"""Ajustes del usuario que se guardan entre sesiones en `data/settings.json`.

Los tokens sensibles (API key de Replicate + license token JWT) se guardan en
Windows Credential Manager. El archivo settings.json se ofusca con una clave
derivada de la maquina y el usuario para evitar lectura casual en texto plano.
"""
import base64
import hashlib
import json
import os
import platform
import socket
from pathlib import Path
from helpmeet import config
from helpmeet import secret_store

SETTINGS_PATH = config.DATA_DIR / "settings.json"
_SETTINGS_MAGIC = b"HMv1"  # prefijo que identifica archivos ofuscados

# P-11: cache en memoria de settings.json. Muchos getters lo leian en cada
# llamada (get_transcription_settings invoca varios). Se carga una vez y se
# refresca al guardar; `invalidate_cache()` lo limpia tras borrar/restaurar datos.
import threading as _threading
_cache_lock = _threading.Lock()
_cache: dict | None = None
_cache_path = None  # ruta para la que es valida la cache (los tests cambian SETTINGS_PATH)


def _derive_key() -> bytes:
    """Deriva una clave de ofuscacion a partir de datos de la maquina y usuario.

    No es cifrado fuerte -- evita la lectura casual del archivo en texto plano.
    Los secretos reales (API key, JWT) ya estan en Windows Credential Manager."""
    seed = f"{socket.gethostname()}:{os.environ.get('USERNAME', '')}:{platform.node()}"
    return hashlib.sha256(seed.encode()).digest()


def _xor_bytes(data: bytes, key: bytes) -> bytes:
    """XOR ciclico con la clave derivada."""
    key_len = len(key)
    return bytes(data[i] ^ key[i % key_len] for i in range(len(data)))


def _read_settings_file() -> str | None:
    """Lee el archivo de settings, soportando tanto formato ofuscado como legacy."""
    if not SETTINGS_PATH.exists():
        return None
    raw = SETTINGS_PATH.read_bytes()
    if raw.startswith(_SETTINGS_MAGIC):
        key = _derive_key()
        return _xor_bytes(raw[len(_SETTINGS_MAGIC):], key).decode("utf-8")
    return raw.decode("utf-8")


def _write_settings_file(content: str) -> None:
    """Escribe el archivo de settings con ofuscacion."""
    key = _derive_key()
    payload = content.encode("utf-8")
    obfuscated = _SETTINGS_MAGIC + _xor_bytes(payload, key)
    temporary = SETTINGS_PATH.with_suffix(".json.tmp")
    temporary.write_bytes(obfuscated)
    temporary.replace(SETTINGS_PATH)


def _load() -> dict:
    global _cache, _cache_path
    with _cache_lock:
        if _cache is None or _cache_path != SETTINGS_PATH:
            try:
                text = _read_settings_file()
                _cache = json.loads(text) if text else {}
            except Exception:
                _cache = {}
            _cache_path = SETTINGS_PATH
        return dict(_cache)  # copia: el llamador no muta la cache por accidente


def _save(data: dict) -> None:
    global _cache, _cache_path
    config.ensure_dirs()
    _write_settings_file(json.dumps(data, indent=2, ensure_ascii=False))
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


def get_export_dir() -> Path:
    p = _load().get("export_dir")
    return Path(p) if p else (config.DATA_DIR / "exports")


def set_export_dir(path: str) -> None:
    data = _load()
    data["export_dir"] = str(path)
    _save(data)


def get_ui_language() -> str:
    """Idioma de la UI. Por defecto 'es'."""
    value = _load().get("ui_language")
    return value if value in ("es", "en") else "es"


def set_ui_language(lang: str) -> None:
    """Guarda el idioma de la UI ('es' o 'en')."""
    data = _load()
    data["ui_language"] = lang
    _save(data)


