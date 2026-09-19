import { useState } from "react";
import {
    Activity,
    Eye,
    EyeOff,
    LockKeyhole,
    ShieldCheck,
    UserRound,
    Mail,
} from "lucide-react";

function Signup({ onSignup, onBackToLogin }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [agreeTerms, setAgreeTerms] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();
        setError("");

        if (!name.trim() || !email.trim() || !password || !confirmPassword) {
            setError("Please fill in all fields.");
            return;
        }

        if (password.length < 6) {
            setError("Password must contain at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!agreeTerms) {
            setError("Please accept the terms to create your account.");
            return;
        }

        const existingAccount = localStorage.getItem("vigil_account");

        if (existingAccount) {
            const account = JSON.parse(existingAccount);

            if (account.email.toLowerCase() === email.trim().toLowerCase()) {
                setError("An account with this email already exists.");
                return;
            }
        }

        setIsLoading(true);

        window.setTimeout(() => {
            onSignup({
                name: name.trim(),
                email: email.trim(),
                password,
            });

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
                            Secure your
                            <span>voice identity.</span>
                        </h1>

                        <p>
                            Create your VIGIL account and access
                            AI-powered voice authenticity analysis.
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


                {/* SIGNUP PANEL */}

                <section className="login-form-panel">

                    <div className="login-form-container">

                        <div className="login-form-heading">

                            <div className="login-form-eyebrow">
                                CREATE ACCOUNT
                            </div>

                            <h2>
                                Join VIGIL
                            </h2>

                            <p>
                                Create your secure VIGIL security console account.
                            </p>

                        </div>


                        <form
                            className="login-form"
                            onSubmit={handleSubmit}
                        >

                            {/* NAME */}

                            <div className="login-field">

                                <label htmlFor="vigil-name">
                                    FULL NAME
                                </label>

                                <div className="login-input-wrapper">

                                    <UserRound size={16} />

                                    <input
                                        id="vigil-name"
                                        type="text"
                                        placeholder="Your name"
                                        value={name}
                                        onChange={(event) => {
                                            setName(event.target.value);
                                            setError("");
                                        }}
                                        autoComplete="name"
                                    />

                                </div>

                            </div>


                            {/* EMAIL */}

                            <div className="login-field">

                                <label htmlFor="vigil-signup-email">
                                    EMAIL ADDRESS
                                </label>

                                <div className="login-input-wrapper">

                                    <Mail size={16} />

                                    <input
                                        id="vigil-signup-email"
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


                            {/* PASSWORD */}

                            <div className="login-field">

                                <label htmlFor="vigil-signup-password">
                                    PASSWORD
                                </label>

                                <div className="login-input-wrapper">

                                    <LockKeyhole size={16} />

                                    <input
                                        id="vigil-signup-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Create a password"
                                        value={password}
                                        onChange={(event) => {
                                            setPassword(event.target.value);
                                            setError("");
                                        }}
                                        autoComplete="new-password"
                                    />

                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() =>
                                            setShowPassword((value) => !value)
                                        }
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
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


                            {/* CONFIRM PASSWORD */}

                            <div className="login-field">

                                <label htmlFor="vigil-confirm-password">
                                    CONFIRM PASSWORD
                                </label>

                                <div className="login-input-wrapper">

                                    <LockKeyhole size={16} />

                                    <input
                                        id="vigil-confirm-password"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        placeholder="Confirm your password"
                                        value={confirmPassword}
                                        onChange={(event) => {
                                            setConfirmPassword(event.target.value);
                                            setError("");
                                        }}
                                        autoComplete="new-password"
                                    />

                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() =>
                                            setShowConfirmPassword(
                                                (value) => !value
                                            )
                                        }
                                        aria-label={
                                            showConfirmPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={16} />
                                        ) : (
                                            <Eye size={16} />
                                        )}
                                    </button>

                                </div>

                            </div>


                            {/* TERMS */}

                            <label className="login-checkbox signup-terms">

                                <input
                                    type="checkbox"
                                    checked={agreeTerms}
                                    onChange={(event) =>
                                        setAgreeTerms(event.target.checked)
                                    }
                                />

                                <span className="login-checkmark" />

                                <span>
                                    I agree to the VIGIL terms and conditions
                                </span>

                            </label>


                            {/* ERROR */}

                            {error && (
                                <div className="login-error">
                                    <span>!</span>
                                    {error}
                                </div>
                            )}


                            {/* CREATE ACCOUNT */}

                            <button
                                type="submit"
                                className="login-submit"
                                disabled={isLoading}
                            >

                                {isLoading ? (
                                    <>
                                        <span className="login-spinner" />
                                        CREATING ACCOUNT...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={17} />
                                        CREATE ACCOUNT
                                    </>
                                )}

                            </button>

                        </form>


                        <div className="login-switch">

                            Already have an account?

                            <button
                                type="button"
                                onClick={onBackToLogin}
                            >
                                Sign in
                            </button>

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

export default Signup;