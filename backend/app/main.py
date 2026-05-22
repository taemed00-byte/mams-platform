from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
import os, logging

from app.config import settings
from app.database import engine, Base
from app.routers import (
    auth, users, cases, providers, finance, clients,
    dashboard, reports, notifications, audit,
    settings as settings_router, call_centre, whatsapp, search, insurance,
    partner_users,
)
from app.routers.partner import auth as partner_auth, cases as partner_cases
from app.routers.partner import invoices as partner_invoices, reports as partner_reports

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_INSECURE_DEFAULT_KEY = "change-this-in-production-use-a-long-random-string"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Security gate ────────────────────────────────────────────────────────
    if settings.SECRET_KEY == _INSECURE_DEFAULT_KEY:
        logger.warning(
            "⚠️  SECURITY WARNING: SECRET_KEY is the insecure default value. "
            "JWT tokens can be forged by anyone who reads the source code. "
            "Set a strong SECRET_KEY environment variable on Render before going live."
        )

    # ── DB bootstrap ─────────────────────────────────────────────────────────
    # create_all creates new tables; ALTER TABLE handles additive column changes.
    Base.metadata.create_all(bind=engine)

    # ── Additive migrations (safe: ADD COLUMN IF NOT EXISTS) ─────────────────
    from sqlalchemy import text
    with engine.begin() as conn:
        migrations = [
            # v2: extended client fields for Insurance Companies
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS website   VARCHAR",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes     TEXT",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS fax       VARCHAR",
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS address   VARCHAR",
            # v2: audit log HIPAA fields
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent     VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash  VARCHAR(64)",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS row_hash       VARCHAR(64)",
            # v2: user account lockout fields
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count  INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until        TIMESTAMP",
            # v3: partner portal — partner_users table (CREATE via create_all, but add index columns)
            "ALTER TABLE partner_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE partner_users ADD COLUMN IF NOT EXISTS failed_login_count   INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE partner_users ADD COLUMN IF NOT EXISTS locked_until         TIMESTAMP",
            "CREATE INDEX IF NOT EXISTS ix_partner_users_company_active ON partner_users (company_id, is_active)",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                logger.warning(f"Migration skipped (already applied?): {sql[:60]}… — {e}")

    # ── Upload directories ───────────────────────────────────────────────────
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # ── Default admin ────────────────────────────────────────────────────────
    from app.database import SessionLocal
    from app.models.user import User
    from app.core.security import hash_password
    from app.core.rbac import Role
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            initial_password = os.environ.get("ADMIN_INITIAL_PASSWORD", "Admin@TMASI2026")
            admin = User(
                name="TMASI Admin",
                email="admin@tmasi.net",
                password_hash=hash_password(initial_password),
                role=Role.ADMINISTRATOR,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            logger.info(
                "Default admin created: admin@tmasi.net — "
                "password set from ADMIN_INITIAL_PASSWORD env var (or default if not set). "
                "Change it immediately after first login."
            )
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="MAMS – Medical Assistance Management System API for TMASI Global",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    HIPAA §164.312(e)(2)(i) — Transmission Security / Integrity Controls.
    Adds HTTP security headers to every response.
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Prevent browsers from sniffing MIME types (XSS vector)
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Block clickjacking / frame injection
        response.headers["X-Frame-Options"] = "DENY"
        # Legacy XSS filter (IE/Edge compat)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Enforce HTTPS for 1 year; include subdomains
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        # Limit referrer exposure — don't leak URL to third parties
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Disable unnecessary browser features
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )
        # Content-Security-Policy — tightened for API-only backend
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'"
        )
        # Remove the server banner (MutableHeaders has no .pop — use del with guard)
        if "server" in response.headers:
            del response.headers["server"]
        return response


app.add_middleware(SecurityHeadersMiddleware)

# NOTE: /uploads is intentionally NOT mounted as StaticFiles.
# All document downloads go through the authenticated endpoint:
#   GET /api/cases/{case_id}/documents/{doc_id}/download
# This ensures medical documents (passports, GOPs, reports) are only
# accessible to authenticated MAMS users.

# Register all routers
API_PREFIX = "/api"
app.include_router(auth.router,             prefix=API_PREFIX)
app.include_router(users.router,            prefix=API_PREFIX)
app.include_router(cases.router,            prefix=API_PREFIX)
app.include_router(providers.router,        prefix=API_PREFIX)
app.include_router(finance.router,          prefix=API_PREFIX)
app.include_router(clients.router,          prefix=API_PREFIX)
app.include_router(dashboard.router,        prefix=API_PREFIX)
app.include_router(reports.router,          prefix=API_PREFIX)
app.include_router(notifications.router,    prefix=API_PREFIX)
app.include_router(audit.router,            prefix=API_PREFIX)
app.include_router(settings_router.router,  prefix=API_PREFIX)
app.include_router(call_centre.router,      prefix=API_PREFIX)
app.include_router(whatsapp.router,         prefix=API_PREFIX)
app.include_router(search.router,           prefix=API_PREFIX)
app.include_router(insurance.router,        prefix=API_PREFIX)

# ── Partner portal ────────────────────────────────────────────────────────────
app.include_router(partner_users.router,    prefix=API_PREFIX)
app.include_router(partner_auth.router,     prefix=API_PREFIX)
app.include_router(partner_cases.router,    prefix=API_PREFIX)
app.include_router(partner_invoices.router, prefix=API_PREFIX)
app.include_router(partner_reports.router,  prefix=API_PREFIX)


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/api/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
