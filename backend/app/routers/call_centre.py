"""
Optional Add-on: Call-Centre Vendor API Integration
Stub implementation — wire up CALL_CENTRE_API_URL and CALL_CENTRE_API_KEY in .env to activate.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.case import Case
from app.models.client import Client
from app.services.audit import log_action
from app.config import settings
import hmac, hashlib, json

router = APIRouter(prefix="/integrations/call-centre", tags=["call-centre"])

@router.post("/webhook")
async def call_centre_webhook(request: Request, db: Session = Depends(get_db),
                               x_signature: Optional[str] = Header(None)):
    """Receive inbound leads and call events from call-centre platform."""
    body = await request.body()
    if settings.CALL_CENTRE_WEBHOOK_SECRET and x_signature:
        expected = hmac.new(settings.CALL_CENTRE_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, x_signature.replace("sha256=", "")):
            raise HTTPException(401, "Invalid webhook signature")
    payload = json.loads(body)
    event_type = payload.get("event_type")
    if event_type == "inbound_lead":
        # Auto-create client lead
        client = Client(
            name=payload.get("caller_name", "Unknown Caller"),
            client_type="Individual",
            phone=payload.get("phone"),
            email=payload.get("email"),
            pipeline_stage="Lead",
        )
        db.add(client); db.commit()
        log_action(db, None, "CALL_CENTRE_LEAD", "Client", str(client.id),
                   f"Inbound lead from call centre: {payload.get('phone')}")
    return {"status": "processed", "event_type": event_type}

@router.post("/click-to-call")
def initiate_call(phone: str, case_id: Optional[str] = None,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Initiate outbound call via call-centre platform."""
    if not settings.CALL_CENTRE_API_URL:
        raise HTTPException(503, "Call-centre integration not configured. Set CALL_CENTRE_API_URL in .env")
    import httpx
    try:
        resp = httpx.post(f"{settings.CALL_CENTRE_API_URL}/calls/initiate",
                          json={"phone": phone, "agent_id": str(current_user.id), "reference": case_id},
                          headers={"Authorization": f"Bearer {settings.CALL_CENTRE_API_KEY}"}, timeout=10)
        log_action(db, current_user, "CLICK_TO_CALL", description=f"Outbound call initiated to {phone}")
        return resp.json()
    except Exception as e:
        raise HTTPException(502, f"Call-centre API error: {str(e)}")

@router.get("/call-logs")
def get_call_logs(case_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Retrieve call logs from call-centre platform."""
    if not settings.CALL_CENTRE_API_URL:
        return {"logs": [], "message": "Call-centre integration not configured"}
    import httpx
    params = {}
    if case_id: params["reference"] = case_id
    try:
        resp = httpx.get(f"{settings.CALL_CENTRE_API_URL}/calls/logs",
                         params=params, headers={"Authorization": f"Bearer {settings.CALL_CENTRE_API_KEY}"}, timeout=10)
        return resp.json()
    except Exception as e:
        return {"logs": [], "error": str(e)}
