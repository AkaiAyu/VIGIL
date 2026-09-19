import { useEffect, useRef, useState } from "react";
import {
    saveHistory,
    isHistoryAutoSaveEnabled,
    isConfidenceVisible,
} from "../utils/history";
import {
    Phone,
    PhoneOff,
    Mic,
    MicOff,
    Wifi,
    Volume2,
    VolumeX,
    ShieldCheck,
    ShieldOff,
} from "lucide-react";

const ROOM_ID = "vigil-demo";

function VoIPDetector() {

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const [isIncomingMuted, setIsIncomingMuted] = useState(false);
    const [isDetectorEnabled, setIsDetectorEnabled] = useState(true);

    const [error, setError] = useState(null);

    const [connectionState, setConnectionState] = useState("offline");
    const [callRole, setCallRole] = useState("unknown");

    const [detectionResult, setDetectionResult] = useState(null);
    const [voiceStatus, setVoiceStatus] = useState("standby");
    const [analysisCount, setAnalysisCount] = useState(0);

    const localStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const websocketRef = useRef(null);
    const remoteAudioRef = useRef(null);

    const remoteStreamRef = useRef(null);

    const detectorEnabledRef = useRef(true);

    const remoteWindowNumberRef = useRef(0);

    // PCM remote-audio pipeline
    const remoteAudioContextRef = useRef(null);
    const remoteAudioSourceRef = useRef(null);
    const remotePcmWorkletRef = useRef(null);
    const remoteSilentGainRef = useRef(null);

    // Detection queue
    const remoteAnalysisQueueRef = useRef([]);
    const remoteProcessingRef = useRef(false);

    const pendingCandidatesRef = useRef([]);
    const callSessionRef = useRef(0);

    const voipSessionResultsRef = useRef([]);
    const voipSessionStartRef = useRef(null);
    const voipHistorySavedRef = useRef(false);

    const voipProcessingRef = useRef(false);
    const voipFinalizeTimerRef = useRef(null);

    const cleanup = () => {

        if (voipFinalizeTimerRef.current) {
            clearTimeout(
                voipFinalizeTimerRef.current
            );

            voipFinalizeTimerRef.current = null;
        }

        // Invalidate all pending detection requests
        callSessionRef.current += 1;


        if (remotePcmWorkletRef.current) {
            remotePcmWorkletRef.current.port.postMessage("reset");
            remotePcmWorkletRef.current.disconnect();
            remotePcmWorkletRef.current = null;
        }

        if (remoteAudioSourceRef.current) {
            remoteAudioSourceRef.current.disconnect();
            remoteAudioSourceRef.current = null;
        }

        if (remoteSilentGainRef.current) {
            remoteSilentGainRef.current.disconnect();
            remoteSilentGainRef.current = null;
        }

        if (remoteAudioContextRef.current) {
            remoteAudioContextRef.current.close();
            remoteAudioContextRef.current = null;
        }

        remoteStreamRef.current = null;

        remoteAnalysisQueueRef.current = [];
        remoteProcessingRef.current = false;

        remoteWindowNumberRef.current = 0;

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (websocketRef.current) {
            websocketRef.current.close();
            websocketRef.current = null;
        }

        if (localStreamRef.current) {

            localStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());

            localStreamRef.current = null;
        }

        pendingCandidatesRef.current = [];

        setIsConnected(false);
        setIsConnecting(false);
        setIsMuted(false);
        setIsIncomingMuted(false);
        setIsDetectorEnabled(true);

        detectorEnabledRef.current = true;

        setConnectionState("offline");
        setCallRole("unknown");

        // Clear previous call's detection data
        setDetectionResult(null);
        setVoiceStatus("standby");
        setAnalysisCount(0);
    };


    const startLocalMicrophone = async (peerConnection) => {
        // Don't create another microphone stream
        if (localStreamRef.current) {
            return localStreamRef.current;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            },
            video: false,
        });

        const audioTrack = stream.getAudioTracks()[0];

        console.log("VIGIL VOIP MIC SETTINGS:", audioTrack.getSettings());
        console.log("VIGIL VOIP MIC CAPABILITIES:", audioTrack.getCapabilities());

        localStreamRef.current = stream;

        stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream);
        });

        console.log("Caller microphone started.");

        return stream;
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


    const analyzeRemoteAudioWindow = async (
        blob,
        windowNumber,
        sessionId
    ) => {

        try {

            // Mark this VoIP window as being processed.
            voipProcessingRef.current = true;

            // Ignore audio from an old call session
            if (sessionId !== callSessionRef.current) {
                return;
            }

            if (!detectorEnabledRef.current) {
                console.log(
                    "VIGIL detector disabled. Ignoring completed detection."
                );
                return;
            }

            setVoiceStatus("analyzing");

            const formData = new FormData();

            formData.append(
                "file",
                blob,
                `voip_window_${windowNumber}.wav`
            );

            console.log(
                `Sending VoIP audio window ${windowNumber} to VIGIL...`
            );

            const response = await fetch(
                "http://127.0.0.1:8000/api/live-detect",
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!response.ok) {

                throw new Error(
                    `Detection server returned ${response.status}`
                );
            }

            const data = await response.json();

            console.log(
                "VIGIL VoIP detection:",
                data
            );

            // The call may have ended while the backend was processing.
            // Ignore this old response if the session has changed.
            if (sessionId !== callSessionRef.current) {
                return;
            }

            if (data.speech_detected === false) {

                setDetectionResult(null);
                setVoiceStatus("silence");

                return;
            }

            if (data.detection) {

                const result = data.detection;

                voipSessionResultsRef.current.push({
                    verdict: result.verdict,

                    confidence:
                        Number(result.confidence) || 0,

                    aiProbability:
                        Number(
                            result.maximum_ai_probability
                        ) || 0,

                    aiProbabilityAverage:
                        Number(
                            result.ai_probability
                        ) || 0,

                    genuineProbability:
                        Number(
                            result.genuine_probability
                        ) || 0,

                    model:
                        result.model || "DF-Arena 1B",
                });

                setDetectionResult(result);

                setVoiceStatus("speech");

                setAnalysisCount(
                    (previous) => previous + 1
                );
            }

        } catch (error) {

            console.error(
                "VoIP audio analysis failed:",
                error
            );

            setError(
                `Voice analysis failed: ${error.message}`
            );

            setVoiceStatus("standby");

        } finally {

            voipProcessingRef.current = false;
        }
    };


    const processRemoteAnalysisQueue = async () => {
        if (remoteProcessingRef.current) {
            return;
        }

        remoteProcessingRef.current = true;

        try {
            while (
                remoteAnalysisQueueRef.current.length > 0
            ) {
                const item =
                    remoteAnalysisQueueRef.current.shift();

                if (!item) {
                    continue;
                }

                await analyzeRemoteAudioWindow(
                    item.blob,
                    item.windowNumber,
                    item.sessionId
                );
            }
        } finally {
            remoteProcessingRef.current = false;
        }
    };


    const startRemotePCMRecording = async (stream) => {
        const sessionId = callSessionRef.current;

        if (!detectorEnabledRef.current) {
            return;
        }

        if (!stream) {
            return;
        }

        if (!stream.getAudioTracks().length) {
            console.error(
                "Remote stream has no audio tracks."
            );
            return;
        }

        try {
            console.log(
                "Starting VIGIL PCM analysis of remote WebRTC audio."
            );

            // Create AudioContext
            const audioContext =
                new AudioContext();

            remoteAudioContextRef.current =
                audioContext;

            if (audioContext.state === "suspended") {
                await audioContext.resume();
            }

            console.log(
                "REMOTE AUDIO SAMPLE RATE:",
                audioContext.sampleRate
            );

            // Load the same AudioWorklet used by Live Voice
            await audioContext.audioWorklet.addModule(
                "/src/pcm-recorder-worklet.js"
            );

            const source =
                audioContext.createMediaStreamSource(
                    stream
                );

            remoteAudioSourceRef.current =
                source;

            const worklet =
                new AudioWorkletNode(
                    audioContext,
                    "pcm-recorder-processor"
                );

            remotePcmWorkletRef.current =
                worklet;

            // Keep the AudioWorklet alive without
            // sending remote audio to the speakers.
            const silentGain =
                audioContext.createGain();

            silentGain.gain.value = 0;

            remoteSilentGainRef.current =
                silentGain;

            source.connect(worklet);
            worklet.connect(silentGain);
            silentGain.connect(
                audioContext.destination
            );

            worklet.port.onmessage = (event) => {
                if (event.data?.type !== "audio") {
                    return;
                }

                if (!detectorEnabledRef.current) {
                    return;
                }

                const samples =
                    event.data.samples;

                const sampleRate =
                    event.data.sampleRate;

                if (!samples || !samples.length) {
                    return;
                }

                const duration =
                    samples.length / sampleRate;

                console.log(
                    "VOIP PCM WINDOW:",
                    {
                        samples: samples.length,
                        sampleRate,
                        duration,
                    }
                );

                const blob =
                    float32ToWavBlob(
                        samples,
                        sampleRate
                    );

                const windowNumber =
                    remoteWindowNumberRef.current;

                remoteWindowNumberRef.current += 1;

                remoteAnalysisQueueRef.current.push({
                    blob,
                    windowNumber,
                    sessionId,
                });

                processRemoteAnalysisQueue();
            };

            worklet.port.onmessageerror = (error) => {
                console.error(
                    "Remote PCM worklet message error:",
                    error
                );
            };

            worklet.onprocessorerror = (error) => {
                console.error(
                    "Remote PCM processor error:",
                    error
                );
            };

            console.log(
                "Started 4-second remote PCM analysis."
            );

        } catch (error) {
            console.error(
                "Failed to start remote PCM analysis:",
                error
            );

            setError(
                `Remote audio analysis failed: ${error.message}`
            );
        }
    };


    const createPeerConnection = () => {

        const peerConnection = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
            ],
        });


        peerConnection.onicecandidate = (event) => {

            if (
                event.candidate &&
                websocketRef.current &&
                websocketRef.current.readyState === WebSocket.OPEN
            ) {

                websocketRef.current.send(
                    JSON.stringify({
                        type: "ice-candidate",
                        candidate: event.candidate,
                    })
                );
            }
        };


        peerConnection.ontrack = (event) => {

            console.log(
                "Remote audio received."
            );


            const remoteStream =
                event.streams[0];


            remoteStreamRef.current =
                remoteStream;


            // ---------------------------------------------
            // Play the remote call audio
            // ---------------------------------------------

            if (remoteAudioRef.current) {

                remoteAudioRef.current.srcObject =
                    remoteStream;

                remoteAudioRef.current
                    .play()
                    .catch((error) => {

                        console.log(
                            "Autoplay waiting for user interaction:",
                            error
                        );

                    });
            }


            // ---------------------------------------------
            // Start VIGIL analysis on the received audio
            // ---------------------------------------------

            console.log(
                "Starting VIGIL analysis of remote WebRTC audio."
            );

            remoteWindowNumberRef.current = 0;

            startRemotePCMRecording(
                remoteStream
            );
        };


        peerConnection.onconnectionstatechange = () => {

            const state =
                peerConnection.connectionState;

            console.log(
                "WebRTC connection state:",
                state
            );

            setConnectionState(state);

            if (state === "connected") {
                setIsConnected(true);
                setIsConnecting(false);
            }

            if (
                state === "failed" ||
                state === "disconnected" ||
                state === "closed"
            ) {
                setIsConnected(false);
            }
        };


        peerConnectionRef.current =
            peerConnection;

        return peerConnection;
    };


    const handleOffer = async (offer) => {

        const peerConnection =
            peerConnectionRef.current;

        if (!peerConnection) {
            return;
        }

        console.log("Received WebRTC offer.");

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );


        for (
            const candidate
            of pendingCandidatesRef.current
        ) {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        }

        pendingCandidatesRef.current = [];


        const answer =
            await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(
            answer
        );


        if (
            websocketRef.current &&
            websocketRef.current.readyState ===
            WebSocket.OPEN
        ) {

            websocketRef.current.send(
                JSON.stringify({
                    type: "answer",
                    answer: answer,
                })
            );
        }
    };


    const handleAnswer = async (answer) => {

        const peerConnection =
            peerConnectionRef.current;

        if (!peerConnection) {
            return;
        }

        console.log("Received WebRTC answer.");

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
        );

        for (
            const candidate
            of pendingCandidatesRef.current
        ) {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        }

        pendingCandidatesRef.current = [];
    };


    const handleIceCandidate = async (candidate) => {

        const peerConnection =
            peerConnectionRef.current;

        if (!peerConnection) {
            return;
        }

        if (peerConnection.remoteDescription) {

            try {

                await peerConnection.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );

            } catch (error) {

                console.error(
                    "Failed to add ICE candidate:",
                    error
                );
            }

        } else {

            pendingCandidatesRef.current.push(
                candidate
            );
        }
    };


    const startCall = async () => {
        try {
            // Create a new session for every call
            callSessionRef.current += 1;

            setError(null);
            setIsConnecting(true);
            setConnectionState("connecting");
            setCallRole("unknown");

            voipSessionResultsRef.current = [];
            voipSessionStartRef.current = Date.now();
            voipHistorySavedRef.current = false;

            console.log("Starting VIGIL VoIP session...");

            // --------------------------------------------------
            // 1. Create WebRTC peer connection
            // --------------------------------------------------

            const peerConnection = createPeerConnection();

            peerConnectionRef.current = peerConnection;

            // --------------------------------------------------
            // 2. Connect to signaling server FIRST
            // --------------------------------------------------

            const websocket = new WebSocket(
                `ws://127.0.0.1:8000/ws/${ROOM_ID}`
            );

            websocketRef.current = websocket;

            websocket.onopen = () => {
                console.log("Connected to signaling server.");

                websocket.send(
                    JSON.stringify({
                        type: "join",
                    })
                );
            };

            // --------------------------------------------------
            // 3. Receive signaling messages
            // --------------------------------------------------

            websocket.onmessage = async (event) => {
                const message = JSON.parse(event.data);

                console.log("Signaling message:", message);

                // ==============================================
                // FIRST CLIENT → CALLER
                // ==============================================

                if (message.type === "waiting") {
                    console.log(
                        "No other participant yet. This browser is the CALLER."
                    );

                    setCallRole("caller");
                    setConnectionState("waiting");
                    setIsConnecting(true);

                    // IMPORTANT:
                    // We DO NOT start the microphone yet.
                    //
                    // We wait until another browser joins.
                    return;
                }

                // ==============================================
                // SECOND CLIENT → VIGIL MONITOR
                // ==============================================

                if (message.type === "peer-present") {
                    console.log(
                        "Another participant already exists. This browser is the VIGIL MONITOR."
                    );

                    setCallRole("monitor");
                    setConnectionState("connecting");
                    setIsConnecting(true);

                    // IMPORTANT:
                    // NO getUserMedia()
                    //
                    // This browser will only receive
                    // the caller's WebRTC audio.
                    return;
                }

                // ==============================================
                // CALLER: SECOND PARTICIPANT JOINED
                // ==============================================

                if (message.type === "peer-joined") {
                    console.log(
                        "Participant joined. Starting caller microphone..."
                    );

                    setCallRole("caller");
                    setConnectionState("connecting");

                    try {
                        // NOW we get the microphone.
                        await startLocalMicrophone(peerConnection);

                        console.log(
                            "Caller microphone ready. Creating offer..."
                        );

                        const offer =
                            await peerConnection.createOffer();

                        await peerConnection.setLocalDescription(
                            offer
                        );

                        websocket.send(
                            JSON.stringify({
                                type: "offer",
                                offer: offer,
                            })
                        );

                        console.log("Offer sent.");
                    } catch (microphoneError) {
                        console.error(
                            "Could not start caller microphone:",
                            microphoneError
                        );

                        setError(
                            "Microphone permission is required for the caller."
                        );

                        setIsConnecting(false);
                    }

                    return;
                }

                // ==============================================
                // RECEIVER: OFFER RECEIVED
                // ==============================================

                if (message.type === "offer") {
                    console.log(
                        "Offer received. This browser is the VIGIL MONITOR."
                    );

                    setCallRole("monitor");

                    await handleOffer(
                        message.offer
                    );

                    return;
                }

                // ==============================================
                // CALLER: ANSWER RECEIVED
                // ==============================================

                if (message.type === "answer") {
                    console.log("Answer received.");

                    await handleAnswer(
                        message.answer
                    );

                    return;
                }

                // ==============================================
                // ICE CANDIDATE
                // ==============================================

                if (message.type === "ice-candidate") {
                    await handleIceCandidate(
                        message.candidate
                    );

                    return;
                }

                // ==============================================
                // OTHER PEER LEFT
                // ==============================================

                if (message.type === "peer-left") {

                    console.log(
                        "Other participant disconnected."
                    );

                    setError(
                        "The other participant ended the call."
                    );

                    finalizeVoipSession();

                    return;
                }
            };

            websocket.onerror = (event) => {
                console.error(
                    "WebSocket error:",
                    event
                );

                setError(
                    "Could not connect to the signaling server."
                );

                setIsConnecting(false);
                setConnectionState("offline");
            };

            websocket.onclose = () => {
                console.log(
                    "Signaling WebSocket closed."
                );
            };

        } catch (error) {
            console.error(
                "Could not start VoIP session:",
                error
            );

            setError(
                error.message ||
                "Could not start the VoIP session."
            );

            setIsConnecting(false);
            setConnectionState("offline");
        }
    };


    const saveVoipSessionToHistory = () => {

        if (voipHistorySavedRef.current) {
            return;
        }

        const results =
            voipSessionResultsRef.current;

        if (!results || results.length === 0) {
            return;
        }

        // --------------------------------------------------
        // Only speech windows participate in the
        // session-level AI/Genuine decision.
        //
        // Silence windows are never stored in
        // voipSessionResultsRef because VAD filters them
        // before DF-Arena analysis.
        // --------------------------------------------------

        const speechResults = results.filter(
            (result) =>
                result.verdict === "AI" ||
                result.verdict === "GENUINE"
        );

        if (speechResults.length === 0) {
            return;
        }

        // --------------------------------------------------
        // WINDOW COUNTS
        //
        // remoteWindowNumberRef is incremented whenever
        // a complete 4-second remote audio window is
        // captured.
        // --------------------------------------------------

        const totalWindows =
            remoteWindowNumberRef.current;

        const speechWindows =
            speechResults.length;

        const aiWindows =
            speechResults.filter(
                (result) => result.verdict === "AI"
            ).length;

        const genuineWindows =
            speechResults.filter(
                (result) => result.verdict === "GENUINE"
            ).length;

        const silenceWindows =
            Math.max(
                0,
                totalWindows - speechWindows
            );

        // --------------------------------------------------
        // SESSION-LEVEL AI PROBABILITY
        //
        // Average the AI probability of ALL speech
        // windows.
        //
        // A single extreme window does NOT decide the
        // complete VoIP session.
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
        // Kept only as forensic information.
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
        //
        // SAME LOGIC AS LIVE VOICE
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
            voipSessionStartRef.current
                ? (
                    (Date.now() -
                        voipSessionStartRef.current) /
                    1000
                )
                : 0;

        // --------------------------------------------------
        // SAVE TO HISTORY
        // --------------------------------------------------

        if (isHistoryAutoSaveEnabled()) {

            saveHistory({

                source: "VoIP Monitor",

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
                // for forensic reference only
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

                // Threshold used for session decision
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

        voipHistorySavedRef.current = true;

        console.log(
            "VIGIL VoIP session saved to history:",
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


    const finalizeVoipSession = () => {

        if (voipHistorySavedRef.current) {
            return;
        }

        const analysisStillProcessing =
            voipProcessingRef.current ||
            remoteProcessingRef.current ||
            remoteAnalysisQueueRef.current.length > 0;

        if (analysisStillProcessing) {
            voipFinalizeTimerRef.current =
                setTimeout(
                    finalizeVoipSession,
                    250
                );

            return;
        }

        console.log(
            "Final VoIP analysis completed. Saving session history."
        );

        saveVoipSessionToHistory();

        cleanup();
    };


    const endCall = () => {
        console.log(
            "Ending VoIP call and waiting for final analysis..."
        );

        finalizeVoipSession();
    };


    const toggleMute = () => {

        if (!localStreamRef.current) {
            return;
        }

        const audioTracks =
            localStreamRef.current
                .getAudioTracks();

        audioTracks.forEach((track) => {

            track.enabled = isMuted;

        });

        setIsMuted(
            (previous) => !previous
        );
    };


    const toggleIncomingMute = () => {
        if (!remoteAudioRef.current) {
            return;
        }

        const nextMuted = !remoteAudioRef.current.muted;

        remoteAudioRef.current.muted = nextMuted;

        setIsIncomingMuted(nextMuted);
    };


    const toggleDetector = async () => {
        if (
            callRole !== "monitor" ||
            !isConnected
        ) {
            return;
        }

        const nextEnabled =
            !detectorEnabledRef.current;

        detectorEnabledRef.current =
            nextEnabled;

        setIsDetectorEnabled(nextEnabled);

        if (!nextEnabled) {
            console.log(
                "VIGIL detector disabled."
            );

            // Stop the current PCM worklet.
            if (remotePcmWorkletRef.current) {
                remotePcmWorkletRef.current.port.postMessage(
                    "reset"
                );

                remotePcmWorkletRef.current.disconnect();
                remotePcmWorkletRef.current = null;
            }

            // Disconnect the remote audio source.
            if (remoteAudioSourceRef.current) {
                remoteAudioSourceRef.current.disconnect();
                remoteAudioSourceRef.current = null;
            }

            // Disconnect the silent output node.
            if (remoteSilentGainRef.current) {
                remoteSilentGainRef.current.disconnect();
                remoteSilentGainRef.current = null;
            }

            // Close the AudioContext completely.
            if (remoteAudioContextRef.current) {
                try {
                    await remoteAudioContextRef.current.close();
                } catch (error) {
                    console.warn(
                        "Could not close remote AudioContext:",
                        error
                    );
                }

                remoteAudioContextRef.current = null;
            }

            // Discard any queued windows.
            remoteAnalysisQueueRef.current = [];

            setVoiceStatus("standby");
            setDetectionResult(null);

        } else {
            console.log(
                "VIGIL detector enabled."
            );

            // Start a fresh detection pipeline.
            if (remoteStreamRef.current) {
                await startRemotePCMRecording(
                    remoteStreamRef.current
                );
            }
        }
    };


    useEffect(() => {

        return () => {

            cleanup();

        };

    }, []);


    return (

        <div className="voip-detector">

            <div className="voip-card">


                {/* HEADER */}

                <div className="voip-header">

                    <div>

                        <span className="small-label">
                            SECURE VOICE CHANNEL
                        </span>

                        <h2>
                            VoIP Voice Analysis
                        </h2>

                        <p>
                            Establish an internet voice
                            connection and analyze the
                            received speech for synthetic
                            or cloned voice patterns.
                        </p>

                    </div>


                    <div className="voip-header-right">

                        {callRole === "caller" && (
                            <div className="voip-role caller-role">
                                🎤 CALLER
                            </div>
                        )}

                        {callRole === "monitor" && (
                            <div className="voip-role monitor-role">
                                🛡️ VIGIL MONITOR
                            </div>
                        )}


                        <div className="voip-status">

                            <span
                                className={`status-dot ${isConnected
                                    ? "connected"
                                    : ""
                                    }`}
                            />

                            {isConnected
                                ? "CONNECTED"
                                : isConnecting
                                    ? "CONNECTING"
                                    : "OFFLINE"}

                        </div>

                    </div>

                </div>


                {/* CALL AREA */}

                <div className="voip-call-area">

                    <div className="connection-icon">

                        <Wifi size={32} />

                    </div>


                    <div className="connection-title">

                        {callRole === "caller" && !isConnected
                            ? "Waiting for participant..."
                            : callRole === "caller" && isConnected
                                ? "Voice channel active"
                                : callRole === "monitor" && !isConnected
                                    ? "Connecting to caller..."
                                    : callRole === "monitor" && isConnected
                                        ? "Monitoring incoming voice..."
                                        : isConnecting
                                            ? "Establishing WebRTC connection..."
                                            : "Ready to connect"}

                    </div>


                    <div className="connection-description">
                        {callRole === "caller" && !isConnected
                            ? "Waiting for another VIGIL participant to join."
                            : callRole === "caller" && isConnected
                                ? "Your microphone is sending voice through the WebRTC channel."
                                : callRole === "monitor" && !isConnected
                                    ? "Waiting to establish the incoming voice channel."
                                    : callRole === "monitor" && isConnected
                                        ? isDetectorEnabled
                                            ? "Incoming voice is being monitored by VIGIL."
                                            : "Incoming voice is connected, but VIGIL detection is paused."
                                        : isConnecting
                                            ? "Establishing WebRTC connection..."
                                            : "Open VIGIL in two browser windows and start a call in each window."}
                    </div>


                    <div className="call-controls">

                        {!isConnected ? (

                            <button
                                className="call-button"
                                onClick={startCall}
                                disabled={isConnecting}
                            >

                                <Phone size={20} />

                                {isConnecting
                                    ? "CONNECTING..."
                                    : "START CALL"}

                            </button>

                        ) : (

                            <>
                                {/* Existing microphone button */}
                                <button
                                    className={`control-button ${isMuted ? "muted" : ""
                                        } ${callRole === "monitor"
                                            ? "microphone-disabled"
                                            : ""
                                        }`}
                                    onClick={toggleMute}
                                    disabled={callRole === "monitor"}
                                    title={
                                        callRole === "monitor"
                                            ? "Microphone disabled for VIGIL Monitor"
                                            : isMuted
                                                ? "Unmute microphone"
                                                : "Mute microphone"
                                    }
                                >
                                    {callRole === "monitor" ? (
                                        <MicOff size={20} />
                                    ) : isMuted ? (
                                        <MicOff size={20} />
                                    ) : (
                                        <Mic size={20} />
                                    )}
                                </button>


                                {/* RECEIVER ONLY: Mute incoming voice */}
                                {callRole === "monitor" && (
                                    <button
                                        className={`control-button ${isIncomingMuted
                                            ? "muted"
                                            : ""
                                            }`}
                                        onClick={toggleIncomingMute}
                                        title={
                                            isIncomingMuted
                                                ? "Unmute incoming voice"
                                                : "Mute incoming voice"
                                        }
                                    >
                                        {isIncomingMuted ? (
                                            <VolumeX size={20} />
                                        ) : (
                                            <Volume2 size={20} />
                                        )}
                                    </button>
                                )}


                                {/* RECEIVER ONLY: Enable / disable detector */}
                                {callRole === "monitor" && (
                                    <button
                                        className={`control-button ${!isDetectorEnabled
                                            ? "muted"
                                            : ""
                                            }`}
                                        onClick={toggleDetector}
                                        title={
                                            isDetectorEnabled
                                                ? "Disable VIGIL detector"
                                                : "Enable VIGIL detector"
                                        }
                                    >
                                        {isDetectorEnabled ? (
                                            <ShieldCheck size={20} />
                                        ) : (
                                            <ShieldOff size={20} />
                                        )}
                                    </button>
                                )}


                                {/* Existing END CALL */}
                                <button
                                    className="end-call-button"
                                    onClick={endCall}
                                >
                                    <PhoneOff size={20} />
                                    END CALL
                                </button>
                            </>

                        )}

                    </div>


                    {connectionState !== "offline" && (

                        <div
                            style={{
                                marginTop: "18px",
                                fontSize: "10px",
                                color: "#60758d",
                                letterSpacing: "1px",
                            }}
                        >

                            WEBRTC:{" "}
                            {connectionState.toUpperCase()}

                        </div>

                    )}


                    {error && (

                        <div className="voip-error">
                            {error}
                        </div>

                    )}

                </div>

                {voiceStatus === "analyzing" && (

                    <div className="voip-analysis-status">

                        ANALYZING RECEIVED VOICE...

                    </div>

                )}

                {voiceStatus === "speech" && !detectionResult && (
                    <div className="voip-analysis-receiving">
                        ● RECEIVING VOICE...
                    </div>
                )}


                {voiceStatus === "silence" && (

                    <div className="voip-analysis-silence">

                        SILENCE / NO SPEECH DETECTED

                    </div>

                )}


                {detectionResult && (

                    <div
                        className={`voip-detection-result ${detectionResult.verdict === "AI"
                            ? "voip-result-ai"
                            : "voip-result-genuine"
                            }`}
                    >

                        <div className="voip-result-label">
                            VIGIL DETECTION
                        </div>

                        <div className="voip-result-title">

                            {detectionResult.verdict === "AI"
                                ? "AI / SPOOF VOICE"
                                : "GENUINE HUMAN VOICE"}

                        </div>

                        {isConfidenceVisible() && (
                            <>
                                <div className="voip-result-score">
                                    {detectionResult.confidence}%
                                </div>

                                <div className="voip-result-subtitle">
                                    Confidence • Window #
                                    {analysisCount}
                                </div>
                            </>
                        )}

                    </div>

                )}


                {/* REMOTE AUDIO */}

                <audio
                    ref={remoteAudioRef}
                    autoPlay
                    playsInline
                    style={{
                        display: "none",
                    }}
                />


                {/* INFO */}

                <div className="voip-info-grid">

                    <div className="voip-info">

                        <span>
                            PROTOCOL
                        </span>

                        <strong>
                            WebRTC
                        </strong>

                    </div>


                    <div className="voip-info">

                        <span>
                            CHANNEL
                        </span>

                        <strong>
                            Peer-to-Peer
                        </strong>

                    </div>


                    <div className="voip-info">

                        <span>
                            DETECTOR
                        </span>

                        <strong>
                            DF-Arena 1B
                        </strong>

                    </div>


                    <div className="voip-info">

                        <span>
                            STATUS
                        </span>

                        <strong>
                            {isConnected
                                ? "ACTIVE"
                                : "READY"}
                        </strong>

                    </div>

                </div>

            </div>

        </div>

    );
}

export default VoIPDetector;