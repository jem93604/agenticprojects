from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.project import ProjectMember
from app.models.task import Task, task_assignees
from app.models.user import User
from app.schemas.task import (
    BatchTaskPositionUpdate,
    TaskBatchUpdateRequest,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    Status,
    UserMini,
)

router = APIRouter()


def _require_project_member(db: Session, project_id: int, user_id: int) -> None:
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


def _serialize_task(db: Session, task: Task) -> TaskResponse:
    # Ensure assignees are loaded
    assignees = db.query(User).join(task_assignees, User.id == task_assignees.c.user_id).filter(
        task_assignees.c.task_id == task.id
    ).all()

    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        status=task.status,  # type: ignore[arg-type]
        due_date=task.due_date,
        importance=task.importance,  # type: ignore[arg-type]
        urgent_override=task.urgent_override,
        position=task.position,
        assignees=[
            UserMini(id=u.id, handle=u.handle, display_name=u.display_name) for u in assignees
        ],
    )


def _next_position(db: Session, project_id: int, status: Status) -> int:
    max_pos = (
        db.query(Task.position)
        .filter(Task.project_id == project_id, Task.status == status)
        .order_by(Task.position.desc())
        .first()
    )
    if not max_pos or max_pos[0] is None:
        return 0
    return int(max_pos[0]) + 1


@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[Status] = None,
):
    _require_project_member(db, project_id, current_user.id)

    q = db.query(Task).filter(Task.project_id == project_id)
    if status is not None:
        q = q.filter(Task.status == status)

    tasks = q.order_by(Task.status.asc(), Task.position.asc()).all()
    return [_serialize_task(db, t) for t in tasks]


@router.post("/projects/{project_id}/tasks", response_model=TaskResponse)
async def create_task(
    project_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)

    task_status = payload.status or "TODO"
    position = payload.position if payload.position is not None else _next_position(db, project_id, task_status)  # type: ignore[arg-type]

    task = Task(
        project_id=project_id,
        title=payload.title.strip(),
        description=payload.description,
        status=task_status,  # type: ignore[arg-type]
        due_date=payload.due_date,
        importance=payload.importance or "MEDIUM",  # type: ignore[arg-type]
        urgent_override=payload.urgent_override,
        position=position,
        created_by=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    if payload.assignee_ids:
        assignees = db.query(User).filter(User.id.in_(payload.assignee_ids)).all()
        task.assignees = assignees
        db.commit()
        db.refresh(task)

    return _serialize_task(db, task)


@router.patch("/projects/{project_id}/tasks/batch", response_model=List[TaskResponse])
async def batch_update_tasks(
    project_id: int,
    payload: TaskBatchUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)

    # Naive approach: apply updates one-by-one.
    updated: List[Task] = []
    for update in payload.updates:
        task = db.query(Task).filter(Task.project_id == project_id, Task.id == update.task_id).first()
        if task is None:
            continue

        task.status = update.status  # type: ignore[assignment]
        task.position = int(update.position)
        updated.append(task)

    db.commit()

    # Return updated tasks with sorting for UI stability.
    for t in updated:
        db.refresh(t)
    updated_sorted = sorted(updated, key=lambda t: (t.status, t.position))
    return [_serialize_task(db, t) for t in updated_sorted]


@router.get("/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)

    task = db.query(Task).filter(Task.project_id == project_id, Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    return _serialize_task(db, task)


@router.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: int,
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)

    task = db.query(Task).filter(Task.project_id == project_id, Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    data = payload.model_dump(exclude_unset=True)

    if "title" in data and data["title"] is not None:
        task.title = str(data["title"]).strip()
    if "description" in data:
        task.description = data["description"]

    status_changed = False
    if "status" in data and data["status"] is not None:
        task.status = data["status"]  # type: ignore[assignment]
        status_changed = True

    if "due_date" in data:
        task.due_date = data["due_date"]
    if "importance" in data:
        task.importance = data["importance"]  # type: ignore[assignment]
    if "urgent_override" in data:
        task.urgent_override = data["urgent_override"]

    if "position" in data and data["position"] is not None:
        task.position = int(data["position"])
    elif status_changed and "position" not in data:
        # If status changed but position not specified, append to bottom of new column.
        task.position = _next_position(db, project_id, task.status)  # type: ignore[arg-type]

    if "assignee_ids" in data:
        if data["assignee_ids"] is None:
            task.assignees = []
        else:
            assignees = db.query(User).filter(User.id.in_(data["assignee_ids"])).all()
            task.assignees = assignees

    db.commit()
    db.refresh(task)
    return _serialize_task(db, task)


@router.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)

    task = db.query(Task).filter(Task.project_id == project_id, Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}

