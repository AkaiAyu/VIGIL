import { useEffect, useState } from "react";

import AudioAnalyzer from "../components/AudioAnalyzer";
import LiveDetector from "../components/LiveDetector";

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

function Dashboard({ history }) {
    const [backendStatus, setBackendStatus] =
        useState("checking");

    useEffect(() => {
        let mounted = true;

        const checkBackend = async () => {
            try {
                const response = await fetch(
                    "http://127.0.0.1:8000/api/health",
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Backend returned ${response.status}`
                    );
                }

                if (mounted) {
                    setBackendStatus("online");
                }
            } catch (error) {
                console.warn(
                    "VIGIL backend health check failed:",
                    error
                );

                if (mounted) {
                    setBackendStatus("offline");
                }
            }
        };

        checkBackend();

        const interval = setInterval(
            checkBackend,
            10000
        );

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const safeHistory = Array.isArray(history) ? history : [];

    const voiceAnalyses = safeHistory.filter(
        (entry) => entry.source !== "VoIP Monitor"
    );

    const aiDetections = voiceAnalyses.filter(
        (entry) => entry.verdict === "AI"
    );

    const genuineDetections = voiceAnalyses.filter(
        (entry) => entry.verdict !== "AI"
    );

    const callShieldEntries = safeHistory.filter(
        (entry) =>
            entry.source === "VoIP Monitor" &&
            entry.callShieldRiskLevel
    );

    const highRiskCalls = callShieldEntries.filter((entry) =>
        ["HIGH", "CRITICAL"].includes(
            String(entry.callShieldRiskLevel).toUpperCase()
        )
    );

    const totalThreats =
        aiDetections.length + highRiskCalls.length;

    const latestCallShield = callShieldEntries[0];

    const latestVoice = voiceAnalyses[0];

    const genuinePercent =
        voiceAnalyses.length > 0
            ? (genuineDetections.length / voiceAnalyses.length) * 100
            : 0;

    const latestRiskLevel = latestCallShield
        ? String(
            latestCallShield.callShieldRiskLevel
        ).toUpperCase()
        : "NO DATA";

    const latestRiskScore = latestCallShield
        ? Number(
            latestCallShield.callShieldRiskScore || 0
        )
        : 0;

    return (
        <>
            {/* HEADER */}

            <header className="top-header">
                <div>
                    <div className="page-eyebrow">
                        VIGIL SECURITY CONSOLE
                    </div>

                    <h1 className="page-title">
                        Voice Security Command Center
                    </h1>

                    <p className="page-description">
                        Monitor voice authenticity and conversation
                        threats from one security console.
                    </p>
                </div>

                <div
                    className={`system-pill ${backendStatus === "offline"
                        ? "backend-offline"
                        : backendStatus === "checking"
                            ? "backend-checking"
                            : ""
                        }`}
                >
                    <span className="status-dot" />

                    {backendStatus === "online"
                        ? "SYSTEM ONLINE"
                        : backendStatus === "checking"
                            ? "CHECKING SYSTEM"
                            : "BACKEND OFFLINE"}
                </div>
            </header>


            <section className="vigil-system-status">
                <div className="vigil-system-status-title">
                    SYSTEM STATUS
                </div>

                <div className="vigil-system-status-items">
                    <div className="vigil-system-status-item">
                        <span
                            className={`vigil-status-indicator ${backendStatus === "online"
                                ? "online"
                                : backendStatus === "offline"
                                    ? "offline"
                                    : "checking"
                                }`}
                        />

                        <span>Backend</span>

                        <strong>
                            {backendStatus === "online"
                                ? "ONLINE"
                                : backendStatus === "offline"
                                    ? "OFFLINE"
                                    : "CHECKING"}
                        </strong>
                    </div>

                    <div className="vigil-system-status-item">
                        <span className="vigil-status-indicator online" />

                        <span>DF-Arena</span>

                        <strong>READY</strong>
                    </div>

                    <div className="vigil-system-status-item">
                        <span className="vigil-status-indicator online" />

                        <span>CallShield</span>

                        <strong>READY</strong>
                    </div>
                </div>
            </section>


            {/* SECURITY OVERVIEW */}

            <section className="vigil-dashboard-stats">
                <div className="vigil-dashboard-stat">
                    <div className="vigil-stat-icon">
                        ◉
                    </div>

                    <div>
                        <span>
                            TOTAL ANALYSES
                        </span>

                        <strong>
                            {safeHistory.length}
                        </strong>

                        <small>
                            All detection activity
                        </small>
                    </div>
                </div>

                <div className="vigil-dashboard-stat threat">
                    <div className="vigil-stat-icon">
                        ⚠
                    </div>

                    <div>
                        <span>
                            VOICE THREATS
                        </span>

                        <strong>
                            {aiDetections.length}
                        </strong>

                        <small>
                            AI voice detections
                        </small>
                    </div>
                </div>

                <div className="vigil-dashboard-stat">
                    <div className="vigil-stat-icon">
                        ☎
                    </div>

                    <div>
                        <span>
                            CALLS ANALYZED
                        </span>

                        <strong>
                            {callShieldEntries.length}
                        </strong>

                        <small>
                            CallShield conversations
                        </small>
                    </div>
                </div>

                <div className="vigil-dashboard-stat threat">
                    <div className="vigil-stat-icon">
                        !
                    </div>

                    <div>
                        <span>
                            THREAT EVENTS
                        </span>

                        <strong>
                            {totalThreats}
                        </strong>

                        <small>
                            Voice + conversation
                        </small>
                    </div>
                </div>
            </section>


            {/* SECURITY OVERVIEW PANELS */}

            <section className="vigil-security-grid">

                {/* VOICE AUTHENTICITY */}

                <div className="vigil-security-card">
                    <div className="vigil-card-header">
                        <div>
                            <div className="card-eyebrow">
                                VOICE AUTHENTICITY
                            </div>

                            <h2>
                                DF-Arena 1B
                            </h2>
                        </div>

                        <span className="vigil-engine-badge">
                            ACTIVE
                        </span>
                    </div>

                    <div className="vigil-security-main-value">
                        {voiceAnalyses.length > 0
                            ? `${genuinePercent.toFixed(1)}%`
                            : "—"}
                    </div>

                    <div className="vigil-security-label">
                        Genuine voice share
                    </div>

                    <div className="vigil-progress">
                        <div
                            style={{
                                width: `${Math.min(
                                    genuinePercent,
                                    100
                                )}%`,
                            }}
                        />
                    </div>

                    <div className="vigil-security-details">
                        <div>
                            <span>
                                Voice checks
                            </span>

                            <strong>
                                {voiceAnalyses.length}
                            </strong>
                        </div>

                        <div>
                            <span>
                                AI detected
                            </span>

                            <strong className="danger-text">
                                {aiDetections.length}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Genuine
                            </span>

                            <strong className="success-text">
                                {genuineDetections.length}
                            </strong>
                        </div>
                    </div>

                    {latestVoice && (
                        <div className="vigil-latest-result">
                            <span>
                                Latest result
                            </span>

                            <strong>
                                {latestVoice.verdict === "AI"
                                    ? "AI DETECTED"
                                    : "GENUINE VOICE"}
                            </strong>

                            <small>
                                {formatRelativeTime(
                                    latestVoice.timestamp
                                )}
                            </small>
                        </div>
                    )}
                </div>

                {/* CALLSHIELD */}

                <div className="vigil-security-card callshield-dashboard-card">
                    <div className="vigil-card-header">
                        <div>
                            <div className="card-eyebrow">
                                CONVERSATION SECURITY
                            </div>

                            <h2>
                                CallShield
                            </h2>
                        </div>

                        <span
                            className={`vigil-risk-badge ${latestCallShield
                                ? latestRiskLevel.toLowerCase()
                                : "none"
                                }`}
                        >
                            {latestRiskLevel}
                        </span>
                    </div>

                    {latestCallShield ? (
                        <>
                            <div className="vigil-risk-score">
                                <strong>
                                    {latestRiskScore}
                                </strong>

                                <span>
                                    / 100
                                </span>
                            </div>

                            <div className="vigil-security-label">
                                Latest conversation risk
                            </div>

                            <div className="vigil-risk-bar">
                                <div
                                    className={
                                        latestRiskLevel === "CRITICAL" ||
                                            latestRiskLevel === "HIGH"
                                            ? "danger"
                                            : ""
                                    }
                                    style={{
                                        width: `${Math.min(
                                            latestRiskScore,
                                            100
                                        )}%`,
                                    }}
                                />
                            </div>

                            <div className="vigil-callshield-meta">
                                <div>
                                    <span>
                                        Calls analyzed
                                    </span>

                                    <strong>
                                        {callShieldEntries.length}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        High / Critical
                                    </span>

                                    <strong className="danger-text">
                                        {highRiskCalls.length}
                                    </strong>
                                </div>
                            </div>

                            {latestCallShield.callShieldReasons?.length > 0 && (
                                <div
                                    className={`vigil-dashboard-threat ${latestRiskLevel === "LOW"
                                        ? "low"
                                        : latestRiskLevel === "MEDIUM"
                                            ? "medium"
                                            : "high"
                                        }`}
                                >
                                    <span>
                                        {latestRiskLevel === "LOW"
                                            ? "LATEST ASSESSMENT"
                                            : latestRiskLevel === "MEDIUM"
                                                ? "RISK INDICATOR"
                                                : "KEY THREAT"}
                                    </span>

                                    <p>
                                        {
                                            latestCallShield
                                                .callShieldReasons[0]
                                        }
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="vigil-no-callshield">
                            <div>
                                ✓
                            </div>

                            <h3>
                                No conversation analysis yet
                            </h3>

                            <p>
                                Start a monitored VoIP call to let
                                CallShield analyze the conversation.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* QUICK ANALYSIS */}

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

            {/* LIVE DETECTION */}

            <section className="analyzer-card">
                <LiveDetector />
            </section>

            {/* RECENT SECURITY ACTIVITY */}

            <section className="vigil-activity-card">
                <div className="vigil-card-header">
                    <div>
                        <div className="card-eyebrow">
                            SECURITY ACTIVITY
                        </div>

                        <h2>
                            Recent analyses
                        </h2>
                    </div>

                    <span className="online-badge">
                        {safeHistory.length}
                    </span>
                </div>

                {safeHistory.length === 0 ? (
                    <div className="vigil-empty-activity">
                        <div>
                            ✓
                        </div>

                        <p>
                            No security activity yet.
                        </p>
                    </div>
                ) : (
                    <div className="vigil-activity-list">
                        {safeHistory
                            .slice(0, 6)
                            .map((entry) => {
                                const isCallShield =
                                    entry.source === "VoIP Monitor";

                                const isAI =
                                    entry.verdict === "AI";

                                const riskLevel =
                                    entry.callShieldRiskLevel
                                        ? String(
                                            entry.callShieldRiskLevel
                                        ).toUpperCase()
                                        : null;

                                return (
                                    <div
                                        className="vigil-activity-item"
                                        key={entry.id}
                                    >
                                        <div
                                            className={`vigil-activity-icon ${isCallShield
                                                ? riskLevel === "HIGH" ||
                                                    riskLevel === "CRITICAL"
                                                    ? "threat"
                                                    : "call"
                                                : isAI
                                                    ? "threat"
                                                    : "genuine"
                                                }`}
                                        >
                                            {isCallShield
                                                ? "☎"
                                                : isAI
                                                    ? "!"
                                                    : "✓"}
                                        </div>

                                        <div className="vigil-activity-info">
                                            <strong>
                                                {isCallShield
                                                    ? `CallShield · ${riskLevel || "ANALYZED"}`
                                                    : isAI
                                                        ? "AI voice detected"
                                                        : "Genuine voice detected"}
                                            </strong>

                                            <span>
                                                {entry.source ||
                                                    "Voice analysis"}
                                                {" • "}
                                                {formatRelativeTime(
                                                    entry.timestamp
                                                )}
                                            </span>
                                        </div>

                                        <div className="vigil-activity-result">
                                            {isCallShield
                                                ? `${Number(
                                                    entry.callShieldRiskScore || 0
                                                )} / 100`
                                                : isAI
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
                                );
                            })}
                    </div>
                )}
            </section>
        </>
    );
}

export default Dashboard;