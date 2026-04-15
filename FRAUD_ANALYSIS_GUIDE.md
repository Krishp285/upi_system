# 🚀 TruePayID - Real-World AI Fraud Analysis (Quick Start)

## ⚠️ The "Failed to fetch" Error

The "Failed to fetch" error when trying to create a transaction means **the backend API server is not running**. 

## ✅ Quick Start (2 Options)

### **Option 1: One-Click Startup (Easiest)**

PowerShell command (Windows 11):
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force; & 'C:\Users\DELL\Downloads\TruePayID\START_SERVERS.ps1'
```

This opens two new terminal windows:
- **Terminal 1**: Backend API running on http://localhost:8000
- **Terminal 2**: Frontend running on http://localhost:5173

Then open: **http://localhost:5173**

---

### **Option 2: Manual Startup (Recommended for Development)**

**Terminal 1 - Start Backend:**
```powershell
cd C:\Users\DELL\Downloads\TruePayID\TruePayID\backend
.\venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Start Frontend:**
```powershell
cd C:\Users\DELL\Downloads\TruePayID\TruePayID\frontend
npm run dev
```

Then open: **http://localhost:5173**

---

## 📝 Test with Real-World Fraud Analysis

Once servers are running, try this transaction (it will trigger high-risk analysis):

1. **Login** with:
   - Email: `test@truepay.com`
   - Password: `Test@123456`

2. **Click "New Transaction"** in the dashboard

3. **Enter high-risk details:**
   - **Receiver UPI**: `merchant@hdfc` (unknown merchant)
   - **Amount**: `₹15,000` (high value)
   - **Your City**: Select `Mumbai` but backend thinks you're in Delhi
   - **Click submit**

4. **Watch the AI Fraud Analysis work:**
   - Risk Score: ~63/100 (Medium-High)
   - Reasons displayed:
     - ✓ Location mismatch detected
     - ✓ High-value transaction (₹15,000)
     - ✓ First transaction to this receiver
     - ✓ Transaction initiated during unusual hours
   - A **5-minute review token** will be issued
   - Email alert sent (check backend console for OTP messages)

---

## 🤖 Real-World Fraud Scoring (What's Happening Behind the Scenes)

The AI fraud scorer analyzes **9 real-world risk factors**:

| Factor | Impact | Example |
|--------|--------|---------|
| **Amount** | Higher = Higher Risk | ₹50,000+ → +5 risk |
| **Receiver Trust Score** | Low trust → Higher Risk | Score <30 → +8 risk |
| **Transaction Frequency** | Unusual spikes → Risk | 0 txns in 7 days → +3 risk |
| **Location Mismatch** | Different city → Risk | Usually Delhi, sending from Mumbai → +10 risk |
| **Hour of Day** | Late night → Risk | 3 AM transaction → +8 risk |
| **Fraud Reports** | Reported UPI → Risk | 1+ fraud reports → +5 risk |
| **Receiver IsNew** | New account → Risk | Registered <30 days → +7 risk |
| **Round Amount** | Social engineering → Risk | ₹5,000 (round) → +3 risk |
| **First Time Receiver** | Unknown → Risk | Never sent to before → +4 risk |

### Risk Score Mapping:
- **0-40**: 🟢 Low Risk (proceed immediately)
- **40-70**: 🟡 Medium Risk (notify user, allow proceed)
- **70-90**: 🔴 High Risk (require 5-minute delay token)
- **90-100**: ⛔ Critical Risk (require signature confirmation)

---

## 🔐 Key Endpoints for Fraud Analysis

The backend now has these working endpoints:

**Get Risk Preview (Real-Time as You Type):**
```
GET /api/v1/transactions/risk-preview?receiver_upi=merchant@hdfc&amount=15000&sender_city=Mumbai
```

returns:
```json
{
  "score": 63,
  "level": "Medium",
  "reasons": [
    "Location mismatch detected...",
    "High-value transaction..."
  ],
  "requires_token": true
}
```

**Initiate Transaction:**
```
POST /api/v1/transactions/initiate
```

**Token Status:**
```
GET /api/v1/transactions/token/{token_id}
```

**Transaction History:**
```
GET /api/v1/transactions/history
```

---

## 🧪 Testing Scenarios

### Low Risk (Proceed Immediately)
```
Receiver: test@truepay (known, high trust)
Amount: ₹500
Your City: Ahmedabad
→ Score: ~15/100 (Low)
```

### High Risk (Triggers Token)
```
Receiver: unknown@upi
Amount: ₹50,000
Your City: Different from receiver's usual location
Hour: 3 AM
→ Score: ~85/100 (High) 
→ 5-minute review token issued
```

### Critical Risk (Blocked for Manual Review)
```
Receiver: fraud-reported-upi
Amount: ₹100,000
Your City: Mismatch + suspicious hours
→ Score: ~95/100 (Critical)
→ Manual bank verification required
```

---

## 🛠️ Troubleshooting

**"Failed to fetch"** 
→ Backend not running. Use Option 1 or Option 2 above.

**"Invalid credentials"**
→ Wrong email/password. Use: `test@truepay.com` / `Test@123456`

**API returns 401 Unauthorized**
→ Token expired. Log out and log in again.

**OTP not showing up**
→ Check backend terminal for: `✅ OTP GENERATED FOR SIGNUP`

---

## 📊 Real-World Features Implemented

✅ **AI Fraud Scorer**: Logistic regression trained on realistic UPI fraud patterns
✅ **Risk Profile**: 9-feature real-time analysis
✅ **Location Intelligence**: City-level mismatch detection
✅ **Trust Scoring**: Receiver reputation tracking  
✅ **Delay Tokens**: 5-minute confirmation window for high-risk
✅ **Email Alerts**: Transaction warnings (logged to console in dev)
✅ **Audit Trail**: All transactions logged for forensics

---

## 🚀 Next Steps

1. ✅ Start both servers (use Quick Start Option 1 or 2)
2. ✅ Log in with test account
3. ✅ Try "New Transaction" with high-risk details
4. ✅ Watch AI fraud analysis work in real-time
5. ✅ See risk score, reasons, and token generation

**Happy testing! 🛡️**
