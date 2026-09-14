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
    const mediaRecorderRef = useRef(null);

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

    // Timer for each 4-second recording window
    const windowTimerRef = useRef(null);

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
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

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

            // Start first 4-second window
            startNewAudioWindow(stream);

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

    // --------------------------------------------------
    // Create one COMPLETE 4-second audio file
    // --------------------------------------------------

    const startNewAudioWindow = (stream) => {
        if (!recordingActiveRef.current) {
            return;
        }

        const windowNumber =
            windowCounterRef.current++;

        const windowStart =
            (Date.now() - sessionStartRef.current) / 1000;

        const windowEnd =
            windowStart + 4;

        let mimeType = "";

        if (
            MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
        ) {
            mimeType = "audio/webm;codecs=opus";
        } else if (
            MediaRecorder.isTypeSupported(
                "audio/webm"
            )
        ) {
            mimeType = "audio/webm";
        }

        let recorder;

        try {
            recorder = mimeType
                ? new MediaRecorder(stream, {
                    mimeType,
                })
                : new MediaRecorder(stream);
        } catch (err) {
            console.error(
                "Could not create MediaRecorder:",
                err
            );

            setError(
                "Your browser does not support the required audio recorder."
            );

            return;
        }

        mediaRecorderRef.current = recorder;

        const chunks = [];

        // ------------------------------------------------
        // Collect this window's audio
        // ------------------------------------------------

        recorder.ondataavailable = (event) => {
            if (
                event.data &&
                event.data.size > 0
            ) {
                chunks.push(event.data);
            }
        };

        // ------------------------------------------------
        // When this 4-second recorder stops
        // ------------------------------------------------

        recorder.onstop = () => {
            const blob = new Blob(chunks, {
                type:
                    recorder.mimeType ||
                    "audio/webm",
            });

            console.log(
                "Completed audio window:",
                Math.round(
                    blob.size / 1024
                ),
                "KB"
            );

            // Put complete file into analysis queue
            analysisQueueRef.current.push({
                blob,
                windowNumber,
                windowStart,
                windowEnd,
            });

            processAnalysisQueue();

            // Immediately start the next window
            if (
                recordingActiveRef.current &&
                streamRef.current
            ) {
                startNewAudioWindow(
                    streamRef.current
                );
            }
        };

        recorder.onerror = (event) => {
            console.error(
                "MediaRecorder error:",
                event
            );

            setError(
                "The microphone recorder encountered an error."
            );
        };

        // ------------------------------------------------
        // Start recording this window
        // ------------------------------------------------

        recorder.start();

        console.log(
            "Started new 4-second audio window."
        );

        // ------------------------------------------------
        // Stop THIS recorder after 4 seconds
        // ------------------------------------------------

        windowTimerRef.current =
            setTimeout(() => {
                if (
                    recorder &&
                    recorder.state === "recording"
                ) {
                    recorder.stop();
                }
            }, 4000);
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

            formData.append(
                "file",
                audioBlob,
                "live_audio.webm"
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

        const aiResults = results.filter(
            (result) => result.status === "AI"
        );

        const genuineResults = results.filter(
            (result) => result.status === "GENUINE"
        );

        const isAI = aiResults.length > 0;

        const strongestResult = results.reduce(
            (strongest, current) =>
                current.aiProbability >
                    strongest.aiProbability
                    ? current
                    : strongest
        );

        const duration =
            sessionStartRef.current
                ? (Date.now() -
                    sessionStartRef.current) /
                1000
                : 0;

        if (isHistoryAutoSaveEnabled()) {

            saveHistory({
                source: "Live Voice",
                verdict: isAI ? "AI" : "GENUINE",
                confidence: Number(
                    strongestResult.confidence ||
                    strongestResult.aiProbability ||
                    0
                ),
                peakAi: Number(
                    strongestResult.aiProbability ||
                    0
                ),
                averageAi: Number(
                    sessionResultsRef.current.reduce(
                        (sum, result) =>
                            sum + Number(result.aiProbabilityAverage || 0),
                        0
                    ) / sessionResultsRef.current.length
                ),
                genuineProbability: Number(
                    strongestResult.genuineProbability ||
                    0
                ),
                duration: Number(duration.toFixed(1)),
                windowsAnalyzed: windowCounterRef.current,
                model: strongestResult.model || "DF-Arena 1B",
            });

        }

        sessionSavedRef.current = true;

        console.log(
            "VIGIL live session saved to history."
        );
    };


    const stopRecording = () => {
        console.log("Stopping live detection...");

        // Prevent another window from starting
        recordingActiveRef.current = false;

        // Stop the current window timer
        if (windowTimerRef.current) {
            clearTimeout(windowTimerRef.current);
            windowTimerRef.current = null;
        }

        // Stop the current recorder.
        // Its onstop callback will push the final window
        // into the analysis queue.
        const recorder = mediaRecorderRef.current;

        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
        }

        // Stop microphone activity animation
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
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

        // IMPORTANT:
        // Do NOT immediately clear mediaRecorderRef here.
        // The recorder's onstop callback still needs to finish.

        analyserRef.current = null;

        setAudioLevel(0);
        setIsRecording(false);

        const waitForFinalAnalysis = () => {

            if (sessionSavedRef.current) {
                return;
            }

            const recorderStillActive =
                mediaRecorderRef.current &&
                mediaRecorderRef.current.state !== "inactive";

            const queueStillProcessing =
                processingQueueRef.current ||
                analysisQueueRef.current.length > 0;

            if (
                recorderStillActive ||
                queueStillProcessing
            ) {
                sessionFinalizeTimerRef.current =
                    setTimeout(
                        waitForFinalAnalysis,
                        250
                    );

                return;
            }

            // The final recorder has stopped and
            // all queued windows have been analyzed.
            finalizeSessionHistory();

            mediaRecorderRef.current = null;
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

            if (windowTimerRef.current) {
                clearTimeout(
                    windowTimerRef.current
                );
            }

            if (
                mediaRecorderRef.current &&
                mediaRecorderRef.current.state !==
                "inactive"
            ) {
                mediaRecorderRef.current.stop();
            }

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