"""
HIPAA §164.312(a)(2)(iv) — Encryption and Decryption of ePHI at rest.

Uses Fernet (AES-128-CBC + HMAC-SHA256).  Set PHI_ENCRYPTION_KEY on Render
as a 32-byte URL-safe base64 string generated with:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

If the key is absent (dev / missing config), encryption is skipped with a warning
so the app still starts — but DO NOT run without a key in production.
"""
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None
_WARNED = False


def _get_fernet() -> Fernet | None:
    global _fernet, _WARNED
    if _fernet is not None:
        return _fernet
    from app.config import settings
    key = getattr(settings, "PHI_ENCRYPTION_KEY", "")
    if not key:
        if not _WARNED:
            logger.warning(
                "⚠️  HIPAA WARNING: PHI_ENCRYPTION_KEY is not set. "
                "Sensitive patient fields (passport, DOB) are stored in plaintext. "
                "Set PHI_ENCRYPTION_KEY on Render before going live with real patient data."
            )
            _WARNED = True
        return None
    _fernet = Fernet(key.encode())
    return _fernet


def encrypt_phi(value: str) -> str:
    """Encrypt a plaintext PHI string.  Returns the original value if no key is configured."""
    if value is None:
        return value
    f = _get_fernet()
    if f is None:
        return value
    return f.encrypt(value.encode()).decode()


def decrypt_phi(value: str) -> str:
    """Decrypt a Fernet-encrypted PHI string.  Returns the value as-is if not encrypted or no key."""
    if value is None:
        return value
    f = _get_fernet()
    if f is None:
        return value
    try:
        return f.decrypt(value.encode()).decode()
    except (InvalidToken, Exception):
        # Value may be a legacy plaintext row written before encryption was enabled
        return value
