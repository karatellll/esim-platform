from datetime import datetime
from typing import Literal
from uuid import UUID
import re

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


def normalize_email(value: str) -> str:
    value = value.strip()
    if len(value) > 254 or value.count("@") != 1 or any(c.isspace() for c in value):
        raise ValueError("Invalid email")
    local, domain = value.rsplit("@", 1)
    try:
        domain = domain.encode("idna").decode("ascii").lower()
    except UnicodeError as error:
        raise ValueError("Invalid email") from error
    if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]{1,64}", local):
        raise ValueError("Invalid email")
    if local.startswith(".") or local.endswith(".") or ".." in local:
        raise ValueError("Invalid email")
    labels = domain.split(".")
    if len(labels) < 2 or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", part) for part in labels):
        raise ValueError("Invalid email")
    # Preserve local-part case; do not merge addresses with provider-specific rules.
    return f"{local}@{domain}"


class SendCodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def email_address(cls, value: str) -> str:
        return normalize_email(value)


class SendCodeResponse(BaseModel):
    challenge_id: UUID
    email: str
    expires_in: int
    resend_after_seconds: int


class VerifyCodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge_id: UUID
    code: str = Field(pattern=r"^[0-9]{6}$")
    client: Literal["web", "native"] = "web"


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client: Literal["web", "native"] = "web"
    refresh_token: SecretStr | None = Field(default=None, max_length=256)


class AuthUser(BaseModel):
    id: UUID
    email: str
    display_name: str = ""
    avatar: str | None = None
    email_verified: bool = True
    created_at: datetime


class SessionResponse(BaseModel):
    user: AuthUser
    access_token: str
    token_type: Literal["Bearer"] = "Bearer"
    expires_in: int
    refresh_token: str | None = None


class MeResponse(BaseModel):
    user: AuthUser


class AuthErrorDetail(BaseModel):
    code: str
    message: str
    retry_after_seconds: int | None = None


class AuthErrorResponse(BaseModel):
    error: AuthErrorDetail


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=80)
    avatar: str | None = Field(default=None, max_length=300000)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value or any(ord(c) < 32 for c in value):
            raise ValueError("Invalid name")
        return value

    @field_validator("avatar")
    @classmethod
    def valid_avatar(cls, value):
        if value is None:
            return value
        import base64
        if not value.startswith("data:image/jpeg;base64,"):
            raise ValueError("Only JPEG avatars are supported")
        try:
            data = base64.b64decode(value.split(",", 1)[1], validate=True)
        except Exception as error:
            raise ValueError("Invalid image") from error
        if not data.startswith(b"\xff\xd8\xff") or len(data) > 200000:
            raise ValueError("Invalid image")
        return value
