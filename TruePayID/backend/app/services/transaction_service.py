# backend/app/services/transaction_service.py
# Core transaction intelligence service
# Orchestrates: UPI lookup → AI scoring → token generation → persistence

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.models import (
    User, TrustScore, Transaction, TokenizedIntent,
    LocationHistory, FraudReport, AuditLog
)
from app.schemas.schemas import (
    TransactionInitRequest, TransactionResponse, TokenStatusResponse,
    UPILookupResponse, RiskScoreResponse, MutualHistoryResponse
)
from app.ai_engine.fraud_scorer import fraud_scorer, FraudFeatures
from app.services.email_service import email_service
from app.services.auth_service import _verify_pin

settings = get_settings()
logger = logging.getLogger(__name__)


class TransactionService:

    # ── UPI Lookup ─────────────────────────────────────────────────────────────

    async def lookup_upi(self, db: AsyncSession, upi_id: str, requesting_user_id: int) -> UPILookupResponse:
        """
        Look up a UPI ID. Returns trust data if registered.
        If not registered, returns cautionary response (not an error).
        """
        q = await db.execute(
            select(User).options(selectinload(User.trust_score), selectinload(User.location_history))
            .where(User.upi_id == upi_id.lower())
        )
        target_user = q.scalar_one_or_none()

        if not target_user:
            return UPILookupResponse(
                upi_id=upi_id,
                full_name=None,
                is_registered=False,
                trust_score=None,
                trust_level=None,
                fraud_count=None,
                report_count=None,
                usual_city=None,
                location_mismatch=False,
                risk_message="This UPI ID is not registered on TruePayID. Proceed with extra caution.",
            )

        # Determine usual city (highest frequency)
        usual_city = None
        if target_user.location_history:
            most_frequent = max(target_user.location_history, key=lambda l: l.frequency)
            usual_city = most_frequent.city

        # Get requesting user's current city for mismatch detection
        req_q = await db.execute(
            select(LocationHistory)
            .where(LocationHistory.user_id == requesting_user_id)
            .order_by(desc(LocationHistory.last_seen))
            .limit(1)
        )
        req_location = req_q.scalar_one_or_none()
        current_city = req_location.city if req_location else None

        location_mismatch = (
            usual_city is not None and current_city is not None
            and usual_city.lower() != current_city.lower()
        )

        ts = target_user.trust_score
        risk_message = None
        if ts and ts.fraud_count > 0:
            risk_message = f"⚠️ This user has {ts.fraud_count} fraud incident(s) on record."
        elif location_mismatch:
            risk_message = f"📍 Receiver usually transacts from {usual_city}, but your location is {current_city}."

        return UPILookupResponse(
            upi_id=target_user.upi_id,
            full_name=target_user.full_name,
            is_registered=True,
            trust_score=ts.score if ts else 50,
            trust_level=ts.level if ts else "Unrated",
            fraud_count=ts.fraud_count if ts else 0,
            report_count=ts.report_count if ts else 0,
            usual_city=usual_city,
            location_mismatch=location_mismatch,
            risk_message=risk_message,
        )

    # ── Risk Preview ───────────────────────────────────────────────────────────

    async def get_risk_preview(
        self, db: AsyncSession, sender_id: int, receiver_upi: str,
        amount: float, sender_city: Optional[str] = None
    ) -> RiskScoreResponse:
        """
        Compute AI risk score before transaction is committed.
        Used by UI to show risk indicators while user is still on the form.
        """
        # Load receiver data
        recv_q = await db.execute(
            select(User).options(selectinload(User.trust_score), selectinload(User.location_history))
            .where(User.upi_id == receiver_upi.lower())
        )
        receiver = recv_q.scalar_one_or_none()

        trust_score_val = 50
        fraud_count = 0
        receiver_is_new = True
        receiver_usual_city = None

        if receiver:
            ts = receiver.trust_score
            trust_score_val = ts.score if ts else 50
            fraud_count = ts.fraud_count if ts else 0
            receiver_is_new = (datetime.utcnow() - receiver.created_at).days < 30
            if receiver.location_history:
                receiver_usual_city = max(receiver.location_history, key=lambda l: l.frequency).city

        # Sender's tx frequency last 7 days
        week_ago = datetime.utcnow() - timedelta(days=7)
        freq_q = await db.execute(
            select(func.count(Transaction.id)).where(
                and_(Transaction.sender_id == sender_id, Transaction.created_at >= week_ago)
            )
        )
        tx_freq = freq_q.scalar() or 0

        # First time sending to this receiver?
        prev_q = await db.execute(
            select(func.count(Transaction.id)).where(
                and_(Transaction.sender_id == sender_id, Transaction.receiver_upi == receiver_upi.lower())
            )
        )
        first_time = (prev_q.scalar() or 0) == 0

        # Location mismatch
        location_mismatch = (
            receiver_usual_city is not None
            and sender_city is not None
            and receiver_usual_city.lower() != sender_city.lower()
        )

        features = FraudFeatures(
            amount=amount,
            trust_score=trust_score_val,
            tx_frequency_7d=tx_freq,
            location_mismatch=location_mismatch,
            hour_of_day=datetime.utcnow().hour,
            fraud_report_count=fraud_count,
            receiver_is_new=receiver_is_new,
            amount_is_round=(amount % 1000 == 0),
            first_time_receiver=first_time,
        )

        result = fraud_scorer.score(features, settings.HIGH_VALUE_THRESHOLD)

        return RiskScoreResponse(
            score=result.score,
            level=result.level,
            reasons=result.reasons,
            location_mismatch=result.location_mismatch,
            requires_token=result.requires_token,
        )

    # ── Initiate Transaction ───────────────────────────────────────────────────

    async def initiate_transaction(
        self, db: AsyncSession, sender_id: int, data: TransactionInitRequest
    ) -> TransactionResponse:
        """
        Full transaction initiation flow:
        1. Compute risk
        2. If high-risk or high-value → issue token + notify
        3. Otherwise → mark as completed
        4. Update trust score, location history, audit log
        """
        sender_q = await db.execute(select(User).where(User.id == sender_id))
        sender = sender_q.scalar_one()

        risk_response = await self.get_risk_preview(
            db, sender_id, data.receiver_upi, data.amount, data.sender_city
        )

        # Determine receiver id if registered — eagerly load location_history to avoid async refresh issues
        recv_q = await db.execute(
            select(User)
            .options(selectinload(User.location_history))
            .where(User.upi_id == data.receiver_upi.lower())
        )
        receiver = recv_q.scalar_one_or_none()
        receiver_city = None
        if receiver and receiver.location_history:
            receiver_city = max(receiver.location_history, key=lambda l: l.frequency).city

        token_obj = None
        status = "completed"

        if risk_response.requires_token:
            # Issue delay token — user must confirm in window
            raw_token = secrets.token_urlsafe(32)
            expires = datetime.utcnow() + timedelta(seconds=settings.TOKEN_WINDOW_SECONDS)
            token_obj = TokenizedIntent(
                token=raw_token,
                sender_id=sender_id,
                receiver_upi=data.receiver_upi.lower(),
                amount=data.amount,
                notes=data.notes,
                risk_score=risk_response.score,
                risk_level=risk_response.level,
                expires_at=expires,
            )
            db.add(token_obj)
            await db.flush()
            status = "token_pending"
        
        # Persist transaction
        tx = Transaction(
            sender_id=sender_id,
            receiver_upi=data.receiver_upi.lower(),
            receiver_id=receiver.id if receiver else None,
            amount=data.amount,
            notes=data.notes,
            risk_score=risk_response.score,
            risk_level=risk_response.level,
            status=status,
            token_id=token_obj.id if token_obj else None,
            sender_city=data.sender_city,
            receiver_city=receiver_city,
            location_mismatch=risk_response.location_mismatch,
            ai_features_json={"reasons": risk_response.reasons, "score": risk_response.score},
        )
        db.add(tx)
        await db.flush()  # Get tx.id before emails

        # Update sender location history
        if data.sender_city:
            await self._update_location(db, sender_id, data.sender_city)

        # Update sender trust score tx count
        ts_q = await db.execute(select(TrustScore).where(TrustScore.user_id == sender_id))
        sender_ts = ts_q.scalar_one_or_none()
        if sender_ts:
            sender_ts.tx_count += 1

        # Audit log
        db.add(AuditLog(
            user_id=sender_id,
            action="transaction_initiated",
            entity_type="transaction",
            details={"receiver": data.receiver_upi, "amount": data.amount, "risk": risk_response.level},
        ))

        await db.commit()

        # Alert emails AFTER transaction persisted (so we have tx.id) — wrapped in try/except
        if risk_response.requires_token:
            try:
                await email_service.send_high_risk_warning(
                    recipient=sender.email,
                    user_name=sender.full_name,
                    receiver_upi=data.receiver_upi,
                    amount=data.amount,
                    reasons=risk_response.reasons,
                )
            except Exception as e:
                logger.warning(f"Failed to send high-risk warning email: {str(e)}")
            
            try:
                await email_service.send_token_created(
                    recipient=sender.email,
                    user_name=sender.full_name,
                    token=raw_token,
                    minutes=settings.TOKEN_WINDOW_SECONDS // 60,
                )
            except Exception as e:
                logger.warning(f"Failed to send token created email: {str(e)}")
        else:
            try:
                await email_service.send_transaction_initiated(
                    recipient=sender.email,
                    user_name=sender.full_name,
                    receiver_upi=data.receiver_upi,
                    amount=data.amount,
                    risk_level=risk_response.level,
                    transaction_id=tx.id,
                )
            except Exception as e:
                logger.warning(f"Failed to send transaction initiated email: {str(e)}")
        
        return TransactionResponse(
            id=tx.id,
            receiver_upi=tx.receiver_upi,
            amount=float(tx.amount),
            notes=tx.notes,
            risk_score=tx.risk_score,
            risk_level=tx.risk_level,
            status=tx.status,
            location_mismatch=tx.location_mismatch,
            sender_city=tx.sender_city,
            receiver_city=tx.receiver_city,
            created_at=tx.created_at,
            token_id=tx.token_id,
            token=token_obj.token if token_obj else None,  # Include actual token string
        )

    # ── Token Operations ───────────────────────────────────────────────────────

    async def get_token_status(self, db: AsyncSession, token: str, user_id: int) -> TokenStatusResponse:
        q = await db.execute(
            select(TokenizedIntent).where(
                TokenizedIntent.token == token,
                TokenizedIntent.sender_id == user_id,
            )
        )
        ti = q.scalar_one_or_none()
        if not ti:
            raise ValueError("Token not found")

        # Auto-expire
        if ti.status == "pending" and datetime.utcnow() > ti.expires_at:
            ti.status = "expired"

        seconds_remaining = max(0, int((ti.expires_at - datetime.utcnow()).total_seconds()))
        return TokenStatusResponse(
            token=ti.token,
            status=ti.status,
            risk_score=ti.risk_score,
            risk_level=ti.risk_level,
            receiver_upi=ti.receiver_upi,
            amount=float(ti.amount),
            expires_at=ti.expires_at,
            created_at=ti.created_at,
            seconds_remaining=seconds_remaining,
        )

    async def decide_token(self, db: AsyncSession, token: str, decision: str, pin: str, user_id: int):
        """
        Approve or deny a transaction token with PIN verification.
        PIN is required for security —  user must provide 4-digit PIN to execute transaction.
        """
        logger.info(f"🔐 decide_token called - User: {user_id}, Decision: {decision}, PIN length: {len(pin)}")
        
        q = await db.execute(
            select(TokenizedIntent).where(
                TokenizedIntent.token == token,
                TokenizedIntent.sender_id == user_id,
                TokenizedIntent.status == "pending",
            )
        )
        ti = q.scalar_one_or_none()
        if not ti:
            logger.warning(f"🚫 Token not found for user {user_id}")
            raise ValueError("Token not found or already decided")

        if datetime.utcnow() > ti.expires_at:
            ti.status = "expired"
            logger.warning(f"⏰ Token expired for user {user_id}")
            raise ValueError("Token has expired")

        # Verify user's transaction PIN
        user_q = await db.execute(select(User).where(User.id == user_id))
        user = user_q.scalar_one()
        
        logger.info(f"📋 PIN verification - User has PIN hash: {bool(user.transaction_pin_hash)}")
        logger.info(f"📋 PIN to verify: '{pin}' (length: {len(pin)})")
        
        if not user.transaction_pin_hash:
            logger.error(f"❌ User {user_id} has no PIN hash set")
            raise ValueError("Transaction PIN not set. Please update your profile.")
        
        is_valid = _verify_pin(pin, user.transaction_pin_hash)
        logger.info(f"📋 PIN verification result: {is_valid}")
        
        if not is_valid:
            logger.warning(f"❌ Incorrect PIN for user {user_id}")
            raise ValueError("Incorrect transaction PIN")

        ti.status = "confirmed" if decision == "confirm" else "denied"
        ti.decided_at = datetime.utcnow()

        # Update linked transaction status
        tx_q = await db.execute(
            select(Transaction).where(Transaction.token_id == ti.id)
        )
        tx = tx_q.scalar_one_or_none()
        if tx:
            tx.status = "completed" if decision == "confirm" else "denied"
            tx.updated_at = datetime.utcnow()

            # Send result email
            sender_q = await db.execute(select(User).where(User.id == user_id))
            sender = sender_q.scalar_one()
            await email_service.send_transaction_result(
                recipient=sender.email,
                user_name=sender.full_name,
                status=tx.status,
                receiver_upi=ti.receiver_upi,
                amount=float(ti.amount),
            )

        db.add(AuditLog(
            user_id=user_id,
            action=f"token_{decision}d",
            entity_type="tokenized_intent",
            entity_id=ti.id,
            details={"token": token, "decision": decision},
        ))
        
        await db.commit()

    # ── History ────────────────────────────────────────────────────────────────

    async def get_transaction_history(
        self, db: AsyncSession, user_id: int,
        status: Optional[str] = None, risk_level: Optional[str] = None,
        page: int = 1, page_size: int = 20
    ) -> dict:
        q = select(Transaction).options(selectinload(Transaction.token_intent)).where(Transaction.sender_id == user_id)
        if status:
            q = q.where(Transaction.status == status)
        if risk_level:
            q = q.where(Transaction.risk_level == risk_level)
        q = q.order_by(desc(Transaction.created_at)).offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(q)
        txns = result.scalars().all()

        count_q = select(func.count(Transaction.id)).where(Transaction.sender_id == user_id)
        total = (await db.execute(count_q)).scalar() or 0

        return {
            "items": [
                {
                    "id": t.id, "receiver_upi": t.receiver_upi, "amount": float(t.amount),
                    "risk_level": t.risk_level, "risk_score": t.risk_score,
                    "status": t.status, "created_at": t.created_at.isoformat(),
                    "location_mismatch": t.location_mismatch, "notes": t.notes,
                    "token": t.token_intent.token if t.token_intent else None,
                    "expires_at": t.token_intent.expires_at.isoformat() if t.token_intent else None,
                }
                for t in txns
            ],
            "total": total, "page": page, "page_size": page_size,
            "has_more": (page * page_size) < total,
        }

    async def get_incoming_transactions(self, db: AsyncSession, user_id: int) -> list:
        """Transactions where the current user is the receiver."""
        user_q = await db.execute(select(User).where(User.id == user_id))
        user = user_q.scalar_one()

        q = await db.execute(
            select(Transaction)
            .where(Transaction.receiver_upi == user.upi_id)
            .order_by(desc(Transaction.created_at))
            .limit(50)
        )
        txns = q.scalars().all()
        return [
            {
                "id": t.id, "sender_id": t.sender_id, "amount": float(t.amount),
                "risk_level": t.risk_level, "status": t.status,
                "created_at": t.created_at.isoformat(), "notes": t.notes,
            }
            for t in txns
        ]

    async def get_transaction_detail(self, db: AsyncSession, tx_id: int, user_id: int) -> dict:
        q = await db.execute(
            select(Transaction).where(
                Transaction.id == tx_id,
                Transaction.sender_id == user_id,
            )
        )
        tx = q.scalar_one_or_none()
        if not tx:
            raise ValueError("Transaction not found")

        return {
            "id": tx.id, "receiver_upi": tx.receiver_upi,
            "amount": float(tx.amount), "notes": tx.notes,
            "risk_score": tx.risk_score, "risk_level": tx.risk_level,
            "status": tx.status, "location_mismatch": tx.location_mismatch,
            "sender_city": tx.sender_city, "receiver_city": tx.receiver_city,
            "ai_features": tx.ai_features_json,
            "created_at": tx.created_at.isoformat(),
            "updated_at": tx.updated_at.isoformat(),
        }

    async def get_mutual_history(self, db: AsyncSession, user_id: int, target_upi: str) -> MutualHistoryResponse:
        """
        Privacy-safe mutual history — no amounts or PII.
        Useful for anti-fraud context before transacting.
        """
        q = await db.execute(
            select(func.count(Transaction.id)).where(
                Transaction.sender_id == user_id,
                Transaction.receiver_upi == target_upi.lower(),
            )
        )
        tx_count = q.scalar() or 0

        # Fraud reports against target
        recv_q = await db.execute(select(User).where(User.upi_id == target_upi.lower()))
        receiver = recv_q.scalar_one_or_none()
        fraud_count = 0
        if receiver:
            ts_q = await db.execute(select(TrustScore).where(TrustScore.user_id == receiver.id))
            ts = ts_q.scalar_one_or_none()
            fraud_count = ts.fraud_count if ts else 0

        # Trust trend (simplified: compare fraud count to tx count)
        if fraud_count == 0 and tx_count > 3:
            trend = "improving"
        elif fraud_count > 2:
            trend = "declining"
        else:
            trend = "stable"

        behavior = (
            f"You have sent {tx_count} transaction(s) to this UPI ID. "
            f"Their trust profile appears {trend}."
        )

        return MutualHistoryResponse(
            transaction_count=tx_count,
            trust_trend=trend,
            fraud_report_count=fraud_count,
            behavior_summary=behavior,
        )

    # ── Helpers ────────────────────────────────────────────────────────────────

    async def _update_location(self, db: AsyncSession, user_id: int, city: str):
        """Upsert location history entry, incrementing frequency."""
        q = await db.execute(
            select(LocationHistory).where(
                LocationHistory.user_id == user_id,
                LocationHistory.city == city,
            )
        )
        loc = q.scalar_one_or_none()
        if loc:
            loc.frequency += 1
            loc.last_seen = datetime.utcnow()
        else:
            db.add(LocationHistory(user_id=user_id, city=city))


transaction_service = TransactionService()
