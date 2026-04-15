# backend/app/services/email_service.py
# Async email service — sends transactional emails via SMTP
# Templates are inline HTML for zero external dependencies

import asyncio
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _build_base_template(title: str, content: str, cta_text: str = None, cta_color: str = "#4f46e5") -> str:
    """Shared HTML email wrapper — consistent branding across all emails."""
    cta_block = f"""
    <tr><td align="center" style="padding: 24px 0;">
      <a href="#" style="background:{cta_color};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">{cta_text}</a>
    </td></tr>""" if cta_text else ""

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#4f46e5 100%);padding:28px 36px;">
          <table width="100%"><tr>
            <td><span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">🛡️ TruePayID</span></td>
            <td align="right"><span style="color:#a5b4fc;font-size:12px;">Trust Layer for UPI</span></td>
          </tr></table>
        </td></tr>
        <!-- Title -->
        <tr><td style="padding:32px 36px 0;">
          <h1 style="margin:0;color:#1e1b4b;font-size:22px;font-weight:700;">{title}</h1>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:16px 36px;">{content}</td></tr>
        {cta_block}
        <!-- Footer -->
        <tr><td style="padding:24px 36px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">This email was sent by TruePayID. If you didn't request this, please ignore it or contact <a href="mailto:support@truepayid.in" style="color:#4f46e5;">support@truepayid.in</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


