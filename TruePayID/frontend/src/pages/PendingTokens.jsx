import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import { Alert, PageHeader } from '../components/common/UI';
import { transactionAPI } from '../services/api';
import '../styles/tokens.css';

export default function PendingTokens() {
  const [activeTokens, setActiveTokens] = useState([]);
  const [completedTokens, setCompletedTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pendingDecision, setPendingDecision] = useState(null); // { tokenId, decision }
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const navigate = useNavigate();

  // Fetch all tokens on mount and set up refresh interval
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // Update countdown timer every second for active tokens
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setActiveTokens(prev =>
        prev.map(token => ({
          ...token,
          seconds_remaining: Math.max(
            0,
            (new Date(token.expires_at) - new Date()) / 1000
          )
        }))
      );
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      // Get all transactions to find tokens
      const response = await transactionAPI.getHistory(50);
      console.log("📦 Transaction history response:", response);

      const active = (response.items || response.results || [])
        .filter(tx => tx.status === 'token_pending')
        .map(tx => ({
          ...tx,
          seconds_remaining: Math.max(
            0,
            (new Date(tx.expires_at) - new Date()) / 1000
          )
        }))
        .sort((a, b) => b.seconds_remaining - a.seconds_remaining);

      const completed = (response.items || response.results || [])
        .filter(tx => ['completed', 'denied', 'expired'].includes(tx.status));

      console.log("✅ Active tokens:", active);
      console.log("✅ Completed tokens:", completed);

      setActiveTokens(active);
      setCompletedTokens(completed);
      setError('');
    } catch (err) {
      console.error("❌ Error fetching tokens:", err);
      setError('Failed to load tokens: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (tokenValue, decision) => {
    // Show PIN dialog
    setPendingDecision({ tokenValue, decision });
    setPinInput('');
    setPinError('');
    setPinDialogOpen(true);
  };

  const confirmDecisionWithPin = async () => {
    // Debug: log current state
    console.log("🔐 confirmDecisionWithPin called");
    console.log("  pinInput value:", pinInput);
    console.log("  pinInput length:", pinInput.length);
    console.log("  pendingDecision:", pendingDecision);
    
    if (!pinInput.trim()) {
      console.warn("❌ PIN is empty");
      setPinError('PIN is required');
      return;
    }

    if (pinInput.length !== 4 || !/^\d+$/.test(pinInput)) {
      console.warn("❌ PIN validation failed: length=" + pinInput.length + ", pattern=" + (/^\d+$/.test(pinInput)));
      setPinError('PIN must be 4 digits');
      return;
    }

    try {
      const requestData = {
        token: pendingDecision.tokenValue,
        decision: pendingDecision.decision,
        pin: pinInput
      };
      console.log("✅ Sending request:", requestData);
      
      const result = await transactionAPI.decideToken(requestData);
      console.log("✅ Success:", result);

      // Refresh tokens after decision
      setPinDialogOpen(false);
      setPendingDecision(null);
      setPinInput('');
      await fetchTokens();
    } catch (err) {
      console.error("❌ Error in confirmDecisionWithPin:", err);
      setPinError(`Failed to ${pendingDecision.decision} token: ${err.message}`);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRiskColor = (riskLevel) => {
    if (!riskLevel) return '#6b7280';
    const level = riskLevel.toLowerCase();
    switch (level) {
      case 'low':
        return '#22c55e';
      case 'medium':
        return '#eab308';
      case 'high':
        return '#f97316';
      case 'critical':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  };

  if (loading && activeTokens.length === 0 && completedTokens.length === 0) {
    return (
      <Layout>
        <PageHeader title="⏱️ Pending Tokens" />
        <div className="tokens-container">
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p>Loading tokens...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="⏱️ Pending Tokens" subtitle="Manage high-risk transactions" />
      <div className="tokens-container">
        {error && <Alert type="danger">{error}</Alert>}

        {/* ACTIVE TOKENS - Need Decision */}
        <section className="tokens-section">
          <h2 className="section-title">🔴 Active Tokens ({activeTokens.length})</h2>

          {activeTokens.length === 0 ? (
            <p className="empty-state">No active tokens. All transactions processed!</p>
          ) : (
            <div className="tokens-grid">
              {activeTokens.map((token, idx) => (
                <TokenCard
                  key={idx}
                  token={token}
                  onApprove={() => handleDecision(token.token, 'confirm')}
                  onDeny={() => handleDecision(token.token, 'deny')}
                  formatTime={formatTime}
                  getRiskColor={getRiskColor}
                />
              ))}
            </div>
          )}
        </section>

        {/* COMPLETED TOKENS - History */}
        {completedTokens.length > 0 && (
          <section className="tokens-section completed">
            <h2 className="section-title">✅ Transaction History</h2>
            <div className="tokens-history">
              {completedTokens.slice(0, 10).map((token, idx) => (
                <div key={idx} className="history-item">
                  <div className="history-info">
                    <p className="receiver">{token.receiver_upi}</p>
                    <p className="amount">₹{token.amount.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="history-status">
                    <span
                      className={`status-badge status-${token.status}`}
                    >
                      {token.status === 'completed'
                        ? '✓ Completed'
                        : token.status === 'denied'
                          ? '✗ Denied'
                          : '⏱️ Expired'}
                    </span>
                    <p className="date">
                      {new Date(token.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* PIN Dialog for Token Decision */}
      {pinDialogOpen && (
        <div className="modal-overlay" onClick={() => setPinDialogOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Verify Transaction PIN</h3>
            <p>Enter your 6-digit transaction PIN to confirm this decision</p>
            
            <input
              type="password"
              maxLength="4"
              placeholder="0000"
              value={pinInput}
              onChange={e => {
                const newPin = e.target.value.replace(/\D/g, '');
                console.log("📝 PIN input changed:", newPin);
                setPinInput(newPin);
                if (pinError) setPinError('');
              }}
              autoFocus
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '18px',
                letterSpacing: '2px',
                textAlign: 'center',
                marginBottom: '10px',
                border: pinError ? '2px solid #dc2626' : '1px solid #ddd',
                borderRadius: '4px'
              }}
            />

            {pinError && <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '15px' }}>{pinError}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-cancel"
                onClick={() => {
                  setPinDialogOpen(false);
                  setPendingDecision(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#e5e7eb',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-confirm"
                onClick={confirmDecisionWithPin}
                disabled={pinInput.length !== 4}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: pinInput.length === 4 
                    ? (pendingDecision?.decision === 'confirm' ? '#22c55e' : '#ef4444')
                    : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: pinInput.length === 4 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  opacity: pinInput.length === 4 ? 1 : 0.6
                }}
              >
                {pendingDecision?.decision === 'confirm' ? '✓ Approve' : '✗ Deny'} (PIN: {pinInput.length}/4)
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* TokenCard Component */
function TokenCard({ token, onApprove, onDeny, formatTime, getRiskColor }) {
  const isExpiring = token.seconds_remaining < 60; // Less than 1 minute

  return (
    <div className={`token-card ${isExpiring ? 'expiring' : ''}`}>
      {/* Header: Risk Level + Timer */}
      <div className="token-header">
        <div
          className="risk-badge"
          style={{ backgroundColor: getRiskColor(token.risk_level) }}
        >
          {token.risk_level || 'Unknown'} ({token.risk_score || 0}%)
        </div>
        <div className={`timer ${isExpiring ? 'urgent' : ''}`}>
          ⏱️ {formatTime(token.seconds_remaining)}
        </div>
      </div>

      {/* Transaction Details */}
      <div className="token-details">
        <div className="detail-row">
          <span className="label">To:</span>
          <span className="value">{token.receiver_upi}</span>
        </div>
        <div className="detail-row">
          <span className="label">Amount:</span>
          <span className="value">₹{token.amount.toLocaleString('en-IN')}</span>
        </div>
        <div className="detail-row">
          <span className="label">Created:</span>
          <span className="value">
            {new Date(token.created_at).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Why High Risk? */}
      <div className="risk-reasons">
        <p>
          <strong>⚠️ Why High-Risk?</strong>
        </p>
        <ul>
          {token.amount > 10000 && (
            <li>High-value transaction (₹{token.amount})</li>
          )}
          {token.location_mismatch && <li>Location mismatch detected</li>}
          {token.receiver_is_new && <li>New receiver address</li>}
          {!token.location_mismatch &&
            !token.receiver_is_new && (
              <li>AI detected multiple risk factors</li>
            )}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="token-actions">
        <button className="btn btn-approve" onClick={onApprove}>
          ✓ Approve
        </button>
        <button className="btn btn-deny" onClick={onDeny}>
          ✗ Deny
        </button>
      </div>

      {/* Status */}
      {token.status === 'expired' && (
        <div className="expired-notice">
          ⏰ This token has expired. Create a new transaction to proceed.
        </div>
      )}
    </div>
  );
}
