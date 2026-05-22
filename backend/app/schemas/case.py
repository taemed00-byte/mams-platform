from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID

class PatientCreate(BaseModel):
    name: str
    nationality: Optional[str] = None
    passport_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class PatientOut(PatientCreate):
    id: UUID
    created_at: datetime
    model_config = {"from_attributes": True, "json_encoders": {date: lambda v: v.isoformat() if v else None}}

class CaseCreate(BaseModel):
    patient_id: Optional[UUID] = None
    patient: Optional[PatientCreate] = None
    case_type: str
    priority: str = "Medium"
    country: Optional[str] = None
    city: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_address: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    insurance_policy_number: Optional[str] = None
    estimated_cost: Optional[float] = 0
    actual_cost: Optional[float] = 0
    currency: str = "USD"
    sla_target_hours: float = 24
    description: Optional[str] = None

class CaseUpdate(BaseModel):
    case_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_address: Optional[str] = None
    assigned_user_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    contract_id: Optional[UUID] = None
    insurance_policy_number: Optional[str] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    currency: Optional[str] = None
    sla_target_hours: Optional[float] = None
    description: Optional[str] = None

class CaseOut(BaseModel):
    id: UUID
    case_number: str
    case_type: str
    priority: str
    status: str
    country: Optional[str]
    city: Optional[str]
    location_lat: Optional[float]
    location_lng: Optional[float]
    location_address: Optional[str]
    estimated_cost: float
    actual_cost: float
    currency: str
    sla_target_hours: float
    sla_actual_hours: Optional[float]
    sla_breached: bool
    insurance_policy_number: Optional[str]
    client_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None
    description: Optional[str]
    opened_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    patient: Optional[PatientOut]
    model_config = {"from_attributes": True}

class CommunicationCreate(BaseModel):
    case_id: UUID
    comm_type: str = "Note"
    content: str
    direction: str = "Internal"

class CommunicationOut(CommunicationCreate):
    id: UUID
    user_id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}