def get_api_token() -> str:
    """Obtiene el token de Replicate. Prioridad: credential store > env var.

    La migracion desde settings.json legacy se hace una sola vez y el token
    se elimina del JSON tras migrarlo con exito al credential store."""
    secure = secret_store.get_secret()
    if secure:
        return secure

    data = _load()
    legacy = (data.get("api_token") or "").strip()
    if legacy:
        if not _looks_like_replicate_token(legacy):
            data.pop("api_token", None)
            _save(data)
            return os.environ.get("REPLICATE_API_TOKEN", "")
        try:
            secret_store.set_secret(legacy)
            data.pop("api_token", None)
            _save(data)
            _scrub_legacy_plaintext_token()
        except OSError:
            return legacy
        return legacy

    return os.environ.get("REPLICATE_API_TOKEN", "")


def _looks_like_replicate_token(token: str) -> bool:
    """Validación ligera: los tokens de Replicate empiezan con r8_."""
    return bool(token) and token.startswith("r8_")


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


# Texto que se antepone al `contexto.md` para orientar a la IA externa
# (Claude Code) desde la primera línea. Es plantilla por defecto y editable.
DEFAULT_AI_INSTRUCTIONS = """Actúa como un senior fullstack engineer + analista funcional con experiencia en proyectos enterprise y comunicación profesional.

Tu objetivo es ayudarme a:
- Resumir información (reuniones, textos, transcripciones)
- Redactar documentos profesionales
- Validar contenido antes de enviarlo a cliente
- Escribir correos claros y efectivos
- Organizar ideas de forma estructurada
- Detectar errores, redundancias o inconsistencias

CONTEXTO DE TRABAJO
Trabajo en proyectos tecnológicos (integraciones, APIs, sistemas como SAP, CRM, etc.).
Necesito respuestas prácticas, claras y listas para usar en contexto real (empresa/cliente).

REGLAS CRÍTICAS
- NO inventes información
- Usa SOLO lo que te proporciono
- Si algo no está claro o no se menciona, dilo explícitamente
- Diferencia entre:
  - lo que está confirmado
  - lo que es interpretación
- Evita contenido genérico o “relleno”

FORMA DE RESPONDER
Responde siempre:
- Claro y directo
- Estructurado (listas, secciones)
- Enfocado en ejecución (que pueda usarlo inmediatamente)
- Con lenguaje profesional pero natural (que no suene a IA)

TIPOS DE TAREAS

1. Resúmenes
- Resume por:
  - puntos clave
  - tareas pendientes
  - decisiones
- No agregues información adicional

2. Documentos
- Estructura clara (objetivo, contexto, contenido)
- Sin redundancias
- Nivel profesional (cliente/empresa)
- No incluir soluciones si no se piden

3. Correos
- Asunto claro
- Contexto breve
- Mensaje directo
- Acción esperada
- Cierre profesional

4. Validación
Cuando te pase contenido:
- Indica qué está correcto
- Qué falta
- Qué sobra o está repetido
- Qué no está alineado con la fuente

EXTRA IMPORTANTE
Si te pregunto:
“¿esto está bien?”
→ responde con criterio profesional real (no solo “sí”)

Si te pregunto:
“¿esto parece hecho por IA?”
→ evalúa tono, claridad y naturalidad

Si te pido mejorar algo:
→ hazlo sin cambiar el significado ni agregar información nueva

Responde siempre como si el resultado fuera a enviarse a un cliente o usarse en un entorno profesional real."""


def get_ai_instructions() -> str:
    val = _load().get("ai_instructions")
    return val if isinstance(val, str) and val.strip() else DEFAULT_AI_INSTRUCTIONS


def set_ai_instructions(text: str) -> None:
    """Guarda las instrucciones. Vacío = vuelve a la plantilla por defecto."""
    data = _load()
    data["ai_instructions"] = (text or "").strip()
    _save(data)


# Vosk necesita un modelo por idioma (a diferencia de Whisper, no autodetecta):
# el idioma elegido decide qué modelo se carga, no solo un flag al transcribir.
VOSK_LANGUAGES = {
    "es": "Español",
    "en": "Inglés",
}

