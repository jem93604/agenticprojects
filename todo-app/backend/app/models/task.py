from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Table
from sqlalchemy.orm import relationship

from app.models.database import Base


task_assignees = Table(
    "task_assignees",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Kanban status
    status = Column(String(20), nullable=False, server_default="TODO", index=True)

    # Priority/urgency
    due_date = Column(DateTime, nullable=True)
    importance = Column(String(20), nullable=False, server_default="MEDIUM", index=True)
    urgent_override = Column(Boolean, nullable=True)

    # Ordering within a status column for stable DnD reordering
    position = Column(Integer, nullable=False, server_default="0", index=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    assignees = relationship("User", secondary=task_assignees)

