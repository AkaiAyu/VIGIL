import { useEffect, useState } from "react";

import {
    Database,
    History,
    ShieldCheck,
    SlidersHorizontal,
    Monitor,
    Trash2,
    CheckCircle2,
    Cpu,
} from "lucide-react";

import {
    getHistory,
    clearHistory,
} from "../utils/history";


const SETTINGS_KEY =
    "vigil_settings";


const DEFAULT_SETTINGS = {
    autoSaveHistory: true,
    showConfidence: true,
};


function getSettings() {

    try {

        const stored =
            localStorage.getItem(
                SETTINGS_KEY
            );

        if (!stored) {
            return DEFAULT_SETTINGS;
        }

        return {
            ...DEFAULT_SETTINGS,
            ...JSON.parse(stored),
        };

    } catch (error) {

        console.error(
            "Could not load VIGIL settings:",
            error
        );

        return DEFAULT_SETTINGS;
    }
}


function Settings() {

    const [settings, setSettings] =
        useState(getSettings);

    const [historyCount, setHistoryCount] =
        useState(0);


    useEffect(() => {

        setHistoryCount(
            getHistory().length
        );

    }, []);


    const updateSetting = (
        setting,
        value
    ) => {

        const updated = {
            ...settings,
            [setting]: value,
        };

        setSettings(updated);

        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify(updated)
        );

    };


    const handleClearHistory = () => {

        const confirmed =
            window.confirm(
                "Are you sure you want to permanently clear all detection history?"
            );

        if (!confirmed) {
            return;
        }

        clearHistory();

        setHistoryCount(0);

    };


    return (

        <div>

            {/* HEADER */}

            <header className="top-header">

                <div>

                    <div className="page-eyebrow">
                        SYSTEM CONFIGURATION
                    </div>

                    <h1 className="page-title">
                        Settings
                    </h1>

                    <p className="page-description">
                        Configure VIGIL detection and
                        system preferences.
                    </p>

                </div>

            </header>


            {/* DETECTION ENGINE + CONNECTION */}

            <section className="dashboard-grid">

                <div className="panel">

                    <div className="panel-header">

                        <div>

                            <div className="card-eyebrow">
                                DETECTION ENGINE
                            </div>

                            <h2>
                                AI Detector
                            </h2>

                        </div>

                        <span className="online-badge">
                            ACTIVE
                        </span>

                    </div>


                    <div className="engine-info">

                        <div>
                            <span>Model</span>

                            <strong>
                                DF-Arena 1B
                            </strong>
                        </div>


                        <div>
                            <span>Device</span>

                            <strong>
                                CUDA GPU
                            </strong>
                        </div>


                        <div>
                            <span>Sample Rate</span>

                            <strong>
                                16 kHz
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


                <div className="panel">

                    <div className="panel-header">

                        <div>

                            <div className="card-eyebrow">
                                CONNECTION
                            </div>

                            <h2>
                                VoIP Configuration
                            </h2>

                        </div>

                        <span className="online-badge">
                            READY
                        </span>

                    </div>


                    <div className="engine-info">

                        <div>
                            <span>Protocol</span>

                            <strong>
                                WebRTC
                            </strong>
                        </div>


                        <div>
                            <span>Signaling</span>

                            <strong>
                                WebSocket
                            </strong>
                        </div>


                        <div>
                            <span>Channel</span>

                            <strong>
                                Peer-to-Peer
                            </strong>
                        </div>

                    </div>

                </div>

            </section>


            {/* USER PREFERENCES */}

            <section className="panel settings-panel">

                <div className="panel-header">

                    <div>

                        <div className="card-eyebrow">
                            PREFERENCES
                        </div>

                        <h2>
                            Detection Preferences
                        </h2>

                    </div>

                    <SlidersHorizontal
                        size={19}
                        className="settings-header-icon"
                    />

                </div>


                <div className="settings-list">

                    {/* AUTO SAVE */}

                    <div className="settings-row">

                        <div className="settings-row-icon">
                            <History size={17} />
                        </div>


                        <div className="settings-row-main">

                            <strong>
                                Auto-save detection history
                            </strong>

                            <span>
                                Automatically store completed
                                analyses in your local browser.
                            </span>

                        </div>


                        <button
                            className={`settings-toggle ${
                                settings.autoSaveHistory
                                    ? "settings-toggle-on"
                                    : ""
                            }`}
                            onClick={() =>
                                updateSetting(
                                    "autoSaveHistory",
                                    !settings.autoSaveHistory
                                )
                            }
                            aria-label="Toggle auto-save detection history"
                        >

                            <span />

                        </button>

                    </div>


                    {/* CONFIDENCE */}

                    <div className="settings-row">

                        <div className="settings-row-icon">
                            <ShieldCheck size={17} />
                        </div>


                        <div className="settings-row-main">

                            <strong>
                                Show confidence scores
                            </strong>

                            <span>
                                Display confidence values in
                                detection results and history.
                            </span>

                        </div>


                        <button
                            className={`settings-toggle ${
                                settings.showConfidence
                                    ? "settings-toggle-on"
                                    : ""
                            }`}
                            onClick={() =>
                                updateSetting(
                                    "showConfidence",
                                    !settings.showConfidence
                                )
                            }
                            aria-label="Toggle confidence scores"
                        >

                            <span />

                        </button>

                    </div>

                </div>

            </section>


            {/* LOCAL DATA */}

            <section className="dashboard-grid settings-bottom-grid">

                <div className="panel">

                    <div className="panel-header">

                        <div>

                            <div className="card-eyebrow">
                                LOCAL DATA
                            </div>

                            <h2>
                                Detection History
                            </h2>

                        </div>

                        <Database
                            size={19}
                            className="settings-header-icon"
                        />

                    </div>


                    <div className="settings-data-card">

                        <div className="settings-data-icon">
                            <Database size={18} />
                        </div>


                        <div>

                            <span>
                                STORED ANALYSES
                            </span>

                            <strong>
                                {historyCount}
                            </strong>

                        </div>

                    </div>


                    <button
                        className="settings-danger-button"
                        onClick={handleClearHistory}
                        disabled={
                            historyCount === 0
                        }
                    >

                        <Trash2 size={15} />

                        CLEAR DETECTION HISTORY

                    </button>

                </div>


                {/* SYSTEM STATUS */}

                <div className="panel">

                    <div className="panel-header">

                        <div>

                            <div className="card-eyebrow">
                                SYSTEM
                            </div>

                            <h2>
                                Runtime Status
                            </h2>

                        </div>

                        <Monitor
                            size={19}
                            className="settings-header-icon"
                        />

                    </div>


                    <div className="settings-status-list">

                        <div className="settings-status-row">

                            <div>

                                <span>
                                    BACKEND
                                </span>

                                <strong>
                                    VIGIL API
                                </strong>

                            </div>

                            <div className="settings-status-online">

                                <CheckCircle2
                                    size={14}
                                />

                                ONLINE

                            </div>

                        </div>


                        <div className="settings-status-row">

                            <div>

                                <span>
                                    AI ENGINE
                                </span>

                                <strong>
                                    DF-Arena 1B
                                </strong>

                            </div>

                            <div className="settings-status-online">

                                <CheckCircle2
                                    size={14}
                                />

                                READY

                            </div>

                        </div>


                        <div className="settings-status-row">

                            <div>

                                <span>
                                    COMPUTE
                                </span>

                                <strong>
                                    CUDA GPU
                                </strong>

                            </div>

                            <Cpu
                                size={15}
                                className="settings-header-icon"
                            />

                        </div>

                    </div>

                </div>

            </section>


            {/* CONFIGURATION NOTE */}

            <div className="settings-note">

                <ShieldCheck size={15} />

                <span>
                    Detection engine parameters are managed
                    by the VIGIL backend and are currently
                    read-only from this interface.
                </span>

            </div>

        </div>

    );
}


export default Settings;