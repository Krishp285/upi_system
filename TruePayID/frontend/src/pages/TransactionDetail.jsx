// frontend/src/pages/TransactionDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Layout from "../components/common/Layout";
import { RiskBadge, StatusBadge, RiskMeter, Alert, PageHeader, Spinner } from "../components/common/UI";
import { transactionAPI } from "../services/api";

export default function TransactionDetail() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const [tx, setTx]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,  setError]   = useState("");

  useEffect(() => {
    transactionAPI.getDetail(id)
      .then(setTx)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <Layout>
      <div className="page-content" style={{ paddingTop: 60, textAlign: "center" }}>
        <Spinner size={32} />
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="page-content">
        <Alert type="danger">{error}</Alert>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>← Back</button>
      </div>
    </Layout>
  );

  if (!tx) return null;

  const aiF = tx.ai_features || {};

  return (
    <Layout>
      <PageHeader
        title="Transaction Detail"
        subtitle={`ID #${tx.id}`}
        action={<button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>}
      />
      <div className="page-content page-enter">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>

          {/* Left: details + timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Core info */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div className="upi-avatar" style={{ width: 48, height: 48, fontSize: "1.2rem" }}>
                  {tx.receiver_upi[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: "1rem" }}>{tx.receiver_upi}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <RiskBadge level={tx.risk_level} />
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, fontFamily: "'DM Mono',monospace" }}>
                    ₹{Number(tx.amount).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {new Date(tx.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {[
                ["Risk Score",   `${tx.risk_score}/100`],
                ["Sender City",  tx.sender_city   || "—"],
                ["Receiver City",tx.receiver_city || "—"],
                ["Notes",        tx.notes || "—"],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", padding: "8px 0",
                  borderBottom: "1px solid var(--border)", fontSize: "0.875rem",
                }}>
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <strong style={{ fontFamily: "'DM Mono',monospace" }}>{v}</strong>
                </div>
              ))}

              {tx.location_mismatch && (
                <Alert type="warning" title="Location Mismatch" style={{ marginTop: 12 }}>
                  Receiver's usual city differs from sender location at time of transaction.
                </Alert>
              )}
            </div>

            {/* Timeline */}
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Transaction Timeline</h3>
              <div className="tx-detail-timeline">
                <div className={`timeline-item active`}>
                  <div className="timeline-label">Transaction Initiated</div>
                  <div className="timeline-time">{new Date(tx.created_at).toLocaleString("en-IN")}</div>
                </div>
                <div className={`timeline-item ${tx.risk_level !== "Low" ? "active" : ""}`}>
                  <div className="timeline-label">AI Risk Assessment</div>
                  <div className="timeline-time">Risk Score: {tx.risk_score}/100 — {tx.risk_level}</div>
                </div>
                {tx.status === "token_pending" && (
                  <div className="timeline-item active">
                    <div className="timeline-label">Delay Token Issued</div>
                    <div className="timeline-time">Awaiting user decision</div>
                  </div>
                )}
                <div className={`timeline-item ${tx.status === "completed" ? "success" : tx.status === "denied" ? "danger" : ""}`}>
                  <div className="timeline-label">
                    {tx.status === "completed" ? "Transaction Completed ✓"
                    : tx.status === "denied"    ? "Transaction Denied ✕"
                    : tx.status === "failed"    ? "Transaction Failed ✕"
                    : "Outcome Pending"}
                  </div>
                  <div className="timeline-time">{new Date(tx.updated_at).toLocaleString("en-IN")}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: AI analysis */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <RiskMeter
              score={tx.risk_score}
              level={tx.risk_level}
              reasons={aiF.reasons || []}
            />

            {/* AI feature snapshot */}
            {aiF && Object.keys(aiF).length > 0 && (
              <div className="card">
                <h3 style={{ marginBottom: 14 }}>AI Feature Snapshot</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 14 }}>
                  These were the exact features used to compute the fraud probability at transaction time.
                </p>
                {Object.entries(aiF).filter(([k]) => k !== "reasons").map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between", padding: "6px 0",
                    borderBottom: "1px solid var(--border)", fontSize: "0.8rem",
                  }}>
                    <span style={{ color: "var(--text-muted)", textTransform: "replace" }}>
                      {k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <strong className="mono" style={{ color: v === true ? "var(--danger)" : "var(--text-primary)" }}>
                      {typeof v === "boolean" ? (v ? "Yes ⚠" : "No ✓") : String(v)}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {/* Report fraud about this transaction */}
            <Link
              to={`/report-fraud?upi=${encodeURIComponent(tx.receiver_upi)}&tx=${tx.id}`}
              className="btn btn-secondary"
              style={{ textAlign: "center" }}
            >
              ⚑ Report Fraud for this Transaction
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
