import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import AudioAnalyzer from "./components/AudioAnalyzer";
import LiveDetector from "./components/LiveDetector";
import VoIPDetector from "./components/VoIPDetector";

import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

import { getHistory } from "./utils/history";

function formatProbability(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    const percentage = number <= 1
        ? number * 100
        : number;

    return `${Math.min(percentage, 100).toFixed(1)}%`;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) {
        return "Unknown time";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Unknown time";
    }

    const diffSeconds = Math.floor(
        (Date.now() - date.getTime()) / 1000
    );

    if (diffSeconds < 60) {
        return "Just now";
    }

    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffMinutes < 60) {
        return `${diffMinutes} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
        return `${diffHours} hr ago`;
    }

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 7) {
        return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    }

    return date.toLocaleDateString();
}

function App() {
    const [currentPage, setCurrentPage] = useState("Dashboard");

    const [history, setHistory] = useState([]);

    useEffect(() => {
        const refreshHistory = () => {
            setHistory(getHistory());
        };

        refreshHistory();

        window.addEventListener(
            "vigil-history-updated",
            refreshHistory
        );

        return () => {
            window.removeEventListener(
                "vigil-history-updated",
                refreshHistory
            );
        };
    }, [currentPage]);

    return (
        <div className="app-layout">

            <Sidebar
                currentPage={currentPage}
                onNavigate={setCurrentPage}
            />

            <main className="main-content">

                {currentPage === "VoIP Monitor" ? (

                    <VoIPDetector />

                ) : currentPage === "Analyze Audio" ? (

                    <section className="analyzer-card">

                        <div className="analyzer-header">

                            <div>

                                <div className="card-eyebrow">
                                    NEW ANALYSIS
                                </div>

                                <h2>
                                    Analyze a voice recording
                                </h2>

                                <p>
                                    Upload an audio file to inspect its
                                    authenticity and detect synthetic speech.
                                </p>

                            </div>

                        </div>

                        <AudioAnalyzer />

                    </section>

                ) : currentPage === "Live Voice" ? (

                    <section className="analyzer-card">

                        <LiveDetector />

                    </section>

                ) : currentPage === "History" ? (

                    <History />

                ) : currentPage === "Analytics" ? (

                    <Analytics />

                ) : currentPage === "Settings" ? (

                    <Settings />

                ) : (

                    <>

                        <header className="top-header">

                            <div>

                                <div className="page-eyebrow">
                                    SECURITY CONSOLE
                                </div>

                                <h1 className="page-title">
                                    Voice Threat Analysis
                                </h1>

                                <p className="page-description">
                                    Detect synthetic and cloned speech using
                                    AI-powered audio forensics.
                                </p>

                            </div>


                            <div className="system-pill">

                                <span className="status-dot" />

                                SYSTEM ONLINE

                            </div>

                        </header>


                        {/* STATISTICS */}

                        <section className="stats-grid">

                            <div className="stat-card">

                                <div className="stat-icon">
                                    ◉
                                </div>

                                <div>

                                    <div className="stat-label">
                                        ANALYSES
                                    </div>

                                    <div className="stat-value">
                                        {history.length}
                                    </div>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-icon">
                                    ⚠
                                </div>

                                <div>

                                    <div className="stat-label">
                                        THREATS DETECTED
                                    </div>

                                    <div className="stat-value">
                                        {history.filter((entry) => entry.verdict === "AI").length}
                                    </div>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-icon">
                                    ◈
                                </div>

                                <div>

                                    <div className="stat-label">
                                        DETECTION MODEL
                                    </div>

                                    <div className="stat-value model">
                                        DF-Arena 1B
                                    </div>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-icon">
                                    ⚡
                                </div>

                                <div>

                                    <div className="stat-label">
                                        ENGINE
                                    </div>

                                    <div className="stat-value model">
                                        CUDA GPU
                                    </div>

                                </div>

                            </div>

                        </section>


                        {/* UPLOAD */}

                        <section className="analyzer-card">

                            <div className="analyzer-header">

                                <div>

                                    <div className="card-eyebrow">
                                        NEW ANALYSIS
                                    </div>

                                    <h2>
                                        Analyze a voice recording
                                    </h2>

                                    <p>
                                        Upload an audio file to inspect its
                                        authenticity and detect synthetic speech.
                                    </p>

                                </div>

                            </div>


                            <AudioAnalyzer />

                        </section>

                        {/* LIVE VOICE DETECTION */}

                        <section className="analyzer-card">

                            <LiveDetector />

                        </section>

                        {/* LOWER PANELS */}

                        <section className="dashboard-grid">

                            <div className="panel">

                                <div className="panel-header">

                                    <div>

                                        <div className="card-eyebrow">
                                            DETECTION ENGINE
                                        </div>

                                        <h2>
                                            DF-Arena 1B
                                        </h2>

                                    </div>

                                    <span className="online-badge">
                                        READY
                                    </span>

                                </div>


                                <div className="engine-info">

                                    <div>
                                        <span>Architecture</span>
                                        <strong>
                                            XLS-R + Conformer
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Sample Rate</span>
                                        <strong>
                                            16 kHz
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Analysis Window</span>
                                        <strong>
                                            4.04 sec
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Decision Threshold</span>
                                        <strong>
                                            45%
                                        </strong>
                                    </div>

                                </div>

                            </div>


                            <div className="panel threat-panel">

                                <div className="card-eyebrow">
                                    THREAT STATUS
                                </div>

                                {history.length === 0 ? (
                                    <div className="empty-threat">

                                        <div className="empty-shield">
                                            ✓
                                        </div>

                                        <h3>
                                            No analysis yet
                                        </h3>

                                        <p>
                                            Upload a recording to begin
                                            voice authenticity analysis.
                                        </p>

                                    </div>
                                ) : (
                                    <div className="empty-threat">

                                        <div
                                            className={`empty-shield ${history[0].verdict === "AI"
                                                    ? "threat"
                                                    : "genuine"
                                                }`}
                                        >
                                            {history[0].verdict === "AI" ? "!" : "✓"}
                                        </div>

                                        <h3>
                                            {history[0].verdict === "AI"
                                                ? "Threat detected"
                                                : "Voice appears genuine"}
                                        </h3>

                                        <p>
                                            Latest analysis:
                                            {" "}
                                            {history[0].source || "Voice analysis"}

                                            {(
                                                history[0].averageAi ??
                                                history[0].aiProbability ??
                                                history[0].genuineProbability ??
                                                history[0].averageGenuine
                                            ) !== undefined && (
                                                    <>
                                                        {" • "}
                                                        {history[0].verdict === "AI"
                                                            ? "AI probability"
                                                            : "Genuine probability"}
                                                        :{" "}
                                                        {formatProbability(
                                                            history[0].verdict === "AI"
                                                                ? (
                                                                    history[0].averageAi ??
                                                                    history[0].aiProbability
                                                                )
                                                                : (
                                                                    history[0].genuineProbability ??
                                                                    history[0].averageGenuine
                                                                )
                                                        )}
                                                    </>
                                                )}

                                            <br />

                                            Analyzed {formatRelativeTime(history[0].timestamp)}
                                        </p>

                                    </div>
                                )}

                            </div>

                            <div className="panel recent-activity-panel">

                                <div className="panel-header">

                                    <div>
                                        <div className="card-eyebrow">
                                            RECENT ACTIVITY
                                        </div>

                                        <h2>
                                            Latest analyses
                                        </h2>
                                    </div>

                                    <span className="online-badge">
                                        {history.length}
                                    </span>

                                </div>

                                {history.length === 0 ? (
                                    <div className="recent-empty">
                                        <p>
                                            No recent analyses.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="recent-activity-list">

                                        {history.slice(0, 5).map((entry) => (
                                            <div
                                                className="recent-activity-item"
                                                key={entry.id}
                                            >

                                                <div
                                                    className={`recent-status ${entry.verdict === "AI"
                                                        ? "threat"
                                                        : "genuine"
                                                        }`}
                                                >
                                                    {entry.verdict === "AI" ? "!" : "✓"}
                                                </div>

                                                <div className="recent-activity-info">

                                                    <strong>
                                                        {entry.verdict === "AI"
                                                            ? "AI detected"
                                                            : "Genuine voice"}
                                                    </strong>

                                                    <span>
                                                        {entry.source || "Voice analysis"}
                                                        {" • "}
                                                        {formatRelativeTime(entry.timestamp)}
                                                    </span>

                                                </div>

                                                <div className="recent-activity-score">
                                                    {entry.verdict === "AI"
                                                        ? formatProbability(
                                                            entry.peakAi ??
                                                            entry.maximumAiProbability ??
                                                            entry.aiProbability
                                                        )
                                                        : formatProbability(
                                                            entry.genuineProbability ??
                                                            entry.averageGenuine
                                                        )}
                                                </div>

                                            </div>
                                        ))}

                                    </div>
                                )}

                            </div>

                        </section>

                    </>

                )}

            </main>

        </div>
    );
}

export default App;