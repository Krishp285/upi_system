// frontend/src/app/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import API from "../api";   // FIXED PATH
import { useAuth } from "../context/AuthContext";

import Login from "../pages/Login";
import Signup from "../pages/Signup";
import OTPVerify from "../pages/OTPVerify";
import Dashboard from "../pages/Dashboard";
import SearchPay from "../pages/SearchPay";
import NewTransaction from "../pages/NewTransaction";
import History from "../pages/History";
import Incoming from "../pages/Incoming";
import TransactionDetail from "../pages/TransactionDetail";
import TokenCountdown from "../pages/TokenCountdown";
import PendingTokens from "../pages/PendingTokens";
import ReportFraud from "../pages/ReportFraud";
import MyFraudReports from "../pages/MyFraudReports";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {

  // ✅ API test added here
  useEffect(() => {
    API.get("/")
      .then(res => console.log("Backend:", res.data))
      .catch(err => console.error("API Error:", err));
  }, []);

  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/verify-otp" element={<OTPVerify />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPay /></ProtectedRoute>} />
        <Route path="/pay" element={<ProtectedRoute><NewTransaction /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/incoming" element={<ProtectedRoute><Incoming /></ProtectedRoute>} />
        <Route path="/transaction/:id" element={<ProtectedRoute><TransactionDetail /></ProtectedRoute>} />
        <Route path="/token/:token" element={<ProtectedRoute><TokenCountdown /></ProtectedRoute>} />
        <Route path="/pending-tokens" element={<ProtectedRoute><PendingTokens /></ProtectedRoute>} />
        <Route path="/report-fraud" element={<ProtectedRoute><ReportFraud /></ProtectedRoute>} />
        <Route path="/my-fraud-reports" element={<ProtectedRoute><MyFraudReports /></ProtectedRoute>} />

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  );
}