import json
import re
from typing import List, Set

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.models.comment import Notification, TaskComment, TaskCommentMention
from app.models.database import get_db
from app.models.project import ProjectMember
from app.models.task import Task
from app.models.user import User
from app.schemas.comment import (
    NotificationResponse,
    TaskCommentCreate,
    TaskCommentResponse,
    UserMini,
)

router = APIRouter()


MENTION_RE = re.compile(r"@([A-Za-z0-9_\\-]{2,50})")


def _require_project_member(db: Session, project_id: int, user_id: int) -> None:
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


def _resolve_mentions(db: Session, project_id: int, handles: Set[str], exclude_user_id: int) -> List[User]:
    if not handles:
        return []

    users = db.query(User).filter(User.handle.in_(list(handles))).all()
    if not users:
        return []

    # Only mention users who are members of the project and exclude the author.
    resolved: List[User] = []
    for u in users:
        if u.id == exclude_user_id:
            continue
        member = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == u.id)
            .first()
        )
        if member is not None:
            resolved.append(u)
    return resolved


def _serialize_comment(db: Session, comment: TaskComment) -> TaskCommentResponse:
    mentioned = (
        db.query(User)
        .join(TaskCommentMention, User.id == TaskCommentMention.mentioned_user_id)
        .filter(TaskCommentMention.comment_id == comment.id)
        .all()
    )

    return TaskCommentResponse(
        id=comment.id,
        project_id=comment.project_id,
        task_id=comment.task_id,
        author=UserMini(id=comment.author.id, handle=comment.author.handle, display_name=comment.author.display_name),
        content=comment.content,
        mentioned_users=[
            UserMini(id=u.id, handle=u.handle, display_name=u.display_name) for u in mentioned
        ],
        created_at=comment.created_at,
        edited_at=comment.edited_at,
    )


@router.get(
    "/projects/{project_id}/tasks/{task_id}/comments",
    response_model=List[TaskCommentResponse],
)
async def list_comments(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)
    task = db.query(Task).filter(Task.project_id == project_id, Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    comments = (
        db.query(TaskComment)
        .filter(TaskComment.project_id == project_id, TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
        .all()
    )

    # Eager-ish load author via relationship; serialization expects comment.author
    return [_serialize_comment(db, c) for c in comments]


@router.post(
    "/projects/{project_id}/tasks/{task_id}/comments",
    response_model=TaskCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    project_id: int,
    task_id: int,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)
    task = db.query(Task).filter(Task.project_id == project_id, Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")

    handles = set(m.group(1) for m in MENTION_RE.finditer(content))
    mentioned_users = _resolve_mentions(db, project_id, handles, exclude_user_id=current_user.id)

    comment = TaskComment(
        project_id=project_id,
        task_id=task_id,
        author_id=current_user.id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Store mention records + create notifications
    for u in mentioned_users:
        mention = TaskCommentMention(comment_id=comment.id, mentioned_user_id=u.id)
        db.add(mention)

        notif_payload = {
            "project_id": project_id,
            "task_id": task_id,
            "comment_id": comment.id,
            "from_user_id": current_user.id,
            "from_user_handle": current_user.handle,
            "mentioned_handle": u.handle,
        }
        notification = Notification(
            user_id=u.id,
            type="MENTION",
            payload_json=json.dumps(notif_payload),
        )
        db.add(notification)

    db.commit()
    db.refresh(comment)
    return _serialize_comment(db, comment)


@router.patch(
    "/projects/{project_id}/tasks/{task_id}/comments/{comment_id}",
    response_model=TaskCommentResponse,
)
async def edit_comment(
    project_id: int,
    task_id: int,
    comment_id: int,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)
    comment = (
        db.query(TaskComment)
        .filter(
            TaskComment.project_id == project_id,
            TaskComment.task_id == task_id,
            TaskComment.id == comment_id,
        )
        .first()
    )
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author can edit")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")

    comment.content = content
    from app.core.security import utcnow

    comment.edited_at = utcnow()
    db.commit()
    db.refresh(comment)
    return _serialize_comment(db, comment)


@router.delete(
    "/projects/{project_id}/tasks/{task_id}/comments/{comment_id}",
)
async def delete_comment(
    project_id: int,
    task_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_project_member(db, project_id, current_user.id)
    comment = (
        db.query(TaskComment)
        .filter(
            TaskComment.project_id == project_id,
            TaskComment.task_id == task_id,
            TaskComment.id == comment_id,
        )
        .first()
    )
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author can delete")

    # Mentions are removed via join table cascade only if FK cascade is set; to be safe, delete mentions explicitly.
    db.query(TaskCommentMention).filter(TaskCommentMention.comment_id == comment.id).delete()
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted"}

