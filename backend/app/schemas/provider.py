from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID

class ProviderCreate(BaseModel):
    name: str
    category: str
    tier: str = "Standard"
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    specialties: Optional[str] = None
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None

class ProviderUpdate(ProviderCreate):
    name: Optional[str] = None
    category: Optional[str] = None

class ProviderOut(BaseModel):
    id: UUID
    name: str
    category: str
    tier: str
    contact_name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    country: Optional[str]
    city: Optional[str]
    specialties: Optional[str]
    contract_start: Optional[date]
    contract_end: Optional[date]
    contract_file_path: Optional[str]
    total_cases: int
    average_cost: float
    approval_rate: float
    rating: float
    created_at: datetime
    model_config = {"from_attributes": True}

class TariffCreate(BaseModel):
    service_name: str
    unit_price: float
    currency: str = "USD"
    notes: Optional[str] = None

class TariffOut(TariffCreate):
    id: UUID
    provider_id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}
