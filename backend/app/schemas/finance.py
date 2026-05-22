from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class LineItemCreate(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    amount: float

class LineItemOut(LineItemCreate):
    id: UUID
    invoice_id: UUID
    model_config = {"from_attributes": True}

class InvoiceCreate(BaseModel):
    case_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None
    invoice_type: str = "Incoming"
    currency: str = "USD"
    tax_rate: float = 0
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    line_items: List[LineItemCreate] = []

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    tax_rate: Optional[float] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None

class InvoiceOut(BaseModel):
    id: UUID
    invoice_number: str
    case_id: Optional[UUID]
    client_id: Optional[UUID]
    provider_id: Optional[UUID]
    invoice_type: str
    status: str
    currency: str
    subtotal: float
    tax_rate: float
    tax_amount: float
    total: float
    notes: Optional[str]
    due_date: Optional[datetime]
    paid_date: Optional[datetime]
    created_at: datetime
    line_items: List[LineItemOut] = []
    model_config = {"from_attributes": True}

class PaymentCreate(BaseModel):
    invoice_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None
    payment_type: str = "Incoming"
    method: str = "Bank Transfer"
    amount: float
    currency: str = "USD"
    reference: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[datetime] = None

class PaymentOut(PaymentCreate):
    id: UUID
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}
