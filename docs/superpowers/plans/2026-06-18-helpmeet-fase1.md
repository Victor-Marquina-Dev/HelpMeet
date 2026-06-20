# Helpmeet — Plan de implementación (Fase 1)

> **Para quien ejecuta:** SUB-SKILL REQUERIDO: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Goal:** Construir una app de escritorio en Python que transcriba reuniones de Meet en vivo, las guarde por iniciativa con capturas ligadas, y exporte el contexto a Claude Code.

**Architecture:** App de escritorio con interfaz `pywebview` (HTML interno). Backend Python con 6 componentes separados (audio, transcripción, capturas, almacenamiento, UI, exportación). Se construye de adentro hacia afuera: primero datos y lógica pura (testeable sin hardware), luego hardware (audio/captura), por último la interfaz.

**Tech Stack:** Python 3.12, `faster-whisper`, `pyaudiowpatch`, `mss`, `pynput`, `SQLAlchemy` + SQLite, `pywebview`, `pytest`.

**Spec de referencia:** `docs/superpowers/specs/2026-06-18-helpmeet-design.md`

---

## Estructura de archivos

```
Helpmeet/
├─ helpmeet/
│  ├─ __init__.py
│  ├─ config.py                # configuración central (rutas, modelo whisper, atajo)
│  ├─ db/
│  │  ├─ __init__.py
│  │  ├─ models.py             # modelos SQLAlchemy (Initiative, Meeting, Utterance, Capture)
│  │  ├─ database.py           # engine, sesión, init_db()
│  │  └─ repository.py         # funciones CRUD de alto nivel
│  ├─ transcription/
│  │  ├─ __init__.py
│  │  └─ engine.py             # envoltorio de faster-whisper
│  ├─ audio/
│  │  ├─ __init__.py
│  │  └─ capture.py            # captura micrófono + audio del sistema (loopback)
│  ├─ screenshot/
│  │  ├─ __init__.py
│  │  ├─ capture.py            # captura de pantalla (mss)
│  │  └─ hotkey.py             # atajo de teclado global (pynput)
│  ├─ export/
│  │  ├─ __init__.py
│  │  └─ exporter.py           # genera carpeta .md + imágenes para Claude
│  ├─ session/
│  │  ├─ __init__.py
│  │  └─ recorder.py           # orquesta audio→transcripción→guardado de una reunión
│  ├─ ui/
│  │  ├─ __init__.py
│  │  ├─ app.py                # ventana pywebview + API JS↔Python
│  │  └─ web/
│  │     ├─ index.html
│  │     ├─ style.css
│  │     └─ app.js
│  └─ main.py                  # punto de entrada de la app
├─ tests/
│  ├─ __init__.py
│  ├─ conftest.py              # fixtures comunes (BD temporal)
│  ├─ test_models.py
│  ├─ test_repository.py
│  ├─ test_exporter.py
│  └─ test_screenshot.py
├─ data/                       # BD y capturas (ignorado por git)
├─ assets/test/                # audios de muestra para pruebas
├─ requirements.txt
├─ .gitignore
└─ README.md
```

---

## Task 0: Preparar entorno y estructura del proyecto

**Files:**
- Create: `.gitignore`, `requirements.txt`, `README.md`
- Create: `helpmeet/__init__.py`, `helpmeet/config.py`
- Create: estructura de carpetas con `__init__.py` vacíos
- Create: `tests/__init__.py`, `tests/conftest.py`

- [ ] **Step 1: Instalar Python 3.12** (la 3.14 del Microsoft Store da problemas con librerías ML)

Run: `winget install -e --id Python.Python.3.12`
Verificar: `py -3.12 --version`
Expected: `Python 3.12.x`

- [ ] **Step 2: Crear entorno virtual con Python 3.12**

Run: `py -3.12 -m venv .venv`
Activar (PowerShell): `.\.venv\Scripts\Activate.ps1`
Verificar: `python --version` → `Python 3.12.x`

- [ ] **Step 3: Crear `.gitignore`**

```gitignore
.venv/
__pycache__/
*.pyc
data/
.superpowers/
assets/models/
*.sqlite
*.sqlite3
.pytest_cache/
```

- [ ] **Step 4: Crear `requirements.txt`**

```
faster-whisper==1.0.3
PyAudioWPatch==0.2.12.7
mss==9.0.1
pynput==1.7.7
SQLAlchemy==2.0.30
pywebview==5.1
pytest==8.2.0
```

