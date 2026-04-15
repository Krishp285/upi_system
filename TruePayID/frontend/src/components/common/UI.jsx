// frontend/src/components/common/UI.jsx
// Shared atomic UI components used across pages

export function Spinner({ size = 20, color }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size, ...(color ? { borderTopColor: color } : {}) }}
    />
  );
}

export function Alert({ type = "info", title, children, icon }) {
  const icons = { info: "ℹ️", warning: "⚠️", danger: "🚨", success: "✅" };
  return (
    <div className={`alert alert-${type}`}>
      <span className="alert-icon">{icon || icons[type]}</span>
      <div className="alert-text">
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function RiskBadge({ level }) {
  const map = { Low: "low", Medium: "medium", High: "high", Critical: "critical" };
  const icons = { Low: "✓", Medium: "⚡", High: "⚠", Critical: "🚨" };
  return (
    <span className={`badge badge-${map[level] || "medium"}`}>
      {icons[level]} {level}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {status === "completed" && "✓ "}
      {status === "denied" && "✕ "}
      {status === "pending" && "⏳ "}
      {status === "token_pending" && "⏳ "}
      {status === "expired" && "○ "}
      {status}
    </span>
  );
}

export function TrustScoreRing({ score, level }) {
  const RADIUS    = 40;
  const CIRC      = 2 * Math.PI * RADIUS;
  const filled    = CIRC * (score / 100);
  const offset    = CIRC - filled;

  const strokeColors = {
    Low: "#ef4444", Medium: "#f59e0b", High: "#10b981",
    Excellent: "#6366f1", Unrated: "#4a5568",
  };
  const stroke = strokeColors[level] || "#6366f1";

  return (
    <div className="trust-score-ring">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle className="trust-score-ring-bg" cx="50" cy="50" r={RADIUS} />
        <circle
          className="trust-score-ring-fill"
          cx="50" cy="50" r={RADIUS}
          stroke={stroke}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="trust-score-value">
        <span className="trust-score-number" style={{ color: stroke }}>{score}</span>
        <span className="trust-score-label">{level}</span>
      </div>
    </div>
  );
}

export function RiskMeter({ score, level, reasons = [] }) {
  const fillClass = {
    Low: "risk-fill-low", Medium: "risk-fill-medium",
    High: "risk-fill-high", Critical: "risk-fill-critical",
  }[level] || "risk-fill-medium";

  const levelColors = {
    Low: "var(--success)", Medium: "var(--warning)",
    High: "var(--danger)", Critical: "var(--critical)",
  };

  return (
    <div className="risk-meter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          AI Risk Score
        </span>
        <span style={{ fontSize: "1.4rem", fontWeight: 800, fontFamily: "'DM Mono', monospace", color: levelColors[level] }}>
          {score}
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>/100</span>
        </span>
      </div>
      <div className="risk-meter-bar-track">
        <div className={`risk-meter-bar-fill ${fillClass}`} style={{ width: `${score}%` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
        <span>Safe</span><span>Critical</span>
      </div>
      {reasons.length > 0 && (
        <div className="risk-reasons">
          {reasons.map((r, i) => (
            <div key={i} className="risk-reason">
              <span className="risk-reason-dot">›</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CountdownRing({ secondsRemaining, totalSeconds }) {
  const RADIUS = 27;
  const CIRC   = 2 * Math.PI * RADIUS;
  const pct    = secondsRemaining / totalSeconds;
  const offset = CIRC - CIRC * pct;
  const mins   = Math.floor(secondsRemaining / 60);
  const secs   = secondsRemaining % 60;

  return (
    <div className="countdown-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle className="countdown-ring-track" cx="32" cy="32" r={RADIUS} />
        <circle
          className="countdown-ring-fill"
          cx="32" cy="32" r={RADIUS}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
      <div className="countdown-ring-text">
        {mins > 0 ? `${mins}m` : `${secs}s`}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "📭", title, desc, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {desc && <p className="empty-state-desc">{desc}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </div>
  );
}
