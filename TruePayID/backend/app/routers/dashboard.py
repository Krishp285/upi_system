# backend/app/routers/dashboard.py
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.connection import get_db
from app.models.models import User, TrustScore, Transaction, TokenizedIntent
from app.schemas.schemas import UserProfile, TrustScoreResponse, UserPreferencesUpdate, MessageResponse
from app.utils.dependencies import get_current_user
from datetime import datetime

router = APIRouter(prefix="/user", tags=["User & Dashboard"])


@router.get("/me", response_model=UserProfile)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/dashboard")
async def dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Dashboard aggregate: trust score, recent activity,
    pending tokens, quick stats — all in one request.
    """
    # Trust score
    ts_q = await db.execute(select(TrustScore).where(TrustScore.user_id == current_user.id))
    ts = ts_q.scalar_one_or_none()

    # Recent transactions (last 5)
    tx_q = await db.execute(
        select(Transaction)
        .where(Transaction.sender_id == current_user.id)
        .order_by(desc(Transaction.created_at))
        .limit(5)
    )
    recent_txns = tx_q.scalars().all()

    # Pending tokens
    tok_q = await db.execute(
        select(TokenizedIntent).where(
            TokenizedIntent.sender_id == current_user.id,
            TokenizedIntent.status == "pending",
        )
    )
    pending_tokens = tok_q.scalars().all()

    # Auto-expire tokens
    now = datetime.utcnow()
    alerts = []
    valid_pending = []
    for tok in pending_tokens:
        if now > tok.expires_at:
            tok.status = "expired"
        else:
            valid_pending.append(tok)
            remaining = int((tok.expires_at - now).total_seconds())
            alerts.append({
                "type": "token_expiring",
                "message": f"Transaction to {tok.receiver_upi} awaits your decision ({remaining}s remaining)",
                "severity": "warning",
            })
    await db.commit()

    # Stats
    total_q = await db.execute(select(Transaction).where(Transaction.sender_id == current_user.id))
    all_txns = total_q.scalars().all()
    high_risk = sum(1 for t in all_txns if t.risk_level in ("High", "Critical"))

    return {
        "user": {
            "id": current_user.id, "upi_id": current_user.upi_id,
            "full_name": current_user.full_name, "email": current_user.email,
            "phone": current_user.phone, "is_verified": current_user.is_verified,
            "elderly_mode": current_user.elderly_mode,
            "created_at": current_user.created_at.isoformat(),
        },
        "trust_score": {
            "score": ts.score if ts else 50,
            "level": ts.level if ts else "Unrated",
            "fraud_count": ts.fraud_count if ts else 0,
            "report_count": ts.report_count if ts else 0,
            "tx_count": ts.tx_count if ts else 0,
        } if ts else None,
        "alerts": alerts,
        "pending_tokens": [
            {
                "token": t.token, "receiver_upi": t.receiver_upi,
                "amount": float(t.amount), "risk_level": t.risk_level,
                "expires_at": t.expires_at.isoformat(),
                "seconds_remaining": max(0, int((t.expires_at - now).total_seconds())),
            }
            for t in valid_pending
        ],
        "recent_transactions": [
            {
                "id": t.id, "receiver_upi": t.receiver_upi, "amount": float(t.amount),
                "risk_level": t.risk_level, "status": t.status,
                "created_at": t.created_at.isoformat(),
            }
            for t in recent_txns
        ],
        "stats": {
            "total_transactions": len(all_txns),
            "high_risk_transactions": high_risk,
            "trust_score": ts.score if ts else 50,
            "pending_tokens": len(valid_pending),
        },
    }


@router.patch("/preferences", response_model=MessageResponse)
async def update_preferences(
    data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.elderly_mode is not None:
        current_user.elderly_mode = data.elderly_mode
    if data.full_name is not None:
        current_user.full_name = data.full_name
    await db.commit()
    return MessageResponse(message="Preferences updated")