- [ ] **Step 5: Instalar dependencias**

Run: `pip install -r requirements.txt`
Expected: instalación sin errores.

- [ ] **Step 6: Crear estructura de carpetas y `__init__.py`**

Crear los archivos `__init__.py` vacíos en: `helpmeet/`, `helpmeet/db/`, `helpmeet/transcription/`, `helpmeet/audio/`, `helpmeet/screenshot/`, `helpmeet/export/`, `helpmeet/session/`, `helpmeet/ui/`, `tests/`.

- [ ] **Step 7: Crear `helpmeet/config.py`**

```python
from pathlib import Path

# Raíz del proyecto y carpeta de datos
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CAPTURES_DIR = DATA_DIR / "captures"
DB_PATH = DATA_DIR / "helpmeet.sqlite"

# Cadena de conexión (SQLite; cambiar a PostgreSQL aquí en el futuro)
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Transcripción
WHISPER_MODEL = "small"      # "base" | "small" | "medium"
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"
WHISPER_LANGUAGE = "es"

# Atajo global para captura de pantalla
SCREENSHOT_HOTKEY = "<ctrl>+<shift>+s"

def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 8: Crear `tests/conftest.py`** (fixture de BD temporal en memoria)

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from helpmeet.db.models import Base

@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()
```

- [ ] **Step 9: Crear `README.md`** con instrucciones básicas de arranque (resumen del setup anterior).

- [ ] **Step 10: Inicializar git y primer commit**

```bash
git init
git add .
git commit -m "chore: estructura inicial del proyecto Helpmeet (Fase 1)"
```

---

## Task 1: Modelo de datos (SQLAlchemy)

**Files:**
- Create: `helpmeet/db/models.py`
- Test: `tests/test_models.py`

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_models.py
from datetime import datetime
from helpmeet.db.models import Initiative, Meeting, Utterance, Capture

def test_initiative_with_meeting_and_utterance(session):
    ini = Initiative(name="Sistema de Login")
    meeting = Meeting(title="Endpoints", started_at=datetime.now(), initiative=ini)
    utt = Utterance(speaker="me", text="hola", start_time=0.0, end_time=1.0, meeting=meeting)
    session.add(ini)
    session.commit()

    assert ini.id is not None
    assert meeting.initiative_id == ini.id
    assert ini.meetings[0].utterances[0].text == "hola"

def test_speaker_only_accepts_me_or_others(session):
    meeting = Meeting(title="t", started_at=datetime.now(), initiative=Initiative(name="x"))
    utt = Utterance(speaker="others", text="t", start_time=0.0, end_time=1.0, meeting=meeting)
    session.add(meeting)
    session.commit()
    assert utt.speaker == "others"
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `pytest tests/test_models.py -v`
Expected: FAIL con `ModuleNotFoundError` / `ImportError` (models aún no existe).

- [ ] **Step 3: Escribir la implementación mínima**

```python
# helpmeet/db/models.py
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Initiative(Base):
    __tablename__ = "initiatives"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    meetings: Mapped[list["Meeting"]] = relationship(back_populates="initiative", cascade="all, delete-orphan")

class Meeting(Base):
    __tablename__ = "meetings"
    id: Mapped[int] = mapped_column(primary_key=True)
    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"))
    title: Mapped[str] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    audio_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    initiative: Mapped["Initiative"] = relationship(back_populates="meetings")
    utterances: Mapped[list["Utterance"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")
    captures: Mapped[list["Capture"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")

class Utterance(Base):
    __tablename__ = "utterances"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    speaker: Mapped[str] = mapped_column(String(10))  # "me" | "others"
    text: Mapped[str] = mapped_column(Text)
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    meeting: Mapped["Meeting"] = relationship(back_populates="utterances")

class Capture(Base):
    __tablename__ = "captures"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    image_path: Mapped[str] = mapped_column(String(500))
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    near_utterance_id: Mapped[int | None] = mapped_column(ForeignKey("utterances.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    meeting: Mapped["Meeting"] = relationship(back_populates="captures")
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `pytest tests/test_models.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/db/models.py tests/test_models.py
git commit -m "feat(db): modelos Initiative, Meeting, Utterance, Capture"
```

---

## Task 2: Inicialización de la base de datos

**Files:**
- Create: `helpmeet/db/database.py`
- Test: cubierto por `tests/test_repository.py` (Task 3)

- [ ] **Step 1: Escribir `helpmeet/db/database.py`**

```python
# helpmeet/db/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from helpmeet import config
from helpmeet.db.models import Base

