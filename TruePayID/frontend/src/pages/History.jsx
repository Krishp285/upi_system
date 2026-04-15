// frontend/src/pages/History.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/common/Layout";
import { RiskBadge, StatusBadge, EmptyState, PageHeader, Spinner, Alert } from "../components/common/UI";
import { transactionAPI } from "../services/api";
import "../styles/dashboard.css";

const STATUS_FILTERS = ["All", "completed", "token_pending", "denied", "failed"];
const RISK_FILTERS   = ["All", "Low", "Medium", "High", "Critical"];

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function History() {
  const [txns,   setTxns]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,  setError]  = useState("");
  const [page,   setPage]   = useState(1);
  const [total,  setTotal]  = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter,   setRiskFilter]   = useState("All");

  const PAGE_SIZE = 20;

  const load = async (p = 1, reset = false) => {
    setLoading(true);
    try {
      const params = {
        page: p, page_size: PAGE_SIZE,
        ...(statusFilter !== "All" ? { status: statusFilter } : {}),
        ...(riskFilter   !== "All" ? { risk_level: riskFilter } : {}),
      };
      const data = await transactionAPI.getHistory(params);
      setTxns(prev => reset ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(data.has_more);
      setPage(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, true); }, [statusFilter, riskFilter]);

  return (
    <Layout>
      <PageHeader
        title="Transaction History"
        subtitle={`${total} total transactions`}
      />
      <div className="page-content page-enter">

        {/* Filters */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Status
            </span>
          </div>
          <div className="filter-bar">
            {STATUS_FILTERS.map(f => (
              <button key={f} className={`filter-chip ${statusFilter === f ? "active" : ""}`}
                onClick={() => setStatusFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Risk Level
            </span>
          </div>
          <div className="filter-bar">
            {RISK_FILTERS.map(f => (
              <button key={f} className={`filter-chip ${riskFilter === f ? "active" : ""}`}
                onClick={() => setRiskFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && <Alert type="danger">{error}</Alert>}

        {/* Transaction list */}
        {txns.length === 0 && !loading ? (
          <EmptyState
            icon="🧾"
            title="No transactions found"
            desc="Try changing your filters, or initiate your first transaction."
            action={<Link to="/pay" className="btn btn-primary" style={{ marginTop: 16 }}>New Transaction</Link>}
          />
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 140px",
              padding: "10px 20px", borderBottom: "1px solid var(--border)",
              fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              <span>Recipient</span>
              <span>Amount</span>
              <span>Risk</span>
              <span>Status</span>
              <span>Date</span>
            </div>

            {txns.map((tx, i) => (
              <Link
                key={tx.id}
                to={`/transaction/${tx.id}`}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 140px",
                  padding: "14px 20px", borderBottom: i < txns.length - 1 ? "1px solid var(--border)" : "none",
                  alignItems: "center", textDecoration: "none", cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}
              >
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {tx.receiver_upi}
                  </div>
                  {tx.notes && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{tx.notes}</div>}
                  {tx.location_mismatch && (
                    <span style={{ fontSize: "0.68rem", color: "var(--warning)", fontWeight: 600 }}>📍 Location mismatch</span>
                  )}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: "0.95rem" }}>
                  ₹{Number(tx.amount).toLocaleString("en-IN")}
                </div>
                <div><RiskBadge level={tx.risk_level} /></div>
                <div><StatusBadge status={tx.status} /></div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{formatDate(tx.created_at)}</div>
              </Link>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size={24} />
              </div>
            )}
          </div>
        )}

        {hasMore && !loading && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => load(page + 1)}>
              Load More
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
