from pathlib import Path

# Raíz del proyecto y carpeta de datos
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CAPTURES_DIR = DATA_DIR / "captures"
DB_PATH = DATA_DIR / "helpmeet.sqlite"

# Cadena de conexión (SQLite; cambiar a PostgreSQL aquí en el futuro)
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Transcripción
WHISPER_MODEL = "medium"     # "base" | "small" | "medium"
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"
WHISPER_LANGUAGE = "es"

# "Pista" de vocabulario para que reconozca mejor términos técnicos.
# Puedes añadir aquí nombres de tus proyectos y palabras frecuentes.
WHISPER_INITIAL_PROMPT = (
    "Reunión técnica de programación. Términos frecuentes: endpoint, API, deploy, "
    "commit, branch, merge, pull request, frontend, backend, base de datos, query, "
    "token, bug, framework, repositorio, sprint, backlog, login, autenticación, "
    "servidor, despliegue, producción, staging."
)

# Atajo global para captura de pantalla
SCREENSHOT_HOTKEY = "<ctrl>+<shift>+s"


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