_engine = None
_SessionFactory = None

def init_db():
    """Crea la carpeta de datos, el engine y las tablas. Idempotente."""
    global _engine, _SessionFactory
    config.ensure_dirs()
    _engine = create_engine(config.DATABASE_URL)
    Base.metadata.create_all(_engine)
    _SessionFactory = sessionmaker(bind=_engine)
    return _engine

def get_session() -> Session:
    if _SessionFactory is None:
        init_db()
    return _SessionFactory()
```

- [ ] **Step 2: Verificación rápida en consola**

Run: `python -c "from helpmeet.db.database import init_db; init_db(); print('OK')"`
Expected: imprime `OK` y se crea `data/helpmeet.sqlite`.

- [ ] **Step 3: Commit**

```bash
git add helpmeet/db/database.py
git commit -m "feat(db): inicialización de SQLite con SQLAlchemy"
```

---

## Task 3: Repositorio CRUD

**Files:**
- Create: `helpmeet/db/repository.py`
- Test: `tests/test_repository.py`

- [ ] **Step 1: Escribir los tests que fallan**

```python
# tests/test_repository.py
from datetime import datetime
from helpmeet.db import repository as repo

def test_create_initiative_and_meeting(session):
    ini = repo.create_initiative(session, "Sistema de Login")
    meeting = repo.start_meeting(session, ini.id, "Endpoints")
    assert ini.id is not None
    assert meeting.initiative_id == ini.id
    assert meeting.ended_at is None

def test_add_utterance_and_end_meeting(session):
    ini = repo.create_initiative(session, "X")
    meeting = repo.start_meeting(session, ini.id, "M")
    u = repo.add_utterance(session, meeting.id, "me", "hola", 0.0, 1.2)
    repo.end_meeting(session, meeting.id)
    refreshed = repo.get_meeting(session, meeting.id)
    assert refreshed.utterances[0].text == "hola"
    assert refreshed.ended_at is not None

def test_add_capture_links_nearest_utterance(session):
    ini = repo.create_initiative(session, "X")
    meeting = repo.start_meeting(session, ini.id, "M")
    u = repo.add_utterance(session, meeting.id, "others", "mira el código", 5.0, 7.0)
    cap = repo.add_capture(session, meeting.id, "data/captures/c1.png", near_utterance_id=u.id)
    assert cap.near_utterance_id == u.id

def test_list_initiatives(session):
    repo.create_initiative(session, "A")
    repo.create_initiative(session, "B")
    assert {i.name for i in repo.list_initiatives(session)} == {"A", "B"}
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest tests/test_repository.py -v`
Expected: FAIL (`repository` no existe).

- [ ] **Step 3: Escribir la implementación**

```python
# helpmeet/db/repository.py
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting, Utterance, Capture

def create_initiative(session: Session, name: str, description: str | None = None) -> Initiative:
    ini = Initiative(name=name, description=description)
    session.add(ini)
    session.commit()
    return ini

def list_initiatives(session: Session) -> list[Initiative]:
    return list(session.scalars(select(Initiative).order_by(Initiative.created_at)))

def start_meeting(session: Session, initiative_id: int, title: str) -> Meeting:
    meeting = Meeting(initiative_id=initiative_id, title=title, started_at=datetime.now())
    session.add(meeting)
    session.commit()
    return meeting

def end_meeting(session: Session, meeting_id: int) -> None:
    meeting = session.get(Meeting, meeting_id)
    meeting.ended_at = datetime.now()
    session.commit()

def get_meeting(session: Session, meeting_id: int) -> Meeting:
    return session.get(Meeting, meeting_id)

def add_utterance(session: Session, meeting_id: int, speaker: str, text: str,
                  start_time: float, end_time: float) -> Utterance:
    utt = Utterance(meeting_id=meeting_id, speaker=speaker, text=text,
                    start_time=start_time, end_time=end_time)
    session.add(utt)
    session.commit()
    return utt

def add_capture(session: Session, meeting_id: int, image_path: str,
                near_utterance_id: int | None = None, note: str | None = None) -> Capture:
    cap = Capture(meeting_id=meeting_id, image_path=image_path,
                  near_utterance_id=near_utterance_id, note=note)
    session.add(cap)
    session.commit()
    return cap
