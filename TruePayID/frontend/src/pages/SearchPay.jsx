// frontend/src/pages/SearchPay.jsx
// "Check Before You Pay" — look up any UPI ID's trust profile before sending money

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/common/Layout";
import { RiskBadge, Alert, PageHeader, Spinner } from "../components/common/UI";
import { transactionAPI } from "../services/api";
import "../styles/dashboard.css";

function TrustBar({ score }) {
  const color = score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--danger)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>
        <span>Trust Score</span><span style={{ color, fontWeight: 700 }}>{score}/100</span>
      </div>
      <div className="risk-meter-bar-track">
        <div className="risk-meter-bar-fill" style={{ width: `${score}%`, background: color, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

export default function SearchPay() {
  const navigate           = useNavigate();
  const [query, setQuery]  = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,  setError]  = useState("");
  const [mutual, setMutual] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(""); setResult(null); setMutual(null);
    setLoading(true);
    try {
      const r = await transactionAPI.lookup(query.trim());
      setResult(r);
      if (r.is_registered) {
        try { setMutual(await transactionAPI.getMutual(query.trim())); } catch {}
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (level) => ({ Low: "var(--success)", Medium: "var(--warning)", High: "var(--danger)", Critical: "var(--critical)" })[level];

  return (
    <Layout>
      <PageHeader
        title="Search & Verify"
        subtitle="Look up any UPI ID before sending money"
      />
      <div className="page-content page-enter">
        <div style={{ maxWidth: 600 }}>
          {/* Search box */}
          <div className="card" style={{ marginBottom: 16 }}>
            <form className="search-box" onSubmit={search}>
              <div className="search-input-wrap">
                <span className="search-icon">⊙</span>
                <input
                  className="form-input mono"
                  placeholder="Enter UPI ID or phone number…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
                {loading ? <Spinner size={18} color="#fff" /> : "Search"}
              </button>
            </form>
            <p className="form-hint" style={{ marginTop: 8 }}>
              Example: merchant@okaxis · 9876543210 · name@ybl
            </p>
          </div>

          {error && <Alert type="danger" style={{ marginBottom: 16 }}>{error}</Alert>}

          {/* Result card */}
          {result && (
            <div className="upi-result-card" style={{ marginBottom: 16 }}>
              <div className="upi-result-header">
                <div className="upi-avatar" style={{
                  background: result.is_registered
                    ? "linear-gradient(135deg, var(--indigo) 0%, var(--indigo-dark) 100%)"
                    : "linear-gradient(135deg, #374151 0%, #1f2937 100%)"
                }}>
                  {result.full_name ? result.full_name[0].toUpperCase() : "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="upi-result-name">
                    {result.full_name || "Unknown User"}
                    {!result.is_registered && (
                      <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400 }}>
                        (Not on TruePayID)
                      </span>
                    )}
                  </div>
                  <div className="upi-result-id">{result.upi_id}</div>
                </div>
                {result.trust_level && <RiskBadge level={
                  result.trust_score >= 70 ? "Low" :
                  result.trust_score >= 40 ? "Medium" : "High"
                } />}
              </div>

              <div className="upi-result-body">
                {result.is_registered ? (
                  <>
                    <TrustBar score={result.trust_score} />

                    <div className="upi-result-row">
                      <span className="upi-result-label">Trust Level</span>
                      <strong style={{ color: result.trust_score >= 70 ? "var(--success)" : result.trust_score >= 40 ? "var(--warning)" : "var(--danger)" }}>
                        {result.trust_level}
                      </strong>
                    </div>
                    <div className="upi-result-row">
                      <span className="upi-result-label">Fraud Reports</span>
                      <strong style={{ color: result.fraud_count > 0 ? "var(--danger)" : "var(--success)" }}>
                        {result.fraud_count}
                      </strong>
                    </div>
                    <div className="upi-result-row">
                      <span className="upi-result-label">Community Reports</span>
                      <strong>{result.report_count}</strong>
                    </div>
                    {result.usual_city && (
                      <div className="upi-result-row">
                        <span className="upi-result-label">Usually active in</span>
                        <strong>📍 {result.usual_city}</strong>
                      </div>
                    )}
                  </>
                ) : (
                  <Alert type="warning" title="Unverified UPI">
                    This UPI ID is not registered on TruePayID. We cannot verify their identity or show a trust score.
                    Proceed with extra caution, especially for large amounts.
                  </Alert>
                )}

                {/* Location mismatch warning */}
                {result.location_mismatch && (
                  <Alert type="warning" title="Location Mismatch Detected">
                    This receiver usually transacts from <strong>{result.usual_city}</strong>, 
                    which differs from your current location. This is a known fraud pattern.
                  </Alert>
                )}

                {result.risk_message && !result.location_mismatch && (
                  <Alert type={result.fraud_count > 0 ? "danger" : "info"}>
                    {result.risk_message}
                  </Alert>
                )}
              </div>

              {/* Mutual history */}
              {mutual && (
                <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}>
                  <div className="mutual-history-card">
                    <div className="mutual-icon">🤝</div>
                    <div className="mutual-info">
                      <div className="mutual-title">Your Mutual History</div>
                      <div className="mutual-desc">{mutual.behavior_summary}</div>
                      {mutual.fraud_report_count > 0 && (
                        <div style={{ color: "var(--danger)", fontSize: "0.78rem", marginTop: 4, fontWeight: 600 }}>
                          ⚠ {mutual.fraud_report_count} fraud report(s) on record
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/pay?receiver=${encodeURIComponent(result.upi_id)}`)}
                >
                  Pay {result.full_name ? result.full_name.split(" ")[0] : "this UPI"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate(`/report-fraud?upi=${encodeURIComponent(result.upi_id)}`)}
                >
                  Report Fraud
                </button>
              </div>
            </div>
          )}

          {/* Guide when empty */}
          {!result && !loading && !error && (
            <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔍</div>
              <h3 style={{ marginBottom: 8 }}>Verify any UPI before paying</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
                Enter a UPI ID or phone number above to see their TruePayID trust score,
                fraud history, location data, and AI risk analysis — before sending a single rupee.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
