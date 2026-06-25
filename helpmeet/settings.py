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

# P-11: caché en memoria de settings.json. Muchos getters lo leían en cada
# llamada (get_transcription_settings invoca varios). Se carga una vez y se
# refresca al guardar; `invalidate_cache()` lo limpia tras borrar/restaurar datos.
import threading as _threading
_cache_lock = _threading.Lock()
_cache: dict | None = None
_cache_path = None  # ruta para la que es válida la caché (los tests cambian SETTINGS_PATH)


def _load() -> dict:
    global _cache, _cache_path
    with _cache_lock:
        if _cache is None or _cache_path != SETTINGS_PATH:
            try:
                _cache = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            except Exception:
                _cache = {}
            _cache_path = SETTINGS_PATH
        return dict(_cache)  # copia: el llamador no muta la caché por accidente


def _save(data: dict) -> None:
    global _cache, _cache_path
    config.ensure_dirs()
    temporary = SETTINGS_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(SETTINGS_PATH)
    with _cache_lock:
        _cache = dict(data)
        _cache_path = SETTINGS_PATH


def invalidate_cache() -> None:
    """Olvida la caché; el próximo acceso releerá del disco (tras borrar/restaurar)."""
    global _cache, _cache_path
    with _cache_lock:
        _cache = None
        _cache_path = None


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


# ---------- Idioma y modelo de transcripción ----------
# El idioma se elige PRIMERO y de él depende qué modelos hay: el inglés usa los
# modelos ".en" (optimizados solo para inglés, más precisos en ese idioma); el
# español usa los multilingües.
WHISPER_LANGUAGES = {
    "es": "Español",
    "en": "Inglés",
}

# Niveles de calidad, de menor a mayor. Cada nivel es el mismo concepto en los dos
# idiomas; solo cambia el modelo concreto que se descarga. `download` es el tamaño
# aproximado que se baja la primera vez que se usa ese modelo.
WHISPER_TIERS = [
    {"tier": "fast",     "label": "Rápido — menos preciso",         "download": "~145 MB"},
    {"tier": "balanced", "label": "Equilibrado (recomendado)",      "download": "~480 MB"},
    {"tier": "accurate", "label": "Más preciso — más lento",        "download": "~1,5 GB"},
    {"tier": "max",      "label": "Máxima calidad — lento, pesado", "download": "~3 GB"},
]

# Modelo concreto de faster-whisper para cada (idioma, nivel). No existe "large.en":
# el modelo grande es multilingüe, así que el nivel máximo usa "large-v3" en ambos.
WHISPER_MODELS_BY_LANG = {
    "es": {"fast": "base",    "balanced": "small",    "accurate": "medium",    "max": "large-v3"},
    "en": {"fast": "base.en", "balanced": "small.en", "accurate": "medium.en", "max": "large-v3"},
}

DEFAULT_TIER = "balanced"
_TIER_IDS = {t["tier"] for t in WHISPER_TIERS}


def get_transcription_language() -> str:
    """Idioma elegido. Por defecto "es"."""
    value = _load().get("transcription_language")
    return value if value in WHISPER_LANGUAGES else "es"


def get_transcription_tier() -> str:
    """Nivel de calidad elegido (fast/balanced/accurate/max). Por defecto balanced."""
    value = _load().get("transcription_tier")
    return value if value in _TIER_IDS else DEFAULT_TIER


def get_transcription_model() -> str:
    """Modelo concreto de faster-whisper, derivado del idioma y el nivel elegidos."""
    return WHISPER_MODELS_BY_LANG[get_transcription_language()][get_transcription_tier()]


def _models_for(language: str) -> list:
    """Lista de niveles con el modelo concreto que les toca en ese idioma."""
    return [
        {"tier": t["tier"], "id": WHISPER_MODELS_BY_LANG[language][t["tier"]],
         "label": t["label"], "download": t["download"]}
        for t in WHISPER_TIERS
    ]


# ---------- Preferencias de transcripción y audio ----------
def get_video_profile() -> str:
    """Perfil de calidad de grabación de pantalla (light/balanced/native)."""
    value = _load().get("video_profile")
    return value if value in config.VIDEO_PROFILES else config.DEFAULT_VIDEO_PROFILE


def get_transcription_settings() -> dict:
    data = _load()
    provider = data.get("transcription_provider", "auto")
    # Replicate (nube) deshabilitado: cualquier valor que no sea local cae a local.
    if provider not in {"auto", "local"}:
        provider = "local"
    language = get_transcription_language()
    tier = get_transcription_tier()
    video_profile = get_video_profile()
    return {
        "provider": provider,
        "default_mic_muted": bool(data.get("default_mic_muted", False)),
        "video_quality": "accurate",
        "video_profile": video_profile,
        "video_profiles": [{"id": pid, "label": p["label"]}
                           for pid, p in config.VIDEO_PROFILES.items()],
        "language": language,
        "language_label": WHISPER_LANGUAGES[language],
        "languages": [{"id": lid, "label": label} for lid, label in WHISPER_LANGUAGES.items()],
        "tier": tier,
        "model": get_transcription_model(),  # id concreto (para diagnóstico y motor)
        # Modelos por idioma, para que la UI cambie la lista al cambiar de idioma
        # sin volver a llamar a Python.
        "models": _models_for(language),
        "models_by_lang": {lang: _models_for(lang) for lang in WHISPER_LANGUAGES},
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
    if "language" in values:
        language = str(values["language"])
        if language not in WHISPER_LANGUAGES:
            raise ValueError("Idioma de transcripción no válido.")
        current["transcription_language"] = language
    if "tier" in values:
        tier = str(values["tier"])
        if tier not in _TIER_IDS:
            raise ValueError("Nivel de transcripción no válido.")
        current["transcription_tier"] = tier
    if "video_profile" in values:
        profile = str(values["video_profile"])
        if profile not in config.VIDEO_PROFILES:
            raise ValueError("Perfil de vídeo no válido.")
        current["video_profile"] = profile
    _save(current)
    return get_transcription_settings()
