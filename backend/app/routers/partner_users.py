"""
MAMS internal — partner user management.

Accessible by MAMS Administrators only.  Allows creating partner users,
viewing their activity, resetting passwords, and deactivating accounts.

Code-review controls:
- Plaintext password shown exactly once (POST response) and never stored or logged
- Password generated via `secrets` module (cryptographically secure)
- Passwords meet the same strength policy as internal accounts
- Audit-logged for every CRUD action
"""
import secrets, string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.partner_user import PartnerUser
from app.models.client import Client
from app.schemas.partner_user import (
    PartnerUserCreate, PartnerUserUpdate,
    PartnerUserOut, GeneratedCredentials,
)
from app.core.security import hash_password
from app.deps import require_role
from app.models.user import User
from app.services.audit import log_action

router = APIRouter(prefix="/partner-users", tags=["partner-users"])

_ADMIN_ONLY = require_role("Administrator")


def _generate_password() -> str:
    """
    Cryptographically secure password that satisfies HIPAA strength rules:
    ≥12 chars, uppercase, lowercase, digit, special.
    Uses `secrets` not `random` — important for credential generation.
    """
    lower   = string.ascii_lowercase
    upper   = string.ascii_uppercase
    digits  = string.digits
    special = "!@#$%^&*"
    alphabet = lower + upper + digits + special

    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(12))
        if (any(c in lower   for c in pwd) and
            any(c in upper   for c in pwd) and
            any(c in digits  for c in pwd) and
            any(c in special for c in pwd)):
            return pwd


def _verify_company(company_id: UUID, db: Session) -> Client:
    """Ensure the target company exists and is an Insurance/Assistance company."""
    client = db.query(Client).filter(Client.id == company_id).first()
    if not client:
        raise HTTPException(404, "Company not found")
    if client.client_type not in ("Insurance Company", "Assistance Company"):
        raise HTTPException(400, "Partner users can only be created for Insurance or Assistance companies")
    return client


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PartnerUserOut])
def list_partner_users(
    company_id: Optional[UUID] = None,
    is_active:  Optional[bool] = None,
    skip: int = 0, limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN_ONLY),
):
    q = db.query(PartnerUser)
    if company_id: q = q.filter(PartnerUser.company_id == company_id)
    if is_active is not None: q = q.filter(PartnerUser.is_active == is_active)
    return q.order_by(PartnerUser.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=GeneratedCredentials, status_code=201)
def create_partner_user(
    data: PartnerUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN_ONLY),
):
    """
    Creates a partner user with an auto-generated password.
    The plaintext password is returned once in the response — it is never
    stored in plaintext or written to the audit log.
    The partner must change it on first login (must_change_password=True).
    """
    _verify_company(data.company_id, db)

    # Check for duplicate email
    if db.query(PartnerUser).filter(PartnerUser.email == data.email.lower()).first():
        raise HTTPException(400, "A partner user with this email already exists")

    plaintext = _generate_password()
    partner   = PartnerUser(
        company_id           = data.company_id,
        name                 = data.name,
        email                = data.email.lower(),
        password_hash        = hash_password(plaintext),
        role                 = data.role,
        is_active            = True,
        must_change_password = True,
    )
    db.add(partner); db.commit(); db.refresh(partner)

    log_action(db, current_user, "CREATE_PARTNER_USER",
               entity_type="PartnerUser", entity_id=str(partner.id),
               description=f"Partner user {partner.email} created for company {partner.company_id}")

    # Return plaintext once — the frontend must display this to the admin
    return GeneratedCredentials(
        user=PartnerUserOut.model_validate(partner),
        plaintext_password=plaintext,
    )


@router.get("/{user_id}", response_model=PartnerUserOut)
def get_partner_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN_ONLY),
):
    pu = db.query(PartnerUser).filter(PartnerUser.id == user_id).first()
    if not pu: raise HTTPException(404, "Partner user not found")
    return pu


@router.put("/{user_id}", response_model=PartnerUserOut)
def update_partner_user(
    user_id: UUID,
    data: PartnerUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN_ONLY),
):
    pu = db.query(PartnerUser).filter(PartnerUser.id == user_id).first()
    if not pu: raise HTTPException(404, "Partner user not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(pu, k, v)
    db.commit(); db.refresh(pu)
    log_action(db, current_user, "UPDATE_PARTNER_USER",
               entity_type="PartnerUser", entity_id=str(pu.id),
               description=f"Partner user {pu.email} updated")
    return pu


@router.delete("/{user_id}")
def deactivate_partner_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN_ONLY),
):
    pu = db.query(PartnerUser).filter(PartnerUser.id == user_id).first()
    if not pu: raise HTTPException(404, "Partner user not found")
    pu.is_active = False
    db.commit()
    log_action(db, current_user, "DEACTIVATE_PARTNER_USER",
               entity_type="PartnerUser", entity_id=str(pu.id),
               description=f"Partner user {pu.email} deactivated")
    return {"message": "Partner user deactivated"}


@router.post("/{user_id}/reset-password", response_model=GeneratedCredentials)
def reset_partner_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN_ONLY),
):
    """
    Admin-triggered password reset.  Generates a new secure password,
    sets must_change_password=True, and returns the plaintext once.
    """
    pu = db.query(PartnerUser).filter(PartnerUser.id == user_id).first()
    if not pu: raise HTTPException(404, "Partner user not found")

    plaintext            = _generate_password()
    pu.password_hash     = hash_password(plaintext)
    pu.must_change_password = True
    pu.failed_login_count   = 0
    pu.locked_until         = None          # clear any lockout
    db.commit(); db.refresh(pu)

    log_action(db, current_user, "RESET_PARTNER_PASSWORD",
               entity_type="PartnerUser", entity_id=str(pu.id),
               description=f"Password reset for partner user {pu.email}")

    return GeneratedCredentials(
        user=PartnerUserOut.model_validate(pu),
        plaintext_password=plaintext,
    )
