"""Ajustes del usuario que se guardan entre sesiones en `data/settings.json`.

Guarda dos cosas:
- `api_token`: la API key de Replicate (para no editar `.env` a mano).
- `export_dir`: la carpeta donde se exportan los `.md` y las capturas.
"""
import os
import json
from pathlib import Path
from helpmeet import config

SETTINGS_PATH = config.DATA_DIR / "settings.json"


def _load() -> dict:
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict) -> None:
    config.ensure_dirs()
    SETTINGS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ---------- Carpeta de exportación ----------
def get_export_dir() -> Path:
    p = _load().get("export_dir")
    return Path(p) if p else (config.DATA_DIR / "exports")


def set_export_dir(path: str) -> None:
    data = _load()
    data["export_dir"] = str(path)
    _save(data)


# ---------- API key de Replicate ----------
def get_api_token() -> str:
    """Token guardado; si no, el de la variable de entorno (.env)."""
    return _load().get("api_token") or os.environ.get("REPLICATE_API_TOKEN", "")


def set_api_token(token: str) -> None:
    token = (token or "").strip()
    data = _load()
    data["api_token"] = token
    _save(data)
    if token:
        os.environ["REPLICATE_API_TOKEN"] = token  # efecto inmediato, sin reiniciar


def apply_env() -> None:
    """Al arrancar: vuelca el token guardado a la variable de entorno."""
    token = _load().get("api_token")
    if token:
        os.environ["REPLICATE_API_TOKEN"] = token


# ---------- Preferencias de transcripción y audio ----------
def get_transcription_settings() -> dict:
    data = _load()
    provider = data.get("transcription_provider", "auto")
    if provider not in {"auto", "local", "replicate"}:
        provider = "auto"
    return {
        "provider": provider,
        "default_mic_muted": bool(data.get("default_mic_muted", False)),
        "video_quality": "accurate",
        "language": config.WHISPER_LANGUAGE,
    }


def set_transcription_settings(values: dict) -> dict:
    current = _load()
    if "provider" in values:
        provider = str(values["provider"]).lower()
        if provider not in {"auto", "local", "replicate"}:
            raise ValueError("Proveedor de transcripción no válido.")
        current["transcription_provider"] = provider
    if "default_mic_muted" in values:
        current["default_mic_muted"] = bool(values["default_mic_muted"])
    _save(current)
    return get_transcription_settings()
