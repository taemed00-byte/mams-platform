from typing import Any
from fastapi import APIRouter, Depends
from app.deps import require_role
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])

# In-memory settings (persist to DB in production via a Settings model)
_settings_store = {
    "default_currency": "USD",
    "sla_threshold_hours": 24,
    "date_format": "DD/MM/YYYY",
    "language": "en",
    "high_cost_alert_threshold": 10000,
    "contract_expiry_warning_days": 30
}

@router.get("/")
def get_settings(current_user: User = Depends(require_role("Administrator"))):
    return _settings_store

@router.put("/")
def update_settings(data: dict[str, Any], current_user: User = Depends(require_role("Administrator"))):
    _settings_store.update(data)
    return _settings_store
