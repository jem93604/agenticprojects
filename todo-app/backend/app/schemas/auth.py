from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class UserResponse(BaseModel):
    id: int
    handle: str
    display_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    handle: str
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    handle: str
    password: str


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    tokens: AuthTokens
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class MeResponse(UserResponse):
    pass


class UpdateMeRequest(BaseModel):
    display_name: Optional[str] = None


class PasswordResetRequest(BaseModel):
    handle: str


class PasswordResetConfirmRequest(BaseModel):
    reset_token: str
    new_password: str

