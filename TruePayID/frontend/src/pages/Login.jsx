// frontend/src/pages/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";import { useAuth } from "../context/AuthContext";
import { tokenStorage } from "../services/api";import "../styles/auth.css";

export default function Login() {
  const navigate  = useNavigate();
  const { updateUser } = useAuth();
  const [useOTP, setUseOTP] = useState(false);
  const [form, setForm] = useState({ identifier: "", password: "", otp: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [displayOtp, setDisplayOtp] = useState(""); // For development mode

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier, password: form.password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed");
      
      // Password verified successfully - now show OTP verification
      setUseOTP(true);  // Switch to OTP mode
      setOtpSent(true);  // Show OTP input form
      if (data.otp) setDisplayOtp(data.otp); // Dev mode: show OTP
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpRequest = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.identifier.trim()) {
      setError("Please enter your UPI ID, phone, or email");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/login-otp-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to send OTP");
      setOtpSent(true);
      if (data.otp) setDisplayOtp(data.otp); // Dev mode: show OTP
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (form.otp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/login-otp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier, otp: form.otp })
      });
      const data = await response.json();
      
      if (!response.ok) {
        console.error("OTP verification failed:", data);
        throw new Error(data.detail || "OTP verification failed");
      }
      
      console.log("✅ OTP verified successfully");
      
      // Store tokens in localStorage
      localStorage.setItem("tpid_access", data.access_token);
      localStorage.setItem("tpid_refresh", data.refresh_token);
      
      // IMPORTANT: Update auth context directly before navigating
      const userData = {
        id: data.user_id,
        upi_id: data.upi_id,
        full_name: data.full_name
      };
      updateUser(userData);
      
      console.log("✅ Auth context updated with user data");
      console.log("🔄 Navigating to dashboard...");
      
      // Navigate to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("OTP verify error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left hero panel */}
      <div className="auth-hero">
        <div className="hero-brand">
          <div className="hero-logo">🛡️</div>
          <div>
            <div className="hero-brand-text">TruePayID</div>
            <div className="hero-brand-sub">Fraud Prevention Layer</div>
          </div>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            Pay with<br /><span>confidence</span>.<br />Not blind faith.
          </h1>
          <p className="hero-desc">
            TruePayID analyses every transaction before it leaves your account —
            verifying identity, scoring risk with AI, and giving you a secure window to confirm.
          </p>
          <div className="hero-features">
            {[
              ["🤖", "AI Fraud Scoring", "Logistic regression on 9 real-time features"],
              ["⏳", "Delay Tokens",     "5-minute confirm window on high-risk payments"],
              ["📍", "Location Intel",   "Detects unusual city-level transaction patterns"],
              ["🔒", "Zero Trust",       "Even unknown UPIs get full risk analysis"],
            ].map(([icon, title, sub]) => (
              <div key={title} className="hero-feature">
                <div className="hero-feature-icon">{icon}</div>
                <div>
                  <div style={{ color: "#c7d2e8", fontWeight: 600, fontSize: "0.875rem" }}>{title}</div>
                  <div style={{ color: "#4a5568", fontSize: "0.78rem", marginTop: 1 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-footer">Not a payment app — a trust layer. © 2025 TruePayID</div>
      </div>

      {/* Right form panel */}
      <div className="auth-panel">
        <div className="auth-form-container page-enter">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-sub">Sign in to your TruePayID account</p>
          </div>

          {!useOTP ? (
            <form className="auth-form" onSubmit={handlePasswordLogin}>
              {error && (
                <div className="alert alert-danger">
                  <span className="alert-icon">⚠️</span>
                  <span className="alert-text">{error}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">UPI ID / Phone / Email</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="name@bank or 9876543210"
                  value={form.identifier}
                  onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
                {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> Signing in...</> : "Sign in →"}
              </button>

              <p style={{ textAlign: "center", marginTop: "16px", color: "#94a3b8", fontSize: "14px" }}>
                <button type="button" className="auth-link" style={{ border: "none", background: "none", cursor: "pointer", color: "#4f46e5", textDecoration: "underline" }} onClick={() => { setUseOTP(true); setError(""); setForm(f => ({ ...f, password: "", otp: "" })); }}>
                  Sign in with OTP instead
                </button>
              </p>
            </form>
          ) : otpSent ? (
            <form className="auth-form" onSubmit={handleOtpVerify}>
              {error && (
                <div className="alert alert-danger">
                  <span className="alert-icon">⚠️</span>
                  <span className="alert-text">{error}</span>
                </div>
              )}

              {displayOtp && (
                <div style={{ background: "#d1fae5", border: "1px solid #10b981", borderRadius: "6px", padding: "12px", marginBottom: "16px", textAlign: "center" }}>
                  <span style={{ color: "#059669", fontWeight: "bold", fontSize: "14px" }}>✅ OTP sent to your registered email. Check your inbox!</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">OTP Code (6 digits)</label>
                <input
                  className="form-input mono"
                  type="text"
                  placeholder="000000"
                  maxLength="6"
                  value={form.otp}
                  onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\\D/g, "") }))}
                  required
                  autoFocus
                  style={{ fontSize: "20px", letterSpacing: "4px", textAlign: "center" }}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || form.otp.length !== 6}>
                {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> Verifying...</> : "Verify OTP →"}
              </button>

              <p style={{ textAlign: "center", marginTop: "16px", color: "#94a3b8", fontSize: "14px" }}>
                <button type="button" className="auth-link" style={{ border: "none", background: "none", cursor: "pointer", color: "#4f46e5", textDecoration: "underline" }} onClick={() => { setOtpSent(false); setForm(f => ({ ...f, otp: "" })); setDisplayOtp(""); }}>
                  Request new OTP
                </button>
              </p>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleOtpRequest}>
              {error && (
                <div className="alert alert-danger">
                  <span className="alert-icon">⚠️</span>
                  <span className="alert-text">{error}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">UPI ID / Phone / Email</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="name@bank or 9876543210"
                  value={form.identifier}
                  onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
                {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> Sending OTP...</> : "Send OTP →"}
              </button>

              <p style={{ textAlign: "center", marginTop: "16px", color: "#94a3b8", fontSize: "14px" }}>
                <button type="button" className="auth-link" style={{ border: "none", background: "none", cursor: "pointer", color: "#4f46e5", textDecoration: "underline" }} onClick={() => { setUseOTP(false); setError(""); }}>
                  Sign in with password instead
                </button>
              </p>
            </form>
          )}

          <p className="auth-footer-text">
            Don't have an account?{" "}
            <Link to="/signup" className="auth-link">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
