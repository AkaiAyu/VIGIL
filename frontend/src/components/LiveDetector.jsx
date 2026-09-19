import { useEffect, useRef, useState } from "react";
import {
    saveHistory,
    isHistoryAutoSaveEnabled,
    isConfidenceVisible,
} from "../utils/history";
import {
    Mic,
    MicOff,
    Activity,
    ShieldCheck,
    ShieldAlert,
    LoaderCircle,
} from "lucide-react";

function LiveDetector() {
    const [isRecording, setIsRecording] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [detectionResult, setDetectionResult] = useState(null);
    const [detectionHistory, setDetectionHistory] = useState([]);
    const [voiceStatus, setVoiceStatus] = useState("standby");

    const streamRef = useRef(null);

    const pcmWorkletRef = useRef(null);

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);

    const timelineRef = useRef(null);

    const sessionStartRef = useRef(null);
    const windowCounterRef = useRef(0);

    const sessionResultsRef = useRef([]);
    const sessionSavedRef = useRef(false);
    const sessionFinalizeTimerRef = useRef(null);
    const finalizingSessionRef = useRef(false);

    // Prevent starting another recording after Stop
    const recordingActiveRef = useRef(false);

    // --------------------------------------------------
    // Analysis queue
    // --------------------------------------------------

    const analysisQueueRef = useRef([]);
    const processingQueueRef = useRef(false);

    // --------------------------------------------------
    // Start microphone
    // --------------------------------------------------

    const startRecording = async () => {
        try {
            setError(null);
            setDetectionResult(null);
            setDetectionHistory([]);

            sessionStartRef.current = Date.now();
            windowCounterRef.current = 0;

            sessionResultsRef.current = [];
            sessionSavedRef.current = false;
            finalizingSessionRef.current = false;

            if (sessionFinalizeTimerRef.current) {
                clearTimeout(sessionFinalizeTimerRef.current);
                sessionFinalizeTimerRef.current = null;
            }

            const stream =
                await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });

            const audioTrack = stream.getAudioTracks()[0];

            console.log("VIGIL MIC SETTINGS:", audioTrack.getSettings());
            console.log("VIGIL MIC CAPABILITIES:", audioTrack.getCapabilities());

            streamRef.current = stream;
            recordingActiveRef.current = true;

            // ------------------------------------------------
            // Microphone activity analyser
            // ------------------------------------------------

            const audioContext = new AudioContext();

            audioContextRef.current = audioContext;

            const source =
                audioContext.createMediaStreamSource(stream);

            const analyser = audioContext.createAnalyser();

            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;

            source.connect(analyser);

            analyserRef.current = analyser;

            updateAudioLevel();

            setIsRecording(true);

            // Start raw PCM capture through AudioWorklet
            await startPCMRecording(stream);

            console.log(
                "Live microphone recording started."
            );
        } catch (err) {
            console.error(
                "Microphone error:",
                err
            );

            setError(
                "Microphone access was denied or could not be started."
            );
        }
    };


    const float32ToWavBlob = (
        samples,
        sampleRate
    ) => {
        const buffer = new ArrayBuffer(
            44 + samples.length * 2
        );

        const view = new DataView(buffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(
                    offset + i,
                    string.charCodeAt(i)
                );
            }
        };

        writeString(0, "RIFF");

        view.setUint32(
            4,
            36 + samples.length * 2,
            true
        );

        writeString(8, "WAVE");
        writeString(12, "fmt ");

        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);

        view.setUint32(
            24,
            sampleRate,
            true
        );

        view.setUint32(
            28,
            sampleRate * 2,
            true
        );

        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);

        writeString(36, "data");

        view.setUint32(
            40,
            samples.length * 2,
            true
        );

        let offset = 44;

        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(
                -1,
                Math.min(1, samples[i])
            );

            const value =
                sample < 0
                    ? sample * 0x8000
                    : sample * 0x7fff;

            view.setInt16(
                offset,
                value,
                true
            );

            offset += 2;
        }

        return new Blob(
            [view],
            { type: "audio/wav" }
        );
    };

    const startPCMRecording = async (stream) => {
        const audioContext =
            audioContextRef.current;

        if (!audioContext) {
            throw new Error(
                "AudioContext is not available."
            );
        }

        await audioContext.audioWorklet.addModule(
            "/src/pcm-recorder-worklet.js"
        );

        const source =
            audioContext.createMediaStreamSource(
                stream
            );

        const worklet =
            new AudioWorkletNode(
                audioContext,
                "pcm-recorder-processor"
            );

        const silentGain =
            audioContext.createGain();

        silentGain.gain.value = 0;

        source.connect(worklet);
        worklet.connect(silentGain);
        silentGain.connect(
            audioContext.destination
        );

        pcmWorkletRef.current = worklet;

        worklet.port.onmessage = (event) => {
            if (
                !event.data ||
                event.data.type !== "audio"
            ) {
                return;
            }

            const samples =
                new Float32Array(
                    event.data.samples
                );

            const sampleRate =
                event.data.sampleRate;

            console.log(
                "PCM WINDOW RECEIVED:",
                {
                    samples: samples.length,
                    sampleRate,
                    duration:
                        samples.length /
                        sampleRate,
                }
            );

            const wavBlob =
                float32ToWavBlob(
                    samples,
                    sampleRate
                );

            console.log(
                "PCM WAV CREATED:",
                Math.round(
                    wavBlob.size / 1024
                ),
                "KB"
            );

            analysisQueueRef.current.push({
                blob: wavBlob,
                windowNumber:
                    windowCounterRef.current++,
                windowStart:
                    (Date.now() -
                        sessionStartRef.current) /
                    1000,
                windowEnd:
                    (Date.now() -
                        sessionStartRef.current) /
                    1000 +
                    samples.length /
                    sampleRate,
            });

            processAnalysisQueue();
        };
    };


    // --------------------------------------------------
    // Process audio windows sequentially
    // --------------------------------------------------

    const processAnalysisQueue = async () => {
        if (processingQueueRef.current) {
            return;
        }

        if (
            analysisQueueRef.current.length ===
            0
        ) {
            return;
        }

        processingQueueRef.current = true;

        while (
            analysisQueueRef.current.length >
            0
        ) {
            const audioWindow =
                analysisQueueRef.current.shift();

            await sendAudioToBackend(
                audioWindow
            );
        }

        processingQueueRef.current = false;
    };

    // --------------------------------------------------
    // Send complete audio file to backend
    // --------------------------------------------------

    const sendAudioToBackend = async (
        audioWindow
    ) => {

        const {
            blob: audioBlob,
            windowNumber,
            windowStart,
            windowEnd,
        } = audioWindow;

        try {
            setIsAnalyzing(true);
            setError(null);

            // Hide the previous result while this new
            // audio window is being analyzed.
            setDetectionResult(null);
            setVoiceStatus("analyzing");

            const formData = new FormData();

            const fileExtension =
                audioBlob.type === "audio/wav"
                    ? "wav"
                    : "webm";

            formData.append(
                "file",
                audioBlob,
                `live_audio.${fileExtension}`
            );

            console.log(
                "Sending complete audio window to VIGIL backend..."
            );

            const response =
                await fetch(
                    "http://127.0.0.1:8000/api/live-detect",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

            if (!response.ok) {
                let message =
                    "Live detection failed.";

                try {
                    const errorData =
                        await response.json();

                    if (errorData.detail) {
                        message =
                            errorData.detail;
                    }
                } catch {
                    // Ignore JSON parsing errors
                }

                throw new Error(message);
            }

            const data =
                await response.json();

            console.log(
                "LIVE DETECTION RESULT:",
                data
            );

            if (
                data.success &&
                data.speech_detected &&
                data.detection
            ) {
                // Speech exists → show the real AI/Genuine result
                setDetectionResult(data.detection);
                setVoiceStatus("speech");

                const result = {
                    window: windowNumber + 1,
                    start: windowStart,
                    end: windowEnd,
                    status: data.detection.verdict,
                    aiProbability:
                        Number(
                            data.detection.maximum_ai_probability
                        ) || 0,
                };

                sessionResultsRef.current.push({
                    ...result,
                    confidence:
                        Number(
                            data.detection.confidence
                        ) || 0,
                    aiProbabilityAverage:
                        Number(
                            data.detection.ai_probability
                        ) || 0,
                    genuineProbability:
                        Number(
                            data.detection.genuine_probability
                        ) || 0,
                    model:
                        data.detection.model ||
                        "DF-Arena 1B",
                });

                setDetectionHistory((previous) => [
                    ...previous,
                    result,
                ]);
            }

            if (
                data.success &&
                !data.speech_detected
            ) {
                // Silence → remove any previous AI/Genuine score
                setDetectionResult(null);
                setVoiceStatus("silence");

                setDetectionHistory((previous) => [
                    ...previous,
                    {
                        window: windowNumber + 1,
                        start: windowStart,
                        end: windowEnd,
                        status: "SILENCE",
                        aiProbability: null,
                    },
                ]);

                console.log(
                    "No speech detected in this window."
                );
            }
        } catch (err) {
            console.error(
                "Live backend error:",
                err
            );

            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --------------------------------------------------
    // Audio activity meter
    // --------------------------------------------------

    const updateAudioLevel = () => {
        if (!analyserRef.current) {
            return;
        }

        const analyser =
            analyserRef.current;

        const data =
            new Uint8Array(
                analyser.frequencyBinCount
            );

        analyser.getByteFrequencyData(
            data
        );

        let sum = 0;

        for (
            let i = 0;
            i < data.length;
            i++
        ) {
            sum += data[i];
        }

        const average =
            sum / data.length;

        setAudioLevel(average);

        animationRef.current =
            requestAnimationFrame(
                updateAudioLevel
            );
    };

    // --------------------------------------------------
    // Stop microphone
    // --------------------------------------------------

    const finalizeSessionHistory = () => {

        if (sessionSavedRef.current) {
            return;
        }

        const results = sessionResultsRef.current;

        if (!results || results.length === 0) {
            return;
        }

        // --------------------------------------------------
        // Separate speech windows from silence.
        // Silence does NOT participate in the AI probability
        // calculation.
        // --------------------------------------------------

        const speechResults = results.filter(
            (result) =>
                result.status === "AI" ||
                result.status === "GENUINE"
        );

        if (speechResults.length === 0) {
            return;
        }

        // --------------------------------------------------
        // Window counts
        // --------------------------------------------------

        const totalWindows =
            windowCounterRef.current;

        const speechWindows =
            speechResults.length;

        const aiWindows =
            speechResults.filter(
                (result) => result.status === "AI"
            ).length;

        const genuineWindows =
            speechResults.filter(
                (result) => result.status === "GENUINE"
            ).length;

        const silenceWindows =
            Math.max(
                0,
                totalWindows - speechWindows
            );

        // --------------------------------------------------
        // SESSION-LEVEL AI PROBABILITY
        //
        // Average the AI probability of every speech window.
        // One extreme window should NOT decide the entire
        // session.
        // --------------------------------------------------

        const averageAiProbability =
            speechResults.reduce(
                (sum, result) =>
                    sum +
                    Number(
                        result.aiProbabilityAverage || 0
                    ),
                0
            ) / speechResults.length;

        const averageGenuineProbability =
            100 - averageAiProbability;

        // --------------------------------------------------
        // HIGHEST SINGLE-WINDOW AI SCORE
        //
        // This is kept only as forensic information.
        // It does NOT decide the session verdict.
        // --------------------------------------------------

        const peakAiProbability =
            Math.max(
                ...speechResults.map(
                    (result) =>
                        Number(
                            result.aiProbability || 0
                        )
                )
            );

        // --------------------------------------------------
        // FINAL SESSION VERDICT
        // --------------------------------------------------

        const AI_THRESHOLD = 45;

        const isAI =
            averageAiProbability >= AI_THRESHOLD;

        // --------------------------------------------------
        // SESSION CONFIDENCE
        // --------------------------------------------------

        const sessionConfidence = isAI
            ? averageAiProbability
            : averageGenuineProbability;

        // --------------------------------------------------
        // SESSION DURATION
        // --------------------------------------------------

        const duration =
            sessionStartRef.current
                ? (Date.now() -
                    sessionStartRef.current) /
                1000
                : 0;

        // --------------------------------------------------
        // SAVE TO HISTORY
        // --------------------------------------------------

        if (isHistoryAutoSaveEnabled()) {

            saveHistory({

                source: "Live Voice",

                // Final session verdict
                verdict: isAI
                    ? "AI"
                    : "GENUINE",

                // Aggregate session confidence
                confidence:
                    Number(
                        sessionConfidence.toFixed(2)
                    ),

                // Aggregate probabilities
                averageAi:
                    Number(
                        averageAiProbability.toFixed(2)
                    ),

                genuineProbability:
                    Number(
                        averageGenuineProbability.toFixed(2)
                    ),

                // Highest individual window score
                // (for forensic reference only)
                peakAi:
                    Number(
                        peakAiProbability.toFixed(2)
                    ),

                // Window statistics
                windowsAnalyzed:
                    totalWindows,

                speechWindows:
                    speechWindows,

                aiWindows:
                    aiWindows,

                genuineWindows:
                    genuineWindows,

                silenceWindows:
                    silenceWindows,

                // Threshold used for the session decision
                threshold:
                    AI_THRESHOLD,

                duration:
                    Number(
                        duration.toFixed(1)
                    ),

                model:
                    speechResults[0]?.model ||
                    "DF-Arena 1B",
            });
        }

        sessionSavedRef.current = true;

        console.log(
            "VIGIL live session saved to history:",
            {
                verdict: isAI
                    ? "AI"
                    : "GENUINE",

                averageAiProbability,
                averageGenuineProbability,

                peakAiProbability,

                totalWindows,
                speechWindows,
                aiWindows,
                genuineWindows,
                silenceWindows,
            }
        );
    };


    const stopRecording = () => {
        console.log("Stopping live detection...");

        // Prevent another window from starting
        recordingActiveRef.current = false;

        // Stop microphone activity animation
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }


        // Stop PCM AudioWorklet
        if (pcmWorkletRef.current) {
            pcmWorkletRef.current.port.postMessage(
                "reset"
            );

            pcmWorkletRef.current.disconnect();
            pcmWorkletRef.current = null;
        }

        // Stop microphone tracks
        if (streamRef.current) {
            streamRef.current
                .getTracks()
                .forEach((track) => track.stop());

            streamRef.current = null;
        }

        // Close audio analyser
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        analyserRef.current = null;

        setAudioLevel(0);
        setIsRecording(false);

        const waitForFinalAnalysis = () => {

            if (sessionSavedRef.current) {
                return;
            }

            const queueStillProcessing =
                processingQueueRef.current ||
                analysisQueueRef.current.length > 0;

            if (queueStillProcessing) {
                sessionFinalizeTimerRef.current =
                    setTimeout(
                        waitForFinalAnalysis,
                        250
                    );

                return;
            }

            finalizeSessionHistory();

        };

        waitForFinalAnalysis();
    };

    // --------------------------------------------------
    // Cleanup
    // --------------------------------------------------

    useEffect(() => {
        return () => {

            if (sessionFinalizeTimerRef.current) {
                clearTimeout(
                    sessionFinalizeTimerRef.current
                );
            }

            recordingActiveRef.current =
                false;

            if (streamRef.current) {
                streamRef.current
                    .getTracks()
                    .forEach((track) =>
                        track.stop()
                    );
            }

            if (audioContextRef.current) {
                audioContextRef.current.close();
            }

            if (animationRef.current) {
                cancelAnimationFrame(
                    animationRef.current
                );
            }
        };
    }, []);

    useEffect(() => {
        if (!timelineRef.current) {
            return;
        }

        timelineRef.current.scrollTo({
            left: timelineRef.current.scrollWidth,
            behavior: "smooth",
        });
    }, [detectionHistory]);

    // --------------------------------------------------
    // UI values
    // --------------------------------------------------

    const activityPercent =
        Math.min(
            100,
            Math.round(
                (audioLevel / 128) * 100
            )
        );

    const isAI =
        detectionResult?.verdict ===
        "AI";

    const isGenuine =
        detectionResult?.verdict ===
        "GENUINE";

    const isSilence =
        voiceStatus === "silence";

    const totalWindows =
        detectionHistory.length;

    const aiWindows =
        detectionHistory.filter(
            (item) => item.status === "AI"
        ).length;

    const genuineWindows =
        detectionHistory.filter(
            (item) => item.status === "GENUINE"
        ).length;

    const silenceWindows =
        detectionHistory.filter(
            (item) => item.status === "SILENCE"
        ).length;

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <div className="live-detector">

            {/* HEADER */}

            <div className="live-header">

                <div>

                    <div className="section-eyebrow">
                        <Activity size={14} />

                        LIVE AUDIO ANALYSIS
                    </div>

                    <h1>
                        Direct Voice Detection
                    </h1>

                    <p>
                        Speak naturally into your
                        microphone. VIGIL analyzes
                        live speech for synthetic
                        and cloned voice
                        characteristics.
                    </p>

                </div>

                <div
                    className={`live-status ${isRecording
                        ? "active"
                        : "inactive"
                        }`}
                >

                    <span className="status-dot" />

                    {isRecording
                        ? "MICROPHONE ACTIVE"
                        : "STANDBY"}

                </div>

            </div>


            {/* MAIN CARD */}

            <div className="live-main-card">

                <div className="mic-visual">

                    <div
                        className={`mic-ring ${isRecording
                            ? "recording"
                            : ""
                            }`}
                    >

                        <div className="mic-icon">

                            {isRecording ? (
                                <Mic size={42} />
                            ) : (
                                <MicOff size={42} />
                            )}

                        </div>

                    </div>

                </div>


                <div className="live-info">

                    <span className="small-label">
                        INPUT SOURCE
                    </span>

                    <h2>

                        {isRecording
                            ? "Listening to microphone"
                            : "Microphone ready"}

                    </h2>

                    <p>

                        {isRecording
                            ? "Live audio is continuously collected and analyzed in 4-second windows."
                            : "Start the microphone to begin live voice analysis."}

                    </p>


                    {/* ACTIVITY */}

                    <div className="activity-section">

                        <div className="activity-header">

                            <span>
                                MICROPHONE ACTIVITY
                            </span>

                            <span>
                                {activityPercent}%
                            </span>

                        </div>

                        <div className="activity-bar">

                            <div
                                className="activity-fill"
                                style={{
                                    width:
                                        `${activityPercent}%`,
                                }}
                            />

                        </div>

                    </div>


                    {/* BUTTON */}

                    {!isRecording ? (

                        <button
                            className="live-start-button"
                            onClick={
                                startRecording
                            }
                        >

                            <Mic size={19} />

                            Start Live Detection

                        </button>

                    ) : (

                        <button
                            className="live-stop-button"
                            onClick={
                                stopRecording
                            }
                        >

                            <MicOff size={19} />

                            Stop Detection

                        </button>

                    )}


                    {/* ERROR */}

                    {error && (

                        <div className="live-error">

                            <ShieldAlert size={18} />

                            <span>
                                {error}
                            </span>

                        </div>

                    )}

                </div>

            </div>


            {/* DETECTION RESULT */}

            <div
                className={`live-result-card ${isSilence
                    ? "result-silence"
                    : isAI
                        ? "result-ai"
                        : isGenuine
                            ? "result-genuine"
                            : ""
                    }`}
            >

                <div className="result-icon">

                    {isAnalyzing ? (

                        <LoaderCircle
                            size={24}
                            className="spin"
                        />

                    ) : isSilence ? (

                        <Activity
                            size={24}
                        />

                    ) : isAI ? (

                        <ShieldAlert
                            size={24}
                        />

                    ) : (

                        <ShieldCheck
                            size={24}
                        />

                    )}

                </div>


                <div className="result-content">

                    <span className="small-label">
                        VIGIL DETECTION STATUS
                    </span>

                    <h3>

                        {isAnalyzing
                            ? "Analyzing latest voice window..."
                            : isSilence
                                ? "SILENCE / NO SPEECH DETECTED"
                                : isAI
                                    ? "AI / SPOOF VOICE DETECTED"
                                    : isGenuine
                                        ? "GENUINE HUMAN VOICE"
                                        : "Awaiting audio input"}

                    </h3>

                    <p>
                        {isAnalyzing
                            ? "DF-Arena 1B is analyzing the latest speech window."
                            : isSilence
                                ? "No speech was detected in the latest audio window. VIGIL is continuing to listen."
                                : isAI
                                    ? isConfidenceVisible()
                                        ? `Peak AI probability: ${detectionResult.maximum_ai_probability}%.`
                                        : "Synthetic voice characteristics detected."
                                    : isGenuine
                                        ? isConfidenceVisible()
                                            ? `Peak AI probability: ${detectionResult.maximum_ai_probability}%.`
                                            : "Voice appears genuine based on the analyzed window."
                                        : "Start live detection and speak normally."}
                    </p>

                </div>


                {/* SCORE */}

                {detectionResult && isConfidenceVisible() && (

                    <div className="live-score">

                        <strong>
                            {
                                detectionResult
                                    .maximum_ai_probability
                            }%
                        </strong>

                        <span>
                            AI SCORE
                        </span>

                    </div>

                )}

            </div>

            {/* FORENSIC TIMELINE */}

            {detectionHistory.length > 0 && (
                <div className="live-timeline-card">

                    <div className="timeline-header">

                        <div>
                            <span className="small-label">
                                LIVE FORENSIC ANALYSIS
                            </span>

                            <h3>
                                Detection Timeline
                            </h3>
                        </div>

                        <span className="timeline-count">
                            {detectionHistory.length} WINDOWS
                        </span>

                    </div>

                    <div className="timeline-stats">

                        <div className="timeline-stat">
                            <span>WINDOWS</span>
                            <strong>{totalWindows}</strong>
                        </div>

                        <div className="timeline-stat">
                            <span>AI / SPOOF</span>
                            <strong>{aiWindows}</strong>
                        </div>

                        <div className="timeline-stat">
                            <span>GENUINE</span>
                            <strong>{genuineWindows}</strong>
                        </div>

                        <div className="timeline-stat">
                            <span>SILENCE</span>
                            <strong>{silenceWindows}</strong>
                        </div>

                    </div>

                    <div
                        className="timeline-track"
                        ref={timelineRef}
                    >

                        {detectionHistory.map((item) => (

                            <div
                                key={item.window}
                                className={`timeline-window ${item.status === "AI"
                                    ? "timeline-ai"
                                    : item.status === "GENUINE"
                                        ? "timeline-genuine"
                                        : "timeline-silence"
                                    }`}
                                title={
                                    item.status === "SILENCE"
                                        ? `${item.start.toFixed(1)}s – ${item.end.toFixed(1)}s: Silence`
                                        : isConfidenceVisible()
                                            ? `${item.start.toFixed(1)}s – ${item.end.toFixed(1)}s: ${item.status} (${item.aiProbability}%)`
                                            : `${item.start.toFixed(1)}s – ${item.end.toFixed(1)}s: ${item.status}`
                                }
                            >

                                <div className="timeline-window-top">
                                    <span>
                                        {item.window}
                                    </span>

                                    {isConfidenceVisible() && (
                                        item.status === "SILENCE" ? (
                                            <span>—</span>
                                        ) : (
                                            <span>
                                                {item.aiProbability}%
                                            </span>
                                        )
                                    )}
                                </div>

                                <div
                                    className="timeline-window-bar"
                                    style={{
                                        opacity:
                                            item.status === "SILENCE"
                                                ? 0.35
                                                : Math.max(
                                                    0.35,
                                                    item.aiProbability / 100
                                                ),
                                    }}
                                />

                                <div className="timeline-window-time">
                                    {item.start.toFixed(1)}s
                                </div>

                            </div>

                        ))}

                    </div>


                    <div className="timeline-legend">

                        <span>
                            <i className="legend-dot legend-human" />
                            Genuine
                        </span>

                        <span>
                            <i className="legend-dot legend-ai" />
                            AI / Spoof
                        </span>

                        <span>
                            <i className="legend-dot legend-silence" />
                            Silence
                        </span>

                    </div>

                </div>
            )}

        </div>
    );
}

export default LiveDetector;