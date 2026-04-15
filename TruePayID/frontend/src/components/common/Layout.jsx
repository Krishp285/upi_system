// frontend/src/components/common/Layout.jsx
// App shell — persistent sidebar + main area for authenticated pages

import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import "../../styles/layout.css";

const NAV_ITEMS = [
  { path: "/dashboard",      icon: "⬡",  label: "Dashboard" },
  { path: "/search",         icon: "⊙",  label: "Search & Verify" },
  { path: "/pay",            icon: "↗",  label: "New Transaction" },
  { path: "/history",        icon: "⊟",  label: "History" },
  { path: "/incoming",       icon: "↙",  label: "Incoming" },
  { path: "/report-fraud",   icon: "⚑",  label: "Report Fraud" },
  { path: "/my-fraud-reports", icon: "📋",  label: "My Reports" , isSubsection: true },
];

export default function Layout({ children }) {
  const { user, logout }               = useAuth();
  const { theme, elderlyMode, toggleTheme, toggleElderly } = useTheme();
  const location                       = useLocation();
  const navigate                       = useNavigate();
  const [sidebarOpen, setSidebarOpen]  = useState(false);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">🛡️</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">TruePayID</span>
            <span className="sidebar-brand-sub">Trust Layer</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <span className="nav-section-label">Main</span>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer controls */}
        <div className="sidebar-footer">
          {/* User info */}
          <div style={{ padding: "4px 4px 8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {user?.full_name || "User"}
            </div>
            <div className="mono" style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>
              {user?.upi_id}
            </div>
          </div>

          {/* Theme toggle */}
          <div className="sidebar-toggle-row">
            <span className="sidebar-toggle-label">
              {theme === "dark" ? "🌙 Dark mode" : "☀️ Light mode"}
            </span>
            <label className="toggle-switch" aria-label="Toggle theme">
              <input type="checkbox" checked={theme === "light"} onChange={toggleTheme} />
              <div className="toggle-track" />
            </label>
          </div>

          {/* Elderly mode toggle */}
          <div className="sidebar-toggle-row">
            <span className="sidebar-toggle-label">👴 Elderly mode</span>
            <label className="toggle-switch" aria-label="Toggle elderly mode">
              <input type="checkbox" checked={elderlyMode} onChange={toggleElderly} />
              <div className="toggle-track" />
            </label>
          </div>

          {/* Logout */}
          <button className="sidebar-logout" onClick={handleLogout}>
            <span>⎋</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
        {children}
      </main>

      {/* Mobile toggle */}
      <button
        className="mobile-nav-toggle"
        onClick={(e) => { e.stopPropagation(); setSidebarOpen(o => !o); }}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>
    </div>
  );
}
