# MAMS — Medical Assistance Management System
### TMASI Global · Full-Stack Platform · Built by CodeWealth

---

## Quick Start (Local)

### Prerequisites
- Docker & Docker Compose, **or** Node 20 + Python 3.12 + PostgreSQL 16

### With Docker (recommended)
```bash
docker-compose up --build
```
- API: http://localhost:8000 · Docs: http://localhost:8000/api/docs
- Frontend: http://localhost:4200
- **Default login:** `admin@tmasi.net` / `Admin@TMASI2026`

### Without Docker
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install --legacy-peer-deps
ng serve
```

---

## Deploying to Render

1. **Create GitHub repo** and push this code (see `push-to-github.bat`)
2. Go to [render.com](https://render.com) → New → **Blueprint**
3. Connect your GitHub repo — Render auto-reads `render.yaml`
4. Click **Apply** — three services spin up:
   - `mams-db` (PostgreSQL)
   - `mams-api` (FastAPI)
   - `mams-frontend` (Angular)
5. Set secret env vars in the Render dashboard:
   - `SECRET_KEY` (auto-generated)
   - `SMTP_*` for email notifications (optional)
   - `WHATSAPP_*` for WhatsApp integration (optional add-on)
   - `CALL_CENTRE_*` for call-centre integration (optional add-on)

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 19 · Standalone Components · Signals · Lazy Loading |
| UI Library | Angular Material · Custom TMASI Theme (Navy #1e3870 + Gold #c9a84c) |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic |
| Database | PostgreSQL 16 · Multi-currency · Full-text search |
| Maps | OpenStreetMap · Leaflet (location picker on case form) |
| Charts | Chart.js 4 (dashboard: line, doughnut, bar) |
| Auth | JWT · bcrypt · Role-based access (RBAC) |
| File storage | Local filesystem (Render disk / S3-compatible) |
| Exports | openpyxl (Excel .xlsx) |

---

## Modules

| # | Module | Description |
|---|--------|-------------|
| 1 | **Operations & Case Management** | Full case lifecycle, patient profiles, SLA, location picker, document upload, communication log |
| 2 | **Network & Provider Management** | Provider database, tiering, tariffs, contracts, performance tracking |
| 3 | **Finance Department** | Invoicing, line items, multi-currency, payment tracking, KPIs |
| 4 | **Business Development / Sales** | Client database, pipeline, contracts, revenue metrics |
| 5 | **Reporting & Analytics** | 6 report types, date-range filtering, Excel export, scheduled reports |
| 6 | **Interactive Dashboard** | Real-time KPI cards + 4 Chart.js charts, all filtered by date range |
| 7 | **User Management & RBAC** | 4 roles, route guards, activity logging |
| 8 | **Cross-Cutting Features** | Notifications, audit log, RTL/Arabic, global search, toast alerts |
| 9 | **Automated Workflow Engine** | Case-closure finance trigger, SLA breach alerts, contract expiry warnings |
| ★ | **Call-Centre Integration** *(Optional)* | Inbound lead push, click-to-call, webhook events |
| ★ | **WhatsApp Business API** *(Optional)* | Automated case/invoice notifications, two-way messaging |

---

## Default Credentials
| Email | Password | Role |
|-------|----------|------|
| admin@tmasi.net | Admin@TMASI2026 | Administrator |

> Change password immediately after first login.

---

## Project Reference
- **Ref:** CW-2026-TMASI-001
- **Client:** TMASI Global
- **Built by:** CodeWealth · omar@codewealth.net · +20 106 730 0073
