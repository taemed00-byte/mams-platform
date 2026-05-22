from sqlalchemy import Column, String, DateTime, Boolean, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.database import Base

class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    report_type = Column(SAEnum("Case","Financial","Provider Performance","SLA Compliance","Tax","Audit", name="report_type_enum"), nullable=False)
    frequency = Column(SAEnum("Daily","Weekly","Monthly", name="report_freq_enum"), default="Weekly")
    recipients = Column(String)
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
