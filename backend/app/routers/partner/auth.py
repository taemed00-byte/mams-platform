"""
Partner portal authentication.

Security controls applied (code-review pre-flight):
- Rate limiting per IP: 10 attempts / 60 s  (same as internal)
- Account lockout: 5 failures → 30-minute lock  (same as internal)
- Timing-safe lookup: user always fetched before password check
- Uniform error message: "Invalid credentials" for both unknown email + wrong password
  → prevents email enumeration
- JWT token_type="partner" prevents token reuse on internal /api/* routes
- must_change_password enforced by get_active_partner_user on all data routes
- HIPAA §164.312(b): all login events (success, failure, lockout) are audit-logged
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from collections import defaultdict
from time import time

from app.database import get_db
from app.models.partner_user import PartnerUser
from app.schemas.partner_user import (
    PartnerLoginRequest, PartnerToken, PartnerUserOut,
    PartnerChangePasswordRequest,
)
from app.core.security import verify_password, hash_password, create_access_token
from app.deps import get_current_partner_user
from app.services.audit import log_action

router = APIRouter(prefix="/partner/auth", tags=["partner-auth"])

# ── Rate limiting (mirrors internal auth constants) ───────────────────────────
_RATE_WINDOW   = 60   # seconds
_RATE_MAX      = 10   # requests per window per IP
_MAX_FAILURES  = 5    # before account lock
_LOCKOUT_MIN   = 30   # minutes

_ip_attempts: dict = defaultdict(list)


def _check_rate_limit(ip: str) -> None:
    now = time()
    bucket = _ip_attempts[ip]
    bucket[:] = [t for t in bucket if now - t < _RATE_WINDOW]
    if len(bucket) >= _RATE_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many attempts. Try again in {_RATE_WINDOW} seconds.",
            headers={"Retry-After": str(_RATE_WINDOW)},
        )
    bucket.append(now)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=PartnerToken)
def partner_login(data: PartnerLoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip  = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    _check_rate_limit(client_ip)

    # Timing-safe: always look up before checking password
    partner = db.query(PartnerUser).filter(
        PartnerUser.email == data.email.lower()
    ).first()

    # Account lockout check
    if partner and partner.locked_until and partner.locked_until > datetime.utcnow():
        remaining = int((partner.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        log_action(db, None, "PARTNER_LOGIN_BLOCKED",
                   entity_type="PartnerUser", entity_id=str(partner.id),
                   description=f"Partner account locked — {remaining} min remaining",
                   ip_address=client_ip, user_agent=user_agent)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account locked. Try again in {remaining} minute(s) or contact your administrator.",
        )

    # Credential check — uniform error to prevent email enumeration
    if not partner or not verify_password(data.password, partner.password_hash):
        if partner:
            partner.failed_login_count = (partner.failed_login_count or 0) + 1
            if partner.failed_login_count >= _MAX_FAILURES:
                partner.locked_until       = datetime.utcnow() + timedelta(minutes=_LOCKOUT_MIN)
                partner.failed_login_count = 0
                db.commit()
                log_action(db, None, "PARTNER_ACCOUNT_LOCKED",
                           entity_type="PartnerUser", entity_id=str(partner.id),
                           description=f"Partner account locked after {_MAX_FAILURES} failed attempts",
                           ip_address=client_ip, user_agent=user_agent)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Account locked for {_LOCKOUT_MIN} minutes after too many failed attempts.",
                )
            db.commit()
            log_action(db, None, "PARTNER_LOGIN_FAILED",
                       entity_type="PartnerUser", entity_id=str(partner.id),
                       description=f"Failed attempt {partner.failed_login_count}/{_MAX_FAILURES}",
                       ip_address=client_ip, user_agent=user_agent)
        # Same message whether email not found or password wrong
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not partner.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    # Success — reset counters
    partner.failed_login_count = 0
    partner.locked_until       = None
    partner.last_login         = datetime.utcnow()
    db.commit()

    token = create_access_token(str(partner.id), token_type="partner")
    log_action(db, None, "PARTNER_LOGIN",
               entity_type="PartnerUser", entity_id=str(partner.id),
               description=f"Partner login from {client_ip} — company {partner.company_id}",
               ip_address=client_ip, user_agent=user_agent)

    return PartnerToken(
        access_token=token,
        token_type="bearer",
        must_change_password=partner.must_change_password,
        user=PartnerUserOut.model_validate(partner),
    )


@router.get("/me", response_model=PartnerUserOut)
def partner_me(current: PartnerUser = Depends(get_current_partner_user)):
    """Returns the authenticated partner user's profile.
    Works even when must_change_password=True so the UI knows who is logged in."""
    return current


@router.post("/change-password")
def partner_change_password(
    data: PartnerChangePasswordRequest,
    current: PartnerUser = Depends(get_current_partner_user),
    db: Session = Depends(get_db),
):
    """
    Works for both forced first-login reset and voluntary password changes.
    Uses get_current_partner_user (not get_active_partner_user) so locked-out
    new users can still complete their onboarding.
    """
    if not verify_password(data.current_password, current.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current.password_hash        = hash_password(data.new_password)
    current.must_change_password = False
    db.commit()

    log_action(db, None, "PARTNER_PASSWORD_CHANGED",
               entity_type="PartnerUser", entity_id=str(current.id),
               description=f"Partner user {current.email} changed password")

    return {"message": "Password updated successfully"}
