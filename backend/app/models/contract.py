from sqlalchemy import Column, String, Float, DateTime, Date, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_number = Column(String, unique=True, nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    status = Column(SAEnum("Active","Pending","Expired","Terminated", name="contract_status_enum"), default="Pending")
    start_date = Column(Date)
    end_date = Column(Date)
    assistance_fee = Column(Float, default=0)
    currency = Column(SAEnum("EUR","USD","EGP","AED", name="contract_currency_enum"), default="USD")
    sla_response_hours = Column(Float, default=24)
    tariff_notes = Column(Text)
    special_terms = Column(Text)
    file_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    client = relationship("Client", back_populates="contracts")
    cases = relationship("Case", back_populates="contract")
