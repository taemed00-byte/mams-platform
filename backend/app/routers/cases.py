from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
import random, string, io, os, re, unicodedata
from app.database import get_db
from app.models.case import Case
from app.models.patient import Patient
from app.models.document import Document
from app.models.communication import Communication
from app.schemas.case import CaseCreate, CaseUpdate, CaseOut, CommunicationCreate, CommunicationOut, PatientOut
from app.deps import get_current_user
from app.models.user import User
from app.services.audit import log_action
from app.services.notifications import notify_all_role
from app.config import settings

router = APIRouter(prefix="/cases", tags=["cases"])

# ── Helpers ────────────────────────────────────────────────────────────────

def gen_case_number():
    return "CASE-" + "".join(random.choices(string.digits, k=8))

# Allowed MIME types for document uploads
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"}

def sanitize_filename(name: str) -> str:
    """Strip path components and dangerous characters from an upload filename."""
    # Normalize unicode, take only the basename
    name = unicodedata.normalize("NFKD", name)
    name = os.path.basename(name)
    # Allow only alphanum, space, dash, underscore, dot
    name = re.sub(r"[^\w\s\-.]", "", name).strip()
    # Collapse any .. sequences that could escape the directory
    name = re.sub(r"\.{2,}", ".", name)
    return name or "upload"

