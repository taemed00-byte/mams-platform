from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Enum as SAEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime
from app.database import Base

class Case(Base):
    __tablename__ = "cases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_number = Column(String, unique=True, nullable=False, index=True)

    # Patient
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)

    # Classification
    case_type = Column(SAEnum("Outpatient","Inpatient","Evacuation & Repatriation","Telemedicine","Concierge", name="case_type_enum"), nullable=False)
    priority = Column(SAEnum("Low","Medium","High","Critical", name="priority_enum"), default="Medium")
    status = Column(SAEnum("Open","Pending","Approved","Closed","Cancelled", name="case_status_enum"), default="Open")

    # Location
    country = Column(SAEnum("Egypt","Germany","Spain","UAE","USA", name="country_enum"))
    city = Column(String)
    location_lat = Column(Float)
    location_lng = Column(Float)
    location_address = Column(String)

    # Assignment
    assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=True)

    # Insurance
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=True)
    insurance_policy_number = Column(String)

    # Costs (multi-currency)
    estimated_cost = Column(Float, default=0)
    actual_cost = Column(Float, default=0)
    currency = Column(SAEnum("EUR","USD","EGP","AED", name="currency_enum"), default="USD")

    # SLA
    sla_target_hours = Column(Float, default=24)
    sla_actual_hours = Column(Float, nullable=True)
    sla_breached = Column(Boolean, default=False)

    # Dates
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Description / notes
    description = Column(Text)

    # Relationships
    patient = relationship("Patient", back_populates="cases")
    assigned_user = relationship("User", back_populates="cases_assigned", foreign_keys=[assigned_user_id])
    provider = relationship("Provider", back_populates="cases")
    client = relationship("Client", back_populates="cases")
    contract = relationship("Contract", back_populates="cases")
    documents = relationship("Document", back_populates="case")
    communications = relationship("Communication", back_populates="case")
    invoices = relationship("Invoice", back_populates="case")
