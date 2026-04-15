# backend/app/services/fraud_service.py
# Fraud reporting + trust score management
# Trust score update algorithm is the key anti-fraud mechanism

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User, TrustScore, FraudReport, AuditLog
from app.schemas.schemas import FraudReportRequest, FraudReportResponse
from app.services.email_service import email_service


def _compute_trust_level(score: int) -> str:
    if score >= 80:
        return "Excellent"
    elif score >= 60:
        return "High"
    elif score >= 40:
        return "Medium"
    elif score >= 20:
        return "Low"
    else:
        return "Low"


async def _penalize_trust(db: AsyncSession, reported_upi: str, penalty: int = 10):
    """
    Reduce trust score of reported user.
    Score is clamped to [0, 100].
    """
    q = await db.execute(select(User).where(User.upi_id == reported_upi.lower()))
    user = q.scalar_one_or_none()
    if not user:
        return

    ts_q = await db.execute(select(TrustScore).where(TrustScore.user_id == user.id))
    ts = ts_q.scalar_one_or_none()
    if ts:
        ts.score = max(0, ts.score - penalty)
        ts.report_count += 1
        ts.level = _compute_trust_level(ts.score)


class FraudService:

    async def submit_report(
        self, db: AsyncSession, reporter_id: int, data: FraudReportRequest
    ) -> FraudReportResponse:
        """
        Submit a fraud report. Immediately penalizes the reported user's trust score.
        """
        # Resolve reported user id if they are registered
        recv_q = await db.execute(select(User).where(User.upi_id == data.reported_upi.lower()))
        reported_user = recv_q.scalar_one_or_none()

        report = FraudReport(
            reporter_id=reporter_id,
            reported_upi=data.reported_upi.lower(),
            reported_id=reported_user.id if reported_user else None,
            category=data.category,
            custom_attack_type=data.custom_attack_type,
            description=data.description,
            transaction_id=data.transaction_id,
        )
        db.add(report)

        # Penalize trust score
        penalty = 15 if data.category in ("phishing", "social_engineering") else 10
        await _penalize_trust(db, data.reported_upi, penalty)

        # Also increment fraud_count
        if reported_user:
            ts_q = await db.execute(select(TrustScore).where(TrustScore.user_id == reported_user.id))
            ts = ts_q.scalar_one_or_none()
            if ts:
                ts.fraud_count += 1

        # Get reporter info for email
        rep_q = await db.execute(select(User).where(User.id == reporter_id))
        reporter = rep_q.scalar_one()

        # Send confirmation email
        await email_service.send_fraud_report_confirmation(
            recipient=reporter.email,
            user_name=reporter.full_name,
            reported_upi=data.reported_upi,
        )

        # Audit
        db.add(AuditLog(
            user_id=reporter_id,
            action="fraud_report_submitted",
            entity_type="fraud_report",
            details={"reported_upi": data.reported_upi, "category": data.category},
        ))

        await db.flush()
        return FraudReportResponse(
            id=report.id,
            reported_upi=report.reported_upi,
            category=report.category,
            status=report.status,
            created_at=report.created_at,
        )

    async def get_my_reports(self, db: AsyncSession, user_id: int) -> list:
        q = await db.execute(
            select(FraudReport).where(FraudReport.reporter_id == user_id)
            .order_by(FraudReport.created_at.desc())
        )
        reports = q.scalars().all()
        return [
            {
                "id": r.id, "reported_upi": r.reported_upi,
                "category": r.category, "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in reports
        ]


fraud_service = FraudService()