```

- [ ] **Step 4: Ejecutar para verificar que pasan**

Run: `pytest tests/test_repository.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/db/repository.py tests/test_repository.py
git commit -m "feat(db): repositorio CRUD de iniciativas, reuniones, frases y capturas"
```

---

## Task 4: Exportador para Claude Code

**Files:**
- Create: `helpmeet/export/exporter.py`
- Test: `tests/test_exporter.py`

- [ ] **Step 1: Escribir los tests que fallan**

```python
# tests/test_exporter.py
from datetime import datetime
from pathlib import Path
from helpmeet.db import repository as repo
from helpmeet.export.exporter import export_meeting

def test_export_creates_md_and_captures_folder(session, tmp_path):
    ini = repo.create_initiative(session, "Sistema de Login")
    meeting = repo.start_meeting(session, ini.id, "Endpoints")
    u1 = repo.add_utterance(session, meeting.id, "me", "¿revisamos el endpoint?", 1.0, 3.0)
    u2 = repo.add_utterance(session, meeting.id, "others", "sí, da error 500", 4.0, 6.0)
    # crear una imagen ficticia
    img = tmp_path / "shot.png"
    img.write_bytes(b"PNG")
    repo.add_capture(session, meeting.id, str(img), near_utterance_id=u2.id)
    repo.end_meeting(session, meeting.id)

    out_dir = export_meeting(session, meeting.id, tmp_path / "out")

    md = out_dir / "contexto.md"
    assert md.exists()
    content = md.read_text(encoding="utf-8")
    assert "Sistema de Login" in content
    assert "Yo:" in content and "Los demás:" in content
    assert "error 500" in content
    assert (out_dir / "capturas").exists()
    assert any((out_dir / "capturas").iterdir())  # se copió la imagen
    assert "capturas/" in content  # referencia a la captura en el md
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `pytest tests/test_exporter.py -v`
Expected: FAIL (`exporter` no existe).

- [ ] **Step 3: Escribir la implementación**

```python
# helpmeet/export/exporter.py
import re
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from helpmeet.db.models import Meeting

SPEAKER_LABEL = {"me": "Yo", "others": "Los demás"}

def _slug(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    return re.sub(r"[\s_-]+", "-", text)

def _fmt_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"

def export_meeting(session: Session, meeting_id: int, base_dir: Path) -> Path:
    meeting: Meeting = session.get(Meeting, meeting_id)
    ini = meeting.initiative

    folder_name = f"{_slug(ini.name)}_{meeting.started_at:%Y-%m-%d}"
    out_dir = Path(base_dir) / folder_name
    captures_dir = out_dir / "capturas"
    out_dir.mkdir(parents=True, exist_ok=True)
    captures_dir.mkdir(parents=True, exist_ok=True)

    # copiar capturas y mapear utterance_id -> [nombres de archivo]
    captures_by_utt: dict[int, list[str]] = {}
    for idx, cap in enumerate(meeting.captures, start=1):
        src = Path(cap.image_path)
        dest_name = f"captura-{idx:02d}{src.suffix or '.png'}"
        if src.exists():
            shutil.copy(src, captures_dir / dest_name)
        captures_by_utt.setdefault(cap.near_utterance_id, []).append(dest_name)

    lines: list[str] = []
    lines.append(f"# Iniciativa: {ini.name}")
    end = f"{meeting.ended_at:%H:%M}" if meeting.ended_at else "en curso"
    lines.append(f"## Reunión: {meeting.title} — {meeting.started_at:%Y-%m-%d} "
                 f"({meeting.started_at:%H:%M}–{end})")
    lines.append("")

    for utt in sorted(meeting.utterances, key=lambda u: u.start_time):
        label = SPEAKER_LABEL.get(utt.speaker, utt.speaker)
        lines.append(f"[{_fmt_time(utt.start_time)}] {label}: {utt.text}")
        for name in captures_by_utt.get(utt.id, []):
            lines.append(f"        📷 (ver capturas/{name})")

    (out_dir / "contexto.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_dir
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `pytest tests/test_exporter.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add helpmeet/export/exporter.py tests/test_exporter.py
git commit -m "feat(export): exportador de reunión a carpeta .md + capturas para Claude"
```

---

## Task 5: Capturador de pantalla

**Files:**
- Create: `helpmeet/screenshot/capture.py`
- Test: `tests/test_screenshot.py`

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_screenshot.py
from pathlib import Path
from helpmeet.screenshot.capture import take_screenshot

def test_take_screenshot_creates_png(tmp_path):
    path = take_screenshot(tmp_path)
    p = Path(path)
    assert p.exists()
    assert p.suffix == ".png"
    assert p.stat().st_size > 0
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `pytest tests/test_screenshot.py -v`
Expected: FAIL (`capture` no existe).

- [ ] **Step 3: Escribir la implementación**

```python
# helpmeet/screenshot/capture.py
from datetime import datetime
from pathlib import Path
import mss

