import { useState } from "react";
import {
    Activity,
    Eye,
    EyeOff,
    LockKeyhole,
    ShieldCheck,
    UserRound,
} from "lucide-react";

function Login({ onLogin, onCreateAccount }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();
        setError("");

        if (!email.trim() || !password.trim()) {
            setError("Enter your email and password to continue.");
            return;
        }

        setIsLoading(true);

        window.setTimeout(() => {
            const result = onLogin({
                email: email.trim(),
                password,
                rememberMe,
            });

            if (result?.success === false) {
                setError(result.error);
            }

            setIsLoading(false);
        }, 200);
    };

    return (
        <div className="login-page">

            <div className="login-grid" />

            <div className="login-glow login-glow-one" />
            <div className="login-glow login-glow-two" />

            <div className="login-shell">

                {/* BRAND PANEL */}

                <section className="login-brand-panel">

                    <div className="login-brand">

                        <div className="login-brand-icon">
                            <ShieldCheck size={25} strokeWidth={1.8} />
                        </div>

                        <div>
                            <div className="login-brand-name">
                                VIGIL
                            </div>

                            <div className="login-brand-subtitle">
                                VOICE AUTHENTICITY ENGINE
                            </div>
                        </div>

                    </div>

                    <div className="login-hero">

                        <div className="login-status">
                            <span className="login-status-dot" />
                            SYSTEM ONLINE
                        </div>

                        <h1>
                            Detect the voice.
                            <span>Protect the identity.</span>
                        </h1>

                        <p>
                            AI-powered voice authenticity analysis for
                            synthetic and cloned speech detection.
                        </p>

                    </div>

                    <div className="login-security-card">

                        <div className="login-security-icon">
                            <Activity size={17} />
                        </div>

                        <div>
                            <strong>
                                Detection Engine Ready
                            </strong>

                            <span>
                                DF-Arena 1B · CUDA accelerated
                            </span>
                        </div>

                        <div className="login-ready-dot" />

                    </div>

                    <div className="login-footer">
                        VIGIL · SIH 2026
                    </div>

                </section>


                {/* LOGIN PANEL */}

                <section className="login-form-panel">

                    <div className="login-form-container">

                        <div className="login-form-heading">

                            <div className="login-form-eyebrow">
                                SECURE ACCESS
                            </div>

                            <h2>
                                Welcome back
                            </h2>

                            <p>
                                Sign in to access your VIGIL security console.
                            </p>

                        </div>


                        <form
                            className="login-form"
                            onSubmit={handleSubmit}
                        >

                            <div className="login-field">

                                <label htmlFor="vigil-email">
                                    EMAIL ADDRESS
                                </label>

                                <div className="login-input-wrapper">

                                    <UserRound size={16} />

                                    <input
                                        id="vigil-email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(event) => {
                                            setEmail(event.target.value);
                                            setError("");
                                        }}
                                        autoComplete="email"
                                    />

                                </div>

                            </div>


                            <div className="login-field">

                                <label htmlFor="vigil-password">
                                    PASSWORD
                                </label>

                                <div className="login-input-wrapper">

                                    <LockKeyhole size={16} />

                                    <input
                                        id="vigil-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(event) => {
                                            setPassword(event.target.value);
                                            setError("");
                                        }}
                                        autoComplete="current-password"
                                    />

                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() =>
                                            setShowPassword((value) => !value)
                                        }
                                    >
                                        {showPassword ? (
                                            <EyeOff size={16} />
                                        ) : (
                                            <Eye size={16} />
                                        )}
                                    </button>

                                </div>

                            </div>


                            <div className="login-options">

                                <label className="login-checkbox">

                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(event) =>
                                            setRememberMe(event.target.checked)
                                        }
                                    />

                                    <span className="login-checkmark" />

                                    <span>
                                        Remember me
                                    </span>

                                </label>

                            </div>


                            {error && (
                                <div className="login-error">
                                    <span>!</span>
                                    {error}
                                </div>
                            )}


                            <button
                                type="submit"
                                className="login-submit"
                                disabled={isLoading}
                            >

                                {isLoading ? (
                                    <>
                                        <span className="login-spinner" />
                                        AUTHENTICATING...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={17} />
                                        SIGN IN
                                    </>
                                )}

                            </button>

                        </form>


                        <div className="login-switch">

                            Don't have an account?

                            <button
                                type="button"
                                onClick={onCreateAccount}
                            >
                                Create account
                            </button>

                        </div>


                        <div className="login-divider">
                            <span>VIGIL SECURITY CONSOLE</span>
                        </div>


                        <div className="login-trust">

                            <div>
                                <span className="trust-dot" />
                                AI ENGINE READY
                            </div>

                            <div>
                                <span className="trust-dot" />
                                LOCAL PROCESSING
                            </div>

                            <div>
                                <span className="trust-dot" />
                                SECURE SESSION
                            </div>

                        </div>

                    </div>

                </section>

            </div>

        </div>
    );
}

export default Login;