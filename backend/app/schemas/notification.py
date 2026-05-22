from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class NotificationOut(BaseModel):
    id: UUID
    title: str
    message: str
    notif_type: str
    is_read: bool
    entity_type: Optional[str]
    entity_id: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}
