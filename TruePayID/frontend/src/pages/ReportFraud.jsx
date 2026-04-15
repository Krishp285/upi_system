// frontend/src/pages/ReportFraud.jsx
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "../components/common/Layout";
import { Alert, PageHeader, Spinner } from "../components/common/UI";
import { fraudAPI } from "../services/api";
import "../styles/dashboard.css";

const CATEGORIES = [
  { value: "fake_identity",       label: "Fake Identity",        icon: "🎭" },
  { value: "unauthorized",        label: "Unauthorized Charge",  icon: "💸" },
  { value: "phishing",            label: "Phishing Attempt",     icon: "🎣" },
  { value: "social_engineering",  label: "Social Engineering",   icon: "📞" },
  { value: "other",               label: "Other",                icon: "⚑"  },
];

export default function ReportFraud() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();

  const [form, setForm] = useState({
    reported_upi:      params.get("upi") || "",
    category:          "",
    custom_attack_type: "",
    description:       "",
    transaction_id:    params.get("tx") ? parseInt(params.get("tx")) : null,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) { setError("Please select a fraud category"); return; }
    setError(""); setLoading(true);
    try {
      await fraudAPI.submitReport(form);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <Layout>
      <div className="page-content page-enter" style={{ maxWidth: 500 }}>
        <div className="card" style={{ textAlign: "center", padding: 48, border: "1px solid var(--success-border)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>✅</div>
          <h2 style={{ color: "var(--success)", marginBottom: 8 }}>Report Submitted</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 28 }}>
            Your fraud report has been received. The reported UPI's trust score has been
            updated and our team will review it. Thank you for protecting the community.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button className="btn btn-secondary" onClick={() => { setDone(false); setForm(f => ({ ...f, reported_upi: "", category: "", description: "" })); }}>
              Report Another
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <PageHeader
        title="Report Fraud"
        subtitle="Help protect the community from fraud"
      />
      <div className="page-content page-enter">
        <div className="fraud-form" style={{ maxWidth: 560 }}>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <span className="alert-icon">ℹ️</span>
            <div className="alert-text">
              <div className="alert-title">How this helps</div>
              Fraud reports directly reduce the reported UPI's trust score, 
              alerting other users before they transact. Only submit genuine reports.
            </div>
          </div>

          <form className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }} onSubmit={handleSubmit}>
            <h3>Fraud Report</h3>

            {error && <Alert type="danger">{error}</Alert>}

            <div className="form-group">
              <label className="form-label">Reported UPI ID</label>
              <input
                className="form-input mono"
                placeholder="suspicious@upi"
                value={form.reported_upi}
                onChange={set("reported_upi")}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fraud Category</label>
              <div className="category-grid">
                {CATEGORIES.map(c => (
                  <div
                    key={c.value}
                    className={`category-option ${form.category === c.value ? "selected" : ""}`}
                    onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  >
                    <span>{c.icon}</span>
                    {c.label}
                  </div>
                ))}
              </div>
            </div>

            {form.category === "other" && (
              <div className="form-group">
                <label className="form-label">Specify Attack Type (Optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g., Account takeover, Sim swap, etc."
                  value={form.custom_attack_type}
                  onChange={set("custom_attack_type")}
                  maxLength={255}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                placeholder="Describe what happened in detail. Include any relevant context about the fraud attempt. (min. 20 characters)"
                value={form.description}
                onChange={set("description")}
                required
                minLength={20}
                rows={5}
              />
              <span className="form-hint">{form.description.length} / 500 characters</span>
            </div>

            {form.transaction_id && (
              <div className="alert alert-info">
                <span className="alert-icon">🔗</span>
                <span className="alert-text">This report is linked to Transaction #{form.transaction_id}</span>
              </div>
            )}

            <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: "0.8rem", color: "var(--danger)" }}>
              <strong>⚠ Important:</strong> False reports are a violation of TruePayID terms and will result in
              a trust score penalty to your own account.
            </div>

            <button type="submit" className="btn btn-danger btn-lg btn-full" disabled={loading}>
              {loading
                ? <><Spinner size={18} color="#fff" /> Submitting…</>
                : "⚑ Submit Fraud Report"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
