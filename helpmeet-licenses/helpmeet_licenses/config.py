from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    admin_api_key: str

    # Gmail API + OAuth — envío como helpmeet@mimotech.vip
    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    google_sender_email: str = "helpmeet@mimotech.vip"
    google_sender_name: str = "HelpMeet"

    # Notificaciones al admin (Victor)
    admin_notify_email: str = "team@mimotech.vip"

    # Resend (fallback / legacy)
    resend_api_key: Optional[str] = None

    cors_origins: str = "*"

    # Ultima version publicada de la app de escritorio
    latest_app_version: str = ""
    latest_app_url: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("jwt_secret", "admin_api_key")
    @classmethod
    def _must_be_strong_secret(cls, value: str, info):
        value = (value or "").strip()
        if len(value) < 32:
            raise ValueError(f"{info.field_name} must be at least 32 characters")
        weak_values = {
            "cambia-esto-por-un-valor-largo-y-aleatorio",
            "clave-admin-secreta",
            "change-me",
            "secret",
        }
        if value.lower() in weak_values:
            raise ValueError(f"{info.field_name} must be changed before running")
        return value


settings = Settings()
