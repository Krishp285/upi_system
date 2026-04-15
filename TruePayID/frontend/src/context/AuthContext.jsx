// frontend/src/context/AuthContext.jsx
// Global auth state — provides user, login, logout to entire app

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authAPI, tokenStorage } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStorage.getUser());
  const [loading, setLoading] = useState(false);

  // Check if tokens exist in localStorage and restore auth state on mount
  useEffect(() => {
    const storedUser = tokenStorage.getUser();
    const accessToken = tokenStorage.getAccess();
    
    console.log(`🔄 AuthProvider mounted | Stored user:`, storedUser, `| Has token:`, !!accessToken);
    
    if (storedUser && accessToken) {
      console.log(`✅ Restoring auth state from localStorage`);
      setUser(storedUser);
    }
  }, []);

  const login = useCallback(async (identifier, password) => {
    setLoading(true);
    try {
      const data = await authAPI.login({ identifier, password });
      tokenStorage.setTokens(data.access_token, data.refresh_token);
      const userData = { id: data.user_id, upi_id: data.upi_id, full_name: data.full_name };
      tokenStorage.setUser(userData);
      setUser(userData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    const updated = { ...user, ...updates };
    tokenStorage.setUser(updated);
    setUser(updated);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
