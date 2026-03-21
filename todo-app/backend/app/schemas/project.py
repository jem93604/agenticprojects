from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


class CreateProjectRequest(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InviteProjectMemberRequest(BaseModel):
    handle: str
    role: Optional[Literal["OWNER", "MEMBER"]] = "MEMBER"


class ProjectMemberResponse(BaseModel):
    user_id: int
    handle: str
    display_name: Optional[str] = None
    role: str
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True

