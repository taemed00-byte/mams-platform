from sqlalchemy import Column, String, Boolean, DateTime, Integer, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base
from app.core.rbac import Role

class User(Base):
    __tablename__ = "users"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(String, nullable=False)
    email         = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role          = Column(SAEnum(Role), nullable=False, default=Role.OPERATIONS)
    is_active     = Column(Boolean, default=True)
    last_login    = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── HIPAA: Account lockout (§164.312(a)(2)(i) — unique user auth controls) ──
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until       = Column(DateTime, nullable=True)   # NULL = not locked

    cases_assigned = relationship("Case", back_populates="assigned_user", foreign_keys="Case.assigned_user_id")
    audit_logs     = relationship("AuditLog", back_populates="actor")
    notifications  = relationship("Notification", back_populates="user")
