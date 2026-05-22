from sqlalchemy.orm import Session
from app.models.notification import Notification
from uuid import UUID

def create_notification(db: Session, user_id: UUID, title: str, message: str,
                        notif_type: str = "GENERAL", entity_type: str = None, entity_id: str = None):
    notif = Notification(
        user_id=user_id, title=title, message=message,
        notif_type=notif_type, entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

def notify_all_role(db: Session, role: str, title: str, message: str, notif_type: str = "GENERAL",
                    entity_type: str = None, entity_id: str = None):
    from app.models.user import User
    users = db.query(User).filter(User.role == role, User.is_active == True).all()
    for user in users:
        create_notification(db, user.id, title, message, notif_type, entity_type, entity_id)
