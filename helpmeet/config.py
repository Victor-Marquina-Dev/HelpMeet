from pathlib import Path

# Raíz del proyecto y carpeta de datos
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CAPTURES_DIR = DATA_DIR / "captures"
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


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
