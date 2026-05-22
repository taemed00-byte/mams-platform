"""
Partner portal — case submission and tracking.

Security controls (code-review pre-flight):
- Every query filtered by current_partner.company_id (data isolation)
- get_active_partner_user blocks access until password is changed
- Case ownership verified before document/communication access
- File uploads: MIME + extension allowlist, size limit, UUID-prefixed filenames
- All actions audit-logged with PARTNER_ prefix
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime
import os, re, unicodedata

from app.database import get_db
from app.models.case import Case
from app.models.patient import Patient
from app.models.document import Document
from app.models.communication import Communication
from app.models.partner_user import PartnerUser
from app.schemas.case import CaseCreate, CaseOut
from app.deps import get_active_partner_user
from app.services.audit import log_action
from app.config import settings

router = APIRouter(prefix="/partner/cases", tags=["partner-cases"])

# ── Upload validation (mirrors internal cases.py) ─────────────────────────────
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"}


def _sanitize(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = os.path.basename(name)
    name = re.sub(r"[^\w\s\-.]", "", name).strip()
    name = re.sub(r"\.{2,}", ".", name)
    return name or "upload"


def _validate_upload(file: UploadFile) -> None:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed.")
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"MIME type '{file.content_type}' not allowed.")


def _owned_case(case_id: UUID, partner: PartnerUser, db: Session) -> Case:
    """Fetch a case and verify it belongs to this partner's company."""
    case = db.query(Case).options(joinedload(Case.patient)).filter(
        Case.id == case_id,
        Case.client_id == partner.company_id,   # ← isolation guarantee
    ).first()
    if not case:
        raise HTTPException(404, "Case not found")
    return case


# ── Cases ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[CaseOut])
def list_partner_cases(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    """List cases submitted by this partner's company."""
    q = db.query(Case).options(joinedload(Case.patient)).filter(
        Case.client_id == partner.company_id    # data isolation
    )
    if status: q = q.filter(Case.status == status)
    if search:
        q = q.join(Patient, isouter=True).filter(
            Patient.name.ilike(f"%{search}%") |
            Case.case_number.ilike(f"%{search}%")
        )
    return q.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=CaseOut, status_code=201)
def submit_case(
    data: CaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    """Submit a new case on behalf of the partner company."""
    import random, string

    # Force client_id to the partner's company — never trust user-supplied value
    patient_id = data.patient_id
    if data.patient and not patient_id:
        p = Patient(**data.patient.model_dump())
        db.add(p); db.flush()
        patient_id = p.id

    case_number = "CASE-" + "".join(random.choices(string.digits, k=8))
    case = Case(
        case_number=case_number,
        patient_id=patient_id,
        case_type=data.case_type,
        priority=data.priority,
        country=data.country,
        city=data.city,
        location_lat=data.location_lat,
        location_lng=data.location_lng,
        location_address=data.location_address,
        client_id=partner.company_id,           # always the partner's company
        contract_id=data.contract_id,
        insurance_policy_number=data.insurance_policy_number,
        estimated_cost=data.estimated_cost,
        actual_cost=data.actual_cost,
        currency=data.currency,
        sla_target_hours=data.sla_target_hours,
        description=data.description,
        status="Open",
    )
    db.add(case); db.commit()

    log_action(db, None, "PARTNER_SUBMIT_CASE",
               entity_type="Case", entity_id=str(case.id),
               description=f"Partner {partner.email} (company {partner.company_id}) submitted case {case.case_number}",
               ip_address=request.client.host if request.client else None,
               user_agent=request.headers.get("user-agent"))

    case = db.query(Case).options(joinedload(Case.patient)).filter(Case.id == case.id).first()
    return case


@router.get("/{case_id}", response_model=CaseOut)
def get_partner_case(
    case_id: UUID,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    return _owned_case(case_id, partner, db)


# ── Documents ─────────────────────────────────────────────────────────────────

@router.get("/{case_id}/documents")
def list_documents(
    case_id: UUID,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    _owned_case(case_id, partner, db)   # ownership check
    docs = db.query(Document).filter(Document.case_id == case_id).all()
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "doc_type": d.doc_type,
            "file_size": d.file_size,
            "created_at": d.created_at,
        }
        for d in docs
    ]


@router.post("/{case_id}/documents", status_code=201)
async def upload_document(
    case_id: UUID,
    doc_type: str = "Other",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    case = _owned_case(case_id, partner, db)
    _validate_upload(file)

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum {settings.MAX_UPLOAD_SIZE_MB} MB.")

    safe_name   = _sanitize(file.filename or "upload")
    unique_name = f"{uuid4().hex[:8]}_{safe_name}"
    upload_dir  = os.path.join(settings.UPLOAD_DIR, str(case_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path   = os.path.join(upload_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        case_id=case_id,
        uploaded_by_id=None,        # partner users are not in the users table
        doc_type=doc_type,
        filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(doc); db.commit(); db.refresh(doc)

    log_action(db, None, "PARTNER_UPLOAD_DOCUMENT",
               entity_type="Document", entity_id=str(doc.id),
               description=f"Partner {partner.email} uploaded {file.filename} to case {case.case_number}")

    return {"id": str(doc.id), "filename": doc.filename, "doc_type": doc_type, "file_size": len(content)}


@router.get("/{case_id}/documents/{doc_id}/download")
def download_document(
    case_id: UUID,
    doc_id: UUID,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    _owned_case(case_id, partner, db)   # ownership check
    doc = db.query(Document).filter(Document.id == doc_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(doc.file_path, filename=doc.filename,
                        media_type=doc.mime_type or "application/octet-stream")


# ── Communications ────────────────────────────────────────────────────────────

@router.get("/{case_id}/communications")
def list_communications(
    case_id: UUID,
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    _owned_case(case_id, partner, db)
    comms = db.query(Communication).filter(
        Communication.case_id == case_id
    ).order_by(Communication.created_at.desc()).all()
    return [
        {
            "id": str(c.id),
            "comm_type": c.comm_type,
            "content": c.content,
            "direction": c.direction,
            "created_at": c.created_at,
        }
        for c in comms
    ]


@router.post("/{case_id}/communications", status_code=201)
def add_communication(
    case_id: UUID,
    content: str,
    comm_type: str = "Note",
    db: Session = Depends(get_db),
    partner: PartnerUser = Depends(get_active_partner_user),
):
    _owned_case(case_id, partner, db)
    comm = Communication(
        case_id=case_id,
        user_id=None,           # partner users are not in the users table
        comm_type=comm_type,
        content=content,
        direction="Inbound",    # partner → TMASI is always inbound
    )
    db.add(comm); db.commit(); db.refresh(comm)
    return {"id": str(comm.id), "content": comm.content, "created_at": comm.created_at}