def take_screenshot(dest_dir, monitor_index: int = 1) -> str:
    """Captura el monitor indicado (1 = principal) y devuelve la ruta del PNG."""
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"capture_{datetime.now():%Y%m%d_%H%M%S_%f}.png"
    dest = dest_dir / filename
    with mss.mss() as sct:
        monitor = sct.monitors[monitor_index]
        img = sct.grab(monitor)
        mss.tools.to_png(img.rgb, img.size, output=str(dest))
    return str(dest)
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `pytest tests/test_screenshot.py -v`
Expected: PASS (requiere una sesión gráfica activa).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/screenshot/capture.py tests/test_screenshot.py
git commit -m "feat(screenshot): captura de pantalla con mss"
```

---

## Task 6: Atajo de teclado global

**Files:**
- Create: `helpmeet/screenshot/hotkey.py`

- [ ] **Step 1: Escribir la implementación**

```python
# helpmeet/screenshot/hotkey.py
from pynput import keyboard
from helpmeet import config

class HotkeyListener:
    """Escucha un atajo global y llama a un callback. No bloquea el hilo principal."""
    def __init__(self, on_trigger, hotkey: str = config.SCREENSHOT_HOTKEY):
        self._listener = keyboard.GlobalHotKeys({hotkey: on_trigger})

    def start(self):
        self._listener.start()

    def stop(self):
        self._listener.stop()
```

- [ ] **Step 2: Verificación manual**

Run un script temporal:
```python
from helpmeet.screenshot.hotkey import HotkeyListener
import time
HotkeyListener(lambda: print("¡ATAJO!")).start()
time.sleep(15)  # pulsa Ctrl+Shift+S durante estos 15s
```
Expected: imprime "¡ATAJO!" al pulsar el atajo.

- [ ] **Step 3: Commit**

```bash
git add helpmeet/screenshot/hotkey.py
git commit -m "feat(screenshot): atajo de teclado global con pynput"
```

---

## Task 7: Motor de transcripción

**Files:**
- Create: `helpmeet/transcription/engine.py`
- Test: manual con audio de muestra (la descarga del modelo y la inferencia no son aptas para test unitario rápido)

- [ ] **Step 1: Escribir la implementación**

```python
# helpmeet/transcription/engine.py
from dataclasses import dataclass
from faster_whisper import WhisperModel
from helpmeet import config

@dataclass
class TranscribedSegment:
    text: str
    start: float
    end: float

class TranscriptionEngine:
    """Envoltorio de faster-whisper. Carga el modelo una vez y transcribe audio."""
    def __init__(self):
        self._model = WhisperModel(
            config.WHISPER_MODEL,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
        )

    def transcribe_file(self, audio_path: str) -> list[TranscribedSegment]:
        segments, _ = self._model.transcribe(
            audio_path, language=config.WHISPER_LANGUAGE, vad_filter=True
        )
        return [TranscribedSegment(s.text.strip(), s.start, s.end) for s in segments]
```

- [ ] **Step 2: Verificación manual con audio de muestra**

Colocar un audio corto en `assets/test/sample_es.wav` y ejecutar:
```python
from helpmeet.transcription.engine import TranscriptionEngine
eng = TranscriptionEngine()
for seg in eng.transcribe_file("assets/test/sample_es.wav"):
    print(f"[{seg.start:.1f}-{seg.end:.1f}] {seg.text}")
```
Expected: imprime el texto transcrito en español (la primera vez descarga el modelo `small`).

- [ ] **Step 3: Commit**

```bash
git add helpmeet/transcription/engine.py
git commit -m "feat(transcription): envoltorio de faster-whisper (modelo small, CPU)"
```

---

## Task 8: Capturador de audio (micrófono + sistema)

**Files:**
- Create: `helpmeet/audio/capture.py`

- [ ] **Step 1: Escribir la implementación** (graba dos fuentes a archivos WAV temporales por trozos)

```python
# helpmeet/audio/capture.py
import wave
import threading
from pathlib import Path
import pyaudiowpatch as pyaudio

