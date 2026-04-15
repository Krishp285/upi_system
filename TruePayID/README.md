# 🛡️ TruePayID

**Trust, Intelligence & Fraud Prevention Layer for UPI Payments**

> TruePayID is **not** a payment app. It does **not** move money.  
> It analyses every transaction *before* payment happens — verifying identity, scoring risk with AI, and giving you a secure confirmation window.

---

## 🏗️ Architecture

```
TruePayID/
├── backend/              ← FastAPI + Python
│   └── app/
│       ├── ai_engine/    ← Logistic Regression fraud scorer
│       ├── models/       ← SQLAlchemy ORM (MySQL)
│       ├── routers/      ← REST API endpoints
│       ├── schemas/      ← Pydantic v2 validation
│       └── services/     ← Business logic layer
│
├── frontend/             ← React + Vite (plain CSS)
│   └── src/
│       ├── pages/        ← All 10 application pages
│       ├── components/   ← Shared UI components
│       ├── context/      ← Auth + Theme context
│       └── services/     ← API client layer
│
├── database/
│   └── schema.sql        ← Full MySQL schema (10 tables)
│
└── docker/               ← Docker Compose + Dockerfiles
```

---

## ⚡ Quick Start (Local Development)

### 1. Database Setup

```bash
mysql -u root -p < database/schema.sql
```

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DB credentials and SMTP settings

# Run development server
uvicorn app.main:app --reload --port 8000
```

API docs auto-generated at: **http://localhost:8000/docs**

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set API URL (optional, defaults to localhost:8000)
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local

# Run development server
npm run dev
```

App runs at: **http://localhost:5173**

---

## 🐳 Docker (Full Stack)

```bash
cd docker

# Copy and configure environment
cp ../backend/.env.example .env
# Edit .env

# Build and start all services
docker-compose up --build

# App: http://localhost
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

---

## 🤖 AI Fraud Engine

**Algorithm:** Logistic Regression (scikit-learn)  
**Training:** Synthetic dataset of 2,000 UPI transactions (1,000 safe / 1,000 fraud)  
**Features (9):**

| Feature | Why it matters |
|---------|---------------|
| `amount` | Large amounts → higher fraud risk |
| `trust_score` | Receiver's TruePayID reputation |
| `tx_frequency_7d` | Unusual surge = suspicious |
| `location_mismatch` | Receiver in different city than usual |
| `hour_of_day` | Late-night transactions = elevated risk |
| `fraud_report_count` | Community-reported fraud history |
| `receiver_is_new` | New accounts used as mule accounts |
| `amount_is_round` | Round sums common in social-engineering |
| `first_time_receiver` | No prior relationship = higher risk |

**Output:** Risk score 0–100 · Level: Low / Medium / High / Critical  
**Model persisted** to `app/ai_engine/fraud_model.pkl` after first run.

---

## 🔌 API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/signup` | Register new user |
| POST | `/api/v1/auth/verify-otp` | Verify email OTP |
| POST | `/api/v1/auth/login` | Login (UPI/phone/email) |
| POST | `/api/v1/auth/refresh` | Refresh JWT tokens |

### User & Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/user/me` | Current user profile |
| GET | `/api/v1/user/dashboard` | Dashboard aggregate |
| PATCH | `/api/v1/user/preferences` | Update preferences |

### Transactions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/transactions/lookup` | UPI ID trust lookup |
| POST | `/api/v1/transactions/risk-preview` | Live AI risk score |
| POST | `/api/v1/transactions/initiate` | Initiate transaction |
| GET | `/api/v1/transactions/history` | Paginated history |
| GET | `/api/v1/transactions/incoming` | Received transactions |
| GET | `/api/v1/transactions/detail/{id}` | Transaction detail |
| GET | `/api/v1/transactions/mutual/{upi}` | Mutual history |
| GET | `/api/v1/transactions/token/{token}` | Token status |
| POST | `/api/v1/transactions/token/decide` | Confirm/deny token |

### Fraud
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/fraud/report` | Submit fraud report |
| GET | `/api/v1/fraud/my-reports` | My submitted reports |

---

## 🎨 Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | UPI/phone/email + password |
| `/signup` | Signup | Create TruePayID account |
| `/verify-otp` | OTP Verify | 6-digit email verification |
| `/dashboard` | Dashboard | Trust score, alerts, quick actions |
| `/search` | Search & Verify | UPI lookup before paying |
| `/pay` | New Transaction | Initiate with live risk preview |
| `/history` | History | Filterable transaction history |
| `/incoming` | Incoming | Received transactions |
| `/transaction/:id` | Detail | Timeline + AI feature snapshot |
| `/token/:token` | Token Countdown | Confirm/deny with 5-min timer |
| `/report-fraud` | Report Fraud | Submit fraud report |

---

## 🔐 Security Features

- **Passwords:** bcrypt hashed (never stored plain)
- **Tokens:** SHA-256 hashed before DB storage, rotation on refresh
- **JWT:** Short-lived access (30 min) + long-lived refresh (7 days)
- **OTP:** Time-limited (10 min), single-use, hashed
- **SQL Injection:** SQLAlchemy ORM with parameterized queries
- **CORS:** Configured allowlist for production domains
- **Rate Limiting:** Configurable per-minute limits (extend with `slowapi`)
- **Sensitive Data:** Location stored as city-level only, IPs hashed

---

## 🌓 UI Features

- **Dark / Light theme** — toggle in sidebar, persisted to localStorage
- **Elderly mode** — 120% font size, stronger contrast, larger buttons
- **Fully responsive** — mobile sidebar, adaptive grid layouts
- **Live AI risk meter** — updates as you type in transaction form (debounced)
- **Countdown rings** — SVG animated rings for token expiry
- **Trust score ring** — animated SVG gauge for trust visualization
- **No Tailwind, no Bootstrap** — 100% plain CSS with CSS variables

---

## 📧 Email Notifications

All emails sent asynchronously via SMTP (non-blocking):

1. **OTP Verification** — on signup
2. **Login Alert** — on every successful login
3. **Transaction Initiated** — on low-risk transactions
4. **High-Risk Warning** — with fraud reasons listed
5. **Token Created** — with reference and expiry
6. **Transaction Result** — confirmed or denied
7. **Fraud Report Confirmation** — on report submission

---

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Core identity: UPI, phone, email, password |
| `auth_tokens` | JWT refresh + OTP tokens (hashed) |
| `trust_scores` | Per-user dynamic trust score (0–100) |
| `location_history` | City-level location for anomaly detection |
| `tokenized_intents` | 5-min delay tokens for high-risk txns |
| `transactions` | Immutable transaction ledger |
| `fraud_reports` | User-submitted fraud reports |
| `email_logs` | Outbound email audit trail |
| `audit_logs` | System-wide action audit log |

---

## 🏆 Built For

- **Hackathons** — complete end-to-end demo in one repo
- **Placement Interviews** — demonstrates AI + security + full-stack
- **Viva / Presentations** — every design decision has a documented "why"

---

*TruePayID — Pay with confidence, not blind faith.*
