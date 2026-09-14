import {
    Shield,
    LayoutDashboard,
    Mic,
    Phone,
    History,
    BarChart3,
    Settings,
} from "lucide-react";

const navigation = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
    },
    {
        label: "Analyze Audio",
        icon: Mic,
    },
    {
        label: "Live Voice",
        icon: Mic,
    },
    {
        label: "VoIP Monitor",
        icon: Phone,
    },
    {
        label: "History",
        icon: History,
    },
    {
        label: "Analytics",
        icon: BarChart3,
    },
];

function Sidebar({ currentPage, onNavigate }) {
    return (
        <aside className="sidebar">

            {/* BRAND */}

            <div className="brand">

                <div className="brand-icon">
                    <Shield size={22} />
                </div>

                <div>
                    <div className="brand-name">
                        VIGIL
                    </div>

                    <div className="brand-subtitle">
                        VOICE SECURITY
                    </div>
                </div>

            </div>


            {/* NAVIGATION */}

            <div className="nav-section">

                <div className="nav-title">
                    MONITORING
                </div>

                {navigation.map((item) => {

                    const Icon = item.icon;

                    return (
                        <button
                            key={item.label}
                            className={`nav-item ${currentPage === item.label ? "active" : ""
                                }`}
                            onClick={() => onNavigate(item.label)}
                        >

                            <Icon size={18} />

                            <span>
                                {item.label}
                            </span>

                        </button>
                    );

                })}

            </div>


            {/* BOTTOM */}

            <div className="sidebar-bottom">

                <button
                    className={`nav-item ${currentPage === "Settings" ? "active" : ""
                        }`}
                    onClick={() => onNavigate("Settings")}
                >

                    <Settings size={18} />

                    <span>
                        Settings
                    </span>

                </button>


                <div className="system-status">

                    <span className="status-dot" />

                    <div>

                        <div className="status-title">
                            SYSTEM ONLINE
                        </div>

                        <div className="status-subtitle">
                            DF-Arena 1B
                        </div>

                    </div>

                </div>

            </div>

        </aside>
    );
}

export default Sidebar;