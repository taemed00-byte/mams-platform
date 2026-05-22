from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "MAMS – Medical Assistance Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/mams"

    # Security — set SECRET_KEY as an env var on Render; never use the default in production
    SECRET_KEY: str = "change-this-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30   # HIPAA §164.312(a)(2)(iii): short-lived sessions

    # HIPAA §164.312(a)(2)(iv): PHI field encryption
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    PHI_ENCRYPTION_KEY: str = ""  # Set on Render — empty = no encryption (dev only)

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:4200", "https://mams-frontend.onrender.com"]

    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Email (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@tmasi.net"

    # WhatsApp Business API (Optional)
    WHATSAPP_API_URL: str = ""
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""

    # Call-Centre API (Optional)
    CALL_CENTRE_API_URL: str = ""
    CALL_CENTRE_API_KEY: str = ""
    CALL_CENTRE_WEBHOOK_SECRET: str = ""

    # SLA & Alerts
    SLA_BREACH_THRESHOLD_HOURS: int = 24
    HIGH_COST_ALERT_THRESHOLD: float = 10000.0
    CONTRACT_EXPIRY_WARNING_DAYS: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
