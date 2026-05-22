from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class PartnerUserCreate(BaseModel):
    company_id: UUID
    name: str
    email: EmailStr
    role: str = "PartnerMember"

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("PartnerAdmin", "PartnerMember"):
            raise ValueError("role must be PartnerAdmin or PartnerMember")
        return v


class PartnerUserUpdate(BaseModel):
    name:      Optional[str]  = None
    role:      Optional[str]  = None
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("PartnerAdmin", "PartnerMember"):
            raise ValueError("role must be PartnerAdmin or PartnerMember")
        return v


class PartnerUserOut(BaseModel):
    id:                   UUID
    company_id:           UUID
    name:                 str
    email:                str
    role:                 str
    is_active:            bool
    must_change_password: bool
    last_login:           Optional[datetime]
    created_at:           datetime
    model_config = {"from_attributes": True}


# ── Auth schemas ──────────────────────────────────────────────────────────────

class PartnerLoginRequest(BaseModel):
    email:    EmailStr
    password: str


class PartnerToken(BaseModel):
    access_token:         str
    token_type:           str
    must_change_password: bool
    user:                 PartnerUserOut


class PartnerChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        import re
        errors = []
        if len(v) < 8:             errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", v): errors.append("one uppercase letter")
        if not re.search(r"[a-z]", v): errors.append("one lowercase letter")
        if not re.search(r"\d",    v): errors.append("one digit")
        if not re.search(r"[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]", v):
            errors.append("one special character")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return v


# ── Credential handoff (returned once, never stored) ──────────────────────────

class GeneratedCredentials(BaseModel):
    """Returned to the MAMS admin immediately after creating a partner user.
    The plaintext password is shown once and never retrievable again.
    """
    user:              PartnerUserOut
    plaintext_password: str
