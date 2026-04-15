# backend/app/config.py
# Centralised settings — reads from environment variables (.env file)
# Never hard-code secrets in source code.

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import os

class Settings(BaseSettings):
    # ── Application ───────────────────────────────────────────
    APP_NAME: str = "TruePayID"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # ── Database ──────────────────────────────────────────────
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "truepayid"
    DB_USER: str = "root"
    DB_PASSWORD: str = "password"

    @property
    def DATABASE_URL(self) -> str:
        # 1. If DATABASE_URL is provided (Render / cloud), use it
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            return db_url

        # 2. Otherwise fallback to local MySQL
        return (
            f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    )

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_STRONG_RANDOM_KEY"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── OTP ───────────────────────────────────────────────────
    OTP_EXPIRE_MINUTES: int = 10
    OTP_LENGTH: int = 6

    # ── Email (SMTP) ───────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "no-reply@truepayid.in"
    SMTP_PASSWORD: str = "SMTP_PASSWORD_HERE"
    EMAIL_FROM_NAME: str = "TruePayID Security"

    # ── Tokenized Delay ───────────────────────────────────────
    # Transactions above this amount get a delay token
    HIGH_VALUE_THRESHOLD: float = 10000.0
    TOKEN_WINDOW_SECONDS: int = 300  # 5 minutes

    # ── Fraud / Risk ──────────────────────────────────────────
    RISK_HIGH_THRESHOLD: int = 70     # score above this → high
    RISK_CRITICAL_THRESHOLD: int = 90  # score above this → critical

    # ── Rate Limiting ─────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── CORS ──────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
    ]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — import and call get_settings() anywhere."""
    return Settings()
