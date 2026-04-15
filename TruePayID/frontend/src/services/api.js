// frontend/src/services/api.js
// Centralised API client — all HTTP calls go through here
// Handles auth headers, token refresh, error normalisation

// Use relative path in development (Vite proxy) or env variable in production
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api/v1" : "http://localhost:8000/api/v1");

// ── Token Storage ─────────────────────────────────────────────────────────────
export const tokenStorage = {
  getAccess:   () => localStorage.getItem("tpid_access"),
  getRefresh:  () => localStorage.getItem("tpid_refresh"),
  setTokens:   (access, refresh) => {
    localStorage.setItem("tpid_access",  access);
    localStorage.setItem("tpid_refresh", refresh);
  },
  clear:       () => {
    localStorage.removeItem("tpid_access");
    localStorage.removeItem("tpid_refresh");
    localStorage.removeItem("tpid_user");
  },
  getUser:     () => JSON.parse(localStorage.getItem("tpid_user") || "null"),
  setUser:     (u) => localStorage.setItem("tpid_user", JSON.stringify(u)),
};

// ── Core Fetch ────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, retry = true) {
  const accessToken = tokenStorage.getAccess();
  
  console.log(`📡 API Call: ${path}`);
  console.log(`   Access Token: ${accessToken ? `✓ Present (${accessToken.substring(0, 20)}...)` : "✗ Missing"}`);

  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };
  
  console.log(`   Headers:`, headers);

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    
    console.log(`   Response Status: ${res.status}`);

    // Token expired — attempt refresh once
    if (res.status === 401 && retry) {
      console.log(`   ⚠️ 401 Unauthorized - attempting refresh`);
      const refreshed = await tryRefresh();
      if (refreshed) {
        console.log(`   ✓ Token refreshed, retrying...`);
        return apiFetch(path, options, false);
      }
      console.log(`   ❌ Refresh failed, clearing tokens and redirecting to login`);
      tokenStorage.clear();
      window.location.href = "/login";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errorMsg = "An error occurred";
      if (data.detail) {
        if (Array.isArray(data.detail)) {
          // Pydantic validation errors
          errorMsg = data.detail.map(err => {
            const field = err.loc ? err.loc.join(".") : "unknown";
            return `${field}: ${err.msg || err.type}`;
          }).join(" | ");
        } else if (typeof data.detail === "string") {
          errorMsg = data.detail;
        }
      }
      console.error(`❌ API Error [${res.status}] ${path}:`, data);
      console.error(`📋 Full response:`, { ...data });
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error(`API Fetch Error ${path}:`, err.message);
    throw err;
  }
}

async function tryRefresh() {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    tokenStorage.setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  signup:    (data) => apiFetch("/auth/signup",     { method: "POST", body: JSON.stringify(data) }),
  verifyOTP: (data) => apiFetch("/auth/verify-otp", { method: "POST", body: JSON.stringify(data) }),
  login:     (data) => apiFetch("/auth/login",      { method: "POST", body: JSON.stringify(data) }),
};

// ── Dashboard API ─────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getDashboard:      () => apiFetch("/user/dashboard"),
  getProfile:        () => apiFetch("/user/me"),
  updatePreferences: (data) => apiFetch("/user/preferences", { method: "PATCH", body: JSON.stringify(data) }),
};

// ── Transaction API ───────────────────────────────────────────────────────────
export const transactionAPI = {
  lookup:        (upi_id)  => apiFetch("/transactions/lookup", { method: "POST", body: JSON.stringify({ upi_id }) }),
  riskPreview:   (receiver_upi, amount, sender_city) =>
    apiFetch(`/transactions/risk-preview?receiver_upi=${encodeURIComponent(receiver_upi)}&amount=${amount}${sender_city ? `&sender_city=${encodeURIComponent(sender_city)}` : ""}`),
  initiate:      (data)    => apiFetch("/transactions/initiate", { method: "POST", body: JSON.stringify(data) }),
  getHistory:    (params)  => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
    return apiFetch(`/transactions/history?${qs}`);
  },
  getIncoming:   () => apiFetch("/transactions/incoming"),
  getDetail:     (id)      => apiFetch(`/transactions/detail/${id}`),
  getMutual:     (upi)     => apiFetch(`/transactions/mutual/${encodeURIComponent(upi)}`),
  getToken:      (token)   => apiFetch(`/transactions/token/${token}`),
  decideToken:   (data)    => {
    console.log("🔐 Sending token decision:", data);
    return apiFetch("/transactions/token/decide", { 
      method: "POST", 
      body: JSON.stringify(data) 
    });
  },
};

// ── Fraud API ─────────────────────────────────────────────────────────────────
export const fraudAPI = {
  submitReport: (data) => apiFetch("/fraud/report", { method: "POST", body: JSON.stringify(data) }),
  getMyReports: () => apiFetch("/fraud/my-reports"),
};
