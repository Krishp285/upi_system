// frontend/src/pages/OTPVerify.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { authAPI } from "../services/api";
import "../styles/auth.css";

export default function OTPVerify() {
  const navigate                = useNavigate();
  const [params]                = useSearchParams();
  const email                   = params.get("email") || "";
  const [digits, setDigits]     = useState(["", "", "", "", "", ""]);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const inputRefs               = useRef([]);

  // Auto-focus first input
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleDigit = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    // Allow pasting all 6 digits
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) return;
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const otp = digits.join("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { setError("Enter all 6 digits"); return; }
    setError("");
    setLoading(true);
    try {
      await authAPI.verifyOTP({ email, otp });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(err?.message || "Verification failed. Please try again.");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="hero-brand">
          <div className="hero-logo">🛡️</div>
          <div>
            <div className="hero-brand-text">TruePayID</div>
            <div className="hero-brand-sub">Email Verification</div>
          </div>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">One last<br /><span>step</span>.</h1>
          <p className="hero-desc">
            We sent a 6-digit verification code to your email.
            Enter it below to activate your account and start building your trust score.
          </p>
        </div>
        <div className="hero-footer">© 2025 TruePayID</div>
      </div>

      <div className="auth-panel">
        <div className="auth-form-container page-enter">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Verify your email</h2>
            <p className="auth-form-sub">
              Enter the 6-digit OTP sent to{" "}
              <span style={{ color: "var(--indigo-light)", fontWeight: 600 }}>{email}</span>
            </p>
          </div>

          {success ? (
            <div className="alert alert-success">
              <span className="alert-icon">✅</span>
              <span className="alert-text">
                <strong>Verified!</strong> Redirecting to login…
              </span>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-danger">
                  <span className="alert-icon">⚠️</span>
                  <span className="alert-text">{error}</span>
                </div>
              )}

              <div style={{ textAlign: "center" }}>
                <div className="otp-inputs" onPaste={handlePaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => inputRefs.current[i] = el}
                      className="otp-digit"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handleDigit(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                    />
                  ))}
                </div>
                <p className="form-hint" style={{ textAlign: "center", marginTop: 8 }}>
                  Code expires in 10 minutes. Check your spam folder.
                </p>
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || otp.length < 6}>
                {loading
                  ? <><div className="spinner" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> Verifying…</>
                  : "Verify & Activate →"}
              </button>
            </form>
          )}

          <p className="auth-footer-text">
            <Link to="/signup" className="auth-link">← Back to signup</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