class DualAudioRecorder:
    """Graba micrófono ('me') y loopback del sistema ('others') en archivos WAV."""
    def __init__(self, dest_dir):
        self.dest_dir = Path(dest_dir)
        self.dest_dir.mkdir(parents=True, exist_ok=True)
        self._pa = pyaudio.PyAudio()
        self._running = False
        self._threads = []

    def _default_loopback(self):
        wasapi = self._pa.get_host_api_info_by_type(pyaudio.paWASAPI)
        default_out = self._pa.get_device_info_by_index(wasapi["defaultOutputDevice"])
        for i in range(self._pa.get_device_count()):
            dev = self._pa.get_device_info_by_index(i)
            if dev.get("isLoopbackDevice") and default_out["name"] in dev["name"]:
                return dev
        return None

    def _record(self, device_info, label):
        rate = int(device_info["defaultSampleRate"])
        channels = int(device_info["maxInputChannels"]) or 2
        path = self.dest_dir / f"{label}.wav"
        wf = wave.open(str(path), "wb")
        wf.setnchannels(channels)
        wf.setsampwidth(self._pa.get_sample_size(pyaudio.paInt16))
        wf.setframerate(rate)
        stream = self._pa.open(format=pyaudio.paInt16, channels=channels, rate=rate,
                               input=True, input_device_index=device_info["index"],
                               frames_per_buffer=1024)
        while self._running:
            wf.writeframes(stream.read(1024, exception_on_overflow=False))
        stream.stop_stream(); stream.close(); wf.close()

    def start(self):
        self._running = True
        mic = self._pa.get_device_info_by_index(self._pa.get_default_input_device_info()["index"])
        loop = self._default_loopback()
        targets = [(mic, "me")]
        if loop:
            targets.append((loop, "others"))
        for dev, label in targets:
            t = threading.Thread(target=self._record, args=(dev, label), daemon=True)
            t.start()
            self._threads.append(t)

    def stop(self):
        self._running = False
        for t in self._threads:
            t.join(timeout=2)
        self._pa.terminate()
```

- [ ] **Step 2: Verificación manual**

```python
from helpmeet.audio.capture import DualAudioRecorder
import time
r = DualAudioRecorder("data/tmp_audio"); r.start()
print("grabando 8s... habla y pon un video con sonido")
time.sleep(8); r.stop()
```
Expected: se crean `data/tmp_audio/me.wav` (tu voz) y `data/tmp_audio/others.wav` (sonido del sistema), ambos con contenido audible.

- [ ] **Step 3: Commit**

```bash
git add helpmeet/audio/capture.py
git commit -m "feat(audio): grabación dual micrófono + loopback del sistema"
```

---

## Task 9: Orquestador de sesión de grabación

**Files:**
- Create: `helpmeet/session/recorder.py`

Une audio + transcripción + guardado. Por trozos: cada N segundos cierra el WAV, lo transcribe y guarda las frases con el `speaker` correspondiente.

- [ ] **Step 1: Escribir la implementación**

```python
# helpmeet/session/recorder.py
import threading
import time
from pathlib import Path
from helpmeet import config
from helpmeet.db.database import get_session
from helpmeet.db import repository as repo
from helpmeet.audio.capture import DualAudioRecorder
from helpmeet.transcription.engine import TranscriptionEngine
from helpmeet.screenshot.capture import take_screenshot

class MeetingRecorder:
    """Orquesta una reunión: graba, transcribe por trozos y guarda en BD."""
    def __init__(self, initiative_id: int, title: str, engine: TranscriptionEngine,
                 chunk_seconds: int = 10, on_utterance=None):
        self.initiative_id = initiative_id
        self.title = title
        self.engine = engine
        self.chunk_seconds = chunk_seconds
        self.on_utterance = on_utterance  # callback(speaker, text, start, end) para la UI
        self._running = False
        self._session = get_session()
        self.meeting = None
        self._last_utterance_id = None
        self._tmp = config.DATA_DIR / "tmp_audio"

    def start(self):
        self.meeting = repo.start_meeting(self._session, self.initiative_id, self.title)
        self._running = True
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        elapsed = 0.0
        while self._running:
            rec = DualAudioRecorder(self._tmp)
            rec.start()
            time.sleep(self.chunk_seconds)
            rec.stop()
            for label, fname in (("me", "me.wav"), ("others", "others.wav")):
                wav = self._tmp / fname
                if not wav.exists():
                    continue
                for seg in self.engine.transcribe_file(str(wav)):
                    if not seg.text:
                        continue
                    u = repo.add_utterance(self._session, self.meeting.id, label,
                                           seg.text, elapsed + seg.start, elapsed + seg.end)
                    self._last_utterance_id = u.id
                    if self.on_utterance:
                        self.on_utterance(label, seg.text, u.start_time, u.end_time)
            elapsed += self.chunk_seconds

    def capture_screenshot(self):
        path = take_screenshot(config.CAPTURES_DIR)
        repo.add_capture(self._session, self.meeting.id, path,
                         near_utterance_id=self._last_utterance_id)
        return path

    def stop(self):
        self._running = False
        time.sleep(0.3)
        repo.end_meeting(self._session, self.meeting.id)
