from __future__ import annotations

from pydantic import BaseModel, Field


class JwtSetRequest(BaseModel):
    token: str


class JwtStatusResponse(BaseModel):
    has_token: bool
    token_preview: str | None


class SignInRequest(BaseModel):
    email: str
    password: str


class SignInResponse(BaseModel):
    success: bool
    ingame_name: str | None = None
    error: str | None = None


class TestProfileRequest(BaseModel):
    method: str = "GET"
    path: str = "/profile/orders"
    body: dict | None = None
    auth_format: str = "JWT {token}"


class TestProfileResponse(BaseModel):
    status: int
    body: dict | list | None
    error: str | None = None
