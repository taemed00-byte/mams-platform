from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.partner_user import PartnerUser

# ── Internal MAMS scheme ──────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── Partner portal scheme ─────────────────────────────────────────────────────
partner_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/partner/auth/login")

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)
_FORBIDDEN = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload:
        raise _UNAUTHORIZED
    # Code-review fix: reject partner tokens on internal routes (cross-portal isolation)
    if payload.get("type") == "partner":
        raise _UNAUTHORIZED
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise _UNAUTHORIZED
    return user


def require_role(*roles):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role.value not in roles:
            raise _FORBIDDEN
        return current_user
    return checker


# ── Partner dependencies ──────────────────────────────────────────────────────

def get_current_partner_user(
    token: str = Depends(partner_oauth2_scheme),
    db: Session = Depends(get_db),
) -> PartnerUser:
    """
    Validates a partner JWT.  Rejects:
    - Expired / tampered tokens
    - Internal MAMS tokens (type != "partner")
    - Inactive partner accounts
    """
    payload = decode_token(token)
    if not payload:
        raise _UNAUTHORIZED
    # Only accept tokens explicitly minted for the partner portal
    if payload.get("type") != "partner":
        raise _UNAUTHORIZED
    partner = db.query(PartnerUser).filter(PartnerUser.id == payload["sub"]).first()
    if not partner or not partner.is_active:
        raise _UNAUTHORIZED
    return partner


def get_active_partner_user(
    partner: PartnerUser = Depends(get_current_partner_user),
) -> PartnerUser:
    """
    Like get_current_partner_user but also blocks accounts that have not
    completed their mandatory first-login password change.
    Use on every data route; use get_current_partner_user only on auth routes.
    """
    if partner.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before accessing this resource.",
        )
    return partner