# Niveles de calidad, de menor a mayor. Vosk solo tiene 2 tamaños reales por
# idioma en su catálogo oficial (a diferencia de los 4 de Whisper): el chico,
# pensado para tiempo real, y el grande, pensado para precisión offline.
# `download` es el tamaño aproximado que se baja la primera vez que se usa
# ese modelo.
VOSK_TIERS = [
    {"tier": "fast",     "label": "Más rápido (recomendado para tiempo real)", "download": "~40 MB"},
    {"tier": "accurate", "label": "Más preciso (más pesado)",                  "download": "~1,4-1,9 GB"},
]

# Modelo concreto del catálogo de Vosk (alphacephei.com/vosk/models) para cada
# (idioma, nivel). Nombres verificados contra el catálogo real, no adivinados.
VOSK_MODELS_BY_LANG = {
    "es": {"fast": "vosk-model-small-es-0.42", "accurate": "vosk-model-es-0.42"},
    "en": {"fast": "vosk-model-small-en-us-0.15", "accurate": "vosk-model-en-us-0.22"},
}

DEFAULT_TIER = "fast"
_TIER_IDS = {t["tier"] for t in VOSK_TIERS}
_TIER_ALIASES = {
    # Compatibilidad con ajustes escritos con el sistema anterior (Whisper,
    # 4 niveles) o manualmente: se colapsan a los 2 niveles reales de Vosk.
    "standard": "fast", "normal": "fast", "small": "fast", "balanced": "fast",
    "medium": "accurate", "max": "accurate",
}


def get_transcription_language() -> str:
    """Idioma elegido. Por defecto "es"."""
    value = _load().get("transcription_language")
    return value if value in VOSK_LANGUAGES else "es"


def get_transcription_tier() -> str:
    """Nivel de calidad elegido (fast/accurate). Por defecto fast."""
    value = str(_load().get("transcription_tier", "")).lower()
    value = _TIER_ALIASES.get(value, value)
    return value if value in _TIER_IDS else DEFAULT_TIER


def get_transcription_model() -> str:
    """Nombre concreto del modelo Vosk, derivado del idioma y el nivel elegidos."""
    return VOSK_MODELS_BY_LANG[get_transcription_language()][get_transcription_tier()]


def _models_for(language: str) -> list:
    """Lista de niveles con el modelo concreto que les toca en ese idioma."""
    from helpmeet.transcription.vosk_engine import model_is_downloaded
    result = []
    for t in VOSK_TIERS:
        model_id = VOSK_MODELS_BY_LANG[language][t["tier"]]
        result.append({
            "tier": t["tier"], "id": model_id,
            "label": t["label"], "download": t["download"],
            "downloaded": model_is_downloaded(model_id),
        })
    return result


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
        "default_mic_muted": bool(data.get("default_mic_muted", True)),
        "video_quality": "accurate",
        "video_profile": video_profile,
        "video_profiles": [{"id": pid, "label": p["label"]}
                           for pid, p in config.VIDEO_PROFILES.items()],
        "language": language,
        "language_label": VOSK_LANGUAGES[language],
        "languages": [{"id": lid, "label": label} for lid, label in VOSK_LANGUAGES.items()],
        "tier": tier,
        "model": get_transcription_model(),  # id concreto (para diagnóstico y motor)
        # Modelos por idioma, para que la UI cambie la lista al cambiar de idioma
        # sin volver a llamar a Python.
        "models": _models_for(language),
        "models_by_lang": {lang: _models_for(lang) for lang in VOSK_LANGUAGES},
        "export_dir": str(get_export_dir()),
    }


def get_consent_seen() -> bool:
    """Si el usuario ya aceptó el aviso de consentimiento de grabación."""
    return bool(_load().get("recording_consent_seen", False))


def set_consent_seen(seen: bool = True) -> None:
    current = _load()
    current["recording_consent_seen"] = bool(seen)
    _save(current)


