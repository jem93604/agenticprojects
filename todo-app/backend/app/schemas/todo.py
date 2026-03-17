from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TagBase(BaseModel):
    name: str
    color: str = "#3B82F6"

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: int
    
    class Config:
        from_attributes = True

class TodoBase(BaseModel):
    title: str
    description: Optional[str] = None
    completed: bool = False
    due_date: Optional[datetime] = None
    parent_id: Optional[int] = None
    tags: List[TagResponse] = []

class TodoCreate(TodoBase):
    pass

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    due_date: Optional[datetime] = None
    parent_id: Optional[int] = None
    tags: Optional[List[TagCreate]] = None

class TodoResponse(TodoBase):
    id: int
    
    class Config:
        from_attributes = True