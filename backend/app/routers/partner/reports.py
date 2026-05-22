"""
Partner portal — report export.
Only exports cases belonging to the partner's company.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
import io

from app.database import get_db
from app.models.case import Case
from app.models.partner_user import PartnerUser
from app.deps import get_active_partner_user

router = APIRouter(prefix="/partner/reports", tags=["partner-reports"])


@router.get("/cases/export")
def export_cases_excel(
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    """Export all cases for this partner's company as Excel."""
    import openpyxl
    cases = db.query(Case).options(joinedload(Case.patient)).filter(
        Case.client_id == partner.company_id    # isolation
    ).order_by(Case.created_at.desc()).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "My Cases"
    ws.append([
        "Case #", "Patient", "Type", "Priority", "Status",
        "Country", "City", "Policy #", "Currency",
        "Estimated Cost", "Actual Cost", "Opened At",
    ])
    for c in cases:
        ws.append([
            c.case_number,
            c.patient.name if c.patient else "",
            c.case_type,
            c.priority,
            c.status,
            c.country or "",
            c.city or "",
            c.insurance_policy_number or "",
            c.currency,
            c.estimated_cost,
            c.actual_cost,
            str(c.opened_at) if c.opened_at else "",
        ])

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = (
            max(len(str(cell.value or "")) for cell in col) + 2
        )

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=my_cases.xlsx"},
    )
