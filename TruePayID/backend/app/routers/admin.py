# backend/app/routers/admin.py
# Development-only admin endpoints for testing OTPs and debugging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.models.models import User, AuthToken
import logging

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
logger = logging.getLogger(__name__)


@router.get("/pending-otps")
async def get_pending_otps(db: AsyncSession = Depends(get_db)):
    """
    [DEVELOPMENT ONLY] - Get all pending OTPs for testing
    Returns email, user name, and OTP code
    """
    result = await db.execute(
        select(User, AuthToken).where(
            (AuthToken.token_type == "otp") &
            (AuthToken.is_used == False)
        ).join(User, User.id == AuthToken.user_id)
    )
    
    otps = []
    for user, token in result.all():
        # Extract OTP from database (we don't have it directly, but we can show the token hash)
        otps.append({
            "email": user.email,
            "full_name": user.full_name,
            "token_id": token.id,
            "created_at": token.created_at,
            "expires_at": token.expires_at,
            "note": "Check backend console for actual OTP code during signup"
        })
    
    return {
        "pending_otps": otps,
        "total": len(otps),
        "message": "Check backend terminal for OTP codes printed during signup"
    }


@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db)):
    """
    [DEVELOPMENT ONLY] - Get all users for testing
    """
    result = await db.execute(select(User))
    users = result.scalars().all()
    
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "upi_id": u.upi_id,
                "full_name": u.full_name,
                "is_verified": u.is_verified,
                "is_active": u.is_active,
                "created_at": u.created_at
            }
            for u in users
        ],
        "total": len(users)
    }


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """
    [DEVELOPMENT ONLY] - Delete a user for testing
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return {"error": "User not found"}
    
    await db.delete(user)
    await db.commit()
    
    return {"message": f"User {user.email} deleted"}
