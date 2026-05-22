from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import random, string, io, os
from app.database import get_db
from app.models.client import Client
from app.models.contract import Contract
from app.schemas.client import ClientCreate, ClientUpdate, ClientOut, ContractCreate, ContractUpdate, ContractOut
from app.deps import get_current_user
from app.models.user import User
from app.services.audit import log_action
from app.config import settings

router = APIRouter(prefix="/clients", tags=["clients"])

def gen_contract_number():
    return "CON-" + "".join(random.choices(string.digits, k=8))

@router.get("/", response_model=List[ClientOut])
def list_clients(
    client_type: Optional[str] = None, is_active: Optional[bool] = None,
    pipeline_stage: Optional[str] = None, search: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    q = db.query(Client)
    if client_type: q = q.filter(Client.client_type == client_type)
    if is_active is not None: q = q.filter(Client.is_active == is_active)
    if pipeline_stage: q = q.filter(Client.pipeline_stage == pipeline_stage)
    if search: q = q.filter(Client.name.ilike(f"%{search}%") | Client.email.ilike(f"%{search}%"))
    return q.order_by(Client.name).offset(skip).limit(limit).all()

@router.post("/", response_model=ClientOut, status_code=201)
def create_client(data: ClientCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client = Client(**data.model_dump())
    db.add(client); db.commit(); db.refresh(client)
    log_action(db, current_user, "CREATE_CLIENT", "Client", str(client.id), f"Client {client.name} created")
    return client

@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c: raise HTTPException(404, "Client not found")
    return c

@router.put("/{client_id}", response_model=ClientOut)
def update_client(client_id: UUID, data: ClientUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c: raise HTTPException(404, "Client not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    log_action(db, current_user, "UPDATE_CLIENT", "Client", str(c.id), f"Client {c.name} updated")
    return c

@router.delete("/{client_id}")
def delete_client(client_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c: raise HTTPException(404, "Client not found")
    c.is_active = False
    db.commit()
    log_action(db, current_user, "DEACTIVATE_CLIENT", "Client", str(c.id), f"Client {c.name} deactivated")
    return {"message": "Client deactivated"}

# Contracts
@router.get("/{client_id}/contracts", response_model=List[ContractOut])
def list_contracts(client_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Contract).filter(Contract.client_id == client_id).all()

@router.post("/{client_id}/contracts", response_model=ContractOut, status_code=201)
def create_contract(client_id: UUID, data: ContractCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contract = Contract(contract_number=gen_contract_number(), **data.model_dump())
    db.add(contract); db.commit(); db.refresh(contract)
    log_action(db, current_user, "CREATE_CONTRACT", "Contract", str(contract.id), f"Contract {contract.contract_number} created")
    return contract

@router.put("/contracts/{contract_id}", response_model=ContractOut)
def update_contract(contract_id: UUID, data: ContractUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(404, "Contract not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(contract, k, v)
    db.commit(); db.refresh(contract)
    return contract

@router.post("/contracts/{contract_id}/upload")
async def upload_contract_doc(contract_id: UUID, file: UploadFile = File(...),
                               db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(404, "Contract not found")
    upload_dir = os.path.join(settings.UPLOAD_DIR, "contracts")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{contract_id}_{file.filename}")
    content = await file.read()
    with open(file_path, "wb") as f: f.write(content)
    contract.file_path = file_path
    db.commit()
    return {"message": "Contract document uploaded"}

@router.get("/export/excel")
def export_clients_excel(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import openpyxl
    clients = db.query(Client).all()
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Clients"
    ws.append(["Name","Type","Contact","Email","Phone","Country","Pipeline Stage","Active","Total Cases","Total Revenue"])
    for c in clients:
        ws.append([c.name, c.client_type, c.contact_name or "", c.email or "", c.phone or "",
                   c.country or "", c.pipeline_stage, "Yes" if c.is_active else "No", c.total_cases, c.total_revenue])
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = max(len(str(cell.value or "")) for cell in col) + 2
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=clients.xlsx"})