def get_mini_indicator() -> bool:
    """Si al minimizar la ventana se muestra el indicador flotante.

    Por defecto SÍ: la transcripción sigue corriendo con la ventana minimizada y
    sin ninguna señal no hay forma de saberlo. Quien no lo quiera lo apaga.
    """
    return bool(_load().get("mini_indicator", True))


def set_mini_indicator(enabled: bool) -> None:
    data = _load()
    data["mini_indicator"] = bool(enabled)
    _save(data)


def get_setup_done() -> bool:
    """Si el usuario completó el asistente de primera ejecución."""
    return bool(_load().get("setup_done", False))


def set_setup_done(done: bool = True) -> None:
    data = _load()
    data["setup_done"] = bool(done)
    _save(data)


def get_last_activated_version() -> str:
    """Versión de la app en la que el usuario activó su licencia por última vez."""
    return _load().get("last_activated_version", "")


def set_last_activated_version(version: str) -> None:
    data = _load()
    data["last_activated_version"] = version
    _save(data)


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
        if language not in VOSK_LANGUAGES:
            raise ValueError("Idioma de transcripción no válido.")
        current["transcription_language"] = language
    if "tier" in values:
        tier = str(values["tier"]).lower()
        tier = _TIER_ALIASES.get(tier, tier)
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


_LIC_CRED_TARGET = "MimoTech.Helpmeet.LicenseToken"
_ADVAPI32 = "Advapi32.dll"


def _wincred_read(target: str) -> str:
    """Lee una credencial genérica de Windows Credential Manager por nombre."""
    import sys, ctypes, ctypes.wintypes as _wt
    if not sys.platform.startswith("win"):
        return ""
    try:
        _TYPE_GENERIC = 1

        class _FILETIME(ctypes.Structure):
            _fields_ = [("dwLowDateTime", _wt.DWORD), ("dwHighDateTime", _wt.DWORD)]

        class _CRED(ctypes.Structure):
            _fields_ = [
                ("Flags", _wt.DWORD), ("Type", _wt.DWORD),
                ("TargetName", _wt.LPWSTR), ("Comment", _wt.LPWSTR),
                ("LastWritten", _FILETIME), ("CredentialBlobSize", _wt.DWORD),
                ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                ("Persist", _wt.DWORD), ("AttributeCount", _wt.DWORD),
                ("Attributes", ctypes.c_void_p), ("TargetAlias", _wt.LPWSTR),
                ("UserName", _wt.LPWSTR),
            ]

        api = ctypes.WinDLL(_ADVAPI32, use_last_error=True)
        api.CredReadW.argtypes = [_wt.LPCWSTR, _wt.DWORD, _wt.DWORD,
                                  ctypes.POINTER(ctypes.POINTER(_CRED))]
        api.CredReadW.restype = _wt.BOOL
        api.CredFree.argtypes = [ctypes.c_void_p]
        ptr = ctypes.POINTER(_CRED)()
        if not api.CredReadW(target, _TYPE_GENERIC, 0, ctypes.byref(ptr)):
            return ""
        try:
            cred = ptr.contents
            if not cred.CredentialBlob or not cred.CredentialBlobSize:
                return ""
            raw = ctypes.string_at(cred.CredentialBlob, cred.CredentialBlobSize)
            return raw.decode("utf-16-le")
        finally:
            api.CredFree(ptr)
    except Exception:
        return ""


