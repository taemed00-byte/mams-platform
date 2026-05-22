"""
PartnerUser — external portal accounts for insurance / assistance companies.

Key design decisions (reviewed against OWASP / HIPAA):
- Separate table from `users` — no accidental RBAC bleed.
- `company_id` FK to `clients.id` scopes every data query to that company.
- `must_change_password` forces a reset on first login.
- `failed_login_count` + `locked_until` mirror the internal lockout policy.
- Indexed on `email` (lookup) and `company_id` (scoped queries).
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Enum as SAEnum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base


class PartnerRole(str):
    ADMIN  = "PartnerAdmin"   # can manage their company's users
    MEMBER = "PartnerMember"  # submit + track only


class PartnerUser(Base):
    __tablename__ = "partner_users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id    = Column(UUID(as_uuid=True), nullable=False, index=True)
    # ^ FK to clients.id — not a SQLAlchemy FK to avoid cross-schema coupling;
    #   enforced at the application layer in every router.

    name          = Column(String, nullable=False)
    email         = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)

    role          = Column(
        SAEnum("PartnerAdmin", "PartnerMember", name="partner_role_enum"),
        nullable=False,
        default="PartnerMember",
    )

    is_active            = Column(Boolean, default=True, nullable=False)
    must_change_password = Column(Boolean, default=True,  nullable=False)

    # HIPAA §164.312(a)(2)(i) — account lockout fields (same policy as internal)
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until       = Column(DateTime, nullable=True)

    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # Composite index for the most common query: active users for a company
        Index("ix_partner_users_company_active", "company_id", "is_active"),
    )
