# backend/app/routers/fraud.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.models import User
from app.schemas.schemas import FraudReportRequest, FraudReportResponse
from app.services.fraud_service import fraud_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/fraud", tags=["Fraud Reports"])


@router.post("/report", response_model=FraudReportResponse, status_code=201)
async def submit_report(
    data: FraudReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await fraud_service.submit_report(db, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-reports")
async def my_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await fraud_service.get_my_reports(db, current_user.id)
