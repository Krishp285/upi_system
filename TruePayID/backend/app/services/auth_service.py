# backend/app/services/auth_service.py
# Authentication service — handles signup, OTP, login, JWT lifecycle
# Security-first: passwords bcrypt-hashed, tokens stored as hashes

import hashlib
import secrets
import random
import string
import logging
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import User, AuthToken, TrustScore
from app.schemas.schemas import SignupRequest, LoginRequest, TokenResponse
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

settings = get_settings()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _hash_pin(pin: str) -> str:
    """Hash PIN for secure storage"""
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def _verify_pin(plain: str, hashed: str) -> bool:
    """Verify PIN against hash"""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _hash_token(token: str) -> str:
    """SHA-256 hash for safe DB storage of tokens."""
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _create_jwt(data: dict, expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.utcnow() + expires_delta}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    logger.info(f"✅ JWT Created | Payload: {payload} | Token length: {len(token)}")
    return token


def decode_access_token(token: str) -> Optional[dict]:
    try:
        logger.info(f"🔓 Decoding JWT | Token length: {len(token)} | First 20 chars: {token[:20]}...")
        decoded = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        logger.info(f"✅ JWT Decoded successfully | Payload: {decoded}")
        return decoded
    except JWTError as e:
        logger.error(f"❌ JWT Decode failed | Error: {e} | Token: {token[:50]}...")
        return None


