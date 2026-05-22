from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime
import io
from app.database import get_db
from app.models.audit_log import AuditLog
from app.deps import require_role
from app.models.user import User
from app.services.audit import verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/")
def list_audit_logs(
    action: Optional[str] = None,
    actor_role: Optional[str] = None,
    entity_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Operations", "Finance"))
):
    q = db.query(AuditLog).options(joinedload(AuditLog.actor))
    if action: q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if actor_role: q = q.filter(AuditLog.actor_role == actor_role)
    if entity_type: q = q.filter(AuditLog.entity_type == entity_type)
    if date_from: q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to: q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
    if search: q = q.filter(AuditLog.description.ilike(f"%{search}%") | AuditLog.action.ilike(f"%{search}%"))
    logs = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [{"id": str(l.id), "action": l.action, "actor_name": l.actor.name if l.actor else "System",
             "actor_role": l.actor_role, "entity_type": l.entity_type, "entity_id": l.entity_id,
             "description": l.description, "ip_address": l.ip_address, "created_at": l.created_at} for l in logs]

@router.get("/verify")
def verify_audit_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrator"))
):
    """
    HIPAA §164.312(b): Verify the tamper-evident hash chain of the audit log.
    Returns {"ok": true, "records_checked": N} or identifies the first broken record.
    Administrator only.
    """
    return verify_chain(db)


@router.get("/export")
def export_audit(db: Session = Depends(get_db), current_user: User = Depends(require_role("Administrator"))):
    import openpyxl
    logs = db.query(AuditLog).options(joinedload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(10000).all()
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Audit Log"
    ws.append(["Timestamp","Actor","Role","Action","Entity Type","Entity ID","Description","IP"])
    for l in logs:
        ws.append([str(l.created_at), l.actor.name if l.actor else "System", l.actor_role or "",
                   l.action, l.entity_type or "", l.entity_id or "", l.description or "", l.ip_address or ""])
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 2
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=audit_log.xlsx"})
