import { useEffect, useMemo, useState } from "react";

import {
    Activity,
    AlertTriangle,
    CheckCircle,
    BarChart3,
    ShieldAlert,
    ShieldCheck,
    Mic,
    Phone,
    Upload,
} from "lucide-react";

import { getHistory } from "../utils/history";


function Analytics() {

    const [history, setHistory] = useState([]);


    useEffect(() => {

        const loadHistory = () => {
            setHistory(getHistory());
        };

        loadHistory();

        // Refresh analytics if another VIGIL page
        // changes localStorage.
        window.addEventListener(
            "vigil-history-updated",
            loadHistory
        );

        return () => {
            window.removeEventListener(
                "vigil-history-updated",
                loadHistory
            );
        };

    }, []);


    const analytics = useMemo(() => {

        const total = history.length;

        const aiDetections =
            history.filter(
                entry =>
                    entry.verdict === "AI"
            ).length;

        const genuineVoices =
            history.filter(
                entry =>
                    entry.verdict === "GENUINE"
            ).length;


        const detectionRate =
            total > 0
                ? (aiDetections / total) * 100
                : 0;


        const confidenceValues =
            history
                .map(entry =>
                    Number(entry.confidence)
                )
                .filter(
                    value =>
                        Number.isFinite(value)
                );


        const averageConfidence =
            confidenceValues.length > 0
                ? confidenceValues.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) / confidenceValues.length
                : 0;


        const sourceCounts = {

            "Audio Upload":
                history.filter(
                    entry =>
                        entry.source ===
                        "Audio Upload"
                ).length,

            "Live Voice":
                history.filter(
                    entry =>
                        entry.source ===
                        "Live Voice"
                ).length,

            "VoIP Monitor":
                history.filter(
                    entry =>
                        entry.source ===
                        "VoIP Monitor"
                ).length,
        };


        return {
            total,
            aiDetections,
            genuineVoices,
            detectionRate,
            averageConfidence,
            sourceCounts,
        };

    }, [history]);


    const formatPercentage = (value) => {

        return `${Number(value).toFixed(1)}%`;

    };


    const getSourceIcon = (source) => {

        if (source === "Audio Upload") {
            return <Upload size={15} />;
        }

        if (source === "Live Voice") {
            return <Mic size={15} />;
        }

        if (source === "VoIP Monitor") {
            return <Phone size={15} />;
        }

        return <Activity size={15} />;
    };


    const getRelativeSourceLabel = (source) => {

        return source || "Unknown Source";

    };


    return (

        <div>

            {/* HEADER */}

            <header className="top-header">

                <div>

                    <div className="page-eyebrow">
                        SECURITY INTELLIGENCE
                    </div>

                    <h1 className="page-title">
                        Detection Analytics
                    </h1>

                    <p className="page-description">
                        Overview of voice authenticity
                        detection activity and threat statistics.
                    </p>

                </div>


                <div className="system-pill">

                    <span className="status-dot" />

                    SYSTEM ONLINE

                </div>

            </header>


            {/* MAIN STATS */}

            <section className="stats-grid">

                <div className="stat-card">

                    <div className="stat-icon">
                        <Activity size={19} />
                    </div>

                    <div>

                        <div className="stat-label">
                            TOTAL ANALYSES
                        </div>

                        <div className="stat-value">
                            {analytics.total}
                        </div>

                    </div>

                </div>


                <div className="stat-card analytics-ai-stat">

                    <div className="stat-icon">
                        <AlertTriangle size={19} />
                    </div>

                    <div>

                        <div className="stat-label">
                            AI DETECTIONS
                        </div>

                        <div className="stat-value">
                            {analytics.aiDetections}
                        </div>

                    </div>

                </div>


                <div className="stat-card analytics-genuine-stat">

                    <div className="stat-icon">
                        <CheckCircle size={19} />
                    </div>

                    <div>

                        <div className="stat-label">
                            GENUINE VOICES
                        </div>

                        <div className="stat-value">
                            {analytics.genuineVoices}
                        </div>

                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-icon">
                        <BarChart3 size={19} />
                    </div>

                    <div>

                        <div className="stat-label">
                            AI DETECTION SHARE
                        </div>

                        <div className="stat-value">
                            {formatPercentage(
                                analytics.detectionRate
                            )}
                        </div>

                    </div>

                </div>

            </section>


            {/* SECONDARY STAT */}

            <section className="analytics-summary-row">

                <div className="analytics-summary-card">

                    <div>

                        <div className="analytics-summary-label">
                            AVERAGE CONFIDENCE
                        </div>

                        <div className="analytics-summary-value">
                            {formatPercentage(
                                analytics.averageConfidence
                            )}
                        </div>

                    </div>

                    <div className="analytics-summary-icon">
                        %
                    </div>

                </div>


                <div className="analytics-summary-card">

                    <div>

                        <div className="analytics-summary-label">
                            ANALYSIS SOURCES
                        </div>

                        <div className="analytics-summary-value">
                            {
                                Object.values(
                                    analytics.sourceCounts
                                ).filter(
                                    count => count > 0
                                ).length
                            }
                        </div>

                    </div>

                    <div className="analytics-summary-icon">
                        ◈
                    </div>

                </div>

            </section>


            {/* MODEL + THREAT */}

            <section className="dashboard-grid">

                {/* MODEL */}

                <div className="panel">

                    <div className="panel-header">

                        <div>

                            <div className="card-eyebrow">
                                MODEL
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
                            <span>Threshold</span>
                            <strong>
                                45%
                            </strong>
                        </div>

                    </div>

                </div>


                {/* THREAT OVERVIEW */}

                <div className="panel analytics-threat-panel">

                    <div className="card-eyebrow">
                        THREAT OVERVIEW
                    </div>


                    {analytics.total === 0 ? (

                        <div className="empty-threat">

                            <div className="empty-shield">
                                ✓
                            </div>

                            <h3>
                                No data available
                            </h3>

                            <p>
                                Perform some voice analyses
                                to populate your security
                                analytics.
                            </p>

                        </div>

                    ) : (

                        <div className="threat-overview-content">

                            <div className="threat-overview-header">

                                <div>

                                    <span>
                                        AI / SPOOF DETECTION
                                    </span>

                                    <strong>
                                        {formatPercentage(
                                            analytics.detectionRate
                                        )}
                                    </strong>

                                </div>

                                <div className="threat-icon">
                                    <ShieldAlert
                                        size={20}
                                    />
                                </div>

                            </div>


                            <div className="threat-bar">

                                <div
                                    className="threat-bar-ai"
                                    style={{
                                        width:
                                            `${analytics.detectionRate}%`,
                                    }}
                                />

                            </div>


                            <div className="threat-legend">

                                <div>

                                    <span className="legend-dot legend-ai-dot" />

                                    <span>
                                        AI / SPOOF
                                    </span>

                                    <strong>
                                        {analytics.aiDetections}
                                    </strong>

                                </div>


                                <div>

                                    <span className="legend-dot legend-genuine-dot" />

                                    <span>
                                        GENUINE
                                    </span>

                                    <strong>
                                        {analytics.genuineVoices}
                                    </strong>

                                </div>

                            </div>

                        </div>

                    )}

                </div>

            </section>


            {/* SOURCE ANALYSIS */}

            <section className="panel analytics-source-panel">

                <div className="panel-header">

                    <div>

                        <div className="card-eyebrow">
                            INPUT SOURCES
                        </div>

                        <h2>
                            Analysis by Source
                        </h2>

                    </div>

                </div>


                <div className="source-list">

                    {Object.entries(
                        analytics.sourceCounts
                    ).map(
                        ([source, count]) => {

                            const percentage =
                                analytics.total > 0
                                    ? (
                                        count /
                                        analytics.total
                                    ) * 100
                                    : 0;

                            return (

                                <div
                                    className="source-row"
                                    key={source}
                                >

                                    <div className="source-name">

                                        <div className="source-icon">
                                            {getSourceIcon(
                                                source
                                            )}
                                        </div>

                                        <span>
                                            {
                                                getRelativeSourceLabel(
                                                    source
                                                )
                                            }
                                        </span>

                                    </div>


                                    <div className="source-progress">

                                        <div className="source-progress-track">

                                            <div
                                                className="source-progress-fill"
                                                style={{
                                                    width:
                                                        `${percentage}%`,
                                                }}
                                            />

                                        </div>

                                    </div>


                                    <div className="source-count">

                                        <strong>
                                            {count}
                                        </strong>

                                        <span>
                                            {formatPercentage(
                                                percentage
                                            )}
                                        </span>

                                    </div>

                                </div>

                            );

                        }
                    )}

                </div>

            </section>


            {/* RECENT ACTIVITY */}

            <section className="panel analytics-recent-panel">

                <div className="panel-header">

                    <div>

                        <div className="card-eyebrow">
                            ACTIVITY
                        </div>

                        <h2>
                            Recent Analyses
                        </h2>

                    </div>

                </div>


                {history.length === 0 ? (

                    <div className="analytics-no-activity">
                        No analyses recorded yet.
                    </div>

                ) : (

                    <div className="recent-analysis-list">

                        {history
                            .slice(0, 5)
                            .map(entry => {

                                const isAI =
                                    entry.verdict ===
                                    "AI";

                                return (

                                    <div
                                        className="recent-analysis-row"
                                        key={entry.id}
                                    >

                                        <div
                                            className={`recent-analysis-icon ${isAI
                                                ? "recent-ai"
                                                : "recent-genuine"
                                                }`}
                                        >

                                            {isAI ? (
                                                <ShieldAlert
                                                    size={16}
                                                />
                                            ) : (
                                                <ShieldCheck
                                                    size={16}
                                                />
                                            )}

                                        </div>


                                        <div className="recent-analysis-main">

                                            <strong>
                                                {isAI
                                                    ? "AI / SPOOF VOICE"
                                                    : "GENUINE HUMAN VOICE"}
                                            </strong>

                                            <span>
                                                {
                                                    entry.source ||
                                                    "Unknown Source"
                                                }
                                            </span>

                                        </div>


                                        <div className="recent-analysis-confidence">

                                            <span>
                                                CONFIDENCE
                                            </span>

                                            <strong>
                                                {formatPercentage(
                                                    entry.confidence
                                                )}
                                            </strong>

                                        </div>

                                    </div>

                                );

                            })}

                    </div>

                )}

            </section>

        </div>

    );
}


export default Analytics;