def validate_upload(file: UploadFile) -> None:
    """Raise 400 if the file MIME type or extension is not allowed."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"File type '{ext}' is not allowed. Permitted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            400,
            f"MIME type '{file.content_type}' is not allowed."
        )

# ── Case CRUD ──────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CaseOut])
def list_cases(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    country: Optional[str] = None,
    case_type: Optional[str] = None,
    client_id: Optional[UUID] = None,
    provider_id: Optional[UUID] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Case).options(joinedload(Case.patient))
    if status: q = q.filter(Case.status == status)
    if priority: q = q.filter(Case.priority == priority)
    if country: q = q.filter(Case.country == country)
    if case_type: q = q.filter(Case.case_type == case_type)
    if client_id: q = q.filter(Case.client_id == client_id)
    if provider_id: q = q.filter(Case.provider_id == provider_id)
    if date_from: q = q.filter(Case.created_at >= datetime.fromisoformat(date_from))
    if date_to: q = q.filter(Case.created_at <= datetime.fromisoformat(date_to))
    if search:
        q = q.join(Patient).filter(
            Patient.name.ilike(f"%{search}%") |
            Case.case_number.ilike(f"%{search}%")
        )
    results = q.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()
    # HIPAA §164.312(b): log PHI list access
    log_action(db, current_user, "LIST_CASES", "Case", None,
               f"{len(results)} case(s) accessed",
               ip_address=request.client.host if request.client else None,
               user_agent=request.headers.get("user-agent"))
    return results


@router.post("/", response_model=CaseOut, status_code=201)
def create_case(data: CaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient_id = data.patient_id
    if data.patient and not patient_id:
        p = Patient(**data.patient.model_dump())
        db.add(p); db.flush()
        patient_id = p.id

    case = Case(
        case_number=gen_case_number(),
        patient_id=patient_id,
        case_type=data.case_type,
        priority=data.priority,
        country=data.country,
        city=data.city,
        location_lat=data.location_lat,
        location_lng=data.location_lng,
        location_address=data.location_address,
        assigned_user_id=data.assigned_user_id or current_user.id,
        provider_id=data.provider_id,
        client_id=data.client_id,
        contract_id=data.contract_id,
        insurance_policy_number=data.insurance_policy_number,
        estimated_cost=data.estimated_cost,
        actual_cost=data.actual_cost,
        currency=data.currency,
        sla_target_hours=data.sla_target_hours,
        description=data.description,
    )
    db.add(case); db.commit()
    case_id_str = str(case.id)
    case_num = case.case_number
    log_action(db, current_user, "CREATE_CASE", "Case", case_id_str, f"Case {case_num} created")
    case = db.query(Case).options(joinedload(Case.patient)).filter(Case.id == case.id).first()
    return case


@router.get("/{case_id}", response_model=CaseOut)
def get_case(request: Request, case_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    case = db.query(Case).options(joinedload(Case.patient)).filter(Case.id == case_id).first()
    if not case: raise HTTPException(404, "Case not found")
    # HIPAA §164.312(b): log PHI read access
    log_action(db, current_user, "VIEW_CASE", "Case", str(case_id),
               f"Case {case.case_number} viewed",
               ip_address=request.client.host if request.client else None,
               user_agent=request.headers.get("user-agent"))
    return case


@router.put("/{case_id}", response_model=CaseOut)
def update_case(case_id: UUID, data: CaseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case: raise HTTPException(404, "Case not found")
    old_status = case.status
    # Use exclude_unset so explicitly-null fields (e.g. provider_id=null) are applied
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(case, k, v)
    if data.status == "Closed" and old_status != "Closed":
        case.closed_at = datetime.utcnow()
        notify_all_role(db, "Finance", "Case Closed", f"Case {case.case_number} closed. Invoice preparation required.",
                        "CASE_UPDATE", "Case", str(case.id))
    if case.opened_at:
        elapsed = (datetime.utcnow() - case.opened_at).total_seconds() / 3600
        case.sla_actual_hours = elapsed
        case.sla_breached = elapsed > case.sla_target_hours
    db.commit()
    case_id_str = str(case.id)
    case_num = case.case_number
    log_action(db, current_user, "UPDATE_CASE", "Case", case_id_str, f"Case {case_num} updated")
    case = db.query(Case).options(joinedload(Case.patient)).filter(Case.id == case_id_str).first()
    return case


@router.delete("/{case_id}")
def delete_case(case_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case: raise HTTPException(404, "Case not found")
    case.status = "Cancelled"
    db.commit()
    log_action(db, current_user, "CANCEL_CASE", "Case", str(case.id), f"Case {case.case_number} cancelled")
    return {"message": "Case cancelled"}


# ── Documents ──────────────────────────────────────────────────────────────

@router.post("/{case_id}/documents", status_code=201)
async def upload_document(
    case_id: UUID,
    doc_type: str = "Other",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case: raise HTTPException(404, "Case not found")

    # 1. Validate MIME type and extension
    validate_upload(file)

    # 2. Validate size
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB.")

    # 3. Sanitize filename and prefix with UUID to prevent collisions and path traversal
    safe_name = sanitize_filename(file.filename or "upload")
    unique_name = f"{uuid4().hex[:8]}_{safe_name}"

    upload_dir = os.path.join(settings.UPLOAD_DIR, str(case_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        case_id=case_id,
        uploaded_by_id=current_user.id,
        doc_type=doc_type,
        filename=file.filename,      # store original name for display
        file_path=file_path,         # store sanitized path for serving
        file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(doc); db.commit(); db.refresh(doc)
    log_action(db, current_user, "UPLOAD_DOCUMENT", "Document", str(doc.id), f"Document {file.filename} uploaded")
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "doc_type": doc_type,
        "file_size": len(content),
        "file_path": doc.file_path,
        "created_at": doc.created_at,
    }


@router.get("/{case_id}/documents")
def get_documents(case_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    docs = db.query(Document).filter(Document.case_id == case_id).all()
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "doc_type": d.doc_type,
            "file_size": d.file_size,
            "file_path": d.file_path,   # needed by frontend download helper
            "created_at": d.created_at,
        }
        for d in docs
    ]


@router.get("/{case_id}/documents/{doc_id}/download")
def download_document(
    case_id: UUID,
    doc_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # enforces auth
):
    """Authenticated file download — replaces the unauthenticated /uploads StaticFiles mount."""
    doc = db.query(Document).filter(Document.id == doc_id, Document.case_id == case_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        doc.file_path,
        filename=doc.filename,
        media_type=doc.mime_type or "application/octet-stream",
    )


# ── Communications ─────────────────────────────────────────────────────────

@router.get("/{case_id}/communications", response_model=List[CommunicationOut])
def get_communications(case_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Communication).filter(Communication.case_id == case_id).order_by(Communication.created_at.desc()).all()


@router.post("/{case_id}/communications", response_model=CommunicationOut, status_code=201)
def add_communication(case_id: UUID, data: CommunicationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comm = Communication(
        case_id=case_id, user_id=current_user.id,
        comm_type=data.comm_type, content=data.content, direction=data.direction
    )
    db.add(comm); db.commit(); db.refresh(comm)
    return comm


# ── Export ─────────────────────────────────────────────────────────────────

@router.get("/export/excel")
def export_cases_excel(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import openpyxl
    cases = db.query(Case).options(joinedload(Case.patient)).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cases"
    headers = ["Case #","Patient","Type","Priority","Status","Country","City","Estimated Cost","Actual Cost","Currency","SLA Breached","Opened At"]
    ws.append(headers)
    for c in cases:
        ws.append([c.case_number, c.patient.name if c.patient else "", c.case_type, c.priority, c.status,
                   c.country or "", c.city or "", c.estimated_cost, c.actual_cost, c.currency,
                   "Yes" if c.sla_breached else "No", str(c.opened_at)])
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 2
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cases.xlsx"},
    )