```

- [ ] **Step 2: Verificación manual** (con micrófono real)

```python
from helpmeet.db.database import init_db, get_session
from helpmeet.db import repository as repo
from helpmeet.transcription.engine import TranscriptionEngine
from helpmeet.session.recorder import MeetingRecorder
import time
init_db()
s = get_session()
ini = repo.create_initiative(s, "Prueba")
rec = MeetingRecorder(ini.id, "Test", TranscriptionEngine(),
                      on_utterance=lambda sp, t, a, b: print(f"{sp}: {t}"))
rec.start(); time.sleep(25); rec.stop()
```
Expected: imprime frases transcritas mientras hablas.

- [ ] **Step 3: Commit**

```bash
git add helpmeet/session/recorder.py
git commit -m "feat(session): orquestador de reunión (audio+transcripción+guardado por trozos)"
```

---

## Task 10: Interfaz (pywebview) y wiring

**Files:**
- Create: `helpmeet/ui/app.py`, `helpmeet/ui/web/index.html`, `helpmeet/ui/web/style.css`, `helpmeet/ui/web/app.js`

- [ ] **Step 1: Crear `helpmeet/ui/app.py`** (API que la web llama)

```python
# helpmeet/ui/app.py
import webview
from pathlib import Path
from helpmeet.db.database import init_db, get_session
from helpmeet.db import repository as repo
from helpmeet.transcription.engine import TranscriptionEngine
from helpmeet.session.recorder import MeetingRecorder
from helpmeet.export.exporter import export_meeting
from helpmeet import config

class Api:
    def __init__(self):
        init_db()
        self._session = get_session()
        self._engine = None
        self._recorder = None
        self._window = None

    def set_window(self, window):
        self._window = window

    def list_initiatives(self):
        return [{"id": i.id, "name": i.name} for i in repo.list_initiatives(self._session)]

    def create_initiative(self, name):
        i = repo.create_initiative(self._session, name)
        return {"id": i.id, "name": i.name}

    def start_recording(self, initiative_id, title):
        if self._engine is None:
            self._engine = TranscriptionEngine()
        self._recorder = MeetingRecorder(
            int(initiative_id), title, self._engine,
            on_utterance=self._push_utterance,
        )
        self._recorder.start()
        return {"ok": True}

    def _push_utterance(self, speaker, text, start, end):
        if self._window:
            safe = text.replace("\\", "\\\\").replace("'", "\\'")
            self._window.evaluate_js(f"addUtterance('{speaker}', '{safe}')")

    def take_capture(self):
        if self._recorder:
            self._recorder.capture_screenshot()
            return {"ok": True}
        return {"ok": False}

    def stop_recording(self):
        if self._recorder:
            self._recorder.stop()
        return {"ok": True}

    def export(self):
        if self._recorder and self._recorder.meeting:
            out = export_meeting(self._session, self._recorder.meeting.id,
                                 config.DATA_DIR / "exports")
            return {"path": str(out)}
        return {"path": None}

def run():
    api = Api()
    web_dir = Path(__file__).parent / "web"
    window = webview.create_window("Helpmeet", str(web_dir / "index.html"),
                                   js_api=api, width=1100, height=720)
    api.set_window(window)
    webview.start()
```

- [ ] **Step 2: Crear `helpmeet/ui/web/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <span class="logo">◆ Helpmeet</span>
    <select id="initiative"></select>
    <button id="newIni">+ Iniciativa</button>
    <span class="spacer"></span>
    <button id="btnRec" class="rec">● Grabar</button>
    <button id="btnCap" class="cap" disabled>📷 Captura</button>
    <button id="btnExp" class="exp" disabled>⬆ Exportar</button>
  </header>
  <main id="transcript"></main>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Crear `helpmeet/ui/web/style.css`**

