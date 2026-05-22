from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Payment(Base):
    __tablename__ = "payments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=True)
    payment_type = Column(SAEnum("Incoming","Outgoing", name="payment_type_enum"), default="Incoming")
    method = Column(SAEnum("Bank Transfer","Card","Cash","Cheque", name="payment_method_enum"), default="Bank Transfer")
    status = Column(SAEnum("Cleared","Pending","Failed", name="payment_status_enum"), default="Pending")
    amount = Column(Float, nullable=False)
    currency = Column(SAEnum("EUR","USD","EGP","AED", name="pay_currency_enum"), default="USD")
    reference = Column(String)
    notes = Column(Text)
    payment_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    invoice = relationship("Invoice", back_populates="payments")
