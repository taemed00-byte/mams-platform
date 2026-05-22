"""
Optional Add-on: WhatsApp Business API Integration
Stub implementation — set WHATSAPP_API_URL, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID in .env to activate.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.communication import Communication
from app.services.audit import log_action
from app.config import settings
import httpx

router = APIRouter(prefix="/integrations/whatsapp", tags=["whatsapp"])

class WhatsAppMessage(BaseModel):
    phone: str
    message: str
    case_id: Optional[str] = None

def send_whatsapp(phone: str, message: str) -> dict:
    if not settings.WHATSAPP_API_URL:
        return {"status": "not_configured", "message": "WhatsApp integration not configured"}
    try:
        resp = httpx.post(
            f"{settings.WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_ID}/messages",
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}", "Content-Type": "application/json"},
            json={"messaging_product": "whatsapp", "to": phone, "type": "text", "text": {"body": message}},
            timeout=10
        )
        return resp.json()
    except Exception as e:
        return {"status": "error", "error": str(e)}

@router.post("/send")
def send_message(data: WhatsAppMessage, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    result = send_whatsapp(data.phone, data.message)
    if data.case_id:
        from uuid import UUID
        comm = Communication(case_id=UUID(data.case_id), user_id=current_user.id,
                             comm_type="WhatsApp", content=data.message, direction="Outbound")
        db.add(comm); db.commit()
    log_action(db, current_user, "WHATSAPP_SEND", description=f"WhatsApp sent to {data.phone}")
    return result

@router.post("/webhook")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive inbound WhatsApp messages and link to cases."""
    payload = await request.json()
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for msg in change.get("value", {}).get("messages", []):
                phone = msg.get("from")
                text = msg.get("text", {}).get("body", "")
                log_action(db, None, "WHATSAPP_INBOUND", description=f"WhatsApp from {phone}: {text[:100]}")
    return {"status": "ok"}

@router.get("/webhook")
def verify_webhook(hub_mode: str = None, hub_challenge: str = None, hub_verify_token: str = None):
    """WhatsApp webhook verification."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_TOKEN:
        return int(hub_challenge)
    raise HTTPException(403, "Verification failed")

# Utility: send automated case notification
def notify_case_update(phone: str, case_number: str, status: str):
    msg = f"TMASI Global Update: Your case {case_number} status has been updated to *{status}*. Contact us for details."
    return send_whatsapp(phone, msg)

def send_invoice_reminder(phone: str, invoice_number: str, amount: float, currency: str):
    msg = f"TMASI Global: Invoice {invoice_number} of {amount} {currency} is due. Please contact finance@tmasi.net."
    return send_whatsapp(phone, msg)
