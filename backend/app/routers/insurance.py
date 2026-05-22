"""
Insurance Companies router.

Insurance companies are stored as Client records with
client_type = 'Insurance Company'. This router provides a
clean, dedicated API surface for the Insurance Companies
management section, including contract document upload/download.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID, uuid4
import os, io, re, unicodedata

from app.database import get_db
from app.models.client import Client
from app.models.contract import Contract
from app.schemas.client import ClientCreate, ClientUpdate, ClientOut, ContractCreate, ContractOut
from app.deps import get_current_user
from app.models.user import User
from app.services.audit import log_action
from app.config import settings

router = APIRouter(prefix="/insurance-companies", tags=["insurance-companies"])

CLIENT_TYPE = "Insurance Company"

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}


def _sanitize(name: str) -> str:
    name = unicodedata.normalize("NFKD", name)
    name = os.path.basename(name)
    name = re.sub(r"[^\w\s\-.]", "", name).strip()
    name = re.sub(r"\.{2,}", ".", name)
    return name or "upload"


def _validate_upload(file: UploadFile) -> None:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed. Permitted: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"MIME type '{file.content_type}' not allowed.")


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ClientOut])
def list_insurance_companies(
    is_active: Optional[bool] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0, limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Client).filter(Client.client_type == CLIENT_TYPE)
    if is_active is not None:
        q = q.filter(Client.is_active == is_active)
    if country:
        q = q.filter(Client.country == country)
    if search:
        q = q.filter(
            Client.name.ilike(f"%{search}%") |
            Client.email.ilike(f"%{search}%") |
            Client.contact_name.ilike(f"%{search}%")
        )
    return q.order_by(Client.name).offset(skip).limit(limit).all()


@router.post("/", response_model=ClientOut, status_code=201)
def create_insurance_company(
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    payload["client_type"] = CLIENT_TYPE   # always force the correct type
    company = Client(**payload)
    db.add(company); db.commit(); db.refresh(company)
    log_action(db, current_user, "CREATE_INSURANCE_COMPANY", "Client", str(company.id),
               f"Insurance company {company.name} created")
    return company


@router.get("/{company_id}", response_model=ClientOut)
def get_insurance_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Client).filter(Client.id == company_id, Client.client_type == CLIENT_TYPE).first()
    if not c:
        raise HTTPException(404, "Insurance company not found")
    return c


@router.put("/{company_id}", response_model=ClientOut)
def update_insurance_company(
    company_id: UUID,
    data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Client).filter(Client.id == company_id, Client.client_type == CLIENT_TYPE).first()
    if not c:
        raise HTTPException(404, "Insurance company not found")
    update_data = data.model_dump(exclude_unset=True)
    update_data["client_type"] = CLIENT_TYPE   # never allow type change via this router
    for k, v in update_data.items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    log_action(db, current_user, "UPDATE_INSURANCE_COMPANY", "Client", str(c.id),
               f"Insurance company {c.name} updated")
    return c


@router.delete("/{company_id}")
def delete_insurance_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Client).filter(Client.id == company_id, Client.client_type == CLIENT_TYPE).first()
    if not c:
        raise HTTPException(404, "Insurance company not found")
    c.is_active = False
    db.commit()
    log_action(db, current_user, "DEACTIVATE_INSURANCE_COMPANY", "Client", str(c.id),
               f"Insurance company {c.name} deactivated")
    return {"message": "Insurance company deactivated"}


# ── Contracts ─────────────────────────────────────────────────────────────────

@router.get("/{company_id}/contracts")
def list_contracts(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Client).filter(Client.id == company_id, Client.client_type == CLIENT_TYPE).first()
    if not c:
        raise HTTPException(404, "Insurance company not found")
    contracts = db.query(Contract).filter(Contract.client_id == company_id).all()
    return [
        {
            "id": str(ct.id),
            "contract_number": ct.contract_number,
            "status": ct.status,
            "start_date": str(ct.start_date) if ct.start_date else None,
            "end_date": str(ct.end_date) if ct.end_date else None,
            "assistance_fee": ct.assistance_fee,
            "currency": ct.currency,
            "sla_response_hours": ct.sla_response_hours,
            "tariff_notes": ct.tariff_notes,
            "special_terms": ct.special_terms,
            "has_document": bool(ct.file_path and os.path.exists(ct.file_path)),
            "created_at": ct.created_at,
        }
        for ct in contracts
    ]


@router.post("/{company_id}/contracts/{contract_id}/upload")
async def upload_contract_document(
    company_id: UUID,
    contract_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a signed contract PDF (or image) for an insurance company contract."""
    c = db.query(Client).filter(Client.id == company_id, Client.client_type == CLIENT_TYPE).first()
    if not c:
        raise HTTPException(404, "Insurance company not found")
    contract = db.query(Contract).filter(Contract.id == contract_id, Contract.client_id == company_id).first()
    if not contract:
        raise HTTPException(404, "Contract not found")

    _validate_upload(file)
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum {settings.MAX_UPLOAD_SIZE_MB} MB.")

    safe_name = _sanitize(file.filename or "contract")
    unique_name = f"{uuid4().hex[:8]}_{safe_name}"
    upload_dir = os.path.join(settings.UPLOAD_DIR, "insurance_contracts", str(company_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    contract.file_path = file_path
    db.commit()
    log_action(db, current_user, "UPLOAD_INSURANCE_CONTRACT", "Contract", str(contract.id),
               f"Contract document uploaded for {c.name}")
    return {"message": "Contract document uploaded", "filename": file.filename}


@router.get("/{company_id}/contracts/{contract_id}/download")
def download_contract_document(
    company_id: UUID,
    contract_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Authenticated download of a contract document."""
    contract = db.query(Contract).filter(
        Contract.id == contract_id, Contract.client_id == company_id
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if not contract.file_path or not os.path.exists(contract.file_path):
        raise HTTPException(404, "No document on file for this contract")
    return FileResponse(
        contract.file_path,
        filename=os.path.basename(contract.file_path),
        media_type="application/octet-stream",
    )


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/export/excel")
def export_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import openpyxl
    companies = db.query(Client).filter(Client.client_type == CLIENT_TYPE).order_by(Client.name).all()
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Insurance Companies"
    ws.append(["Name", "Contact", "Email", "Phone", "Country", "Website", "Active", "Total Cases", "Total Revenue", "Notes"])
    for c in companies:
        ws.append([c.name, c.contact_name or "", c.email or "", c.phone or "",
                   c.country or "", c.website or "", "Yes" if c.is_active else "No",
                   c.total_cases, c.total_revenue, c.notes or ""])
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 2
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=insurance_companies.xlsx"})
