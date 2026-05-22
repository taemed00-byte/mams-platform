from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    notif_type = Column(SAEnum("SLA_BREACH","OVERDUE_INVOICE","CASE_UPDATE","PROVIDER_ISSUE","CONTRACT_EXPIRY","HIGH_COST","GENERAL", name="notif_type_enum"), default="GENERAL")
    is_read = Column(Boolean, default=False)
    entity_type = Column(String)
    entity_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="notifications")
