from sqlalchemy import Column, String, Float, DateTime, Integer, Text, Enum as SAEnum, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Provider(Base):
    __tablename__ = "providers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    category = Column(SAEnum("Hospital","Clinic","Pharmacy","Ambulance","Laboratory", name="provider_category_enum"), nullable=False)
    tier = Column(SAEnum("Preferred","Standard","Blacklisted", name="provider_tier_enum"), default="Standard")
    contact_name = Column(String)
    phone = Column(String)
    email = Column(String)
    country = Column(SAEnum("Egypt","Germany","Spain","UAE","USA", name="provider_country_enum"))
    city = Column(String)
    specialties = Column(String)
    contract_start = Column(Date)
    contract_end = Column(Date)
    contract_file_path = Column(String)
    total_cases = Column(Integer, default=0)
    average_cost = Column(Float, default=0)
    approval_rate = Column(Float, default=0)
    rating = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cases = relationship("Case", back_populates="provider")
    tariffs = relationship("ProviderTariff", back_populates="provider")

class ProviderTariff(Base):
    __tablename__ = "provider_tariffs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False)
    service_name = Column(String, nullable=False)
    unit_price = Column(Float, nullable=False)
    currency = Column(SAEnum("EUR","USD","EGP","AED", name="tariff_currency_enum"), default="USD")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    provider = relationship("Provider", back_populates="tariffs")
