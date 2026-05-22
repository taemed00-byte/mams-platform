from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID

class ClientCreate(BaseModel):
    name: str
    client_type: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    country: Optional[str] = None
    pipeline_stage: str = "Lead"
    is_active: bool = True

class ClientUpdate(ClientCreate):
    name: Optional[str] = None
    client_type: Optional[str] = None

class ClientOut(BaseModel):
    id: UUID
    name: str
    client_type: str
    contact_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    fax: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    country: Optional[str]
    pipeline_stage: str
    is_active: bool
    total_cases: int
    total_revenue: float
    created_at: datetime
    model_config = {"from_attributes": True}

class ContractCreate(BaseModel):
    client_id: UUID
    status: str = "Pending"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    assistance_fee: float = 0
    currency: str = "USD"
    sla_response_hours: float = 24
    tariff_notes: Optional[str] = None
    special_terms: Optional[str] = None

class ContractUpdate(BaseModel):
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    assistance_fee: Optional[float] = None
    currency: Optional[str] = None
    sla_response_hours: Optional[float] = None
    tariff_notes: Optional[str] = None
    special_terms: Optional[str] = None

class ContractOut(BaseModel):
    id: UUID
    contract_number: str
    client_id: UUID
    status: str
    start_date: Optional[date]
    end_date: Optional[date]
    assistance_fee: float
    currency: str
    sla_response_hours: float
    tariff_notes: Optional[str]
    special_terms: Optional[str]
    file_path: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}