class EmailService:

    async def _send_async(self, recipient: str, subject: str, html: str) -> bool:
        """
        Send email via SMTP in a thread pool executor so it doesn't block FastAPI's event loop.
        Sends to the configured SMTP server (Gmail).
        """
        def _send():
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"]    = f"{settings.EMAIL_FROM_NAME} <{settings.SMTP_USER}>"
                msg["To"]      = recipient
                msg.attach(MIMEText(html, "html"))

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(settings.SMTP_USER, recipient, msg.as_string())
                logger.info(f"✅ Email sent to {recipient}: {subject}")
                return True
            except Exception as e:
                logger.error(f"❌ Email send failed to {recipient}: {e}")
                return False

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _send)

    async def send_otp(self, recipient: str, user_name: str, otp: str):
        # Log OTP to console AND file for reference during development
        msg = f"\n{'='*70}\n✅ OTP GENERATED\n{'='*70}\nUser: {user_name}\nEmail: {recipient}\n🔐 OTP CODE: {otp}\nExpires: {settings.OTP_EXPIRE_MINUTES} minutes\n{'='*70}\n"
        logger.warning(msg)
        
        # Also save to a file for easy reference with explicit error handling
        otp_file = os.path.join(os.path.dirname(__file__), "../../otp_codes.txt")
        try:
            with open(otp_file, "a") as f:
                f.write(f"[{datetime.utcnow().isoformat()}] {recipient}: {otp}\n")
                f.flush()
        except Exception as e:
            pass
        
        # Send email to registered email address
        content = f"""
        <p style="color:#475569;margin:0 0 20px;">Hi <strong>{user_name}</strong>,</p>
        <p style="color:#475569;margin:0 0 24px;">Your TruePayID verification code is:</p>
        <div style="background:#f8fafc;border:2px dashed #4f46e5;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
          <span style="font-size:40px;font-weight:800;color:#1e1b4b;letter-spacing:12px;">{otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">This code expires in {settings.OTP_EXPIRE_MINUTES} minutes. Do not share it with anyone.</p>"""
        html = _build_base_template("Verify Your Email", content)
        await self._send_async(recipient, "🔐 Your TruePayID Verification Code", html)

    async def send_login_alert(self, recipient: str, user_name: str):
        now = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")
        content = f"""
        <p style="color:#475569;margin:0 0 16px;">Hi <strong>{user_name}</strong>,</p>
        <p style="color:#475569;margin:0 0 24px;">A new login to your TruePayID account was detected:</p>
        <table style="background:#f8fafc;border-radius:8px;padding:16px 20px;width:100%;margin:0 0 24px;">
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Time</td><td style="color:#1e293b;font-weight:600;padding:4px 0;">{now}</td></tr>
        </table>
        <p style="color:#ef4444;font-size:13px;margin:0;">⚠️ If this wasn't you, contact support immediately and change your password.</p>"""
        html = _build_base_template("New Login Detected", content, cta_color="#ef4444")
        await self._send_async(recipient, "⚠️ TruePayID Login Alert", html)

    async def send_transaction_initiated(self, recipient: str, user_name: str, receiver_upi: str, amount: float, risk_level: str, transaction_id: int = None):
        risk_colors = {"Low": "#22c55e", "Medium": "#f59e0b", "High": "#ef4444", "Critical": "#7f1d1d"}
        risk_color = risk_colors.get(risk_level, "#94a3b8")
        tx_id_row = f"<tr><td style='color:#94a3b8;font-size:13px;padding:4px 0;'>Transaction ID</td><td style='color:#1e293b;font-weight:600;padding:4px 0;'>{transaction_id}</td></tr>" if transaction_id else ""
        timestamp = datetime.now().strftime("%d %b %Y, %I:%M %p")
        content = f"""
        <p style="color:#475569;margin:0 0 16px;">Hi <strong>{user_name}</strong>,</p>
        <p style="color:#475569;margin:0 0 24px;">A transaction has been initiated from your account:</p>
        <table style="background:#f8fafc;border-radius:8px;padding:16px 20px;width:100%;margin:0 0 24px;">
          {tx_id_row}
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">To</td><td style="color:#1e293b;font-weight:600;padding:4px 0;">{receiver_upi}</td></tr>
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Amount</td><td style="color:#1e293b;font-weight:600;padding:4px 0;">₹{amount:,.2f}</td></tr>
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Risk Level</td><td style="padding:4px 0;"><span style="background:{risk_color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">{risk_level}</span></td></tr>
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Timestamp</td><td style="color:#1e293b;font-weight:600;padding:4px 0;">{timestamp}</td></tr>
        </table>"""
        html = _build_base_template("Transaction Initiated", content)
        await self._send_async(recipient, "💸 TruePayID Transaction Initiated", html)

    async def send_high_risk_warning(self, recipient: str, user_name: str, receiver_upi: str, amount: float, reasons: list[str]):
        reasons_html = "".join(f"<li style='color:#ef4444;padding:4px 0;'>{r}</li>" for r in reasons)
        content = f"""
        <p style="color:#475569;margin:0 0 16px;">Hi <strong>{user_name}</strong>,</p>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:16px;margin:0 0 24px;">
          <p style="color:#ef4444;font-weight:700;margin:0 0 8px;">🚨 HIGH-RISK TRANSACTION DETECTED</p>
          <p style="color:#475569;margin:0 0 16px;">Receiver: <strong>{receiver_upi}</strong> | Amount: <strong>₹{amount:,.2f}</strong></p>
          <p style="color:#475569;font-weight:600;margin:0 0 8px;">Risk Factors:</p>
          <ul style="margin:0;padding-left:20px;">{reasons_html}</ul>
        </div>
        <p style="color:#475569;margin:0;">A delay token has been issued. You have {settings.TOKEN_WINDOW_SECONDS // 60} minutes to confirm or deny this transaction.</p>"""
        html = _build_base_template("High-Risk Transaction Warning", content, cta_color="#ef4444")
        await self._send_async(recipient, "🚨 TruePayID High-Risk Alert", html)

    async def send_token_created(self, recipient: str, user_name: str, token: str, minutes: int):
        content = f"""
        <p style="color:#475569;margin:0 0 16px;">Hi <strong>{user_name}</strong>,</p>
        <p style="color:#475569;margin:0 0 24px;">A delay token has been issued for your transaction. You must confirm or deny it within <strong>{minutes} minutes</strong>.</p>
        <div style="background:#f8fafc;border:2px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px;">
          <span style="font-size:13px;color:#94a3b8;">Token Reference</span><br>
          <span style="font-size:16px;font-weight:700;color:#1e1b4b;letter-spacing:2px;">{token[:16]}...</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;">Log in to TruePayID to confirm or deny this transaction before it expires.</p>"""
        html = _build_base_template("Action Required: Transaction Token", content, cta_text="Open TruePayID", cta_color="#f59e0b")
        await self._send_async(recipient, "⏳ TruePayID: Transaction Confirmation Required", html)

    async def send_transaction_result(self, recipient: str, user_name: str, status: str, receiver_upi: str, amount: float, transaction_id: int = None):
        icon = "✅" if status == "completed" else "❌"
        color = "#22c55e" if status == "completed" else "#ef4444"
        timestamp = datetime.now().strftime("%d %b %Y, %I:%M %p")
        tx_id_row = f"<tr><td style='color:#94a3b8;font-size:13px;padding:4px 0;'>Transaction ID</td><td style='color:#1e293b;font-weight:600;padding:4px 0;'>{transaction_id}</td></tr>" if transaction_id else ""
        content = f"""
        <p style="color:#475569;margin:0 0 16px;">Hi <strong>{user_name}</strong>,</p>
        <div style="background:{color}1a;border-left:4px solid {color};border-radius:0 8px 8px 0;padding:16px;margin:0 0 24px;">
          <p style="color:{color};font-weight:700;margin:0;">{icon} Transaction {status.upper()}</p>
        </div>
        <table style="background:#f8fafc;border-radius:8px;padding:16px 20px;width:100%;margin:0 0 24px;">
          {tx_id_row}
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">To</td><td style="color:#1e293b;font-weight:600;padding:4px 0;">{receiver_upi}</td></tr>
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Amount</td><td style="color:#1e293b;font-weight:600;padding:4px 0;">₹{amount:,.2f}</td></tr>
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Status</td><td style="color:{color};font-weight:600;padding:4px 0;">{status.capitalize()}</td></tr>
          <tr><td style="color:#94a3b8;font-size:13px;padding:4px 0;">Timestamp</td><td style="color:#1e293b;font-weight:600;padding:4px 0;">{timestamp}</td></tr>
        </table>"""
        html = _build_base_template("Transaction Result", content)
        await self._send_async(recipient, f"{icon} TruePayID Transaction {status.capitalize()}", html)

    async def send_fraud_report_confirmation(self, recipient: str, user_name: str, reported_upi: str):
        content = f"""
        <p style="color:#475569;margin:0 0 16px;">Hi <strong>{user_name}</strong>,</p>
        <p style="color:#475569;margin:0 0 16px;">Your fraud report against <strong>{reported_upi}</strong> has been received and will be reviewed by our team.</p>
        <p style="color:#475569;margin:0 0 16px;">Reports like yours help protect the entire TruePayID community. Thank you for contributing.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Report Status: <strong>Under Review</strong></p>"""
        html = _build_base_template("Fraud Report Received", content)
        await self._send_async(recipient, "📋 TruePayID Fraud Report Submitted", html)


email_service = EmailService()
