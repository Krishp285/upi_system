// frontend/src/pages/TokenCountdown.jsx
// The crucial anti-fraud delay window — confirm or deny pending transaction

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/common/Layout";
import { RiskBadge, Alert, PageHeader, Spinner } from "../components/common/UI";
import { transactionAPI } from "../services/api";
import "../styles/dashboard.css";

const TOTAL_SECS = 300; // 5 minutes

export default function TokenCountdown() {
  const { token }       = useParams();
  const navigate        = useNavigate();
  const [data, setData] = useState(null);
  const [secs, setSecs] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decided, setDecided]   = useState(null); // "confirmed" | "denied"
  const [error,  setError]      = useState("");
  const [showPINDialog, setShowPINDialog] = useState(false);
  const [pin, setPin] = useState("");
  const [pendingDecision, setPendingDecision] = useState(null); // "confirm" | "deny"
  const [pinError, setPinError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await transactionAPI.getToken(token);
      setData(d);
      setSecs(d.seconds_remaining);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Live countdown
  useEffect(() => {
    if (secs === null) return;
    if (secs <= 0) {
      // Token expired - auto-navigate after 2 seconds
      const timeout = setTimeout(() => navigate("/dashboard"), 2000);
      return () => clearTimeout(timeout);
    }
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secs, navigate]);

  const decide = async (decision) => {
    setPendingDecision(decision);
    setShowPINDialog(true);
    setPinError("");
    setPin("");
  };

  const confirmWithPIN = async () => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setPinError("PIN must be exactly 4 digits");
      return;
    }

    setDeciding(true);
    try {
      await transactionAPI.decideToken({ token, decision: pendingDecision, pin: pin.trim() });
      setDecided(pendingDecision === "confirm" ? "confirmed" : "denied");
      setShowPINDialog(false);
    } catch (e) {
      setPinError(e.message || "Transaction failed");
    } finally {
      setDeciding(false);
    }
  };

  const CIRC = 2 * Math.PI * 52;
  const pct  = secs !== null ? secs / TOTAL_SECS : 0;
  const offset = CIRC - CIRC * pct;
  const mins = Math.floor((secs ?? 0) / 60);
  const sec2 = (secs ?? 0) % 60;

  if (loading) return (
    <Layout>
      <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spinner size={32} />
      </div>
    </Layout>
  );

  if (decided) {
    const isConfirmed = decided === "confirmed";
    return (
      <Layout>
        <div className="page-content page-enter">
          <div className="token-page">
            <div className="card" style={{
              textAlign: "center", padding: 48,
              border: `1px solid ${isConfirmed ? "var(--success-border)" : "var(--danger-border)"}`,
            }}>
              <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>
                {isConfirmed ? "✅" : "🚫"}
              </div>
              <h2 style={{ marginBottom: 8, color: isConfirmed ? "var(--success)" : "var(--danger)" }}>
                Transaction {isConfirmed ? "Confirmed" : "Denied"}
              </h2>
              <p style={{ color: "var(--text-muted)", marginBottom: 28 }}>
                {isConfirmed
                  ? "Your transaction has been confirmed and initiated. A result email will be sent."
                  : "Transaction successfully cancelled. Your money is safe."}
              </p>
              <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !data) return (
    <Layout>
      <div className="page-content page-enter">
        <Alert type="danger">{error}</Alert>
      </div>
    </Layout>
  );

  if (!data) return null;

  const expired = secs !== null && secs <= 0;
  const isExpired = data.status === "expired" || expired;

  return (
    <Layout>
      <PageHeader title="Transaction Review" subtitle="Confirm or deny within the time window" />
      <div className="page-content page-enter">
        <div className="token-page" style={{ maxWidth: "100%" }}>
          <div className="token-countdown-card">
            {/* Header with countdown */}
            <div className="token-header">
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--warning)" }}>
                  ⏳ Delay Token Active
                </span>
              </div>

              {isExpired ? (
                <div>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>⌛</div>
                  <h3 style={{ color: "var(--text-muted)" }}>Token Expired</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: 8 }}>
                    The review window has closed. No action was taken.
                  </p>
                </div>
              ) : (
                <div className="token-timer-ring">
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle className="token-timer-track" cx="60" cy="60" r="52" />
                    <circle
                      className="token-timer-fill"
                      cx="60" cy="60" r="52"
                      strokeDasharray={CIRC}
                      strokeDashoffset={offset}
                      style={{ transform: "rotate(-90deg)", transformOrigin: "60px 60px",
                               stroke: secs < 60 ? "var(--danger)" : "var(--warning)" }}
                    />
                  </svg>
                  <div className="token-timer-text">
                    <span className="token-timer-seconds" style={{ color: secs < 60 ? "var(--danger)" : "var(--warning)" }}>
                      {mins > 0 ? `${mins}:${String(sec2).padStart(2, "0")}` : `${secs}s`}
                    </span>
                    <span className="token-timer-label">remaining</span>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <RiskBadge level={data.risk_level} />
                <span style={{ marginLeft: 8, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Risk Score: <strong style={{ color: "var(--warning)" }}>{data.risk_score}/100</strong>
                </span>
              </div>
            </div>

            {/* Transaction details */}
            <div className="token-body">
              <h3 style={{ marginBottom: 12 }}>Transaction Details</h3>

              {error && <Alert type="danger">{error}</Alert>}

              {[
                ["Recipient",  data.receiver_upi],
                ["Amount",     "₹" + Number(data.amount).toLocaleString("en-IN")],
                ["Risk Level", data.risk_level],
                ["Issued at",  new Date(data.created_at).toLocaleString("en-IN")],
                ["Expires at", new Date(data.expires_at).toLocaleString("en-IN")],
              ].map(([label, val]) => (
                <div key={label} className="token-detail-row">
                  <span className="token-detail-label">{label}</span>
                  <span className="token-detail-value">{val}</span>
                </div>
              ))}

              {/* Anti-fraud education */}
              <div className="alert alert-info" style={{ marginTop: 4 }}>
                <span className="alert-icon">💡</span>
                <div className="alert-text">
                  <div className="alert-title">Why this window exists</div>
                  93% of UPI fraud is socially engineered — the victim acts under pressure.
                  This 5-minute pause gives you time to verify independently.
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {!isExpired && (
              <div className="token-actions">
                <button
                  className="btn btn-danger btn-lg"
                  onClick={() => decide("deny")}
                  disabled={deciding}
                >
                  {deciding ? <Spinner size={18} color="#fff" /> : "🚫 Deny Transaction"}
                </button>
                <button
                  className="btn btn-success btn-lg"
                  onClick={() => decide("confirm")}
                  disabled={deciding}
                >
                  {deciding ? <Spinner size={18} color="#fff" /> : "✅ Confirm"}
                </button>
              </div>
            )}

            {isExpired && (
              <div style={{ padding: "16px 24px 24px", background: "var(--bg-card)", textAlign: "center" }}>
                <div style={{ marginBottom: 16 }}>
                  <Spinner size={28} />
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: 8 }}>
                  Redirecting to dashboard...
                </p>
                <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
                  Back to Dashboard
                </button>
              </div>
            )}

            {/* PIN Verification Dialog */}
            {showPINDialog && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}>
                <div style={{
                  background: "var(--bg-primary)",
                  borderRadius: "12px",
                  padding: "32px",
                  maxWidth: "360px",
                  width: "100%",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                }}>
                  <h3 style={{ marginBottom: 12, textAlign: "center" }}>🔐 Enter Your PIN</h3>
                  <p style={{ color: "var(--text-muted)", marginBottom: 24, textAlign: "center", fontSize: "13px" }}>
                    Enter your 4-digit transaction PIN to confirm this {pendingDecision === "confirm" ? "transaction" : "cancellation"}
                  </p>

                  {pinError && <Alert type="danger">{pinError}</Alert>}

                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength="4"
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setPin(val);
                      setPinError("");
                    }}
                    placeholder="••••"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      marginBottom: 20,
                      fontSize: "24px",
                      textAlign: "center",
                      letterSpacing: "8px",
                      border: "2px solid var(--border-color)",
                      borderRadius: "8px",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                    }}
                    autoFocus
                  />

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowPINDialog(false);
                        setPin("");
                        setPinError("");
                      }}
                      disabled={deciding}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      className={`btn ${pendingDecision === "confirm" ? "btn-success" : "btn-danger"}`}
                      onClick={confirmWithPIN}
                      disabled={deciding || pin.length !== 4}
                      style={{ flex: 1 }}
                    >
                      {deciding ? <Spinner size={16} color="#fff" /> : pin.length !== 4 ? "⏳ Enter 4 digits" : "Confirm"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
