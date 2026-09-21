import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Signup from "./components/Signup";
import Login from "./components/Login";
import AudioAnalyzer from "./components/AudioAnalyzer";
import LiveDetector from "./components/LiveDetector";
import VoIPDetector from "./components/VoIPDetector";

import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Dashboard from "./pages/Dashboard";

import { getHistory } from "./utils/history";


function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return (
            localStorage.getItem("vigil_auth") === "true" ||
            sessionStorage.getItem("vigil_auth") === "true"
        );
    });

    const [authPage, setAuthPage] = useState("login");

    const [currentPage, setCurrentPage] = useState("Dashboard");

    const [history, setHistory] = useState([]);

    const handleLogin = ({ email, password, rememberMe }) => {
        const storedAccount = localStorage.getItem("vigil_account");

        if (!storedAccount) {
            setAuthPage("signup");
            return {
                success: false,
                error: "No account found. Please create an account first.",
            };
        }

        const account = JSON.parse(storedAccount);

        if (
            account.email.toLowerCase() !== email.toLowerCase() ||
            account.password !== password
        ) {
            return {
                success: false,
                error: "Invalid email or password.",
            };
        }

        const storage = rememberMe ? localStorage : sessionStorage;

        storage.setItem("vigil_auth", "true");
        storage.setItem("vigil_user_email", account.email);
        storage.setItem("vigil_user_name", account.name);

        setIsAuthenticated(true);

        return {
            success: true,
        };
    };

    const handleSignup = ({ name, email, password }) => {
        localStorage.setItem(
            "vigil_account",
            JSON.stringify({
                name,
                email,
                password,
            })
        );

        setAuthPage("login");
    };

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
    }, []);

    if (!isAuthenticated) {
        if (authPage === "signup") {
            return (
                <Signup
                    onSignup={handleSignup}
                    onBackToLogin={() => setAuthPage("login")}
                />
            );
        }

        return (
            <Login
                onLogin={handleLogin}
                onCreateAccount={() => setAuthPage("signup")}
            />
        );
    }

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

                    <Dashboard history={history} />
                )}

            </main>

        </div>
    );
}

export default App;