// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/common/Layout";
import { TrustScoreRing, RiskBadge, StatusBadge, CountdownRing, EmptyState, PageHeader, Spinner, Alert } from "../components/common/UI";
import { dashboardAPI, transactionAPI } from "../services/api";
import "../styles/dashboard.css";

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function formatINR(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function Dashboard() {
  const navigate            = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [tokenSeconds, setTokenSeconds] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const d = await dashboardAPI.getDashboard();
      setData(d);
      // Initialize per-token countdown
      const secs = {};
      (d.pending_tokens || []).forEach(t => { secs[t.token] = t.seconds_remaining; });
      setTokenSeconds(secs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Live countdown for all pending tokens
  useEffect(() => {
    if (!Object.keys(tokenSeconds).length) return;
    const id = setInterval(() => {
      setTokenSeconds(prev => {
        const next = { ...prev };
        let anyLeft = false;
        Object.keys(next).forEach(k => {
          if (next[k] > 0) { next[k]--; anyLeft = true; }
        });
        if (!anyLeft) clearInterval(id);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [tokenSeconds]);

  if (loading) return (
    <Layout>
      <PageHeader title="Dashboard" subtitle="Your fraud intelligence hub" />
      <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
        <Spinner size={32} />
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <PageHeader title="Dashboard" />
      <div className="page-content"><Alert type="danger">{error}</Alert></div>
    </Layout>
  );

  const { user, trust_score: ts, alerts, pending_tokens, recent_transactions, stats } = data;
  const TOTAL_TOKEN_SECS = 300;

  return (
    <Layout>
      <PageHeader
        title={`Welcome back, ${user.full_name.split(" ")[0]} 👋`}
        subtitle="Here's your fraud intelligence dashboard"
      />
      <div className="page-content page-enter">

        {/* Pending token alerts — top priority */}
        {pending_tokens.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {pending_tokens.map((tok) => {
              const secs = tokenSeconds[tok.token] ?? tok.seconds_remaining;
              return (
                <div key={tok.token} className="token-alert-card" style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <CountdownRing secondsRemaining={secs} totalSeconds={TOTAL_TOKEN_SECS} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "var(--warning)", fontSize: "0.9rem" }}>
                        🔔 Action required: Transaction pending
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "4px 0" }}>
                        To <span className="mono">{tok.receiver_upi}</span> · {formatINR(tok.amount)} ·{" "}
                        <RiskBadge level={tok.risk_level} />
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Expires in {Math.floor(secs / 60)}m {secs % 60}s
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/token/${tok.token}`)}
                    >
                      Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Other alerts */}
        {alerts.filter(a => a.type !== "token_expiring").map((a, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <Alert type={a.severity || "info"}>{a.message}</Alert>
          </div>
        ))}

        {/* Stats row */}
        <div className="dashboard-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Trust Score</span>
              <div className="stat-icon stat-icon-indigo">🛡️</div>
            </div>
            <div className="stat-value" style={{ color: "var(--indigo-light)" }}>{ts?.score ?? 50}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Level: <strong>{ts?.level ?? "Unrated"}</strong></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Transactions</span>
              <div className="stat-icon stat-icon-green">↗</div>
            </div>
            <div className="stat-value" style={{ color: "var(--success)" }}>{stats.total_transactions}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Total initiated</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">High Risk</span>
              <div className="stat-icon stat-icon-red">⚠</div>
            </div>
            <div className="stat-value" style={{ color: stats.high_risk_transactions > 0 ? "var(--danger)" : "var(--text-muted)" }}>
              {stats.high_risk_transactions}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Flagged transactions</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Pending</span>
              <div className="stat-icon stat-icon-yellow">⏳</div>
            </div>
            <div className="stat-value" style={{ color: stats.pending_tokens > 0 ? "var(--warning)" : "var(--text-muted)" }}>
              {stats.pending_tokens}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Awaiting decision</div>
          </div>
        </div>

        {/* Main grid: trust score + quick actions | recent transactions */}
        <div className="dashboard-grid-wide" style={{ marginBottom: 16 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Trust Score Card */}
            <div className="trust-score-card card">
              <h3 style={{ marginBottom: 16 }}>Your Trust Profile</h3>
              {ts && <TrustScoreRing score={ts.score} level={ts.level} />}
              <div className="trust-score-meta">
                <div>
                  <div className="trust-meta-item-val" style={{ color: "var(--danger)" }}>{ts?.fraud_count ?? 0}</div>
                  <div className="trust-meta-item-label">Fraud incidents</div>
                </div>
                <div>
                  <div className="trust-meta-item-val" style={{ color: "var(--warning)" }}>{ts?.report_count ?? 0}</div>
                  <div className="trust-meta-item-label">Reports</div>
                </div>
                <div>
                  <div className="trust-meta-item-val" style={{ color: "var(--success)" }}>{ts?.tx_count ?? 0}</div>
                  <div className="trust-meta-item-label">Transactions</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h3 style={{ marginBottom: 14 }}>Quick Actions</h3>
              <div className="quick-actions">
                {[
                  { to: "/search",       icon: "⊙", label: "Check Before Pay" },
                  { to: "/pay",          icon: "↗", label: "New Transaction" },
                  { to: "/history",      icon: "⊟", label: "View History" },
                  { to: "/incoming",     icon: "↙", label: "Incoming" },
                  { to: "/report-fraud", icon: "⚑", label: "Report Fraud" },
                  { to: "/search",       icon: "◎", label: "Verify UPI" },
                ].map(a => (
                  <Link key={a.to + a.label} to={a.to} className="quick-action">
                    <div className="quick-action-icon">{a.icon}</div>
                    <span className="quick-action-label">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — Recent transactions */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Recent Transactions</h3>
              <Link to="/history" style={{ fontSize: "0.8rem", color: "var(--indigo-light)", textDecoration: "none", fontWeight: 600 }}>
                View all →
              </Link>
            </div>

            {recent_transactions.length === 0 ? (
              <EmptyState icon="🧾" title="No transactions yet" desc="Initiate your first payment analysis" />
            ) : (
              <div className="tx-list">
                {recent_transactions.map(tx => (
                  <Link key={tx.id} to={`/transaction/${tx.id}`} className="tx-item">
                    <div className="tx-avatar">
                      {tx.receiver_upi[0].toUpperCase()}
                    </div>
                    <div className="tx-info">
                      <div className="tx-upi mono">{tx.receiver_upi}</div>
                      <div className="tx-meta">
                        <RiskBadge level={tx.risk_level} /> · <StatusBadge status={tx.status} />
                      </div>
                    </div>
                    <div className="tx-right">
                      <div className="tx-amount">{formatINR(tx.amount)}</div>
                      <div className="tx-time">{formatDate(tx.created_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
