// frontend/src/pages/MyFraudReports.jsx
import { useState, useEffect } from "react";
import Layout from "../components/common/Layout";
import { PageHeader, Spinner, Alert } from "../components/common/UI";
import { fraudAPI } from "../services/api";
import "../styles/dashboard.css";

const STATUS_COLORS = {
  pending:  "#f59e0b",
  reviewed: "#3b82f6",
  actioned: "#22c55e",
  dismissed: "#94a3b8",
};

const STATUS_LABELS = {
  pending: "⏳ Pending Review",
  reviewed: "👀 Under Review",
  actioned: "✅ Action Taken",
  dismissed: "❌ Dismissed",
};

const CATEGORIES = {
  fake_identity: "🎭 Fake Identity",
  unauthorized: "💸 Unauthorized Charge",
  phishing: "🎣 Phishing Attempt",
  social_engineering: "📞 Social Engineering",
  other: "⚑ Other",
};

export default function MyFraudReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fraudAPI.getMyReports();
      setReports(data);
    } catch (err) {
      setError(err.message || "Failed to load fraud reports");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Spinner />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <PageHeader
        title="My Fraud Reports"
        subtitle={`You've submitted ${reports.length} fraud report${reports.length !== 1 ? "s" : ""}`}
      />
      <div className="page-content page-enter">
        {error && <Alert type="danger">{error}</Alert>}
        
        {reports.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>📋</div>
            <h3>No Reports Yet</h3>
            <p>You haven't submitted any fraud reports. Help protect the community by reporting suspicious activity.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
            {reports.map(report => (
              <div key={report.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Report #{report.id}
                    </div>
                    <div className="mono" style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>
                      {report.reported_upi}
                    </div>
                  </div>
                  <div style={{
                    background: `${STATUS_COLORS[report.status]}15`,
                    color: STATUS_COLORS[report.status],
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                  }}>
                    {STATUS_LABELS[report.status]}
                  </div>
                </div>

                {/* Category */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border-color)" }}>
                  <span style={{ fontSize: "16px" }}>{CATEGORIES[report.category]?.split(" ")[0]}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    {CATEGORIES[report.category]?.split(" ").slice(1).join(" ")}
                  </span>
                </div>

                {/* Timestamp */}
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  📅 {new Date(report.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>

                {/* Description summary */}
                <div style={{
                  background: "var(--bg-secondary)",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  maxHeight: "80px",
                  overflow: "hidden",
                  borderLeft: `3px solid ${STATUS_COLORS[report.status]}`,
                }}>
                  {report.description?.substring(0, 150)}
                  {report.description?.length > 150 ? "..." : ""}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border-color)", fontSize: "12px", color: "var(--text-muted)" }}>
                  <span>Status: <strong>{report.status}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
