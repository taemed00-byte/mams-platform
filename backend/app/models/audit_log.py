"""
HIPAA §164.312(b) — Audit Controls.
Every audit log row contains a SHA-256 hash of itself chained to the previous
row's hash.  Tampering with any row (or deleting rows) breaks the chain and is
detectable by the /api/audit/verify endpoint.
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor_role  = Column(String)
    action      = Column(String, nullable=False, index=True)
    entity_type = Column(String)
    entity_id   = Column(String)
    description = Column(Text)
    ip_address  = Column(String)
    user_agent  = Column(String)                    # HIPAA: capture the accessing client
    created_at  = Column(DateTime, default=datetime.utcnow, index=True)

    # ── Integrity chain ────────────────────────────────────────────────────
    # SHA-256( id | actor_id | action | entity_id | created_at | previous_hash )
    previous_hash = Column(String(64))              # previous row's row_hash
    row_hash      = Column(String(64))              # this row's hash

    actor = relationship("User", back_populates="audit_logs")
