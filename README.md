# 🛡️ TruePayID - AI Fraud Detection for UPI

## ⚡ QUICK START - 30 Seconds

### Windows Users (Easiest)

**Double-click this file:**
```
run_servers.bat
```

That's it! Both servers will start automatically.

---

## 📋 What Just Happened

When you run `run_servers.bat`:

1. **Backend starts** on `http://localhost:8000`
   - Python FastAPI server
   - AI fraud scoring engine
   - Database connection
   - Runs on port 8000

2. **Frontend starts** on `http://localhost:5173`
   - React app
   - Connects to backend at `http://localhost:8000/api/v1`
   - Runs on port 5173

3. **Browser opens** automatically to `http://localhost:5173`

---

## 🔐 Test Login

After servers start and page loads:

```
Email:    test@truepay.com
Password: Test@123456
```

Click **"Sign In"**

---

## 🧪 Test AI Fraud Analysis

After login:

1. Click **"New Transaction"** (or look for it in dashboard)
2. Enter these details:

```
Receiver UPI:  merchant@hdfc
Amount:        ₹15,000
Your City:     Mumbai
Click "Initiate Transaction"
```

3. **Watch the AI analysis in real-time:**
   - Risk Score: ~63/100
   - Level: 🟡 Medium Risk
   - Reasons shown:
     - Location mismatch
     - High-value transaction
     - First-time receiver

4. A **5-minute review token** will be issued (for high-risk transactions)

---

## 🤖 How the AI Fraud Scoring Works

The system analyzes **9 real-world factors**:

| Factor | What | Risk |
|--------|------|------|
| Amount | ₹15,000 | High amounts = more risk |
| Receiver Trust | Unknown merchant | Low trust = high risk |
| Location | You in Mumbai, receiver usually in Delhi | Mismatch = risk |
| Hour | 3 AM vs 9 AM | Late night = risk |
| Frequency | Unusual sending pattern | Spikes = risk |
| Fraud Reports | Any against receiver | Prior fraud = high risk |
| New Account | Receiver registered <30 days | New = risk |
| Round Amount | ₹5,000 vs ₹4,847 | Round = social engineering risk |
| First Time | Never sent to this person | Unknown = risk |

### Risk Score Ranges:
- **0-40**: 🟢 Low (proceed immediately)
- **40-70**: 🟡 Medium (show warning, allow proceed)
- **70-90**: 🔴 High (issue 5-min review token)
- **90-100**: ⛔ Critical (manual review required)

---

## 🧩 Architecture

```
┌─────────────────────────────────────────────────┐
│         Frontend (React + Vite)                 │
│         http://localhost:5173                   │
│    (Login, New Transaction, Dashboard, etc)     │
└──────────────┬──────────────────────────────────┘
               │
               │ HTTP REST API
               │ /api/v1/*
               │
┌──────────────▼──────────────────────────────────┐
│         Backend (FastAPI)                       │
│         http://localhost:8000                   │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ AI Fraud Scorer                         │  │
│  │ - Logistic Regression Model             │  │
│  │ - 9-feature real-time risk analysis     │  │
│  │ - Trained on UPI fraud patterns         │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ Transaction Service                     │  │
│  │ - Risk preview (as you type)            │  │
│  │ - Delay token generation                │  │
│  │ - Trust scoring                         │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ Auth & User Management                  │  │
│  │ - JWT tokens                            │  │
│  │ - Email OTP verification                │  │
│  │ - Password hashing                      │  │
│  └─────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────┘
               │
               │ MySQL Driver (aiomysql)
               │ Database: truepayid
               │
┌──────────────▼──────────────────────────────────┐
│         MySQL Database                          │
│         localhost:3306/truepayid                │
│                                                 │
│  Tables: users, transactions, tokens,          │
│          fraud_reports, trust_scores, etc      │
└─────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
TruePayID/
├── backend/              # FastAPI Python backend
│   ├── app/
│   │   ├── main.py      # FastAPI app entry
│   │   ├── config.py    # Settings from .env
│   │   ├── routers/     # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── models/      # SQLAlchemy ORM
│   │   ├── schemas/     # Request/response validation
│   │   ├── ai_engine/   # Fraud scorer
│   │   └── database/    # MySQL connection
│   ├── requirements.txt # Python dependencies
│   └── venv/           # Virtual environment
│
├── frontend/            # React + Vite
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # UI components
│   │   ├── services/   # API client
│   │   ├── context/    # Auth state
│   │   └── styles/     # CSS
│   ├── package.json
│   └── vite.config.js
│
├── database/
│   └── schema.sql      # SQL schema
│
├── run_servers.bat     # ⭐ Run this file!
│
└── docs/
    ├── FRAUD_ANALYSIS_GUIDE.md
    ├── OTP_TESTING_GUIDE.md
    └── README.md
```

---

## 🔧 Detailed Manual Start (If Issues)

**Terminal 1 - Backend:**
```powershell
cd C:\Users\DELL\Downloads\TruePayID\TruePayID\backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

You should see:
```
✅ AI Fraud Scorer ready | TruePayID v1.0.0
✅ Application startup complete
```

**Terminal 2 - Frontend:**
```powershell
cd C:\Users\DELL\Downloads\TruePayID\TruePayID\frontend
npm run dev
```

You should see:
```
✅ Local: http://localhost:5173/
```

Then open: **http://localhost:5173**

---

## 🚑 Troubleshooting

### "Failed to fetch" Error
- ✓ Check backend terminal is running (shows `Application startup complete`)
- ✓ Check frontend terminal shows `Local: http://localhost:5173/`
- ✓ Open http://localhost:8000/health - should show `{"status":"ok"}`

### "Cannot find module 'aiomysql'"
- ✓ Backend not running in venv
- ✓ Run: `cd backend && .\venv\Scripts\python -m uvicorn app.main:app --reload --port 8000`

### "npm: command not found"
- ✓ Node.js not installed
- ✓ Download from https://nodejs.org/
- ✓ Restart terminals after install

### MySQL Connection Error
- ✓ MySQL service must be running on localhost:3306
- ✓ Username: root, Password: root (from .env)
- ✓ Database: truepayid (auto-created on first run)

### OTP Not Showing
- ✓ Check backend terminal for: `✅ OTP GENERATED FOR SIGNUP`
- ✓ OTPs are logged to console in development mode
- ✓ Only for **new signup**, not for login

---

## 🎯 Key Features to Test

| Feature | How to Test | Expected |
|---------|------------|----------|
| **Login** | Use test account | Dashboard loads |
| **New Transaction** | High-risk details | AI score shown in real-time |
| **Risk Analysis** | Change amount/receiver | Score updates live |
| **Delay Tokens** | High-risk txn > ₹70 score | Token issued, 5min countdown |
| **Location Intel** | Different city | Location mismatch flagged |
| **Signup** | New email | OTP in backend terminal |
| **Multiple Txns** | Send 10 txns in 1 day | Frequency factor increases risk |

---

## 🔗 API Endpoints

Once running, view interactive API docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

Try endpoints live in the Swagger UI!

---

## 📚 Learn More

- `FRAUD_ANALYSIS_GUIDE.md` - Detailed fraud scoring explanation
- `OTP_TESTING_GUIDE.md` - How OTP system works
- Backend: `Backend API docs (Swagger)` at `/api/v1/*`
- Database: MySQL at `localhost:3306/truepayid`

---

## ✅ Done!

You now have a **fully functional AI-powered fraud detection system** for UPI payments running locally.

**Next:** Double-click `run_servers.bat` and test it! 🚀

---

*TruePayID v1.0.0 - Trust Layer for UPI Payments*
