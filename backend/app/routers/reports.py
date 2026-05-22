from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
import io
from app.database import get_db
from app.models.case import Case
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.provider import Provider
from app.models.client import Client
from app.models.audit_log import AuditLog
from app.models.scheduled_report import ScheduledReport
from app.deps import get_current_user
from app.models.user import User
from app.services.audit import log_action

router = APIRouter(prefix="/reports", tags=["reports"])

def get_date_range(preset: Optional[str], date_from: Optional[str], date_to: Optional[str]):
    now = datetime.utcnow()
    if preset == "7d": return now - timedelta(days=7), now
    elif preset == "30d": return now - timedelta(days=30), now
    elif preset == "MTD": return now.replace(day=1, hour=0, minute=0, second=0), now
    elif preset == "QTD":
        quarter_start = now.replace(month=((now.month - 1) // 3) * 3 + 1, day=1, hour=0, minute=0, second=0)
        return quarter_start, now
    elif preset == "YTD": return now.replace(month=1, day=1, hour=0, minute=0, second=0), now
    elif preset == "all": return datetime(2000, 1, 1), now
    else:
        dt_from = datetime.fromisoformat(date_from) if date_from else now - timedelta(days=30)
        dt_to = datetime.fromisoformat(date_to) if date_to else now
        return dt_from, dt_to

def make_excel(title: str, headers: list, rows: list):
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = title
    ws.append(headers)
    for row in rows: ws.append(row)
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 2
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return buf

@router.get("/cases/data")
def case_report_data(
    preset: Optional[str] = "30d", date_from: Optional[str] = None, date_to: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    dt_from, dt_to = get_date_range(preset, date_from, date_to)
    cases = db.query(Case).filter(Case.created_at.between(dt_from, dt_to)).all()
    total_cases = len(cases)
    by_status = db.query(Case.status, func.count(Case.id)).filter(Case.created_at.between(dt_from, dt_to)).group_by(Case.status).all()
    by_type = db.query(Case.case_type, func.count(Case.id)).filter(Case.created_at.between(dt_from, dt_to)).group_by(Case.case_type).all()
    total_cost = sum(c.actual_cost or 0 for c in cases)
    sla_breached = sum(1 for c in cases if c.sla_breached)
    return {
        "total_cases": total_cases, "total_cost": total_cost,
        "sla_breached": sla_breached, "sla_compliance": round((total_cases - sla_breached) / total_cases * 100, 1) if total_cases else 100,
        "by_status": [{"status": r[0], "count": r[1]} for r in by_status],
        "by_type": [{"type": r[0], "count": r[1]} for r in by_type],
        "top_clients": [],
        "top_providers": []
    }

@router.get("/cases/export")
def export_case_report(
    preset: Optional[str] = "30d", date_from: Optional[str] = None, date_to: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    from sqlalchemy.orm import joinedload
    dt_from, dt_to = get_date_range(preset, date_from, date_to)
    cases = db.query(Case).options(joinedload(Case.patient)).filter(Case.created_at.between(dt_from, dt_to)).all()
    headers = ["Case #","Patient","Type","Priority","Status","Country","Estimated Cost","Actual Cost","Currency","SLA Breached","Opened At"]
    rows = [[c.case_number, c.patient.name if c.patient else "", c.case_type, c.priority, c.status, c.country or "",
             c.estimated_cost, c.actual_cost, c.currency, "Yes" if c.sla_breached else "No", str(c.opened_at)] for c in cases]
    buf = make_excel("Case Report", headers, rows)
    log_action(db, current_user, "EXPORT_CASE_REPORT", description=f"Case report exported ({len(cases)} rows)")
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=case_report.xlsx"})

@router.get("/financial/export")
def export_financial_report(
    preset: Optional[str] = "30d", date_from: Optional[str] = None, date_to: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    dt_from, dt_to = get_date_range(preset, date_from, date_to)
    invoices = db.query(Invoice).filter(Invoice.created_at.between(dt_from, dt_to)).all()
    headers = ["Invoice #","Type","Status","Currency","Subtotal","Tax","Total","Due Date"]
    rows = [[i.invoice_number, i.invoice_type, i.status, i.currency, i.subtotal, i.tax_amount, i.total, str(i.due_date or "")] for i in invoices]
    buf = make_excel("Financial Report", headers, rows)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=financial_report.xlsx"})

@router.get("/provider-performance/export")
def export_provider_performance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    providers = db.query(Provider).all()
    headers = ["Name","Category","Tier","Country","Total Cases","Avg Cost","Approval Rate","Rating"]
    rows = [[p.name, p.category, p.tier, p.country or "", p.total_cases, p.average_cost, p.approval_rate, p.rating] for p in providers]
    buf = make_excel("Provider Performance", headers, rows)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=provider_performance.xlsx"})

@router.get("/sla/export")
def export_sla_report(
    preset: Optional[str] = "30d", date_from: Optional[str] = None, date_to: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    dt_from, dt_to = get_date_range(preset, date_from, date_to)
    cases = db.query(Case).filter(Case.created_at.between(dt_from, dt_to)).all()
    headers = ["Case #","Case Type","Priority","SLA Target (h)","Actual (h)","Breached","Status"]
    rows = [[c.case_number, c.case_type, c.priority, c.sla_target_hours, c.sla_actual_hours or "",
             "Yes" if c.sla_breached else "No", c.status] for c in cases]
    buf = make_excel("SLA Compliance", headers, rows)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=sla_report.xlsx"})

@router.get("/audit/export")
def export_audit_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(5000).all()
    headers = ["Action","Actor Role","Entity Type","Entity ID","Description","IP","Timestamp"]
    rows = [[l.action, l.actor_role or "", l.entity_type or "", l.entity_id or "", l.description or "", l.ip_address or "", str(l.created_at)] for l in logs]
    buf = make_excel("Audit Log", headers, rows)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=audit_report.xlsx"})

# Scheduled reports
@router.get("/scheduled")
def list_scheduled(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ScheduledReport).all()

@router.post("/scheduled", status_code=201)
def create_scheduled(name: str, report_type: str, frequency: str, recipients: str,
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sr = ScheduledReport(name=name, report_type=report_type, frequency=frequency, recipients=recipients)
    db.add(sr); db.commit(); db.refresh(sr)
    return sr

@router.put("/scheduled/{report_id}/toggle")
def toggle_scheduled(report_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sr = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
    if not sr: raise HTTPException(404, "Not found")
    sr.is_active = not sr.is_active
    db.commit()
    return {"is_active": sr.is_active}

@router.delete("/scheduled/{report_id}")
def delete_scheduled(report_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sr = db.query(ScheduledReport).filter(ScheduledReport.id == report_id).first()
    if sr: db.delete(sr); db.commit()
    return {"message": "Deleted"}
