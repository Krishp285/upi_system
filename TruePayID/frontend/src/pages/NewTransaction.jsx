// frontend/src/pages/NewTransaction.jsx
// Initiate a transaction with live AI risk preview as user types

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/common/Layout";
import { RiskMeter, Alert, PageHeader, Spinner } from "../components/common/UI";
import { transactionAPI } from "../services/api";
import "../styles/dashboard.css";

const CITIES = ["Ahmedabad", "Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad",
                "Pune", "Kolkata", "Jaipur", "Surat", "Lucknow", "Nagpur"];

const DEBOUNCE_MS = 600;

export default function NewTransaction() {
  const navigate        = useNavigate();
  const [params]        = useSearchParams();

  const [form, setForm] = useState({
    receiver_upi: params.get("receiver") || "",
    amount:       "",
    notes:        "",
    sender_city:  "Ahmedabad",
  });

  const [risk,    setRisk]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(null);
  const [pendingToken, setPendingToken] = useState(null);
  const [tokenCountdown, setTokenCountdown] = useState(300);
  const [decidingToken, setDecidingToken] = useState(false);
  
  // PIN verification when approving/rejecting token
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingDecision, setPendingDecision] = useState(null); // 'confirm' or 'deny'

  const debounceRef = useRef(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  // Live risk preview — debounced so we don't hammer the API
  const fetchRisk = useCallback(async (receiver_upi, amount, sender_city) => {
    if (!receiver_upi || !amount || parseFloat(amount) <= 0) {
      setRisk(null); return;
    }
    setLoading(true);
    try {
      const r = await transactionAPI.riskPreview(receiver_upi, parseFloat(amount), sender_city);
      setRisk(r);
    } catch {
      setRisk(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRisk(form.receiver_upi, form.amount, form.sender_city);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [form.receiver_upi, form.amount, form.sender_city, fetchRisk]);

  // 5-minute countdown timer for pending token
  useEffect(() => {
    if (!pendingToken) return;
    if (tokenCountdown <= 0) {
      setPendingToken(null);
      return;
    }
    const interval = setInterval(() => {
      setTokenCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingToken, tokenCountdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setResult(null);
    setSubmitting(true);
    try {
      const r = await transactionAPI.initiate({
        receiver_upi: form.receiver_upi,
        amount:       parseFloat(form.amount),
        notes:        form.notes || null,
        sender_city:  form.sender_city || null,
      });
      setResult(r);
      // If token issued, show approval panel
      if (r.status === "token_pending" && r.token) {
        setPendingToken(r);
        setTokenCountdown(300);
      }
      setSubmitting(false);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleApproveReject = (decision) => {
    // Show PIN dialog when user tries to approve/reject
    setPendingDecision(decision);
    setPinDialogOpen(true);
    setPinInput('');
    setPinError('');
  };

  const handlePinConfirm = async () => {
    if (!pinInput.trim()) {
      setPinError('PIN is required');
      return;
    }

    if (pinInput.length !== 4 || !/^\d+$/.test(pinInput)) {
      setPinError('PIN must be 4 digits');
      return;
    }

    // Send decision with PIN
    if (!pendingToken || !pendingDecision) {
      console.error('Missing pendingToken or pendingDecision');
      setPinError('Transaction data missing');
      return;
    }
    
    console.log('📤 Sending PIN verification:', {
      token: pendingToken.token ? pendingToken.token.substring(0, 20) + '...' : 'NO TOKEN',
      decision: pendingDecision,
      pin_length: pinInput.length,
      pin_value: '****'
    });
    
    setDecidingToken(true);
    try {
      const response = await transactionAPI.decideToken({
        token: pendingToken.token,
        decision: pendingDecision,
        pin: pinInput.trim()
      });
      console.log('✅ PIN verified successfully');
      setResult({
        ...pendingToken,
        status: pendingDecision === 'confirm' ? 'completed' : 'denied'
      });
      setPendingToken(null);
      setPinDialogOpen(false);
      setPendingDecision(null);
      setPinInput('');
    } catch (err) {
      console.error('❌ PIN verification failed:', err);
      setPinError(`Failed: ${err.message}`);
    } finally {
      setDecidingToken(false);
    }
  };



  const riskColor = {
    Low: "var(--success)", Medium: "var(--warning)",
    High: "var(--danger)", Critical: "var(--critical)"
  };

  // Format countdown timer (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Token approval UI — shows when high-risk transaction requires approval
  if (pendingToken) {
    const isUrgent = tokenCountdown < 60;
    const isExpired = tokenCountdown <= 0;
    const tokenHash = pendingToken.token || '0'.repeat(64);

    if (isExpired) {
      return (
        <Layout>
          <PageHeader title="❌ Token Expired" />
          <div className="page-content page-enter" style={{ maxWidth: 600 }}>
            <div className="card" style={{ textAlign: "center", padding: 36, border: "2px solid #dc2626" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>⏰</div>
              <h2 style={{ marginBottom: 8, color: "#dc2626" }}>Transaction Expired</h2>
              <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
                The 7-minute approval window has expired. Your transaction has been automatically cancelled.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn btn-primary" onClick={() => { setPendingToken(null); setResult(null); setForm(f => ({ ...f, receiver_upi: "", amount: "" })); }}>
                  New Transaction
                </button>
                <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        </Layout>
      );
    }

    return (
      <Layout>
        <PageHeader title="⏱️ Approve Your Transaction" />
        <div className="page-content page-enter" style={{ maxWidth: 600 }}>
          
          {/* Big Countdown Timer */}
          <div style={{
            background: isUrgent ? "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)" : "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)",
            border: `3px solid ${isUrgent ? "#dc2626" : "#f97316"}`,
            borderRadius: 12,
            padding: 32,
            marginBottom: 24,
            textAlign: "center"
          }}>
            <div style={{ color: isUrgent ? "#991b1b" : "#92400e", marginBottom: 12, fontSize: "14px", fontWeight: "600" }}>
              ⏳ TIME REMAINING
            </div>
            <div style={{
              fontSize: "4rem",
              fontWeight: "bold",
              fontFamily: "monospace",
              color: isUrgent ? "#dc2626" : "#ea580c",
              animation: isUrgent ? "pulse 1s infinite" : "none",
              letterSpacing: 8
            }}>
              {formatTime(tokenCountdown)}
            </div>
            <div style={{ color: isUrgent ? "#7f1d1d" : "#c2410c", marginTop: 12, fontSize: "12px" }}>
              {isUrgent && "⚠️ Less than 1 minute remaining"}
            </div>
          </div>

          {/* Transaction Card */}
          <div className="card" style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            marginBottom: 24,
            padding: 20
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Transaction Details</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                ["📤 To", pendingToken.receiver_upi],
                ["💰 Amount", "₹" + Number(pendingToken.amount).toLocaleString("en-IN")],
                ["⚡ Risk Level", `${pendingToken.risk_level} (Score: ${pendingToken.risk_score})`],
                ["🔐 Token Hash", tokenHash]
              ].map(([label, value]) => (
                <div key={label} style={{
                  padding: 12,
                  background: label.includes("Hash") ? "#1f2937" : "var(--bg-surface)",
                  borderRadius: 6,
                  border: label.includes("Hash") ? "1px solid #10b981" : "1px solid var(--border)"
                }}>
                  <div style={{ fontSize: "11px", color: label.includes("Hash") ? "#10b981" : "var(--text-muted)", fontWeight: "600", marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: label.includes("Hash") ? "11px" : "14px",
                    fontWeight: "600",
                    color: label.includes("Hash") ? "#10b981" : "var(--text-primary)",
                    fontFamily: label.includes("Hash") ? "monospace" : "inherit",
                    wordBreak: "break-all",
                    letterSpacing: label.includes("Hash") ? 1 : 0
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons - BIG */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <button
              onClick={() => handleApproveReject('confirm')}
              disabled={isExpired}
              style={{
                flex: 1,
                padding: "16px 24px",
                background: "#22c55e",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "16px",
                fontWeight: "bold",
                cursor: isExpired ? "not-allowed" : "pointer",
                opacity: isExpired ? 0.6 : 1,
                transform: "scale(1)",
                transition: "all 0.2s"
              }}
            >
              ✓ APPROVE
            </button>
            <button
              onClick={() => handleApproveReject('deny')}
              disabled={isExpired}
              style={{
                flex: 1,
                padding: "16px 24px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "16px",
                fontWeight: "bold",
                cursor: isExpired ? "not-allowed" : "pointer",
                opacity: isExpired ? 0.6 : 1,
                transform: "scale(1)",
                transition: "all 0.2s"
              }}
            >
              ✗ DENY
            </button>
          </div>

          {/* Warning */}
          {isUrgent && (
            <div style={{
              background: "#fee2e2",
              border: "2px solid #dc2626",
              borderRadius: 6,
              padding: 12,
              textAlign: "center",
              color: "#7f1d1d",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              ⚠️ Hurry! Less than 1 minute to approve
            </div>
          )}

          {error && (
            <Alert type="danger" style={{ marginTop: 16 }}>{error}</Alert>
          )}
        </div>
      </Layout>
    );
  }

  if (result) {
    const isSuccess = result.status === "completed";
    const isDenied = result.status === "denied";
    const isTokenPending = result.status === "token_pending";
    
    // If token is pending, show approval panel with countdown
    if (isTokenPending && !pendingToken) {
      setPendingToken(result);
      setTokenCountdown(result.seconds_remaining || 300);
    }
    
    return (
      <Layout>
        <PageHeader title={isSuccess ? "✅ Payment Successful" : isDenied ? "❌ Payment Denied" : isTokenPending ? "⏱️ Approve Your Transaction" : "⏳ Transaction Initiated"} />
        <div className="page-content page-enter" style={{ maxWidth: 600 }}>
          {/* Final Result Screen - Success or Denied */}
          {!isTokenPending && (
          <div className="card" style={{
            background: isSuccess ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" : isDenied ? "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)" : "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)",
            border: `3px solid ${isSuccess ? "#10b981" : isDenied ? "#dc2626" : "#f97316"}`,
            textAlign: "center",
            padding: 48,
            borderRadius: 12
          }}>
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>
              {isSuccess ? "✅" : isDenied ? "❌" : "⏳"}
            </div>
            <h2 style={{ marginBottom: 8, color: isSuccess ? "#065f46" : isDenied ? "#7f1d1d" : "#92400e" }}>
              {isSuccess ? "Payment Approved!" : isDenied ? "Payment Denied" : "Awaiting Review"}
            </h2>
            <p style={{ color: isSuccess ? "#047857" : isDenied ? "#b91c1c" : "#b45309", marginBottom: 24, fontSize: "16px" }}>
              {isSuccess
                ? "Your transaction has been successfully completed. A confirmation email has been sent."
                : isDenied
                ? "You have declined this transaction. It has been cancelled."
                : "Your transaction is under review. Please wait for completion."}
            </p>

            {/* Transaction Summary */}
            <div style={{
              background: "rgba(255,255,255,0.7)",
              borderRadius: 8,
              padding: 20,
              marginBottom: 24,
              textAlign: "left"
            }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>Transaction Details</h4>
              {[
                ["📤 Recipient", result.receiver_upi],
                ["💰 Amount", "₹" + Number(result.amount).toLocaleString("en-IN")],
                ["⚡ Risk Level", result.risk_level],
                ["✓ Status", result.status],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px" }}>
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <strong style={{ fontFamily: "monospace" }}>{v}</strong>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button style={{
                padding: "12px 24px",
                background: isSuccess ? "#10b981" : isDenied ? "#dc2626" : "#f97316",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer"
              }} onClick={() => navigate("/history")}>
                View Transaction History
              </button>
              <button style={{
                padding: "12px 24px",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer"
              }} onClick={() => navigate("/pending-tokens")}>
                View Pending Tokens
              </button>
              <button style={{
                padding: "12px 24px",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer"
              }} onClick={() => { setResult(null); setForm(f => ({ ...f, receiver_upi: "", amount: "", notes: "" })); }}>
                New Transaction
              </button>
            </div>
          </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="New Transaction" subtitle="AI risk analysis runs as you type" />
      <div className="page-content page-enter">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>

          {/* Left: form */}
          <form className="card" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3>Transaction Details</h3>

            {error && <Alert type="danger">{error}</Alert>}

            <div className="form-group">
              <label className="form-label">Receiver UPI ID</label>
              <input
                className="form-input mono"
                placeholder="merchant@okaxis"
                value={form.receiver_upi}
                onChange={set("receiver_upi")}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Amount (₹)</label>
              <input
                className="form-input mono"
                type="number"
                placeholder="0.00"
                min="1"
                max="200000"
                step="0.01"
                value={form.amount}
                onChange={set("amount")}
                required
              />
              <span className="form-hint">UPI limit: ₹2,00,000 per transaction</span>
            </div>

            <div className="form-group">
              <label className="form-label">Your City (for location analysis)</label>
              <select className="form-input" value={form.sender_city} onChange={set("sender_city")}>
                {CITIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input
                className="form-input"
                placeholder="Rent payment, groceries, etc."
                value={form.notes}
                onChange={set("notes")}
              />
            </div>

            {/* Warning banners based on risk */}
            {risk && risk.level === "Critical" && (
              <Alert type="danger" title="Critical Risk — Do Not Proceed">
                Our AI has flagged this transaction as critically risky. 
                Proceeding will require token confirmation. Consider cancelling.
              </Alert>
            )}
            {risk && risk.level === "High" && (
              <Alert type="warning" title="High Risk Detected">
                Multiple risk factors identified. A 5-minute delay token will be issued.
              </Alert>
            )}
            {risk && parseFloat(form.amount) > 10000 && (
              <Alert type="info">
                Transactions above ₹10,000 require token confirmation.
              </Alert>
            )}

            <button
              type="submit"
              className={`btn btn-lg btn-full ${risk?.level === "Critical" ? "btn-danger" : "btn-primary"}`}
              disabled={submitting || !form.receiver_upi || !form.amount}
            >
              {submitting
                ? <><Spinner size={18} color="#fff" /> Processing…</>
                : risk?.requires_token
                ? "⏳ Initiate with Review Token"
                : "↗ Initiate Transaction"}
            </button>
          </form>

          {/* Right: live risk panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Risk meter */}
            <div>
              {loading && !risk && (
                <div className="card" style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                  <Spinner size={24} />
                </div>
              )}
              {risk && (
                <RiskMeter score={risk.score} level={risk.level} reasons={risk.reasons} />
              )}
              {!risk && !loading && (
                <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>🤖</div>
                  <p style={{ fontSize: "0.875rem" }}>
                    Enter a UPI ID and amount to see the AI risk score in real time.
                  </p>
                </div>
              )}
            </div>

            {/* Token info card */}
            {risk?.requires_token && (
              <div className="card" style={{ border: "1px solid var(--warning-border)", background: "var(--warning-bg)" }}>
                <h3 style={{ color: "var(--warning)", marginBottom: 8 }}>⏳ Delay Token Required</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Due to high risk or large amount, a 5-minute review window will be created.
                  You'll receive an email and can confirm or deny within that window.
                </p>
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.08)", borderRadius: "var(--radius-md)", fontSize: "0.8rem", color: "var(--warning)" }}>
                  <strong>Why this exists:</strong> Most UPI frauds rely on urgency.
                  This 5-minute pause breaks that pattern.
                </div>
              </div>
            )}

            {/* Location info */}
            {risk?.location_mismatch && (
              <Alert type="warning" title="Location Mismatch">
                The receiver's usual transaction city differs from your current location.
                This is a common indicator of social engineering fraud.
              </Alert>
            )}
          </div>
        </div>
      </div>

      {/* PIN Dialog — shown after transaction is initiated if high-risk */}
      {pinDialogOpen && (
        <div className="modal-overlay" onClick={() => setPinDialogOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Verify Transaction PIN</h3>
            <p>Enter your 4-digit transaction PIN to verify and complete this transaction</p>
            
            <input
              type="password"
              maxLength="4"
              placeholder="0000"
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '18px',
                letterSpacing: '2px',
                textAlign: 'center',
                marginBottom: '10px',
                border: pinError ? '2px solid #dc2626' : '1px solid #ddd',
                borderRadius: '4px'
              }}
            />

            {pinError && <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '15px', textAlign: 'center' }}>{pinError}</p>}

            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '15px' }}>
              📌 Your PIN is never shared with anyone and only used to verify your identity.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setPinDialogOpen(false);
                  setPendingDecision(null);
                  setPinInput('');
                  setPinError('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#e5e7eb',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#1f2937'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePinConfirm}
                disabled={decidingToken || pinInput.length !== 4}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: decidingToken || pinInput.length !== 4 ? '#9ca3af' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: decidingToken || pinInput.length !== 4 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {decidingToken ? '⏳ Processing...' : pinInput.length !== 4 ? '⏳ Enter 4 digits' : '✓ Verify & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
