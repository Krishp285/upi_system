// frontend/src/context/ThemeContext.jsx
// Manages light/dark theme + elderly mode (larger fonts, high contrast)
// Persists preference in localStorage

import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("tpid_theme") || "dark");
  const [elderlyMode, setElderlyMode] = useState(() => localStorage.getItem("tpid_elderly") === "true");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-elderly", elderlyMode ? "true" : "false");
    localStorage.setItem("tpid_theme", theme);
    localStorage.setItem("tpid_elderly", String(elderlyMode));
  }, [theme, elderlyMode]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const toggleElderly = () => setElderlyMode(e => !e);

  return (
    <ThemeContext.Provider value={{ theme, elderlyMode, toggleTheme, toggleElderly }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
