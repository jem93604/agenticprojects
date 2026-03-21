import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from app.core.auth import create_access_token, decode_access_token
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.security import hash_password, sha256_hex, utcnow, verify_password
from app.models.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthTokens,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MeResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    UpdateMeRequest,
    UserResponse,
)

router = APIRouter()


def _create_plain_token() -> str:
    return secrets.token_urlsafe(48)


# Import models lazily by defining them here? We'll reference tables via SQLAlchemy ORM models
# using simple dynamic table approach only for now.
#
# NOTE: refresh token storage and reset tokens are declared in the migration and implemented
# as ORM models below to keep Phase 0 self-contained.

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from app.models.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(Text, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    replaced_by_token_hash = Column(Text, nullable=True)

    user = relationship("User")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(Text, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)

    user = relationship("User")


def _get_user_by_handle(db: Session, handle: str) -> Optional[User]:
    try:
        return db.query(User).filter(User.handle == handle).first()
    except OperationalError:
        # Usually means migrations were not applied to the configured DB.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database schema not initialized. Run `alembic upgrade head`.",
        )


def _issue_tokens(db: Session, user: User) -> tuple[AuthTokens, UserResponse]:
    access_token = create_access_token(user.id)

    refresh_plain = _create_plain_token()
    refresh_hash = sha256_hex(refresh_plain)
    expires_at = utcnow() + timedelta(days=settings.refresh_token_expire_days)

    db_refresh = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=expires_at,
        revoked_at=None,
        replaced_by_token_hash=None,
    )
    db.add(db_refresh)
    db.commit()
    db.refresh(db_refresh)

    tokens = AuthTokens(
        access_token=access_token,
        refresh_token=refresh_plain,
        token_type="bearer",
    )
    user_resp = UserResponse(
        id=user.id,
        handle=user.handle,
        display_name=user.display_name,
        created_at=user.created_at,
    )
    return tokens, user_resp


@router.post("/register", response_model=UserResponse)
async def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    handle = payload.handle.strip()
    if not handle:
        raise HTTPException(status_code=400, detail="Handle is required")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = _get_user_by_handle(db, handle)
    if existing is not None:
        raise HTTPException(status_code=400, detail="Handle already in use")

    user = User(
        handle=handle,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = _get_user_by_handle(db, payload.handle.strip())
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    tokens, user_resp = _issue_tokens(db, user)
    return LoginResponse(tokens=tokens, user=user_resp)


@router.post("/refresh", response_model=AuthTokens)
async def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_hash = sha256_hex(payload.refresh_token)
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if record.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
    if record.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate: revoke old, issue new
    record.revoked_at = utcnow()
    new_refresh_plain = _create_plain_token()
    new_refresh_hash = sha256_hex(new_refresh_plain)
    record.replaced_by_token_hash = new_refresh_hash
    record_expires = utcnow() + timedelta(days=settings.refresh_token_expire_days)

    new_record = RefreshToken(
        user_id=user.id,
        token_hash=new_refresh_hash,
        expires_at=record_expires,
        revoked_at=None,
        replaced_by_token_hash=None,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    access_token = create_access_token(user.id)
    return AuthTokens(access_token=access_token, refresh_token=new_refresh_plain, token_type="bearer")


@router.post("/logout")
async def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    token_hash = sha256_hex(payload.refresh_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if record is None:
        # Don't leak whether token exists
        return {"message": "Logged out"}
    if record.revoked_at is None:
        record.revoked_at = utcnow()
    db.commit()
    return {"message": "Logged out"}


@router.get("/me", response_model=MeResponse)
async def me(
    current_user: User = Depends(get_current_user),
):
    return MeResponse(
        id=current_user.id,
        handle=current_user.handle,
        display_name=current_user.display_name,
        created_at=current_user.created_at,
    )


@router.patch("/me", response_model=MeResponse)
async def update_me(
    payload: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.display_name is not None:
        display_name = payload.display_name.strip()
        current_user.display_name = display_name if display_name else None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return MeResponse(
        id=current_user.id,
        handle=current_user.handle,
        display_name=current_user.display_name,
        created_at=current_user.created_at,
    )


@router.post("/password-reset/request")
async def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    user = _get_user_by_handle(db, payload.handle.strip())
    # Avoid user enumeration
    if user is None:
        return {"message": "If the account exists, a reset link has been sent"}

    reset_plain = _create_plain_token()
    reset_hash = sha256_hex(reset_plain)
    expires_at = utcnow() + timedelta(minutes=settings.password_reset_token_expire_minutes)

    record = PasswordResetToken(
        user_id=user.id,
        token_hash=reset_hash,
        expires_at=expires_at,
        used_at=None,
    )
    db.add(record)
    db.commit()

    # NOTE: For a production system, we would email this token; Phase 0 returns it for dev/testing.
    return {"message": "Reset token created", "reset_token": reset_plain}


@router.post("/password-reset/confirm")
async def confirm_password_reset(payload: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    token_hash = sha256_hex(payload.reset_token)
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
    if record.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token already used")
    if record.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token expired")

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    record.used_at = utcnow()

    # Revoke all refresh tokens for this user.
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": utcnow()})

    db.commit()
    return {"message": "Password updated"}

