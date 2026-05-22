from sqlalchemy import Column, String, Float, DateTime, Integer, Enum as SAEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Client(Base):
    __tablename__ = "clients"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    client_type = Column(SAEnum("Insurance Company","Assistance Company","Corporate","Hotel","Individual", name="client_type_enum"), nullable=False)
    contact_name = Column(String)
    email = Column(String)
    phone = Column(String)
    country = Column(SAEnum("Egypt","Germany","Spain","UAE","USA","Other", name="client_country_enum"))
    pipeline_stage = Column(SAEnum("Lead","Opportunity","Won","Lost", name="pipeline_enum"), default="Lead")
    is_active = Column(Boolean, default=True)
    total_cases = Column(Integer, default=0)
    total_revenue = Column(Float, default=0)
    # Extended fields (used primarily by Insurance Companies)
    website = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    fax = Column(String, nullable=True)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cases = relationship("Case", back_populates="client")
    contracts = relationship("Contract", back_populates="client")
    invoices = relationship("Invoice", back_populates="client")
