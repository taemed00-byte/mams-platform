from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.case import Case
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.provider import Provider
from app.models.client import Client
from app.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

def parse_dates(date_from: Optional[str], date_to: Optional[str]):
    dt_from = datetime.fromisoformat(date_from) if date_from else datetime.utcnow() - timedelta(days=30)
    dt_to = datetime.fromisoformat(date_to) if date_to else datetime.utcnow()
    return dt_from, dt_to

@router.get("/")
def get_dashboard(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dt_from, dt_to = parse_dates(date_from, date_to)

    # KPIs
    open_cases = db.query(func.count(Case.id)).filter(Case.status == "Open").scalar() or 0
    total_revenue = db.query(func.sum(Invoice.total)).filter(
        Invoice.status == "Paid", Invoice.invoice_type == "Incoming",
        Invoice.created_at.between(dt_from, dt_to)
    ).scalar() or 0
    total_cases_in_range = db.query(func.count(Case.id)).filter(Case.created_at.between(dt_from, dt_to)).scalar() or 0
    sla_breached = db.query(func.count(Case.id)).filter(Case.sla_breached == True, Case.created_at.between(dt_from, dt_to)).scalar() or 0
    sla_compliance = ((total_cases_in_range - sla_breached) / total_cases_in_range * 100) if total_cases_in_range > 0 else 100
    overdue_invoices = db.query(func.count(Invoice.id)).filter(Invoice.status == "Overdue").scalar() or 0

    # Cases over time (daily counts)
    from sqlalchemy import cast, Date
    daily_cases = db.query(
        cast(Case.created_at, Date).label("date"),
        func.count(Case.id).label("count")
    ).filter(Case.created_at.between(dt_from, dt_to)).group_by(cast(Case.created_at, Date)).order_by("date").all()

    # Status breakdown
    status_breakdown = db.query(Case.status, func.count(Case.id)).filter(
        Case.created_at.between(dt_from, dt_to)
    ).group_by(Case.status).all()

    # Cost by case type
    cost_by_type = db.query(Case.case_type, func.sum(Case.actual_cost)).filter(
        Case.created_at.between(dt_from, dt_to)
    ).group_by(Case.case_type).all()

    # Top providers by case volume
    top_providers = db.query(
        Provider.name,
        func.count(Case.id).label("case_count"),
        Provider.approval_rate
    ).join(Case, Case.provider_id == Provider.id).filter(
        Case.created_at.between(dt_from, dt_to)
    ).group_by(Provider.id, Provider.name, Provider.approval_rate).order_by(func.count(Case.id).desc()).limit(5).all()

    return {
        "kpis": {
            "open_cases": open_cases,
            "total_revenue": float(total_revenue),
            "sla_compliance_rate": round(sla_compliance, 1),
            "overdue_invoices": overdue_invoices
        },
        "cases_over_time": [{"date": str(r.date), "count": r.count} for r in daily_cases],
        "status_breakdown": [{"label": r[0], "value": r[1]} for r in status_breakdown],
        "cost_by_case_type": [{"label": r[0], "value": float(r[1] or 0)} for r in cost_by_type],
        "top_providers": [{"name": r.name, "case_count": r.case_count, "approval_rate": float(r.approval_rate or 0)} for r in top_providers]
    }
