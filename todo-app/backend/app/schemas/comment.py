from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class UserMini(BaseModel):
    id: int
    handle: str
    display_name: Optional[str] = None

    class Config:
        from_attributes = True


class TaskCommentCreate(BaseModel):
    content: str


class TaskCommentResponse(BaseModel):
    id: int
    project_id: int
    task_id: int
    author: UserMini
    content: str
    mentioned_users: List[UserMini] = []
    created_at: datetime
    edited_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    type: str
    payload: dict
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True

