# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.database.connection import get_db
from app.schemas.schemas import (
    SignupRequest, VerifyOTPRequest, LoginRequest, LoginOTPRequest, VerifyLoginOTPRequest,
    TokenResponse, LoginOTPResponse, RefreshRequest, MessageResponse
)
from app.services.auth_service import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.signup(db, data)
        return MessageResponse(message=result["message"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in signup: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/verify-otp", response_model=MessageResponse)
async def verify_otp(data: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.verify_otp(db, str(data.email), data.otp)
        return MessageResponse(message=result["message"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in verify_otp: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login", response_model=LoginOTPResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login with password — now requires OTP verification.
    1. Verify password credentials
    2. Generate OTP and send to email
    3. Return message requesting OTP verification + OTP (dev mode)
    4. Frontend must call /login-otp-verify with identifier + OTP to get tokens
    """
    try:
        result = await auth_service.login(db, data)
        return LoginOTPResponse(
            message=result["message"],
            user_id=result["user_id"],
            otp=result.get("otp")  # Only in dev mode
        )
    except ValueError as e:
        logger.warning(f"Login validation error: {e}")
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in login endpoint: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login-otp-request", response_model=MessageResponse)
async def login_otp_request(data: LoginOTPRequest, db: AsyncSession = Depends(get_db)):
    """Request OTP for password-less login"""
    try:
        result = await auth_service.login_otp_request(db, data.identifier)
        return MessageResponse(message=result["message"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in login_otp_request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login-otp-verify", response_model=TokenResponse)
async def login_otp_verify(data: VerifyLoginOTPRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and complete password-less login"""
    try:
        return await auth_service.verify_login_otp(db, data.identifier, data.otp)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in login_otp_verify: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await auth_service.refresh_tokens(db, data.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in refresh: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
