import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
    saveHistory,
    isHistoryAutoSaveEnabled,
    isConfidenceVisible,
} from "../utils/history";
import {
    Upload,
    Play,
    Pause,
    RotateCcw,
    FileAudio,
    X,
    ShieldAlert,
} from "lucide-react";


function AudioAnalyzer() {

    const waveformRef = useRef(null);
    const waveSurferRef = useRef(null);

    const [audioFile, setAudioFile] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);

    const [isPlaying, setIsPlaying] = useState(false);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [error, setError] = useState(null);


    /* ==========================================================
       CREATE WAVEFORM
       ========================================================== */

    useEffect(() => {

        if (!audioUrl || !waveformRef.current) {
            return;
        }

        const wavesurfer = WaveSurfer.create({

            container: waveformRef.current,

            waveColor: "#31547e",

            progressColor: "#4388ff",

            cursorColor: "#7db2ff",

            cursorWidth: 2,

            height: 110,

            barWidth: 2,

            barGap: 2,

            barRadius: 3,

            normalize: true,

            interact: true,

        });


        waveSurferRef.current = wavesurfer;


        wavesurfer.load(audioUrl);


        wavesurfer.on("ready", (audioDuration) => {

            setDuration(audioDuration);

        });


        wavesurfer.on("timeupdate", (time) => {

            setCurrentTime(time);

        });


        wavesurfer.on("play", () => {

            setIsPlaying(true);

        });


        wavesurfer.on("pause", () => {

            setIsPlaying(false);

        });


        wavesurfer.on("finish", () => {

            setIsPlaying(false);

            setCurrentTime(0);

        });


        return () => {

            wavesurfer.destroy();

            waveSurferRef.current = null;

        };

    }, [audioUrl]);


    /* ==========================================================
       FILE SELECTION
       ========================================================== */

    const handleFile = (file) => {

        if (!file) {
            return;
        }


        const supportedTypes = [
            "audio/mpeg",
            "audio/wav",
            "audio/x-wav",
            "audio/mp4",
            "audio/flac",
            "audio/ogg",
            "audio/aac",
        ];


        if (
            !supportedTypes.includes(file.type) &&
            !file.name.match(
                /\.(mp3|wav|m4a|flac|ogg|aac)$/i
            )
        ) {

            alert(
                "Please select a supported audio file."
            );

            return;

        }


        if (audioUrl) {

            URL.revokeObjectURL(audioUrl);

        }


        const newUrl = URL.createObjectURL(file);


        setAudioFile(file);

        setAudioUrl(newUrl);

        setCurrentTime(0);

        setDuration(0);

        setIsPlaying(false);
        setAnalysisResult(null);
        setError(null);

    };


    /* ==========================================================
       FILE INPUT
       ========================================================== */

    const handleInputChange = (event) => {

        const file = event.target.files?.[0];

        handleFile(file);

    };


    /* ==========================================================
       DRAG & DROP
       ========================================================== */

    const handleDrop = (event) => {

        event.preventDefault();

        const file = event.dataTransfer.files?.[0];

        handleFile(file);

    };


    const handleDragOver = (event) => {

        event.preventDefault();

    };


    /* ==========================================================
       PLAY / PAUSE
       ========================================================== */

    const togglePlayback = () => {

        if (!waveSurferRef.current) {
            return;
        }

        waveSurferRef.current.playPause();

    };

    /* ==========================================================
     ANALYZE AUDIO
     ========================================================== */

    const analyzeAudio = async () => {
        if (!audioFile) {
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const formData = new FormData();

            formData.append(
                "file",
                audioFile
            );

            const response = await fetch(
                "http://127.0.0.1:8000/api/detect",
                {
                    method: "POST",
                    body: formData,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    "Voice analysis failed."
                );
            }

            setAnalysisResult(data.detection);

            if (isHistoryAutoSaveEnabled()) {

                saveHistory({
                    source: "Audio Upload",
                    filename: audioFile.name,
                    verdict: data.detection.verdict,
                    confidence: Number(
                        data.detection.confidence
                    ),
                    peakAi: Number(
                        data.detection.maximum_ai_probability
                    ),
                    averageAi: Number(
                        data.detection.ai_probability
                    ),
                    genuineProbability: Number(
                        data.detection.genuine_probability
                    ),
                    windowsAnalyzed: Number(
                        data.detection.windows_analyzed
                    ),
                    duration: Number(duration),
                    model:
                        data.detection.model ||
                        "DF-Arena 1B",
                });

            }
        } catch (error) {
            console.error(
                "VIGIL analysis error:",
                error
            );

            setError(
                error.message ||
                "Unable to connect to VIGIL backend."
            );
        } finally {
            setIsAnalyzing(false);
        }
    };
    /* ==========================================================
       RESET
       ========================================================== */

    const resetAudio = () => {

        if (audioUrl) {

            URL.revokeObjectURL(audioUrl);

        }

        setAudioFile(null);

        setAudioUrl(null);

        setCurrentTime(0);

        setDuration(0);

        setIsPlaying(false);

    };


    /* ==========================================================
       FORMAT TIME
       ========================================================== */

    const formatTime = (seconds) => {

        if (!seconds || Number.isNaN(seconds)) {
            return "00:00";
        }


        const minutes = Math.floor(
            seconds / 60
        );

        const remainingSeconds = Math.floor(
            seconds % 60
        );


        return `${String(minutes).padStart(
            2,
            "0"
        )}:${String(remainingSeconds).padStart(
            2,
            "0"
        )}`;

    };

    /*
   * ==========================================================
   * MERGE SUSPICIOUS DETECTION WINDOWS
   * ==========================================================
   */

    const getSuspiciousRegions = () => {
        if (!analysisResult?.window_results) {
            return [];
        }

        const threshold =
            Number(analysisResult.threshold) || 45;

        const suspiciousWindows =
            analysisResult.window_results
                .filter(
                    (window) =>
                        Number(window.ai_probability) >= threshold
                )
                .map((window) => ({
                    start: Number(window.start) || 0,
                    end: Number(window.end) || 0,
                    probability:
                        Number(window.ai_probability) || 0,
                }))
                .sort((a, b) => a.start - b.start);

        if (suspiciousWindows.length === 0) {
            return [];
        }

        const merged = [];

        for (const current of suspiciousWindows) {
            const previous = merged[merged.length - 1];

            if (
                previous &&
                current.start <= previous.end
            ) {
                previous.end = Math.max(
                    previous.end,
                    current.end
                );

                previous.probability = Math.max(
                    previous.probability,
                    current.probability
                );
            } else {
                merged.push({
                    ...current,
                });
            }
        }

        return merged;
    };

    const suspiciousRegions =
        getSuspiciousRegions();

    const strongestRegion =
        suspiciousRegions.length > 0
            ? suspiciousRegions.reduce((strongest, region) =>
                region.probability > strongest.probability
                    ? region
                    : strongest
            )
            : null;

    /*
     * ==========================================================
     * SEEK TO DETECTION WINDOW
     * ==========================================================
     */

    const seekToWindow = (start) => {
        if (!waveSurferRef.current || !duration) {
            return;
        }

        const time = Number(start);

        if (!Number.isFinite(time)) {
            return;
        }

        waveSurferRef.current.setTime(
            Math.max(0, Math.min(time, duration))
        );
    };

    /* ==========================================================
       RENDER
       ========================================================== */

    return (

        <div className="audio-analyzer">

            {!audioFile ? (

                /* ====================================================
                   EMPTY / UPLOAD STATE
                   ==================================================== */

                <div
                    className="upload-zone"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                >

                    <div className="upload-icon">

                        <Upload size={26} />

                    </div>


                    <h3>
                        Drop an audio file here
                    </h3>


                    <p>
                        or choose a recording from your computer
                    </p>


                    <label className="upload-button">

                        <FileAudio size={15} />

                        Select Audio

                        <input
                            type="file"
                            accept="audio/*"
                            onChange={handleInputChange}
                            hidden
                        />

                    </label>


                    <div className="upload-formats">

                        WAV · MP3 · M4A · FLAC · OGG · AAC

                    </div>

                </div>

            ) : (

                /* ====================================================
                   AUDIO LOADED STATE
                   ==================================================== */

                <div className="audio-workspace">


                    {/* FILE HEADER */}

                    <div className="audio-file-header">

                        <div className="audio-file-info">

                            <div className="audio-file-icon">

                                <FileAudio size={18} />

                            </div>


                            <div>

                                <div className="audio-file-name">

                                    {audioFile.name}

                                </div>


                                <div className="audio-file-meta">

                                    {(audioFile.size / 1024 / 1024).toFixed(
                                        2
                                    )} MB

                                    {" · "}

                                    {formatTime(duration)}

                                </div>

                            </div>

                        </div>


                        <button
                            className="icon-button"
                            onClick={resetAudio}
                            title="Remove audio"
                        >

                            <X size={17} />

                        </button>

                    </div>


                    {/* WAVEFORM */}

                    <div className="waveform-container">

                        <div
                            ref={waveformRef}
                            className="waveform"
                        />

                        {/* Merged suspicious regions */}

                        {analysisResult &&
                            suspiciousRegions.map(
                                (region, index) => {

                                    if (!duration) {
                                        return null;
                                    }

                                    const left =
                                        (region.start / duration) * 100;

                                    const width =
                                        ((region.end - region.start) /
                                            duration) *
                                        100;

                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            className="waveform-detection-region"
                                            style={{
                                                left: `${left}%`,
                                                width: `${width}%`,
                                            }}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                seekToWindow(region.start);
                                            }}
                                            title={`Suspicious speech: ${region.start.toFixed(
                                                1
                                            )}s – ${region.end.toFixed(
                                                1
                                            )}s`}
                                        >
                                            <span className="waveform-region-label">
                                                AI {region.probability.toFixed(1)}%
                                            </span>
                                        </button>
                                    );
                                }
                            )}

                    </div>

                    {analysisResult &&
                        analysisResult.window_results?.some(
                            (window) =>
                                Number(window.ai_probability) >=
                                Number(analysisResult.threshold)
                        ) && (
                            <div className="waveform-alert-note">
                                <span className="waveform-alert-dot" />

                                <span>
                                    Suspicious region detected — click the
                                    highlighted area to inspect it.
                                </span>
                            </div>
                        )}

                    {/* PLAYER CONTROLS */}

                    <div className="audio-controls">

                        <div className="audio-left-controls">

                            <button
                                className="play-button"
                                onClick={togglePlayback}
                            >

                                {isPlaying ? (
                                    <Pause size={17} />
                                ) : (
                                    <Play size={17} />
                                )}



                            </button>


                            <span className="time-display">

                                {formatTime(currentTime)}

                                <span>
                                    {" / "}
                                    {formatTime(duration)}
                                </span>

                            </span>

                        </div>


                    </div>

                    {analysisResult &&
                        suspiciousRegions.length > 0 && (
                            <div className="detection-summary">

                                <div className="detection-summary-icon">
                                    <ShieldAlert size={15} />
                                </div>

                                <div className="detection-summary-content">

                                    <span className="detection-summary-label">
                                        SUSPICIOUS AUDIO DETECTED
                                    </span>

                                    <div className="detection-summary-regions">

                                        {suspiciousRegions.map(
                                            (region, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() =>
                                                        seekToWindow(
                                                            region.start
                                                        )
                                                    }
                                                >
                                                    {region.start.toFixed(1)}s
                                                    {" – "}
                                                    {region.end.toFixed(1)}s
                                                </button>
                                            )
                                        )}

                                    </div>

                                </div>

                            </div>
                        )}


                    {/* ANALYZE BUTTON */}

                    {error && (

                        <div className="analysis-error">

                            <strong>
                                Analysis failed
                            </strong>

                            <span>
                                {error}
                            </span>

                        </div>

                    )}

                    <button
                        className="analyze-button"
                        onClick={analyzeAudio}
                        disabled={isAnalyzing}
                    >

                        {isAnalyzing ? (

                            <>
                                <span className="analyzing-spinner" />

                                Analyzing Voice...

                            </>

                        ) : (

                            <>
                                <RotateCcw size={16} />

                                Analyze Voice

                            </>

                        )}

                    </button>

                    {analysisResult && (

                        <div className="analysis-result">

                            <div className="result-divider" />

                            <div className="result-header">

                                <div>

                                    <div className="card-eyebrow">
                                        VIGIL ANALYSIS COMPLETE
                                    </div>

                                    <h3>
                                        Voice Authenticity Assessment
                                    </h3>

                                </div>

                                <div
                                    className={`result-badge ${analysisResult.verdict === "AI"
                                        ? "ai"
                                        : "genuine"
                                        }`}
                                >

                                    {analysisResult.verdict === "AI"
                                        ? "AI DETECTED"
                                        : "GENUINE VOICE"}

                                </div>

                            </div>


                            <div className="result-metrics">

                                {/* PEAK AI SCORE */}

                                <div className="result-score">

                                    <span className="result-score-label">
                                        PEAK AI SCORE
                                    </span>

                                    {isConfidenceVisible() ? (
                                        <>
                                            <strong>
                                                {analysisResult.maximum_ai_probability}%
                                            </strong>

                                            <div className="score-meter">
                                                <div
                                                    className="score-meter-fill"
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            analysisResult.maximum_ai_probability
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <strong>—</strong>
                                    )}

                                    <span className="result-score-description">
                                        {analysisResult.verdict === "AI"
                                            ? "Strongest suspicious segment"
                                            : "No suspicious segment detected"}
                                    </span>

                                </div>


                                {/* AVERAGE AI SCORE */}

                                <div className="result-stat">

                                    <span>
                                        AVERAGE AI SCORE
                                    </span>

                                    {isConfidenceVisible() ? (
                                        <>
                                            <strong className="ai-value">
                                                {analysisResult.ai_probability}%
                                            </strong>

                                            <div className="mini-meter">
                                                <div
                                                    className="mini-meter-fill ai"
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            analysisResult.ai_probability
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <strong className="ai-value">—</strong>
                                    )}

                                </div>


                                {/* AVERAGE GENUINE SCORE */}

                                <div className="result-stat">

                                    <span>
                                        AVERAGE GENUINE SCORE
                                    </span>

                                    {isConfidenceVisible() ? (
                                        <>
                                            <strong className="genuine-value">
                                                {analysisResult.genuine_probability}%
                                            </strong>

                                            <div className="mini-meter">
                                                <div
                                                    className="mini-meter-fill genuine"
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            analysisResult.genuine_probability
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <strong className="genuine-value">—</strong>
                                    )}

                                </div>


                                {/* WINDOWS */}

                                <div className="result-stat">

                                    <span>
                                        WINDOWS ANALYZED
                                    </span>

                                    <strong>
                                        {analysisResult.windows_analyzed}
                                    </strong>

                                    <small>
                                        ~4.04 sec each
                                    </small>

                                </div>

                            </div>


                            {/* DETECTION TIMELINE */}

                            <div className="timeline-section">

                                <div className="timeline-title">

                                    <span>
                                        DETECTION TIMELINE
                                    </span>

                                    <span>
                                        Threshold: {analysisResult.threshold}%
                                    </span>

                                </div>


                                <div className="timeline">

                                    {analysisResult.window_results.map(
                                        (window, index) => {

                                            const isAI =
                                                window.ai_probability >=
                                                analysisResult.threshold;

                                            return (

                                                <div
                                                    key={index}
                                                    className={`timeline-window ${isAI ? "suspicious" : "normal"
                                                        }`}
                                                >

                                                    <div className="timeline-bar">

                                                        <div
                                                            className="timeline-fill"
                                                            style={{
                                                                width: `${Math.min(
                                                                    window.ai_probability,
                                                                    100
                                                                )}%`,
                                                            }}
                                                        />

                                                    </div>


                                                    <div className="timeline-info">

                                                        <span>
                                                            {window.start}s – {window.end}s
                                                        </span>

                                                        {isConfidenceVisible() && (
                                                            <strong>
                                                                {window.ai_probability}%
                                                            </strong>
                                                        )}

                                                    </div>

                                                </div>

                                            );

                                        }
                                    )}

                                </div>

                            </div>


                            {/* INSIGHTS */}

                            <div className="insights-box">

                                <div className="insights-icon">
                                    {analysisResult.verdict === "AI"
                                        ? "!"
                                        : "✓"}
                                </div>

                                <div>

                                    <strong>

                                        {analysisResult.verdict === "AI"
                                            ? "Synthetic speech detected"
                                            : "Voice appears genuine"}

                                    </strong>

                                    <p>
                                        {analysisResult.verdict === "AI"
                                            ? strongestRegion
                                                ? isConfidenceVisible()
                                                    ? `VIGIL detected suspicious synthetic speech between ${strongestRegion.start.toFixed(
                                                        1
                                                    )}s and ${strongestRegion.end.toFixed(
                                                        1
                                                    )}s, reaching a peak AI score of ${strongestRegion.probability.toFixed(
                                                        1
                                                    )}%. This exceeded the ${analysisResult.threshold}% detection threshold.`
                                                    : `VIGIL detected suspicious synthetic speech between ${strongestRegion.start.toFixed(
                                                        1
                                                    )}s and ${strongestRegion.end.toFixed(
                                                        1
                                                    )}s. This exceeded the detection threshold.`
                                                : isConfidenceVisible()
                                                    ? `VIGIL detected a suspicious segment with a peak AI score of ${analysisResult.maximum_ai_probability}%, exceeding the ${analysisResult.threshold}% detection threshold.`
                                                    : `VIGIL detected a suspicious segment exceeding the detection threshold.`
                                            : isConfidenceVisible()
                                                ? `No analyzed segment exceeded the ${analysisResult.threshold}% detection threshold. The strongest AI score was ${analysisResult.maximum_ai_probability}%.`
                                                : `No analyzed segment exceeded the detection threshold.`}
                                    </p>

                                </div>

                            </div>


                            {/* TECHNICAL DETAILS */}

                            <details className="technical-details">

                                <summary>
                                    Advanced analysis details
                                </summary>

                                <div className="technical-grid">

                                    <div>
                                        <span>Model</span>
                                        <strong>
                                            {analysisResult.model}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Decision threshold</span>
                                        <strong>
                                            {analysisResult.threshold}%
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Windows analyzed</span>
                                        <strong>
                                            {analysisResult.windows_analyzed}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Aggregation method</span>
                                        <strong>
                                            Maximum window probability
                                        </strong>
                                    </div>

                                </div>

                            </details>

                        </div>

                    )}
                </div>

            )}

        </div>

    );

}


export default AudioAnalyzer;