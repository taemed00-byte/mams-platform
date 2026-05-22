from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import io, os
from app.database import get_db
from app.models.provider import Provider, ProviderTariff
from app.schemas.provider import ProviderCreate, ProviderUpdate, ProviderOut, TariffCreate, TariffOut
from app.deps import get_current_user
from app.models.user import User
from app.services.audit import log_action
from app.config import settings

router = APIRouter(prefix="/providers", tags=["providers"])

@router.get("/", response_model=List[ProviderOut])
def list_providers(
    category: Optional[str] = None,
    tier: Optional[str] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    q = db.query(Provider)
    if category: q = q.filter(Provider.category == category)
    if tier: q = q.filter(Provider.tier == tier)
    if country: q = q.filter(Provider.country == country)
    if search: q = q.filter(Provider.name.ilike(f"%{search}%") | Provider.city.ilike(f"%{search}%"))
    return q.order_by(Provider.name).offset(skip).limit(limit).all()

@router.post("/", response_model=ProviderOut, status_code=201)
def create_provider(data: ProviderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prov = Provider(**data.model_dump())
    db.add(prov); db.commit(); db.refresh(prov)
    log_action(db, current_user, "CREATE_PROVIDER", "Provider", str(prov.id), f"Provider {prov.name} created")
    return prov

@router.get("/{provider_id}", response_model=ProviderOut)
def get_provider(provider_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prov = db.query(Provider).filter(Provider.id == provider_id).first()
    if not prov: raise HTTPException(404, "Provider not found")
    return prov

@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(provider_id: UUID, data: ProviderUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prov = db.query(Provider).filter(Provider.id == provider_id).first()
    if not prov: raise HTTPException(404, "Provider not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(prov, k, v)
    db.commit(); db.refresh(prov)
    log_action(db, current_user, "UPDATE_PROVIDER", "Provider", str(prov.id), f"Provider {prov.name} updated")
    return prov

@router.delete("/{provider_id}")
def delete_provider(provider_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prov = db.query(Provider).filter(Provider.id == provider_id).first()
    if not prov: raise HTTPException(404, "Provider not found")
    db.delete(prov); db.commit()
    log_action(db, current_user, "DELETE_PROVIDER", "Provider", str(provider_id), "Provider deleted")
    return {"message": "Provider deleted"}

@router.get("/{provider_id}/tariffs", response_model=List[TariffOut])
def get_tariffs(provider_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ProviderTariff).filter(ProviderTariff.provider_id == provider_id).all()

@router.post("/{provider_id}/tariffs", response_model=TariffOut, status_code=201)
def add_tariff(provider_id: UUID, data: TariffCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tariff = ProviderTariff(provider_id=provider_id, **data.model_dump())
    db.add(tariff); db.commit(); db.refresh(tariff)
    return tariff

@router.post("/{provider_id}/contract")
async def upload_contract(provider_id: UUID, file: UploadFile = File(...),
                          db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prov = db.query(Provider).filter(Provider.id == provider_id).first()
    if not prov: raise HTTPException(404, "Provider not found")
    upload_dir = os.path.join(settings.UPLOAD_DIR, "provider_contracts")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{provider_id}_{file.filename}")
    content = await file.read()
    with open(file_path, "wb") as f: f.write(content)
    prov.contract_file_path = file_path
    db.commit()
    return {"message": "Contract uploaded", "file_path": file_path}

@router.get("/export/excel")
def export_providers_excel(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import openpyxl
    providers = db.query(Provider).all()
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Providers"
    headers = ["Name","Category","Tier","Country","City","Phone","Email","Specialties","Rating","Total Cases","Approval Rate"]
    ws.append(headers)
    for p in providers:
        ws.append([p.name, p.category, p.tier, p.country or "", p.city or "", p.phone or "",
                   p.email or "", p.specialties or "", p.rating, p.total_cases, p.approval_rate])
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 2
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=providers.xlsx"})
