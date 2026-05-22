from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class Communication(Base):
    __tablename__ = "communications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    comm_type = Column(SAEnum("Note","Email","Call","WhatsApp", name="comm_type_enum"), default="Note")
    content = Column(Text, nullable=False)
    direction = Column(SAEnum("Inbound","Outbound","Internal", name="comm_direction_enum"), default="Internal")
    created_at = Column(DateTime, default=datetime.utcnow)
    case = relationship("Case", back_populates="communications")
    user = relationship("User")
