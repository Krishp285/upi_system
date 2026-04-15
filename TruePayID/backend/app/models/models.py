# backend/app/models/models.py
# SQLAlchemy ORM models — mirror the schema.sql design
# Relationships are declared here for easy cross-table queries

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Boolean, DateTime, Enum, Text,
    ForeignKey, JSON, Numeric, SmallInteger, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    upi_id: Mapped[str]        = mapped_column(String(100), unique=True, nullable=False)
    phone: Mapped[str]         = mapped_column(String(15), unique=True, nullable=False)
    email: Mapped[str]         = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str]     = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    transaction_pin_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool]  = mapped_column(Boolean, default=False)
    is_active: Mapped[bool]    = mapped_column(Boolean, default=True)
    elderly_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    trust_score:       Mapped[Optional["TrustScore"]]       = relationship("TrustScore", back_populates="user", uselist=False)
    auth_tokens:       Mapped[list["AuthToken"]]            = relationship("AuthToken", back_populates="user")
    sent_transactions: Mapped[list["Transaction"]]          = relationship("Transaction", foreign_keys="Transaction.sender_id", back_populates="sender")
    location_history:  Mapped[list["LocationHistory"]]      = relationship("LocationHistory", back_populates="user")
    fraud_reports:     Mapped[list["FraudReport"]]          = relationship("FraudReport", foreign_keys="FraudReport.reporter_id", back_populates="reporter")
    tokenized_intents: Mapped[list["TokenizedIntent"]]      = relationship("TokenizedIntent", back_populates="sender")
    email_logs:        Mapped[list["EmailLog"]]             = relationship("EmailLog", back_populates="user")
    audit_logs:        Mapped[list["AuditLog"]]             = relationship("AuditLog", back_populates="user")


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[int]          = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int]     = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_type: Mapped[str]  = mapped_column(Enum("refresh", "otp", "reset"), nullable=False)
    token_hash: Mapped[str]  = mapped_column(String(512), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_used: Mapped[bool]    = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="auth_tokens")


class TrustScore(Base):
    __tablename__ = "trust_scores"

    id: Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int]      = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    score: Mapped[int]        = mapped_column(SmallInteger, default=50)
    level: Mapped[str]        = mapped_column(Enum("Unrated", "Low", "Medium", "High", "Excellent"), default="Unrated")
    fraud_count: Mapped[int]  = mapped_column(SmallInteger, default=0)
    report_count: Mapped[int] = mapped_column(SmallInteger, default=0)
    tx_count: Mapped[int]     = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="trust_score")


class LocationHistory(Base):
    __tablename__ = "location_history"

    id: Mapped[int]       = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int]  = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    city: Mapped[str]     = mapped_column(String(100), nullable=False)
    region: Mapped[Optional[str]]  = mapped_column(String(100))
    country: Mapped[str]  = mapped_column(String(100), default="India")
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64))
    frequency: Mapped[int] = mapped_column(Integer, default=1)
    last_seen: Mapped[datetime]  = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="location_history")

    __table_args__ = (UniqueConstraint("user_id", "city", name="uq_user_city"),)


class TokenizedIntent(Base):
    __tablename__ = "tokenized_intents"

    id: Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str]        = mapped_column(String(64), unique=True, nullable=False)
    sender_id: Mapped[int]    = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_upi: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float]     = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    risk_score: Mapped[int]   = mapped_column(SmallInteger, default=0)
    risk_level: Mapped[str]   = mapped_column(Enum("Low", "Medium", "High", "Critical"), default="Low")
    status: Mapped[str]       = mapped_column(Enum("pending", "confirmed", "denied", "expired"), default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sender: Mapped["User"]         = relationship("User", back_populates="tokenized_intents")
    transaction: Mapped[Optional["Transaction"]] = relationship("Transaction", back_populates="token_intent", uselist=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int]              = mapped_column(Integer, primary_key=True, autoincrement=True)
    sender_id: Mapped[int]       = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    receiver_upi: Mapped[str]    = mapped_column(String(100), nullable=False)
    receiver_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    amount: Mapped[float]        = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    risk_score: Mapped[int]      = mapped_column(SmallInteger, default=0)
    risk_level: Mapped[str]      = mapped_column(Enum("Low", "Medium", "High", "Critical"), default="Low")
    status: Mapped[str]          = mapped_column(Enum("initiated", "token_pending", "completed", "denied", "failed"), default="initiated")
    token_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tokenized_intents.id", ondelete="SET NULL"))
    sender_city: Mapped[Optional[str]]   = mapped_column(String(100))
    receiver_city: Mapped[Optional[str]] = mapped_column(String(100))
    location_mismatch: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_features_json: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sender:       Mapped["User"]                    = relationship("User", foreign_keys=[sender_id], back_populates="sent_transactions")
    receiver:     Mapped[Optional["User"]]          = relationship("User", foreign_keys=[receiver_id])
    token_intent: Mapped[Optional["TokenizedIntent"]] = relationship("TokenizedIntent", back_populates="transaction")


class FraudReport(Base):
    __tablename__ = "fraud_reports"

    id: Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    reporter_id: Mapped[int]    = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reported_upi: Mapped[str]   = mapped_column(String(100), nullable=False)
    reported_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    category: Mapped[str]       = mapped_column(Enum("fake_identity", "unauthorized", "phishing", "social_engineering", "other"), nullable=False)
    custom_attack_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[str]    = mapped_column(Text, nullable=False)
    transaction_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("transactions.id", ondelete="SET NULL"))
    status: Mapped[str]         = mapped_column(Enum("pending", "reviewed", "actioned", "dismissed"), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    reporter:    Mapped["User"]                    = relationship("User", foreign_keys=[reporter_id], back_populates="fraud_reports")
    reported:    Mapped[Optional["User"]]          = relationship("User", foreign_keys=[reported_id])
    transaction: Mapped[Optional["Transaction"]]   = relationship("Transaction")


class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[int]          = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    recipient: Mapped[str]   = mapped_column(String(255), nullable=False)
    email_type: Mapped[str]  = mapped_column(Enum("otp", "login_alert", "tx_initiated", "high_risk", "token_created", "tx_result", "fraud_report"), nullable=False)
    subject: Mapped[str]     = mapped_column(String(255), nullable=False)
    status: Mapped[str]      = mapped_column(Enum("queued", "sent", "failed"), default="queued")
    error_msg: Mapped[Optional[str]] = mapped_column(Text)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="email_logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int]          = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str]      = mapped_column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[int]]   = mapped_column(Integer)
    details: Mapped[Optional[dict]]    = mapped_column(JSON)
    ip_hash: Mapped[Optional[str]]     = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")