```css
body{margin:0;font-family:Segoe UI,system-ui;background:#0f1419;color:#cbd3e1}
header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#151b24;border-bottom:1px solid #2a3140}
.logo{color:#3b82f6;font-weight:700}.spacer{flex:1}
button{background:#2a3140;color:#cbd3e1;border:0;border-radius:6px;padding:6px 12px;cursor:pointer}
button.rec{background:#ef4444}button.cap{background:#3b82f6}button.exp{background:#22c55e}
button:disabled{opacity:.4;cursor:default}
select{background:#1f2937;color:#cbd3e1;border:0;border-radius:20px;padding:5px 10px}
main{padding:16px;overflow-y:auto;height:calc(100vh - 56px)}
.row{margin-bottom:10px;line-height:1.5}
.me b{color:#3b82f6}.others b{color:#22c55e}
```

- [ ] **Step 4: Crear `helpmeet/ui/web/app.js`**

```javascript
const $ = (id) => document.getElementById(id);

async function refreshInitiatives() {
  const list = await window.pywebview.api.list_initiatives();
  $('initiative').innerHTML = list.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
}

function addUtterance(speaker, text) {
  const div = document.createElement('div');
  div.className = 'row ' + speaker;
  const label = speaker === 'me' ? 'Yo' : 'Los demás';
  div.innerHTML = `<b>${label}:</b> ${text}`;
  $('transcript').appendChild(div);
  window.scrollTo(0, document.body.scrollHeight);
}

window.addEventListener('pywebviewready', refreshInitiatives);

$('newIni').onclick = async () => {
  const name = prompt('Nombre de la iniciativa:');
  if (name) { await window.pywebview.api.create_initiative(name); refreshInitiatives(); }
};
$('btnRec').onclick = async () => {
  const id = $('initiative').value;
  await window.pywebview.api.start_recording(id, 'Reunión');
  $('btnRec').disabled = true; $('btnCap').disabled = false; $('btnExp').disabled = false;
};
$('btnCap').onclick = () => window.pywebview.api.take_capture();
$('btnExp').onclick = async () => {
  const r = await window.pywebview.api.stop_recording();
  const e = await window.pywebview.api.export();
  alert('Exportado en: ' + e.path);
  $('btnRec').disabled = false; $('btnCap').disabled = true;
};
```

- [ ] **Step 5: Verificación manual**

Run: `python -m helpmeet.main`
Expected: se abre la ventana; puedes crear iniciativa, grabar, ver frases, capturar y exportar.

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/
git commit -m "feat(ui): ventana pywebview con grabación, captura y exportación en vivo"
```

---

## Task 11: Punto de entrada y prueba end-to-end

**Files:**
- Create: `helpmeet/main.py`

- [ ] **Step 1: Crear `helpmeet/main.py`**

```python
# helpmeet/main.py
from helpmeet.ui.app import run

if __name__ == "__main__":
    run()
```

- [ ] **Step 2: Prueba completa manual**

Run: `python -m helpmeet.main`
Flujo: crear iniciativa → Grabar → hablar y poner un video con voz → 📷 Captura → Exportar → revisar la carpeta generada con `contexto.md` + `capturas/`.

- [ ] **Step 3: Ejecutar toda la batería de tests**

Run: `pytest -v`
Expected: todos los tests en verde.

- [ ] **Step 4: Commit final**

```bash
git add helpmeet/main.py
git commit -m "feat: punto de entrada y app Helpmeet Fase 1 completa"
```

---

## Seguimiento de progreso

Marca cada tarea al completarla (esto se refleja también en el documento de diseño):

- [x] Task 0 — Entorno y estructura
- [x] Task 1 — Modelo de datos
- [x] Task 2 — Inicialización BD
- [x] Task 3 — Repositorio CRUD
- [x] Task 4 — Exportador para Claude
- [x] Task 5 — Capturador de pantalla
- [x] Task 6 — Atajo de teclado global
- [x] Task 7 — Motor de transcripción
- [~] Task 8 — Capturador de audio (sistema verificado; micrófono pendiente de hardware)
- [x] Task 9 — Orquestador de sesión
- [ ] Task 10 — Interfaz pywebview
- [ ] Task 11 — Punto de entrada y E2E
