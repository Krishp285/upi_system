# backend/app/utils/dependencies.py
# FastAPI dependency injection utilities
# get_current_user is used in every protected route

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.database.connection import get_db
from app.models.models import User
from app.services.auth_service import decode_access_token

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates JWT Bearer token and returns the authenticated User.
    Raises 401 if token is missing, expired, or invalid.
    """
    token = credentials.credentials
    logger.info(f"🔑 Authenticating with token: {token[:20]}...")
    
    payload = decode_access_token(token)
    logger.info(f"🔓 Token payload: {payload}")

    if not payload:
        logger.warning(f"❌ Invalid or expired access token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = int(payload.get("sub", 0))
    logger.info(f"🆔 Looking up user ID: {user_id}")
    
    q = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = q.scalar_one_or_none()

    if not user:
        logger.warning(f"❌ User not found or inactive | User ID: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated",
        )

    logger.info(f"✅ User authenticated: {user.id} ({user.email})")
    return user
