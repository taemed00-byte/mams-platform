from enum import Enum
from typing import List

class Role(str, Enum):
    ADMINISTRATOR = "Administrator"
    OPERATIONS = "Operations"
    FINANCE = "Finance"
    SALES = "Sales"

ROLE_PERMISSIONS = {
    Role.ADMINISTRATOR: {
        "cases": ["view", "edit", "approve", "delete"],
        "providers": ["view", "edit", "approve", "delete"],
        "finance": ["view", "edit", "approve", "delete"],
        "clients": ["view", "edit", "approve", "delete"],
        "reports": ["view", "edit", "export"],
        "users": ["view", "edit", "approve", "delete"],
        "settings": ["view", "edit"],
        "audit": ["view", "export"],
    },
    Role.OPERATIONS: {
        "cases": ["view", "edit", "approve"],
        "providers": ["view", "edit"],
        "finance": ["view"],
        "clients": ["view"],
        "reports": ["view", "export"],
        "users": [],
        "settings": ["view"],
        "audit": ["view"],
    },
    Role.FINANCE: {
        "cases": ["view"],
        "providers": ["view"],
        "finance": ["view", "edit", "approve"],
        "clients": ["view", "edit"],
        "reports": ["view", "export"],
        "users": [],
        "settings": ["view"],
        "audit": ["view"],
    },
    Role.SALES: {
        "cases": ["view"],
        "providers": ["view"],
        "finance": ["view"],
        "clients": ["view", "edit", "approve"],
        "reports": ["view", "export"],
        "users": [],
        "settings": ["view"],
        "audit": [],
    },
}

def has_permission(role: str, module: str, action: str) -> bool:
    role_enum = Role(role)
    return action in ROLE_PERMISSIONS.get(role_enum, {}).get(module, [])
