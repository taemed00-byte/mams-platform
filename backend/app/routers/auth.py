"""
HIPAA §164.312(a)(2)(i) — Unique user identification & authentication controls.
- Rate-limiting per IP (in-memory, 10 attempts / 60 s)
- Account lockout after 5 consecutive failed logins (30-minute lock)
- Password-strength validation on creation / change
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from collections import defaultdict
from time import time
import re
from app.database import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserOut
from app.core.security import verify_password, create_access_token
from app.services.audit import log_action
from app.deps import get_current_user
import logging

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW   = 60    # seconds
RATE_LIMIT_MAX      = 10    # attempts per window per IP
MAX_FAILED_LOGINS   = 5     # before account lock
LOCKOUT_MINUTES     = 30    # duration of account lock

# ── In-memory IP rate limiter ──────────────────────────────────────────────
_ip_attempts: dict = defaultdict(list)

def _check_ip_rate_limit(ip: str) -> None:
    now = time()
    attempts = _ip_attempts[ip]
    attempts[:] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
    if len(attempts) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts from this IP. Try again in {RATE_LIMIT_WINDOW} seconds.",
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )
    attempts.append(now)

# ── Password strength validator ────────────────────────────────────────────
def validate_password_strength(password: str) -> None:
    """HIPAA best-practice: min 8 chars, upper + lower + digit + special."""
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("one digit")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
        errors.append("one special character (!@#$%^&* etc.)")
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password must contain: {', '.join(errors)}."
        )


@router.post("/login", response_model=Token)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    # 1. IP-level rate limit (prevents distributed brute-force)
    _check_ip_rate_limit(client_ip)

    # 2. Look up user (timing-safe: always look up before checking password)
    user = db.query(User).filter(User.email == data.email).first()

    # 3. Account lockout check
    if user and user.locked_until and user.locked_until > datetime.utcnow():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        log_action(db, user, "LOGIN_BLOCKED", description=f"Account locked — {remaining} min remaining",
                   ip_address=client_ip, user_agent=user_agent)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is temporarily locked after too many failed attempts. "
                   f"Try again in {remaining} minute(s) or contact your administrator."
        )

    # 4. Verify credentials
    if not user or not verify_password(data.password, user.password_hash):
        if user:
            user.failed_login_count = (user.failed_login_count or 0) + 1
            if user.failed_login_count >= MAX_FAILED_LOGINS:
                user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_count = 0
                db.commit()
                log_action(db, user, "ACCOUNT_LOCKED",
                           description=f"Account locked after {MAX_FAILED_LOGINS} failed attempts",
                           ip_address=client_ip, user_agent=user_agent)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Account locked for {LOCKOUT_MINUTES} minutes after too many failed attempts."
                )
            db.commit()
            log_action(db, user, "LOGIN_FAILED",
                       description=f"Failed attempt {user.failed_login_count}/{MAX_FAILED_LOGINS}",
                       ip_address=client_ip, user_agent=user_agent)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    # 5. Successful login — reset counters
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(str(user.id))
    log_action(db, user, "LOGIN", description=f"Successful login from {client_ip}",
               ip_address=client_ip, user_agent=user_agent)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_action(db, current_user, "LOGOUT", description=f"User {current_user.email} logged out")
    return {"message": "Logged out successfully"}
