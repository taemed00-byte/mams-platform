"""
Partner portal — invoice viewing.
Partners can only see invoices for their own company (client_id isolation).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import io

from app.database import get_db
from app.models.invoice import Invoice
from app.models.partner_user import PartnerUser
from app.deps import get_active_partner_user

router = APIRouter(prefix="/partner/invoices", tags=["partner-invoices"])


@router.get("/")
def list_invoices(
    status: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    """List invoices for this partner's company."""
    q = db.query(Invoice).filter(Invoice.client_id == partner.company_id)
    if status:
        q = q.filter(Invoice.status == status)
    invoices = q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id":             str(inv.id),
            "invoice_number": inv.invoice_number,
            "invoice_type":   inv.invoice_type,
            "status":         inv.status,
            "currency":       inv.currency,
            "subtotal":       inv.subtotal,
            "tax_amount":     inv.tax_amount,
            "total_amount":   inv.total_amount,
            "due_date":       inv.due_date,
            "created_at":     inv.created_at,
        }
        for inv in invoices
    ]


@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.client_id == partner.company_id,    # isolation
    ).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return {
        "id":             str(inv.id),
        "invoice_number": inv.invoice_number,
        "invoice_type":   inv.invoice_type,
        "status":         inv.status,
        "currency":       inv.currency,
        "subtotal":       inv.subtotal,
        "tax_rate":       inv.tax_rate,
        "tax_amount":     inv.tax_amount,
        "total_amount":   inv.total_amount,
        "due_date":       inv.due_date,
        "notes":          inv.notes,
        "created_at":     inv.created_at,
    }
