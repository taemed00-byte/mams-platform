from sqlalchemy import Column, String, Date, DateTime, TypeDecorator
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date
from app.database import Base


# ── HIPAA §164.312(a)(2)(iv): PHI field encryption ───────────────────────────
# EncryptedString transparently encrypts on write and decrypts on read.
# Requires PHI_ENCRYPTION_KEY env var (Fernet key).

class EncryptedString(TypeDecorator):
    """Fernet-encrypted String column — stores ciphertext in the DB."""
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Encrypt before INSERT / UPDATE."""
        if value is None:
            return None
        from app.core.phi_encryption import encrypt_phi
        return encrypt_phi(str(value))

    def process_result_value(self, value, dialect):
        """Decrypt after SELECT."""
        if value is None:
            return None
        from app.core.phi_encryption import decrypt_phi
        return decrypt_phi(value)


class Patient(Base):
    __tablename__ = "patients"
    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name           = Column(String, nullable=False)          # searchable — not encrypted
    nationality    = Column(String)                          # low-sensitivity
    # ── Encrypted PHI fields ──────────────────────────────────────────────────
    passport_number = Column(EncryptedString)                # HIPAA: encrypted at rest
    date_of_birth   = Column(EncryptedString)                # HIPAA: encrypted at rest
    # ─────────────────────────────────────────────────────────────────────────
    gender         = Column(String)
    phone          = Column(String)
    email          = Column(String)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cases = relationship("Case", back_populates="patient")
