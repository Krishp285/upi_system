# backend/app/schemas/schemas.py
# Pydantic v2 schemas — strict validation on every API boundary
# Separates request payloads from response shapes for security

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
import re


# ── Auth Schemas ──────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    upi_id:    str
    phone:     str
    email:     EmailStr
    full_name: str
    password:  str
    transaction_pin: str

    @field_validator("upi_id")
    @classmethod
    def validate_upi(cls, v: str) -> str:
        if not re.match(r"^[\w.\-]+@[\w]+$", v):
            raise ValueError("Invalid UPI ID format (e.g. name@bank)")
        return v.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if not re.match(r"^[6-9]\d{9}$", digits):
            raise ValueError("Must be a valid 10-digit Indian mobile number")
        return digits

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("transaction_pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not re.match(r"^\d{4}$", v):
            raise ValueError("Transaction PIN must be exactly 4 digits")
        return v


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp:   str


class LoginRequest(BaseModel):
    identifier: str   # UPI / phone / email
    password:   str


class LoginOTPRequest(BaseModel):
    """Request OTP for login"""
    identifier: str   # UPI / phone / email


class VerifyLoginOTPRequest(BaseModel):
    """Verify OTP and complete login"""
    identifier: str
    otp:        str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user_id:       int
    upi_id:        str
    full_name:     str


class LoginOTPResponse(BaseModel):
    """Response after password login - OTP required for verification"""
    message:  str
    user_id:  int
    otp:      Optional[str] = None  # Only in development mode


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User Schemas ──────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    upi_id:       str
    phone:        str
    email:        str
    full_name:    str
    is_verified:  bool
    elderly_mode: bool
    created_at:   datetime


class UserPreferencesUpdate(BaseModel):
    elderly_mode: Optional[bool] = None
    full_name:    Optional[str]  = None


# ── Trust Score Schemas ───────────────────────────────────────────────────────

class TrustScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    score:        int
    level:        str
    fraud_count:  int
    report_count: int
    tx_count:     int
    last_updated: datetime


# ── Search / UPI Lookup Schemas ───────────────────────────────────────────────

class UPILookupRequest(BaseModel):
    upi_id: str


class UPILookupResponse(BaseModel):
    upi_id:            str
    full_name:         Optional[str]
    is_registered:     bool
    trust_score:       Optional[int]
    trust_level:       Optional[str]
    fraud_count:       Optional[int]
    report_count:      Optional[int]
    usual_city:        Optional[str]
    location_mismatch: bool = False
    risk_message:      Optional[str] = None


# ── AI Risk Schemas ───────────────────────────────────────────────────────────

class RiskScoreResponse(BaseModel):
    score:             int
    level:             str          # Low | Medium | High | Critical
    reasons:           list[str]
    location_mismatch: bool
    requires_token:    bool


# ── Transaction Schemas ───────────────────────────────────────────────────────

class TransactionInitRequest(BaseModel):
    receiver_upi: str
    amount:       float
    notes:        Optional[str] = None
    sender_city:  Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be positive")
        if v > 200000:
            raise ValueError("Amount exceeds UPI limit of ₹2,00,000")
        return round(v, 2)


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                int
    receiver_upi:      str
    amount:            float
    notes:             Optional[str]
    risk_score:        int
    risk_level:        str
    status:            str
    location_mismatch: bool
    sender_city:       Optional[str]
    receiver_city:     Optional[str]
    created_at:        datetime
    token_id:          Optional[int] = None
    token:             Optional[str] = None  # Actual token string for high-risk transactions


class TransactionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    receiver_upi: str
    amount:       float
    risk_level:   str
    status:       str
    created_at:   datetime
    location_mismatch: bool
    token:        Optional[str] = None  # Token string for token_pending transactions


class TransactionFilters(BaseModel):
    status:     Optional[str] = None
    risk_level: Optional[str] = None
    date_from:  Optional[datetime] = None
    date_to:    Optional[datetime] = None
    page:       int = 1
    page_size:  int = 20


# ── Tokenized Intent Schemas ──────────────────────────────────────────────────

class TokenStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    token:        str
    status:       str
    risk_score:   int
    risk_level:   str
    receiver_upi: str
    amount:       float
    expires_at:   datetime
    created_at:   datetime
    seconds_remaining: int


class TokenDecisionRequest(BaseModel):
    token:    str
    decision: str   # "confirm" | "deny"
    pin:      str   # Transaction PIN

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        if v not in ("confirm", "deny"):
            raise ValueError("Decision must be 'confirm' or 'deny'")
        return v

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not re.match(r"^\d{4}$", v):
            raise ValueError("PIN must be exactly 4 digits")
        return v


# ── Fraud Report Schemas ──────────────────────────────────────────────────────

class FraudReportRequest(BaseModel):
    reported_upi:      str
    category:          str
    custom_attack_type: Optional[str] = None
    description:       str
    transaction_id:    Optional[int] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {"fake_identity", "unauthorized", "phishing", "social_engineering", "other"}
        if v not in allowed:
            raise ValueError(f"Category must be one of {allowed}")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if len(v.strip()) < 20:
            raise ValueError("Description must be at least 20 characters")
        return v.strip()


class FraudReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    reported_upi: str
    category:     str
    status:       str
    created_at:   datetime


# ── Transaction PIN Schemas ───────────────────────────────────────────────────

class VerifyPINRequest(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not re.match(r"^\d{4}$", v):
            raise ValueError("PIN must be exactly 4 digits")
        return v


class UpdatePINRequest(BaseModel):
    old_pin: str
    new_pin: str

    @field_validator("old_pin", "new_pin")
    @classmethod
    def validate_pins(cls, v: str) -> str:
        if not re.match(r"^\d{4}$", v):
            raise ValueError("PIN must be exactly 4 digits")
        return v


# ── Mutual History Schemas (privacy-safe) ─────────────────────────────────────

class MutualHistoryResponse(BaseModel):
    transaction_count:  int
    trust_trend:        str   # "improving" | "stable" | "declining"
    fraud_report_count: int
    behavior_summary:   str
    # NOTE: No amounts or personal data included — privacy by design


# ── Dashboard Schemas ─────────────────────────────────────────────────────────

class DashboardResponse(BaseModel):
    user:           UserProfile
    trust_score:    TrustScoreResponse
    recent_alerts:  list[dict]
    pending_tokens: list[TokenStatusResponse]
    stats:          dict


# ── Generic Responses ─────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class PaginatedResponse(BaseModel):
    items:      list
    total:      int
    page:       int
    page_size:  int
    has_more:   bool
