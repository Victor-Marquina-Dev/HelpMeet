"""Ajustes del usuario que se guardan entre sesiones en `data/settings.json`.

La API key de Replicate se guarda aparte en Credenciales de Windows; nunca se
escribe en este JSON.
"""
import os
import json
from pathlib import Path
from helpmeet import config
from helpmeet import secret_store

SETTINGS_PATH = config.DATA_DIR / "settings.json"


def _load() -> dict:
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(data: dict) -> None:
    config.ensure_dirs()
    temporary = SETTINGS_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(SETTINGS_PATH)


def _scrub_legacy_plaintext_token() -> None:
    """Retira el token del JSON antiguo después de pasarlo al almacén seguro."""
    expected = config.DATA_DIR / "settings.json"
    legacy_path = config.LEGACY_DATA_DIR / "settings.json"
    if SETTINGS_PATH != expected or legacy_path.resolve() == SETTINGS_PATH.resolve():
        return
    try:
        data = json.loads(legacy_path.read_text(encoding="utf-8"))
        if "api_token" in data:
            data.pop("api_token", None)
            temporary = legacy_path.with_suffix(".json.tmp")
            temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False),
                                 encoding="utf-8")
            temporary.replace(legacy_path)
    except Exception:
        pass


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
    """Lee Credenciales de Windows y migra el valor plano de versiones antiguas."""
    secure = secret_store.get_secret()
    if secure:
        return secure
    data = _load()
    legacy = (data.get("api_token") or "").strip()
    if legacy:
        try:
            secret_store.set_secret(legacy)
            data.pop("api_token", None)
            _save(data)
            _scrub_legacy_plaintext_token()
        except OSError:
            return legacy  # no borrar si Windows rechazó la migración
        return legacy
    return os.environ.get("REPLICATE_API_TOKEN", "")


def set_api_token(token: str) -> None:
    token = (token or "").strip()
    secret_store.set_secret(token)
    data = _load()
    data.pop("api_token", None)
    _save(data)
    _scrub_legacy_plaintext_token()
    if token:
        os.environ["REPLICATE_API_TOKEN"] = token  # efecto inmediato, sin reiniciar
    else:
        os.environ.pop("REPLICATE_API_TOKEN", None)


def apply_env() -> None:
    """Al arrancar: vuelca temporalmente el token seguro al proceso actual."""
    token = get_api_token()
    if token:
        os.environ["REPLICATE_API_TOKEN"] = token


# ---------- Instrucciones para la IA (cabecera del contexto) ----------
# Texto que se antepone al `contexto.md` para orientar a la IA externa
# (Claude Code) desde la primera línea. Es plantilla por defecto y editable.
DEFAULT_AI_INSTRUCTIONS = (
    "Eres un asistente que me ayuda con este proyecto. A continuación tienes las "
    "transcripciones de mis reuniones, con sus capturas y notas. Úsalas como "
    "contexto para responderme con precisión. Cuando te apoyes en algo dicho en "
    "una reunión, indica de cuál y en qué momento. Si algo no aparece en el "
    "contexto, dímelo en lugar de inventarlo."
)


def get_ai_instructions() -> str:
    val = _load().get("ai_instructions")
    return val if isinstance(val, str) and val.strip() else DEFAULT_AI_INSTRUCTIONS


def set_ai_instructions(text: str) -> None:
    """Guarda las instrucciones. Vacío = vuelve a la plantilla por defecto."""
    data = _load()
    data["ai_instructions"] = (text or "").strip()
    _save(data)


# ---------- Preferencias de transcripción y audio ----------
def get_transcription_settings() -> dict:
    data = _load()
    provider = data.get("transcription_provider", "auto")
    # Replicate (nube) deshabilitado: cualquier valor que no sea local cae a local.
    if provider not in {"auto", "local"}:
        provider = "local"
    return {
        "provider": provider,
        "default_mic_muted": bool(data.get("default_mic_muted", False)),
        "video_quality": "accurate",
        "language": config.WHISPER_LANGUAGE,
    }


def get_consent_seen() -> bool:
    """Si el usuario ya aceptó el aviso de consentimiento de grabación."""
    return bool(_load().get("recording_consent_seen", False))


def set_consent_seen(seen: bool = True) -> None:
    current = _load()
    current["recording_consent_seen"] = bool(seen)
    _save(current)


def set_transcription_settings(values: dict) -> dict:
    current = _load()
    if "provider" in values:
        provider = str(values["provider"]).lower()
        if provider == "replicate":  # nube deshabilitada: se guarda como local
            provider = "local"
        if provider not in {"auto", "local"}:
            raise ValueError("Proveedor de transcripción no válido.")
        current["transcription_provider"] = provider
    if "default_mic_muted" in values:
        current["default_mic_muted"] = bool(values["default_mic_muted"])
    _save(current)
    return get_transcription_settings()
