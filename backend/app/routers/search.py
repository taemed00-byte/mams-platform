from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.case import Case
from app.models.patient import Patient
from app.models.provider import Provider
from app.models.client import Client
from app.models.invoice import Invoice

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/")
def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results = []
    term = f"%{q}%"

    # Cases
    cases = (db.query(Case).join(Patient, isouter=True)
             .filter(Case.case_number.ilike(term) |
                     Patient.name.ilike(term) |
                     Patient.passport_number.ilike(term) |
                     Case.insurance_policy_number.ilike(term))
             .limit(5).all())
    for c in cases:
        results.append({
            "type": "case",
            "id": str(c.id),
            "title": c.case_number,
            "subtitle": f"{c.patient.name if c.patient else '—'} · {c.status}",
            "badge": c.status,
            "url": f"/cases/{c.id}"
        })

    # Providers
    providers = (db.query(Provider)
                 .filter(Provider.name.ilike(term) |
                         Provider.city.ilike(term) |
                         Provider.contact_name.ilike(term))
                 .limit(4).all())
    for p in providers:
        results.append({
            "type": "provider",
            "id": str(p.id),
            "title": p.name,
            "subtitle": f"{p.category} · {p.city or '—'}",
            "badge": p.tier,
            "url": f"/providers/{p.id}"
        })

    # Clients
    clients = (db.query(Client)
               .filter(Client.name.ilike(term) |
                       Client.contact_name.ilike(term) |
                       Client.email.ilike(term))
               .limit(4).all())
    for c in clients:
        results.append({
            "type": "client",
            "id": str(c.id),
            "title": c.name,
            "subtitle": f"{c.client_type} · {c.pipeline_stage}",
            "badge": c.pipeline_stage,
            "url": f"/clients/{c.id}"
        })

    # Invoices
    invoices = (db.query(Invoice)
                .filter(Invoice.invoice_number.ilike(term))
                .limit(3).all())
    for inv in invoices:
        results.append({
            "type": "invoice",
            "id": str(inv.id),
            "title": inv.invoice_number,
            "subtitle": f"{inv.invoice_type} · {inv.currency} {inv.total:.2f}",
            "badge": inv.status,
            "url": f"/finance"
        })

    return results
