from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.models.comment import Notification
from app.schemas.project import (
    CreateProjectRequest,
    InviteProjectMemberRequest,
    ProjectMemberResponse,
    ProjectResponse,
)

router = APIRouter()


def _get_member_or_404(db: Session, project_id: int, user_id: int) -> ProjectMember:
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=ProjectResponse)
async def create_project(
    payload: CreateProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")

    project = Project(name=name, created_by=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)

    owner_member = ProjectMember(project_id=project.id, user_id=current_user.id, role="OWNER")
    db.add(owner_member)
    db.commit()
    db.refresh(owner_member)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        created_by=project.created_by,
        created_at=project.created_at,
    )


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = (
        db.query(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )
    return [
        ProjectResponse(
            id=p.id,
            name=p.name,
            created_by=p.created_by,
            created_at=p.created_at,
        )
        for p in projects
    ]


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def list_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(db, project_id)
    # Membership guard: only members can see members
    _get_member_or_404(db, project_id, current_user.id)

    members = (
        db.query(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    return [
        ProjectMemberResponse(
            user_id=member.user_id,
            handle=user.handle,
            display_name=user.display_name,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, user in members
    ]


@router.post("/{project_id}/invites", response_model=ProjectMemberResponse)
async def invite_member(
    project_id: int,
    payload: InviteProjectMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    actor_member = _get_member_or_404(db, project_id, current_user.id)
    if actor_member.role != "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can invite")

    handle = payload.handle.strip()
    if not handle:
        raise HTTPException(status_code=400, detail="Handle is required")

    invited_user = db.query(User).filter(User.handle == handle).first()
    if invited_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == invited_user.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="User already a member")

    new_member = ProjectMember(
        project_id=project_id,
        user_id=invited_user.id,
        role=payload.role or "MEMBER",
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    # Create a notification for the invited user
    try:
        import json

        notif_payload = json.dumps(
            {
                "project_id": project_id,
                "project_name": project.name,
                "invited_by_user_id": current_user.id,
                "invited_by_handle": current_user.handle,
                "role": new_member.role,
            }
        )
        notif = Notification(user_id=invited_user.id, type="PROJECT_INVITE", payload_json=notif_payload)
        db.add(notif)
        db.commit()
    except Exception:
        # Do not fail invite if notification creation fails
        db.rollback()

    return ProjectMemberResponse(
        user_id=new_member.user_id,
        handle=invited_user.handle,
        display_name=invited_user.display_name,
        role=new_member.role,
        joined_at=new_member.joined_at,
    )


@router.delete("/{project_id}/members/{user_id}")
async def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(db, project_id)
    actor_member = _get_member_or_404(db, project_id, current_user.id)
    if actor_member.role != "OWNER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can remove members")

    member = _get_member_or_404(db, project_id, user_id)
    if member.user_id == current_user.id:
        # Prevent owners from removing themselves if it would leave no owners.
        owner_count = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.role == "OWNER")
            .count()
        )
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last owner")

    db.delete(member)
    db.commit()
    return {"message": "Member removed"}

