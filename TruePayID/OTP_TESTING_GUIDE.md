# 🔐 OTP Testing Guide for TruePayID

## How to Sign Up and Get Your OTP

### Method 1: Check Backend Terminal (Recommended)
1. Open http://localhost:5173
2. Click **"Sign Up"**
3. Fill in the form with your details
4. Click **"Create Account →"**
5. **Look at your backend terminal** where the API is running
6. You'll see a message like:

```
======================================================================
✅ OTP GENERATED FOR SIGNUP
======================================================================
User: Your Name
Email: your@email.com
🔐 OTP CODE: 123456
Expires: 10 minutes
======================================================================
```

7. Copy the 6-digit OTP code
8. Enter it in the OTP verification form on the frontend

### Method 2: Check OTP Codes File
An `otp_codes.txt` file is created in the backend root directory with all OTPs:
- Location: `TruePayID/backend/../otp_codes.txt`
- Format: `[timestamp] email: otp_code`

### Method 3: Check Admin API (For Debugging)
Visit these URLs in your browser:

**View all pending OTPs:**
```
http://localhost:8000/api/v1/admin/pending-otps
```

**View all users:**
```
http://localhost:8000/api/v1/admin/users
```

**Delete a test user (GET with user_id):**
```
http://localhost:8000/api/v1/admin/users/{user_id}
```

## Test Accounts Already Created

You can also test login with pre-created accounts:

| Email | Password | UPI | Status |
|-------|----------|-----|--------|
| test@truepay.com | Test@123456 | test@truepay | ✅ Verified |
| krishk@okaxis | password123 | krishk@okaxis | ❌ Not Verified |

## Quick Test Flow

1. **Signup with new account**
   - Fill signup form
   - Get OTP from backend terminal  
   - Enter OTP
   - Email gets verified automatically

2. **Login with verified account**
   - Use test@truepay.com / Test@123456
   - Or use any account you just verified via signup

3. **Access Dashboard**
   - After login, you'll be redirected to /dashboard
   - You can view transactions, fraud scoring, etc.

## Troubleshooting

**Q: I don't see the OTP in the terminal**
- A: Make sure the backend is running (`npm run dev` in backend dir)
- A: Check that DEBUG=true in .env file
- A: Look for the message starting with "✅ OTP GENERATED FOR SIGNUP"

**Q: OTP expired**
- A: Default expiry is 10 minutes (configured in .env)
- A: Create a new signup request to get a fresh OTP

**Q: Backend showing email send failed**
- A: That's OK! In development mode, we log to console instead
- A: Check your terminal for the OTP code

