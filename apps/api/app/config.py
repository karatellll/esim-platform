from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    api_host: str = "127.0.0.1"
    api_port: int = Field(default=8000, ge=1, le=65535)
    api_cors_origins: list[str] = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
    ]
    esim_provider_base_url: AnyHttpUrl = AnyHttpUrl("https://esim-api.terexov-tech.ru")
    esim_partner_token: SecretStr = SecretStr("")
    esim_publishable_key: SecretStr = SecretStr("")
    # This identity is used only by the server-side catalog reader, never for orders.
    esim_catalog_external_user_id: str = Field(default="tursim-catalog", min_length=1, max_length=128, pattern=r"\S")
    esim_request_timeout_seconds: float = Field(default=15, gt=0, le=60)
    # SDK order creation returns a hosted PSP URL. Never accept a return URL
    # supplied by the app; the operator must approve this server-side URL.
    esim_payment_return_url: str | None = Field(default=None, max_length=512)
    esim_payment_allowed_hosts: list[str] = ["payform.aurapay.tech"]
    orders_database_path: Path = REPOSITORY_ROOT / "apps/api/var/orders.sqlite3"

    # SQLite storage is intended for local authentication tests.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_use_ssl: bool = True
    mail_from: str = ""
    auth_otp_secret: SecretStr = SecretStr("")
    auth_database_path: Path = REPOSITORY_ROOT / "apps/api/var/auth.sqlite3"
    auth_otp_ttl_seconds: int = Field(default=300, ge=60, le=600)
    auth_cookie_secure: bool = False