def _wincred_write(target: str, value: str) -> bool:
    """Escribe una credencial genérica en Windows Credential Manager. Devuelve True si OK."""
    import sys, os, ctypes, ctypes.wintypes as _wt
    if not sys.platform.startswith("win"):
        return False
    try:
        _TYPE_GENERIC = 1
        _PERSIST_LOCAL_MACHINE = 2

        class _FILETIME(ctypes.Structure):
            _fields_ = [("dwLowDateTime", _wt.DWORD), ("dwHighDateTime", _wt.DWORD)]

        class _CRED(ctypes.Structure):
            _fields_ = [
                ("Flags", _wt.DWORD), ("Type", _wt.DWORD),
                ("TargetName", _wt.LPWSTR), ("Comment", _wt.LPWSTR),
                ("LastWritten", _FILETIME), ("CredentialBlobSize", _wt.DWORD),
                ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                ("Persist", _wt.DWORD), ("AttributeCount", _wt.DWORD),
                ("Attributes", ctypes.c_void_p), ("TargetAlias", _wt.LPWSTR),
                ("UserName", _wt.LPWSTR),
            ]

        value = (value or "").strip()
        if not value:
            _wincred_delete(target)
            return True
        raw = value.encode("utf-16-le")
        if len(raw) > 5120:
            return False
        api = ctypes.WinDLL(_ADVAPI32, use_last_error=True)
        api.CredWriteW.argtypes = [ctypes.POINTER(_CRED), _wt.DWORD]
        api.CredWriteW.restype = _wt.BOOL
        blob = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
        cred = _CRED()
        cred.Type = _TYPE_GENERIC
        cred.TargetName = target
        cred.Comment = "Token de licencia Helpmeet"
        cred.CredentialBlobSize = len(raw)
        cred.CredentialBlob = ctypes.cast(blob, ctypes.POINTER(ctypes.c_ubyte))
        cred.Persist = _PERSIST_LOCAL_MACHINE
        cred.UserName = os.environ.get("USERNAME", "Helpmeet")
        return bool(api.CredWriteW(ctypes.byref(cred), 0))
    except Exception:
        return False


def _wincred_delete(target: str) -> None:
    """Elimina una credencial de Windows Credential Manager si existe."""
    import sys, ctypes, ctypes.wintypes as _wt
    if not sys.platform.startswith("win"):
        return
    try:
        api = ctypes.WinDLL(_ADVAPI32, use_last_error=True)
        api.CredDeleteW.argtypes = [_wt.LPCWSTR, _wt.DWORD, _wt.DWORD]
        api.CredDeleteW.restype = _wt.BOOL
        api.CredDeleteW(target, 1, 0)  # 1 = CRED_TYPE_GENERIC; ignora ERROR_NOT_FOUND
    except Exception:
        pass


def get_license_token() -> str | None:
    # Primero intenta leer del almacén seguro (Windows Credential Manager)
    val = _wincred_read(_LIC_CRED_TARGET)
    if val:
        return val
    # Fallback: JSON antiguo (instalaciones previas); migra automáticamente
    val = _load().get("license_token") or None
    if val and _wincred_write(_LIC_CRED_TARGET, val):
        # Migración exitosa: elimina del JSON
        data = _load()
        data.pop("license_token", None)
        _save(data)
    return val or None


def set_license_token(token: str) -> None:
    token = (token or "").strip()
    ok = _wincred_write(_LIC_CRED_TARGET, token)
    if not ok:
        # Fallback: guardar en settings.json si Windows rechazó la operación
        data = _load()
        if token:
            data["license_token"] = token
        else:
            data.pop("license_token", None)
        _save(data)
        return
    # Éxito en almacén seguro: limpiar cualquier valor residual del JSON
    data = _load()
    if "license_token" in data:
        data.pop("license_token", None)
        _save(data)


def get_last_license_check() -> str | None:
    return _load().get("last_license_check") or None


def set_last_license_check(iso_ts: str) -> None:
    data = _load()
    data["last_license_check"] = iso_ts
    _save(data)


def get_video_hours_used() -> float:
    """Horas acumuladas de transcripcion de video (para limite del plan Personal)."""
    return float(_load().get("video_hours_used", 0.0))


def add_video_hours(seconds: float) -> float:
    """Suma segundos de video transcrito y devuelve el nuevo total en horas."""
    current = get_video_hours_used()
    new_total = current + (max(0, float(seconds)) / 3600.0)
    data = _load()
    data["video_hours_used"] = new_total
    _save(data)
    return new_total
