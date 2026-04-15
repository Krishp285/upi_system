# backend/app/routers/transactions.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database.connection import get_db
from app.models.models import User
from app.schemas.schemas import (
    TransactionInitRequest, TransactionResponse,
    TokenDecisionRequest, UPILookupRequest, UPILookupResponse,
    RiskScoreResponse, MessageResponse, MutualHistoryResponse
)
from app.services.transaction_service import transaction_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/lookup", response_model=UPILookupResponse)
async def lookup_upi(
    data: UPILookupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Look up any UPI ID for trust data before paying."""
    return await transaction_service.lookup_upi(db, data.upi_id, current_user.id)


@router.get("/risk-preview", response_model=RiskScoreResponse)
async def risk_preview(
    receiver_upi: str,
    amount: float,
    sender_city: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get AI risk score for a proposed transaction (non-committing)."""
    return await transaction_service.get_risk_preview(
        db, current_user.id, receiver_upi, amount, sender_city
    )


@router.post("/initiate", response_model=TransactionResponse)
async def initiate(
    data: TransactionInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a transaction. Issues delay token if high-risk."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        return await transaction_service.initiate_transaction(db, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Transaction initiation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/token/{token}")
async def get_token_status(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time status of a delay token (for countdown UI)."""
    try:
        return await transaction_service.get_token_status(db, token, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/token/decide", response_model=MessageResponse)
async def decide_token(
    data: TokenDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm or deny a pending delay token with PIN verification."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info(f"Token decision request - User: {current_user.id} | Token: {data.token[:10]}... | Decision: {data.decision} | PIN length: {len(data.pin)}")
        await transaction_service.decide_token(db, data.token, data.decision, data.pin, current_user.id)
        logger.info(f"Token decision successful - Token: {data.token[:10]}... | Decision: {data.decision}")
        return MessageResponse(message=f"Transaction {data.decision}d successfully")
    except ValueError as e:
        logger.warning(f"Token decision validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Token decision error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/history")
async def history(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated transaction history with filters."""
    return await transaction_service.get_transaction_history(
        db, current_user.id, status, risk_level, page, page_size
    )


@router.get("/incoming")
async def incoming(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transactions received by current user."""
    return await transaction_service.get_incoming_transactions(db, current_user.id)


@router.get("/detail/{tx_id}")
async def transaction_detail(
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full transaction detail including AI features snapshot."""
    try:
        return await transaction_service.get_transaction_detail(db, tx_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/mutual/{target_upi}", response_model=MutualHistoryResponse)
async def mutual_history(
    target_upi: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Privacy-safe mutual transaction history with a UPI ID."""
    return await transaction_service.get_mutual_history(db, current_user.id, target_upi)
