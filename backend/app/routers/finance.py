from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import random, string, io
from app.database import get_db
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.payment import Payment
from app.schemas.finance import InvoiceCreate, InvoiceUpdate, InvoiceOut, PaymentCreate, PaymentOut
from app.deps import get_current_user
from app.models.user import User
from app.services.audit import log_action
from app.services.notifications import notify_all_role

router = APIRouter(prefix="/finance", tags=["finance"])

def gen_invoice_number():
    return "INV-" + "".join(random.choices(string.digits, k=8))

@router.get("/invoices", response_model=List[InvoiceOut])
def list_invoices(
    status: Optional[str] = None,
    invoice_type: Optional[str] = None,
    client_id: Optional[UUID] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    q = db.query(Invoice)
    if status: q = q.filter(Invoice.status == status)
    if invoice_type: q = q.filter(Invoice.invoice_type == invoice_type)
    if client_id: q = q.filter(Invoice.client_id == client_id)
    if date_from: q = q.filter(Invoice.created_at >= datetime.fromisoformat(date_from))
    if date_to: q = q.filter(Invoice.created_at <= datetime.fromisoformat(date_to))
    return q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/invoices", response_model=InvoiceOut, status_code=201)
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subtotal = sum(item.amount for item in data.line_items)
    tax_amount = subtotal * (data.tax_rate / 100)
    total = subtotal + tax_amount
    inv = Invoice(
        invoice_number=gen_invoice_number(),
        case_id=data.case_id, client_id=data.client_id, provider_id=data.provider_id,
        invoice_type=data.invoice_type, currency=data.currency,
        tax_rate=data.tax_rate, subtotal=subtotal, tax_amount=tax_amount, total=total,
        notes=data.notes, due_date=data.due_date
    )
    db.add(inv); db.flush()
    for item in data.line_items:
        db.add(InvoiceLineItem(invoice_id=inv.id, **item.model_dump()))
    db.commit(); db.refresh(inv)
    log_action(db, current_user, "CREATE_INVOICE", "Invoice", str(inv.id), f"Invoice {inv.invoice_number} created")
    return inv

@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(404, "Invoice not found")
    return inv

@router.put("/invoices/{invoice_id}", response_model=InvoiceOut)
def update_invoice(invoice_id: UUID, data: InvoiceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv: raise HTTPException(404, "Invoice not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(inv, k, v)
    if data.status == "Paid":
        inv.paid_date = datetime.utcnow()
    db.commit(); db.refresh(inv)
    log_action(db, current_user, "UPDATE_INVOICE", "Invoice", str(inv.id), f"Invoice {inv.invoice_number} → {inv.status}")
    return inv

@router.get("/payments", response_model=List[PaymentOut])
def list_payments(
    status: Optional[str] = None,
    payment_type: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    q = db.query(Payment)
    if status: q = q.filter(Payment.status == status)
    if payment_type: q = q.filter(Payment.payment_type == payment_type)
    return q.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/payments", response_model=PaymentOut, status_code=201)
def create_payment(data: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pay = Payment(**data.model_dump())
    db.add(pay); db.commit(); db.refresh(pay)
    log_action(db, current_user, "CREATE_PAYMENT", "Payment", str(pay.id), f"Payment of {pay.amount} {pay.currency} recorded")
    return pay

@router.put("/payments/{payment_id}/status")
def update_payment_status(payment_id: UUID, status: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pay = db.query(Payment).filter(Payment.id == payment_id).first()
    if not pay: raise HTTPException(404, "Payment not found")
    pay.status = status
    db.commit()
    return {"message": f"Payment status updated to {status}"}

@router.get("/kpis")
def get_financial_kpis(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy import func
    total_revenue = db.query(func.sum(Invoice.total)).filter(Invoice.status == "Paid", Invoice.invoice_type == "Incoming").scalar() or 0
    outstanding = db.query(func.sum(Invoice.total)).filter(Invoice.status.in_(["Sent","Overdue"]), Invoice.invoice_type == "Incoming").scalar() or 0
    collected = db.query(func.sum(Payment.amount)).filter(Payment.status == "Cleared", Payment.payment_type == "Incoming").scalar() or 0
    return {"total_revenue": total_revenue, "outstanding_balance": outstanding, "collected_amount": collected}

@router.get("/invoices/export/excel")
def export_invoices_excel(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import openpyxl
    invoices = db.query(Invoice).all()
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Invoices"
    ws.append(["Invoice #","Type","Status","Currency","Subtotal","Tax","Total","Due Date","Created"])
    for i in invoices:
        ws.append([i.invoice_number, i.invoice_type, i.status, i.currency, i.subtotal, i.tax_amount, i.total,
                   str(i.due_date or ""), str(i.created_at)])
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 2
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=invoices.xlsx"})
