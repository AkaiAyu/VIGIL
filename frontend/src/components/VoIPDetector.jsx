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
    const [captureProgress, setCaptureProgress] = useState(0);

    const localStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const websocketRef = useRef(null);
    const remoteAudioRef = useRef(null);

    const remoteStreamRef = useRef(null);
    const remoteRecorderRef = useRef(null);
    const detectorEnabledRef = useRef(true);
    const remoteChunksRef = useRef([]);
    const remoteWindowTimerRef = useRef(null);
    const captureProgressIntervalRef = useRef(null);
    const remoteWindowNumberRef = useRef(0);

    const pendingCandidatesRef = useRef([]);
    const callSessionRef = useRef(0);

    const voipSessionResultsRef = useRef([]);
    const voipSessionStartRef = useRef(null);
    const voipHistorySavedRef = useRef(false);

    const voipProcessingRef = useRef(false);
    const voipEndingRef = useRef(false);
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

        if (remoteWindowTimerRef.current) {

            clearTimeout(
                remoteWindowTimerRef.current
            );

            remoteWindowTimerRef.current = null;
        }


        if (captureProgressIntervalRef.current) {
            clearInterval(captureProgressIntervalRef.current);
            captureProgressIntervalRef.current = null;
        }


        if (remoteRecorderRef.current) {

            if (
                remoteRecorderRef.current.state ===
                "recording"
            ) {

                remoteRecorderRef.current.stop();
            }

            remoteRecorderRef.current = null;
        }


        remoteStreamRef.current = null;

        remoteChunksRef.current = [];
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
        setCaptureProgress(0);
    };


    const startLocalMicrophone = async (peerConnection) => {
        // Don't create another microphone stream
        if (localStreamRef.current) {
            return localStreamRef.current;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
        });

        localStreamRef.current = stream;

        stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream);
        });

        console.log("Caller microphone started.");

        return stream;
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
                `voip_window_${windowNumber}.webm`
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


    const startRemoteAudioWindow = (stream) => {

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


        let recorder;

        try {

            recorder = new MediaRecorder(
                stream,
                {
                    mimeType: "audio/webm;codecs=opus",
                }
            );

        } catch (error) {

            console.error(
                "Preferred MediaRecorder format failed:",
                error
            );

            recorder = new MediaRecorder(stream);
        }


        remoteRecorderRef.current =
            recorder;

        remoteChunksRef.current = [];


        recorder.ondataavailable = (event) => {

            if (
                event.data &&
                event.data.size > 0
            ) {

                remoteChunksRef.current.push(
                    event.data
                );
            }
        };


        recorder.onstop = async () => {

            const chunks =
                remoteChunksRef.current;

            remoteChunksRef.current = [];

            // Detector was disabled while this window was recording.
            // Do not send this audio to the backend.
            if (!detectorEnabledRef.current) {
                console.log(
                    "VIGIL detector disabled. Skipping audio analysis."
                );
                return;
            }

            if (chunks.length === 0) {

                console.log(
                    "No remote audio data captured."
                );

                return;
            }


            const blob = new Blob(
                chunks,
                {
                    type:
                        recorder.mimeType ||
                        "audio/webm",
                }
            );


            const windowNumber =
                remoteWindowNumberRef.current;


            remoteWindowNumberRef.current += 1;


            console.log(
                `Remote audio window ${windowNumber} captured:`,
                blob.size,
                "bytes"
            );


            await analyzeRemoteAudioWindow(
                blob,
                windowNumber,
                sessionId
            );


            // Start the next window
            if (
                detectorEnabledRef.current &&
                !voipEndingRef.current &&
                peerConnectionRef.current &&
                peerConnectionRef.current.connectionState ===
                "connected"
            ) {
                startRemoteAudioWindow(stream);
            }
        };


        recorder.onerror = (event) => {

            console.error(
                "Remote MediaRecorder error:",
                event.error
            );
        };

        setCaptureProgress(0);

        captureProgressIntervalRef.current = setInterval(() => {
            setCaptureProgress((previous) => {
                if (previous >= 100) {
                    clearInterval(captureProgressIntervalRef.current);
                    captureProgressIntervalRef.current = null;
                    return 100;
                }

                return previous + 2.5;
            });
        }, 100);

        recorder.start();

        console.log(
            "Started 4-second remote audio window."
        );


        remoteWindowTimerRef.current =
            setTimeout(() => {

                if (
                    recorder &&
                    recorder.state === "recording"
                ) {

                    recorder.stop();

                }

            }, 4000);
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

            startRemoteAudioWindow(
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
            voipEndingRef.current = false;

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

                    voipEndingRef.current = true;

                    if (remoteWindowTimerRef.current) {
                        clearTimeout(
                            remoteWindowTimerRef.current
                        );

                        remoteWindowTimerRef.current = null;
                    }

                    const recorder =
                        remoteRecorderRef.current;

                    if (
                        recorder &&
                        recorder.state !== "inactive"
                    ) {
                        recorder.stop();
                    }

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

        const strongestResult =
            results.reduce(
                (strongest, current) =>
                    current.aiProbability >
                        strongest.aiProbability
                        ? current
                        : strongest
            );

        const aiDetected = results.some(
            (result) =>
                result.verdict === "AI"
        );

        const duration =
            voipSessionStartRef.current
                ? (
                    (Date.now() -
                        voipSessionStartRef.current) /
                    1000
                ).toFixed(1)
                : 0;

        if (isHistoryAutoSaveEnabled()) {

            saveHistory({

                source: "VoIP Monitor",

                verdict: aiDetected
                    ? "AI"
                    : "GENUINE",

                confidence: Number(
                    strongestResult.confidence ||
                    strongestResult.aiProbability ||
                    0
                ),

                peakAi: Number(
                    strongestResult.aiProbability || 0
                ),

                averageAi: Number(
                    strongestResult.aiProbabilityAverage || 0
                ),

                genuineProbability: Number(
                    strongestResult.genuineProbability ||
                    0
                ),

                duration: Number(duration),

                windowsAnalyzed:
                    results.length,

                model:
                    strongestResult.model ||
                    "DF-Arena 1B",
            });

        }

        voipHistorySavedRef.current = true;

        console.log(
            "VIGIL VoIP session saved to history."
        );
    };


    const finalizeVoipSession = () => {

        if (voipHistorySavedRef.current) {
            return;
        }

        const recorder =
            remoteRecorderRef.current;

        const recorderStillActive =
            recorder &&
            recorder.state !== "inactive";

        const analysisStillProcessing =
            voipProcessingRef.current;

        if (
            recorderStillActive ||
            analysisStillProcessing
        ) {
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

        // Tell the recorder that no more windows
        // should be created.
        voipEndingRef.current = true;

        // Stop the current 4-second capture window.
        if (remoteWindowTimerRef.current) {
            clearTimeout(
                remoteWindowTimerRef.current
            );

            remoteWindowTimerRef.current = null;
        }

        const recorder =
            remoteRecorderRef.current;

        if (
            recorder &&
            recorder.state !== "inactive"
        ) {
            recorder.stop();
        }

        // Wait until the recorder's onstop callback
        // and backend analysis have completed.
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


    const toggleDetector = () => {
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

            // Stop the current detection window.
            if (remoteWindowTimerRef.current) {
                clearTimeout(
                    remoteWindowTimerRef.current
                );

                remoteWindowTimerRef.current = null;
            }

            // Stop the current recorder.
            const recorder =
                remoteRecorderRef.current;

            if (
                recorder &&
                recorder.state !== "inactive"
            ) {
                recorder.stop();
            }

            // Stop the visual capture progress.
            if (
                captureProgressIntervalRef.current
            ) {
                clearInterval(
                    captureProgressIntervalRef.current
                );

                captureProgressIntervalRef.current =
                    null;
            }

            remoteChunksRef.current = [];

            setCaptureProgress(0);
            setVoiceStatus("standby");
            setDetectionResult(null);

        } else {
            console.log(
                "VIGIL detector enabled."
            );

            // Start a fresh detection window.
            if (remoteStreamRef.current) {
                startRemoteAudioWindow(
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

                {callRole === "monitor" &&
                    isConnected &&
                    voiceStatus !== "analyzing" &&
                    voiceStatus !== "silence" && (

                        <div className="voip-capture-status">

                            <div className="voip-capture-header">

                                <span>
                                    ● RECEIVING REMOTE VOICE
                                </span>

                                <span>
                                    {Math.round(captureProgress)}%
                                </span>

                            </div>

                            <div className="voip-capture-bar">

                                <div
                                    className="voip-capture-progress"
                                    style={{
                                        width: `${captureProgress}%`
                                    }}
                                />

                            </div>

                            <div className="voip-capture-subtitle">

                                Capturing 4-second analysis window...

                            </div>

                        </div>

                    )}

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