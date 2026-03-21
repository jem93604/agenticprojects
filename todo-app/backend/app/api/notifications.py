from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.models.comment import Notification
from app.models.database import get_db
from app.models.user import User
from app.schemas.comment import NotificationResponse

router = APIRouter()


@router.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    def _to_payload(n: Notification) -> NotificationResponse:
        payload = {}
        try:
            # stored as JSON string
            import json

            payload = json.loads(n.payload_json)
        except Exception:
            payload = {}
        return NotificationResponse(
            id=n.id,
            type=n.type,
            payload=payload,
            created_at=n.created_at,
            read_at=n.read_at,
        )

    return [_to_payload(n) for n in notifications]


@router.patch("/notifications/{notification_id}/mark-read", response_model=NotificationResponse)
async def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.id == notification_id)
        .first()
    )
    if notif is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    from app.core.security import utcnow

    notif.read_at = utcnow()
    db.commit()
    db.refresh(notif)

    import json

    payload = {}
    try:
        payload = json.loads(notif.payload_json)
    except Exception:
        payload = {}

    return NotificationResponse(
        id=notif.id,
        type=notif.type,
        payload=payload,
        created_at=notif.created_at,
        read_at=notif.read_at,
    )