class AuthService:

    async def signup(self, db: AsyncSession, data: SignupRequest) -> dict:
        """
        Register a new user. Steps:
        1. Check uniqueness of upi_id / phone / email
        2. Hash password and PIN
        3. Create user + trust score row
        4. Generate OTP and send verification email
        """
        for field, value in [("upi_id", data.upi_id), ("phone", data.phone), ("email", data.email)]:
            existing = await db.execute(
                select(User).where(getattr(User, field) == value)
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"An account with this {field} already exists")

        user = User(
            upi_id=data.upi_id,
            phone=data.phone,
            email=str(data.email),
            full_name=data.full_name,
            password_hash=_hash_password(data.password),
            transaction_pin_hash=_hash_pin(data.transaction_pin),
        )
        db.add(user)
        await db.flush()  # get user.id before commit

        # Initialize trust score row
        db.add(TrustScore(user_id=user.id))
        await db.flush()

        # Generate OTP
        otp = _generate_otp(settings.OTP_LENGTH)
        otp_expires = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        db.add(AuthToken(
            user_id=user.id,
            token_type="otp",
            token_hash=_hash_token(otp),
            expires_at=otp_expires,
        ))

        # Send verification email (async — does not block response)
        try:
            await email_service.send_otp(
                recipient=str(data.email),
                user_name=data.full_name,
                otp=otp,
            )
        except Exception as e:
            logger.warning(f"Failed to send OTP email: {e}")

        await db.commit()
        result = {"message": "Account created. Check your email for OTP verification.", "user_id": user.id}
        # In development mode, include OTP in response for testing
        if settings.DEBUG or settings.ENVIRONMENT == "development":
            result["otp"] = otp
        return result

    async def verify_otp(self, db: AsyncSession, email: str, otp: str) -> dict:
        """Verify OTP and mark user as verified."""
        user_q = await db.execute(select(User).where(User.email == email))
        user = user_q.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        otp_hash = _hash_token(otp)
        token_q = await db.execute(
            select(AuthToken).where(
                AuthToken.user_id == user.id,
                AuthToken.token_type == "otp",
                AuthToken.token_hash == otp_hash,
                AuthToken.is_used == False,
                AuthToken.expires_at > datetime.utcnow(),
            )
        )
        token = token_q.scalar_one_or_none()
        if not token:
            raise ValueError("Invalid or expired OTP")

        token.is_used = True
        user.is_verified = True
        await db.commit()
        return {"message": "Email verified successfully"}

    async def login(self, db: AsyncSession, data: LoginRequest) -> dict:
        """
        Login with UPI / phone / email + password.
        Sends OTP instead of issuing tokens directly.
        User must verify OTP before getting access tokens.
        """
        identifier = data.identifier.strip().lower()

        # Try to find user by any identifier
        for field in [User.upi_id, User.phone, User.email]:
            q = await db.execute(select(User).where(field == identifier))
            user = q.scalar_one_or_none()
            if user:
                break

        if not user or not _verify_password(data.password, user.password_hash):
            raise ValueError("Invalid credentials")

        if not user.is_verified:
            raise ValueError("Email not verified. Please verify your account first.")

        if not user.is_active:
            raise ValueError("Account is deactivated. Contact support.")

        # Generate OTP for login verification
        otp = _generate_otp(settings.OTP_LENGTH)
        otp_expires = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        db.add(AuthToken(
            user_id=user.id,
            token_type="otp",
            token_hash=_hash_token(otp),
            expires_at=otp_expires,
        ))

        # Send OTP email
        try:
            await email_service.send_otp(
                recipient=user.email,
                user_name=user.full_name,
                otp=otp,
            )
        except Exception as e:
            logger.warning(f"Failed to send login OTP: {e}")
            raise ValueError("Failed to send OTP. Please try again.")

        await db.commit()
        
        result = {"message": "OTP sent to your registered email. Please verify to complete login.", "user_id": user.id}
        # In development mode, include OTP in response for testing
        if settings.DEBUG or settings.ENVIRONMENT == "development":
            result["otp"] = otp
        return result

    async def login_otp_request(self, db: AsyncSession, identifier: str) -> dict:
        """
        Send OTP to user for password-less login via email.
        """
        identifier_lower = identifier.strip().lower()

        # Find user by identifier
        user = None
        for field in [User.upi_id, User.phone, User.email]:
            q = await db.execute(select(User).where(field == identifier_lower))
            user = q.scalar_one_or_none()
            if user:
                break

        if not user:
            raise ValueError("User not found")

        if not user.is_verified:
            raise ValueError("Email not verified. Please verify your account first.")

        if not user.is_active:
            raise ValueError("Account is deactivated. Contact support.")

        # Generate and store OTP for login
        otp = _generate_otp(settings.OTP_LENGTH)
        otp_expires = datetime.utcnow() + timedelta(minutes=5)  # 5-minute window for login OTP
        db.add(AuthToken(
            user_id=user.id,
            token_type="otp",
            token_hash=_hash_token(otp),
            expires_at=otp_expires,
        ))

        # Send OTP email
        try:
            await email_service.send_otp(
                recipient=user.email,
                user_name=user.full_name,
                otp=otp,
            )
        except Exception as e:
            logger.warning(f"Failed to send login OTP email: {e}")
            raise ValueError("Failed to send OTP. Please try again.")

        await db.commit()
        result = {"message": "OTP sent to your registered email"}
        # In development mode, include OTP in response for testing
        if settings.DEBUG or settings.ENVIRONMENT == "development":
            result["otp"] = otp  # Include OTP for frontend to display
        return result

    async def verify_login_otp(self, db: AsyncSession, identifier: str, otp: str) -> TokenResponse:
        """
        Verify OTP and complete login (password-less login).
        """
        identifier_lower = identifier.strip().lower()
        logger.info(f"🔐 OTP Verification attempt | Identifier: {identifier_lower} | OTP length: {len(otp)}")

        # Find user by identifier
        user = None
        field_names = ["upi_id", "phone", "email"]
        for idx, field in enumerate([User.upi_id, User.phone, User.email]):
            q = await db.execute(select(User).where(field == identifier_lower))
            user = q.scalar_one_or_none()
            if user:
                logger.info(f"✅ User found by {field_names[idx]}: {user.id}")
                break

        if not user:
            logger.warning(f"❌ User not found for identifier: {identifier_lower}")
            raise ValueError("User not found")

        # Verify OTP
        otp_hash = _hash_token(otp)
        logger.info(f"🔍 Searching for OTP token | User: {user.id} | OTP Hash: {otp_hash[:16]}...")
        
        token_q = await db.execute(
            select(AuthToken).where(
                AuthToken.user_id == user.id,
                AuthToken.token_type == "otp",
                AuthToken.token_hash == otp_hash,
                AuthToken.is_used == False,
                AuthToken.expires_at > datetime.utcnow(),
            )
        )
        otp_token = token_q.scalar_one_or_none()
        
        if not otp_token:
            logger.warning(f"❌ OTP token not found or invalid | User: {user.id}")
            # Check if token exists but is used/expired
            all_tokens = await db.execute(
                select(AuthToken).where(
                    AuthToken.user_id == user.id,
                    AuthToken.token_type == "otp"
                )
            )
            tokens = all_tokens.scalars().all()
            if tokens:
                for t in tokens:
                    logger.info(f"   Token: used={t.is_used}, exp={t.expires_at}, now={datetime.utcnow()}")
            raise ValueError("Invalid or expired OTP")

        logger.info(f"✅ OTP valid, marking as used and issuing JWT")
        otp_token.is_used = True

        # Issue JWT pair
        access_token = _create_jwt(
            {"sub": str(user.id), "upi": user.upi_id},
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        refresh_raw = secrets.token_urlsafe(48)
        refresh_expires = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        db.add(AuthToken(
            user_id=user.id,
            token_type="refresh",
            token_hash=_hash_token(refresh_raw),
            expires_at=refresh_expires,
        ))

        # Send login alert
        try:
            await email_service.send_login_alert(
                recipient=user.email,
                user_name=user.full_name,
            )
        except Exception as e:
            logger.warning(f"Failed to send login alert: {e}")

        await db.commit()
        logger.info(f"✅ Login successful for user {user.id}")

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_raw,
            user_id=user.id,
            upi_id=user.upi_id,
            full_name=user.full_name,
        )

    async def refresh_tokens(self, db: AsyncSession, refresh_token: str) -> TokenResponse:
        """Rotate refresh token — old one invalidated, new pair issued."""
        token_hash = _hash_token(refresh_token)
        q = await db.execute(
            select(AuthToken).where(
                AuthToken.token_hash == token_hash,
                AuthToken.token_type == "refresh",
                AuthToken.is_used == False,
                AuthToken.expires_at > datetime.utcnow(),
            )
        )
        token = q.scalar_one_or_none()
        if not token:
            raise ValueError("Invalid or expired refresh token")

        token.is_used = True  # invalidate old token (rotation)

        user_q = await db.execute(select(User).where(User.id == token.user_id))
        user = user_q.scalar_one()

        access_token = _create_jwt(
            {"sub": str(user.id), "upi": user.upi_id},
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        new_refresh = secrets.token_urlsafe(48)
        db.add(AuthToken(
            user_id=user.id,
            token_type="refresh",
            token_hash=_hash_token(new_refresh),
            expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ))

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh,
            user_id=user.id,
            upi_id=user.upi_id,
            full_name=user.full_name,
        )


auth_service = AuthService()
