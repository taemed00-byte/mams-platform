"""
HIPAA §164.312(b) — Audit Controls.

All PHI access (reads AND writes) is logged.  Each row is chained via
SHA-256 to the previous row so tampering is detectable.

Usage:
    log_action(db, current_user, "VIEW_CASE", "Case", str(case.id),
               f"Case {case.case_number} viewed",
               ip_address=request.client.host,
               user_agent=request.headers.get("user-agent"))
"""
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.user import User
from typing import Optional

# Genesis hash — the "previous" hash for the very first row
_GENESIS_HASH = "0" * 64


def _compute_row_hash(log: AuditLog, previous_hash: str) -> str:
    """SHA-256 over the fields that identify this record."""
    payload = "|".join([
        str(log.id),
        str(log.actor_id or ""),
        log.action,
        str(log.entity_id or ""),
        log.created_at.isoformat(),
        previous_hash,
    ])
    return hashlib.sha256(payload.encode()).hexdigest()


def _get_last_hash(db: Session) -> str:
    last = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    return last.row_hash if last and last.row_hash else _GENESIS_HASH


def log_action(
    db: Session,
    actor: Optional[User],
    action: str,
    entity_type: str = None,
    entity_id: str = None,
    description: str = None,
    ip_address: str = None,
    user_agent: str = None,
) -> AuditLog:
    """Append an immutable, chained audit record."""
    previous_hash = _get_last_hash(db)
    log = AuditLog(
        actor_id    = actor.id if actor else None,
        actor_role  = actor.role.value if actor else "System",
        action      = action,
        entity_type = entity_type,
        entity_id   = str(entity_id) if entity_id else None,
        description = description,
        ip_address  = ip_address,
        user_agent  = user_agent,
        created_at  = datetime.utcnow(),
        previous_hash = previous_hash,
    )
    # Compute hash before flush so we can store it
    log.row_hash = _compute_row_hash(log, previous_hash)
    db.add(log)
    db.commit()
    return log


def verify_chain(db: Session) -> dict:
    """
    Walk the entire audit log in chronological order and verify the hash chain.
    Returns {"ok": True} or {"ok": False, "broken_at": <log_id>, "index": <n>}.
    Exposed at GET /api/audit/verify (Administrator only).
    """
    logs = db.query(AuditLog).order_by(AuditLog.created_at.asc()).all()
    prev = _GENESIS_HASH
    for i, log in enumerate(logs):
        expected = _compute_row_hash(log, prev)
        if log.row_hash != expected:
            return {"ok": False, "broken_at": str(log.id), "index": i,
                    "message": "Audit log integrity violation detected — possible tampering."}
        prev = log.row_hash
    return {"ok": True, "records_checked": len(logs)}
