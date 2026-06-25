import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Los recursos viajan con el programa; los datos personales NO. En una versión
# empaquetada, PROJECT_ROOT apunta al directorio temporal de PyInstaller, por lo
# que nunca debe usarse para SQLite, ajustes o grabaciones.
SOURCE_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = Path(getattr(sys, "_MEIPASS", SOURCE_ROOT))
LEGACY_DATA_DIR = SOURCE_ROOT / "data"
_LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
DATA_DIR = Path(os.environ.get("HELPMEET_DATA_DIR", _LOCAL_APPDATA / "Helpmeet"))
CAPTURES_DIR = DATA_DIR / "captures"
MEDIA_DIR = DATA_DIR / "media"
DB_PATH = DATA_DIR / "helpmeet.sqlite"

# Cadena de conexión (SQLite; cambiar a PostgreSQL aquí en el futuro)
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Transcripción
WHISPER_MODEL = "small"      # "base" (más rápido) | "small" (equilibrado) | "medium" (más preciso pero lento)
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"
WHISPER_LANGUAGE = "es"

# Cada cuántos segundos se procesa un trozo de audio (modo local en vivo)
CHUNK_SECONDS = 6

# Proveedor de transcripción:
#   True  -> Replicate: graba la reunión entera y la transcribe de una vez al
#            terminar (alta calidad, 1 cobro por reunión, sin texto en vivo).
#   False -> Local: modelo en tu PC, texto en vivo por trozos (gratis, privado).
USE_REPLICATE = True

# "Pista" de vocabulario para reconocer mejor términos técnicos.
# Desactivada (None) por defecto: con audio variado/silencios se "colaba" como
# texto transcrito. Actívala SOLO para reuniones técnicas reales poniendo aquí
# una frase con tus términos (ej. "Reunión de programación: endpoint, deploy, token").
WHISPER_INITIAL_PROMPT = None

# Atajo global para captura de pantalla
SCREENSHOT_HOTKEY = "<ctrl>+<shift>+s"

# Grabación de pantalla (video)
VIDEO_FPS = 30
VIDEO_CODEC = "libx264"
VIDEO_PRESET = "veryfast"   # rápido para no soltar fotogramas al grabar
VIDEO_CRF = "18"            # calidad alta (menor = mejor; 18 ≈ sin pérdida visible)
VIDEO_AUDIO_RATE = 48000

# Perfiles de calidad de grabación de pantalla (P-12). Permiten grabaciones más
# ligeras (menos CPU y espacio) o de máxima nitidez. `max_w/max_h = 0` = sin
# límite de resolución (la nativa del monitor). `crf` menor = más calidad/peso.
VIDEO_PROFILES = {
    "light":    {"label": "Ligero · 720p · 15 fps",       "max_w": 1280, "max_h": 720,  "fps": 15, "crf": "26"},
    "balanced": {"label": "Equilibrado · 1080p · 30 fps",  "max_w": 1920, "max_h": 1080, "fps": 30, "crf": "23"},
    "native":   {"label": "Nativo · máxima nitidez",       "max_w": 0,    "max_h": 0,    "fps": 30, "crf": "18"},
}
DEFAULT_VIDEO_PROFILE = "balanced"


def video_profile(name):
    """Devuelve el perfil de vídeo pedido, o el de por defecto si no es válido."""
    return VIDEO_PROFILES.get(name, VIDEO_PROFILES[DEFAULT_VIDEO_PROFILE])


def migrate_legacy_state() -> bool:
    """Copia el estado esencial de la versión de desarrollo una sola vez.

    No duplica `exports/`, `captures/` ni temporales (pueden ocupar varios GB).
    Sus rutas absolutas permanecen válidas en la BD y en settings. Las nuevas
    capturas y la nueva base sí se guardan desde ahora en LOCALAPPDATA.
    """
    if DATA_DIR.resolve() == LEGACY_DATA_DIR.resolve() or not LEGACY_DATA_DIR.exists():
        return False
    marker = DATA_DIR / ".legacy-migration-v1.json"
    if marker.exists():
        return False
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    copied = []
    for name in ("helpmeet.sqlite", "settings.json"):
        source = LEGACY_DATA_DIR / name
        target = DATA_DIR / name
        if source.exists() and not target.exists():
            shutil.copy2(source, target)
            copied.append(name)
    # Una recuperación pendiente sí debe acompañar a la BD; normalmente es
    # pequeña y borrarla equivaldría a perder una grabación interrumpida.
    legacy_recovery = LEGACY_DATA_DIR / "recovery"
    target_recovery = DATA_DIR / "recovery"
    if legacy_recovery.exists() and any(legacy_recovery.iterdir()):
        shutil.copytree(legacy_recovery, target_recovery, dirs_exist_ok=True)
        copied.append("recovery/")
    marker.write_text(json.dumps({
        "migrated_at": datetime.now().isoformat(),
        "legacy_data_dir": str(LEGACY_DATA_DIR),
        "copied": copied,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return bool(copied)


def ensure_dirs() -> None:
    migrate_legacy_state()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)


# Datos personales dentro de DATA_DIR. NO se incluye el marcador de migración:
# conservarlo evita que, tras borrar, se vuelvan a copiar datos antiguos de
# desarrollo al reiniciar.
_WIPE_FILES = ("helpmeet.sqlite", "settings.json")
_WIPE_DIRS = ("captures", "media", "recovery", "tmp_video", "tmp_audio")


def wipe_data_dir(data_dir=None) -> list[str]:
    """Borra los datos personales (base, ajustes, capturas, recuperación y
    temporales) de `data_dir` (por defecto DATA_DIR). Devuelve lo que borró.
    No toca la carpeta de exportación (son archivos del usuario)."""
    base = Path(data_dir) if data_dir else DATA_DIR
    removed: list[str] = []
    for name in _WIPE_FILES:
        target = base / name
        if target.exists():
            try:
                target.unlink()
                removed.append(name)
            except OSError:
                pass
    for sub in _WIPE_DIRS:
        target = base / sub
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
            removed.append(sub + "/")
    return removed
