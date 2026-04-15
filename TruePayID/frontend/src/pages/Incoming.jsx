// frontend/src/pages/Incoming.jsx
import { useEffect, useState } from "react";
import Layout from "../components/common/Layout";
import { StatusBadge, RiskBadge, EmptyState, PageHeader, Spinner, Alert } from "../components/common/UI";
import { transactionAPI } from "../services/api";

export default function Incoming() {
  const [txns, setTxns]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    transactionAPI.getIncoming()
      .then(setTxns)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <PageHeader title="Incoming Transactions" subtitle="Transactions received by your UPI ID" />
      <div className="page-content page-enter">
        {error && <Alert type="danger">{error}</Alert>}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}><Spinner size={32} /></div>
        ) : txns.length === 0 ? (
          <EmptyState icon="↙" title="No incoming transactions" desc="Transactions sent to your UPI ID will appear here." />
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 140px",
              padding: "10px 20px", borderBottom: "1px solid var(--border)",
              fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              <span>From</span><span>Amount</span><span>Risk</span><span>Status</span><span>Date</span>
            </div>
            {txns.map((tx, i) => (
              <div key={tx.id} style={{
                display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 140px",
                padding: "14px 20px", borderBottom: i < txns.length - 1 ? "1px solid var(--border)" : "none",
                alignItems: "center",
              }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "0.875rem", fontWeight: 600 }}>Sender #{tx.sender_id}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>₹{Number(tx.amount).toLocaleString("en-IN")}</div>
                <div><RiskBadge level={tx.risk_level} /></div>
                <div><StatusBadge status={tx.status} /></div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {new Date(tx.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
