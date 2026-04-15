// frontend/src/pages/Signup.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";
import "../styles/auth.css";

export default function Signup() {
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ upi_id: "", phone: "", email: "", full_name: "", password: "", transaction_pin: "" });
  const [error,   setError]   = useState("");
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayOtp, setDisplayOtp] = useState(""); // For development mode

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPinError("");
    
    if (form.transaction_pin.length !== 4) {
      setPinError("PIN must be exactly 4 digits");
      return;
    }
    
    setLoading(true);
    try {
      const result = await authAPI.signup(form);
      if (result.otp) {
        // Dev mode: show OTP
        setDisplayOtp(result.otp);
      } else {
        navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`);
      }
    } catch (err) {
      setError(err?.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Hero panel */}
      <div className="auth-hero">
        <div className="hero-brand">
          <div className="hero-logo">🛡️</div>
          <div>
            <div className="hero-brand-text">TruePayID</div>
            <div className="hero-brand-sub">Fraud Prevention Layer</div>
          </div>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">Join the<br /><span>trusted</span><br />network.</h1>
          <p className="hero-desc">
            Your TruePayID profile builds a verified digital trust identity — protecting
            you and the people you transact with from fraud, impersonation and social engineering.
          </p>
          <div className="hero-features">
            {[
              ["✓", "Verified identity tied to your real UPI ID"],
              ["✓", "Starts you with a 50/100 neutral trust score"],
              ["✓", "AI risk scoring on every transaction you initiate"],
              ["✓", "All emails encrypted — no marketing, ever"],
            ].map(([icon, text]) => (
              <div key={text} className="hero-feature">
                <div className="hero-feature-icon">{icon}</div>
                <div style={{ color: "#7a8ba8", fontSize: "0.875rem" }}>{text}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-footer">Not a payment app — a trust layer. © 2025 TruePayID</div>
      </div>

      {/* Form panel */}
      <div className="auth-panel">
        <div className="auth-form-container page-enter">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create account</h2>
            <p className="auth-form-sub">Set up your TruePayID trust profile</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="alert alert-danger">
                <span className="alert-icon">⚠️</span>
                <span className="alert-text">{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Ravi Kumar" value={form.full_name} onChange={set("full_name")} required />
            </div>

            <div className="form-group">
              <label className="form-label">UPI ID</label>
              <input className="form-input mono" placeholder="name@upi" value={form.upi_id} onChange={set("upi_id")} required />
              <span className="form-hint">Format: yourname@bank (e.g. ravi@okicici)</span>
            </div>

            <div className="auth-form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="9876543210" type="tel" value={form.phone} onChange={set("phone")} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" placeholder="you@email.com" type="email" value={form.email} onChange={set("email")} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
            </div>

            <div className="form-group">
              <label className="form-label">Transaction PIN (4 digits)</label>
              <input 
                className="form-input mono" 
                type="password" 
                placeholder="0000" 
                maxLength="4"
                value={form.transaction_pin} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setForm(f => ({ ...f, transaction_pin: val }));
                  setPinError(val.length === 4 || val.length === 0 ? '' : 'PIN must be 4 digits');
                }}
                required 
              />
              <span className="form-hint">Used to verify high-risk transactions. Keep it safe!</span>
              {pinError && <span className="form-hint" style={{ color: '#dc2626' }}>❌ {pinError}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading
                ? <><div className="spinner" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> Creating...</>
                : "Create Account →"}
            </button>
          </form>

          {displayOtp && (
            <div style={{ marginTop: "24px", padding: "20px", background: "#dbeafe", border: "2px solid #0284c7", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ color: "#0284c7", fontWeight: "bold", marginBottom: "12px" }}>🔐 Development Mode: Signup OTP</div>
              <div style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "4px", color: "#0284c7", fontFamily: "monospace", marginBottom: "16px" }}>{displayOtp}</div>
              <button 
                onClick={() => navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`)}
                style={{
                  padding: "10px 20px",
                  background: "#0284c7",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  width: "100%"
                }}
              >
                Proceed to OTP Verification →
              </button>
            </div>
          )}

          <p className="auth-footer-text">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
