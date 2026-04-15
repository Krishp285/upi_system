# 🎨 Frontend Token UI Implementation Guide

## Overview

When a high-risk transaction issues a token, the user needs a "Pending Tokens" dashboard to:
1. See all active tokens waiting for approval
2. View countdown timer (changes every second)
3. Approve or Deny each token
4. See token history (completed/expired)

---

## Component Architecture

```
NewTransaction.jsx (when high-risk)
    ↓
    ├─> Shows "Token Pending - View Tokens" button
    └─> Links to...

PendingTokens.jsx (NEW PAGE) 
    ├─> Active Tokens List (countdown timers)
    ├─> TokenCard (for each token)
    │   ├─> Timer (updates every second)
    │   ├─> Risk Details
    │   ├─> [APPROVE] [DENY] buttons
    │   └─> Decision feedback
    └─> Completed Tokens (history)
```

---

## Implementation Files

### 1. Create `src/pages/PendingTokens.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import '../styles/tokens.css';

export default function PendingTokens() {
  const [activeTokens, setActiveTokens] = useState([]);
  const [completedTokens, setCompletedTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Fetch all tokens on mount
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(() => {
      setActiveTokens(prev => 
        prev.map(token => ({
          ...token,
          seconds_remaining: Math.max(
            0,
            (new Date(token.expires_at) - new Date()) / 1000
          )
        }))
      );
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      // Get all transactions to find tokens
      const response = await api.get('/transactions/history?limit=50');
      
      const active = response.data.results
        .filter(tx => tx.status === 'token_pending')
        .map(tx => ({
          ...tx,
          seconds_remaining: Math.max(
            0,
            (new Date(tx.expires_at) - new Date()) / 1000
          )
        }));

      const completed = response.data.results
        .filter(tx => ['completed', 'denied', 'expired'].includes(tx.status));

      setActiveTokens(active);
      setCompletedTokens(completed);
      setError('');
    } catch (err) {
      setError('Failed to load tokens: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (token_id, decision) => {
    try {
      await api.post('/transactions/token/decide', {
        token: token_id,
        decision: decision // 'confirm' or 'deny'
      });

      // Refresh tokens
      await fetchTokens();
    } catch (err) {
      setError(`Failed to ${decision} token: ${err.message}`);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'Low': return '#22c55e';
      case 'Medium': return '#eab308';
      case 'High': return '#f97316';
      case 'Critical': return '#dc2626';
      default: return '#6b7280';
    }
  };

  if (loading) return <div className="tokens-container"><p>Loading tokens...</p></div>;

  return (
    <div className="tokens-container">
      <h1>⏱️ Pending Tokens</h1>
      
      {error && <div className="error-message">{error}</div>}

      {/* ACTIVE TOKENS - Need Decision */}
      <section className="tokens-section">
        <h2>🔴 Active Tokens ({activeTokens.length})</h2>
        
        {activeTokens.length === 0 ? (
          <p className="empty-state">No active tokens. All transactions processed!</p>
        ) : (
          <div className="tokens-grid">
            {activeTokens.map((token, idx) => (
              <TokenCard
                key={idx}
                token={token}
                onApprove={() => handleDecision(token.id, 'confirm')}
                onDeny={() => handleDecision(token.id, 'deny')}
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
          <h2>✅ Transaction History</h2>
          <div className="tokens-history">
            {completedTokens.slice(0, 10).map((token, idx) => (
              <div key={idx} className="history-item">
                <div className="history-info">
                  <p className="receiver">{token.receiver_upi}</p>
                  <p className="amount">₹{token.amount.toLocaleString('en-IN')}</p>
                </div>
                <div className="history-status">
                  <span className={`status-badge status-${token.status}`}>
                    {token.status === 'completed' ? '✓ Completed' :
                     token.status === 'denied' ? '✗ Denied' :
                     '⏱️ Expired'}
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
  );
}

/* TokenCard Component */
function TokenCard({ token, onApprove, onDeny, formatTime, getRiskColor }) {
  const isExpiring = token.seconds_remaining < 60; // Less than 1 minute
  
  return (
    <div className={`token-card ${isExpiring ? 'expiring' : ''}`}>
      {/* Header: Risk Level + Timer */}
      <div className="token-header">
        <div className="risk-badge" style={{ backgroundColor: getRiskColor(token.risk_level) }}>
          {token.risk_level} ({token.risk_score}%)
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
        <p><strong>⚠️ Why High-Risk?</strong></p>
        <ul>
          {token.amount > 10000 && <li>High-value transaction (₹{token.amount})</li>}
          {token.location_mismatch && <li>Location mismatch detected</li>}
          {token.receiver_is_new && <li>New receiver address</li>}
          {!token.location_mismatch && !token.receiver_is_new && (
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
```

---

### 2. Create `src/styles/tokens.css`

```css
/* Pending Tokens Page */

.tokens-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.tokens-container h1 {
  color: white;
  text-align: center;
  margin-bottom: 30px;
  font-size: 2.5em;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.tokens-container h2 {
  color: white;
  margin-bottom: 20px;
  font-size: 1.5em;
}

.error-message {
  background: #dc2626;
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #991b1b;
}

/* Sections */
.tokens-section {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.tokens-section.completed {
  background: rgba(34, 197, 94, 0.05);
  border-left: 4px solid #22c55e;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  padding: 40px;
  font-size: 1.1em;
}

/* Tokens Grid */
.tokens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

/* Token Card */
.token-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  border: 2px solid #e5e7eb;
  transition: all 0.3s ease;
  position: relative;
}

.token-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.token-card.expiring {
  border-color: #f97316;
  background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
}

/* Token Header */
.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  gap: 10px;
}

.risk-badge {
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.95em;
  flex: 1;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.timer {
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: bold;
  color: #1f2937;
  font-size: 0.95em;
  white-space: nowrap;
}

.timer.urgent {
  color: #dc2626;
  background: #fecaca;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Token Details */
.token-details {
  background: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  color: #6b7280;
  font-weight: 500;
}

.detail-row .value {
  color: #1f2937;
  font-weight: bold;
  word-break: break-all;
}

/* Risk Reasons */
.risk-reasons {
  background: #fef2f2;
  border-left: 3px solid #dc2626;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.risk-reasons p {
  color: #dc2626;
  margin: 0 0 8px 0;
  font-weight: bold;
  font-size: 0.9em;
}

.risk-reasons ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.risk-reasons li {
  color: #7f1d1d;
  padding: 4px 0 4px 20px;
  position: relative;
  font-size: 0.85em;
}

.risk-reasons li:before {
  content: '⚠️ ';
  position: absolute;
  left: 0;
}

/* Action Buttons */
.token-actions {
  display: flex;
  gap: 10px;
}

.btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.95em;
}

.btn-approve {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
}

.btn-approve:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
}

.btn-approve:active {
  transform: translateY(0);
}

.btn-deny {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

.btn-deny:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
}

.btn-deny:active {
  transform: translateY(0);
}

.expired-notice {
  background: #fed7aa;
  color: #92400e;
  padding: 12px;
  border-radius: 6px;
  text-align: center;
  font-size: 0.9em;
  margin-top: 12px;
  border-left: 3px solid #f97316;
}

/* History Section */
.tokens-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  background: white;
  padding: 15px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid #e5e7eb;
  transition: all 0.3s ease;
}

.history-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.history-info {
  flex: 1;
}

.history-info .receiver {
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.history-info .amount {
  color: #6b7280;
  margin: 0;
  font-size: 0.9em;
}

.history-status {
  text-align: right;
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: bold;
  margin-bottom: 6px;
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-denied {
  background: #fee2e2;
  color: #7f1d1d;
}

.status-expired {
  background: #fef3c7;
  color: #78350f;
}

.history-status .date {
  color: #9ca3af;
  font-size: 0.85em;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .tokens-container {
    padding: 15px;
  }

  .tokens-container h1 {
    font-size: 1.8em;
  }

  .tokens-grid {
    grid-template-columns: 1fr;
  }

  .token-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .timer {
    width: 100%;
    text-align: center;
  }

  .token-actions {
    flex-direction: column;
  }

  .history-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .history-status {
    text-align: left;
    margin-top: 10px;
  }
}
```

---

### 3. Update `src/pages/NewTransaction.jsx` (Add Token Pending State)

Find this section in `NewTransaction.jsx`:

```jsx
// ADD THIS after your component definition:

{/* If transaction resulted in token_pending */}
{transactionResult?.status === 'token_pending' && (
  <div className="token-pending-alert">
    <div className="alert-icon">⏱️</div>
    <div className="alert-content">
      <h3>Transaction Pending Approval</h3>
      <p>
        This high-risk transaction requires your approval within 5 minutes.
        Check your email and click the approval link, or{' '}
        <button 
          className="link-button"
          onClick={() => navigate('/pending-tokens')}
        >
          view pending tokens here
        </button>
        .
      </p>
    </div>
  </div>
)}
```

Add to your CSS:

```css
.token-pending-alert {
  background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);
  border: 2px solid #f97316;
  border-radius: 10px;
  padding: 20px;
  margin-top: 20px;
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.alert-icon {
  font-size: 2em;
  animation: pulse 1s infinite;
}

.alert-content h3 {
  color: #b45309;
  margin: 0 0 10px 0;
}

.alert-content p {
  color: #92400e;
  margin: 0;
}

.link-button {
  background: none;
  border: none;
  color: #d97706;
  text-decoration: underline;
  cursor: pointer;
  font-weight: bold;
  padding: 0;
}

.link-button:hover {
  color: #b45309;
}
```

---

### 4. Update `src/app/App.jsx` (Add Route)

```jsx
import PendingTokens from '../pages/PendingTokens';

<Route path="/pending-tokens" element={<PendingTokens />} />
```

---

## Key Features

✅ **Real-Time Countdown** - Updates every second
✅ **Visual Urgency** - Red timer when < 1 minute
✅ **Single-Use Enforcement** - Button disables after decision
✅ **Risk Context** - Shows why transaction was flagged
✅ **Transaction History** - Shows completed/expired tokens
✅ **Mobile Responsive** - Works on phones too
✅ **Error Handling** - Clear failure messages

---

## Testing Checklist

- [ ] Login with test@truepay.com
- [ ] Create transaction with ₹50,000 to unknown receiver → Should trigger token
- [ ] Check email (or console) for token details
- [ ] Click "View Pending Tokens" button
- [ ] See countdown timer (should be ~300 seconds)
- [ ] Click "Approve" → Transaction completes
- [ ] Check transaction history for "Completed" status
- [ ] Try "Deny" on another token → See "Denied" status
- [ ] Wait 5 minutes → See token "Expired" status
- [ ] Test on mobile → Should be responsive

---

## Next Steps

1. Create PendingTokens.jsx component
2. Create tokens.css stylesheet
3. Add route to App.jsx
4. Test full flow: High-risk transaction → Token → Decision → Completion

🎉 Your token system will be complete!
