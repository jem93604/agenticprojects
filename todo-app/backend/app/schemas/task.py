from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


Status = Literal["TODO", "DOING", "DONE"]
Importance = Literal["LOW", "MEDIUM", "HIGH"]


class UserMini(BaseModel):
    id: int
    handle: str
    display_name: Optional[str] = None

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[Status] = "TODO"
    due_date: Optional[datetime] = None
    importance: Optional[Importance] = "MEDIUM"
    urgent_override: Optional[bool] = None
    position: Optional[int] = None
    assignee_ids: Optional[List[int]] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Status] = None
    due_date: Optional[datetime] = None
    importance: Optional[Importance] = None
    urgent_override: Optional[bool] = None
    position: Optional[int] = None
    assignee_ids: Optional[List[int]] = None


class TaskResponse(BaseModel):
    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    status: Status
    due_date: Optional[datetime] = None
    importance: Importance
    urgent_override: Optional[bool] = None
    position: int
    assignees: List[UserMini] = []

    class Config:
        from_attributes = True


class BatchTaskPositionUpdate(BaseModel):
    task_id: int
    status: Status
    position: int


class TaskBatchUpdateRequest(BaseModel):
    updates: List[BatchTaskPositionUpdate]

