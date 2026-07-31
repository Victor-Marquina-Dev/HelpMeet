import os
import sys
import time
import wave
import json
import base64
import queue
import logging
import threading
import tempfile
import subprocess
import shutil
import traceback
import webview
from pathlib import Path
from datetime import timedelta
from helpmeet.db.database import init_db, get_session
from helpmeet.db import repository as repo
from helpmeet.constants import MONTHS_ES
from helpmeet.utils import wav_seconds, human_size

# Mixins: organizan ~70 metodos de Api por dominio
from helpmeet.ui.api.api_initiatives import InitiativeApiMixin
from helpmeet.ui.api.api_meetings import MeetingApiMixin
from helpmeet.ui.api.api_recording import RecordingApiMixin
from helpmeet.ui.api.api_export import ExportApiMixin
from helpmeet.ui.api.api_settings import SettingsApiMixin
from helpmeet.ui.api.api_licenses import LicenseApiMixin
from helpmeet.ui.api.api_search import SearchApiMixin
# El motor de transcripción (Vosk) se importa de forma perezosa dentro de los
# metodos que lo crean: cargar el modelo tarda un momento y la ventana no lo
# necesita para abrirse, solo al grabar/transcribir.
from helpmeet.session.recorder import MeetingRecorder
from helpmeet.export.exporter import (
    export_meeting, export_initiative, meeting_export_dir, build_meeting_context,
    build_transcript_txt, transcript_filename, export_transcript_package,
    transcript_package_filename, organize_meeting_folder, initiative_export_dir,
)
from helpmeet import config
from helpmeet import settings
from helpmeet import documents
from helpmeet.version import __version__

# Log de errores en %LOCALAPPDATA%\Helpmeet\helpmeet.log
def _setup_logger():
    log_path = config.DATA_DIR / "helpmeet.log"
    try:
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        h = logging.FileHandler(log_path, encoding="utf-8")
        h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        lg = logging.getLogger("helpmeet")
        lg.setLevel(logging.DEBUG)
        lg.addHandler(h)
    except Exception:
        pass

_setup_logger()
_log = logging.getLogger("helpmeet")


def _hook_exceptions():
    """Captura excepciones no manejadas en el hilo principal y en hilos secundarios."""
    def _excepthook(exc_type, exc_value, exc_tb):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_tb)
            return
        _log.critical("Excepción no capturada", exc_info=(exc_type, exc_value, exc_tb))
    sys.excepthook = _excepthook

    def _thread_excepthook(args):
        if args.exc_type and not issubclass(args.exc_type, SystemExit):
            _log.critical(
                "Excepción no capturada en hilo '%s'",
                getattr(args.thread, 'name', '?'),
                exc_info=(args.exc_type, args.exc_value, args.exc_tb),
            )
    threading.excepthook = _thread_excepthook

_hook_exceptions()


ARCHIVE_FOLDER_NAME = "Archivados"


def _version_newer(latest: str, current: str) -> bool:
    """Compara versiones semanticas: True si latest > current."""
    try:
        lp = [int(x) for x in latest.split(".")]
        cp = [int(x) for x in current.split(".")]
        while len(lp) < len(cp): lp.append(0)
        while len(cp) < len(lp): cp.append(0)
        return lp > cp
    except Exception:
        return False


def _archive_root() -> Path:
    root = settings.get_export_dir() / ARCHIVE_FOLDER_NAME
    root.mkdir(parents=True, exist_ok=True)
    return root


def _is_inside(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _remap_path(value, source_dir: Path, dest_dir: Path) -> str | None:
    if not value:
        return value
    try:
        path = Path(value)
        rel = path.resolve().relative_to(source_dir.resolve())
        return str(dest_dir / rel)
    except Exception:
        return value


def _remap_meeting_paths(meeting, source_dir: Path, dest_dir: Path) -> None:
    meeting.audio_path = _remap_path(meeting.audio_path, source_dir, dest_dir)
    for cap in getattr(meeting, "captures", []) or []:
        cap.image_path = _remap_path(cap.image_path, source_dir, dest_dir)


def _remove_empty_export_parents(path: Path, stop_at: Path) -> None:
    current = path.parent
    stop = stop_at.resolve()
    while current.exists() and current.resolve() != stop:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def _move_managed_folder(source: Path, dest: Path) -> bool:
    """Mueve una carpeta Helpmeet si existe; devuelve True si movió algo."""
    if not source.exists() or not source.is_dir():
        return False
    if source.resolve() == dest.resolve():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        raise FileExistsError(f"La carpeta de destino ya existe: {dest}")
    shutil.move(str(source), str(dest))
    return True


def _delete_archived_folder(path: Path) -> bool:
    root = _archive_root()
    if not path.exists():
        return False
    if not _is_inside(path, root):
        raise ValueError("Por seguridad, solo se eliminan carpetas dentro de Archivados.")
    shutil.rmtree(path)
    return True


class _JobCancelled(Exception):
    """Excepción interna: el usuario canceló la transcripción."""


_MONTHS_ES = (
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
)

_NATIVE_ICON_REFS = []


def _set_windows_app_identity() -> None:
    """Separa Helpmeet de Python en la barra de tareas de Windows."""
    if not sys.platform.startswith("win"):
        return
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            "MimoTech.Helpmeet.Desktop"
        )
    except Exception:
        pass


_SINGLE_INSTANCE_MUTEX_NAME = "HelpmeetApp_SingleInstance_9F3A2E1B"
_ERROR_ALREADY_EXISTS = 183


def _acquire_single_instance():
    """Evita abrir varias ventanas: si ya hay una Helpmeet corriendo, la
    trae al frente y devuelve None (para no crear otra). Si no había
    ninguna, devuelve el handle del mutex (hay que mantenerlo vivo mientras
    corre la app, si se libera antes de tiempo el bloqueo deja de aplicar)."""
    if not sys.platform.startswith("win"):
        return True
    try:
        import ctypes
        handle = ctypes.windll.kernel32.CreateMutexW(
            None, False, _SINGLE_INSTANCE_MUTEX_NAME
        )
        if ctypes.windll.kernel32.GetLastError() == _ERROR_ALREADY_EXISTS:
            hwnd = ctypes.windll.user32.FindWindowW(None, "Helpmeet")
            if hwnd:
                if ctypes.windll.user32.IsIconic(hwnd):
                    ctypes.windll.user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                ctypes.windll.user32.SetForegroundWindow(hwnd)
            return None
        return handle
    except Exception:
        return True


def _apply_dark_titlebar(hwnd: int) -> None:
    """Pinta la barra de título oscura y con el color de la app (Win11 DWM API)."""
    try:
        import ctypes
        import ctypes.wintypes
        dwmapi = ctypes.WinDLL("dwmapi")

        def _dwm_set(attr: int, value: ctypes.c_uint | ctypes.c_int) -> None:
            dwmapi.DwmSetWindowAttribute(
                ctypes.wintypes.HWND(hwnd), ctypes.wintypes.DWORD(attr),
                ctypes.byref(value), ctypes.sizeof(value),
            )

        # Modo oscuro: texto blanco, botones oscuros (Win10 20H1+)
        _dwm_set(20, ctypes.c_int(1))   # DWMWA_USE_IMMERSIVE_DARK_MODE

        # Fondo de la barra: #121413 → BGR = 0x131412
        _dwm_set(35, ctypes.c_uint(0x131412))  # DWMWA_CAPTION_COLOR

        # Texto: casi blanco
        _dwm_set(36, ctypes.c_uint(0xD8E0DC))  # DWMWA_TEXT_COLOR

        # Borde: oscuro neutro
        _dwm_set(34, ctypes.c_uint(0x1E201F))  # DWMWA_BORDER_COLOR
    except Exception:
        pass


def _apply_native_window_icon(window, icon_path: Path) -> None:
    """Aplica el .ico y el tema oscuro a WinForms después de que pywebview cree la ventana."""
    if not sys.platform.startswith("win") or not window.events.shown.wait(15):
        return
    try:
        import ctypes
        from System import Action, IntPtr
        from System.Drawing import Icon
        from webview.platforms.winforms import BrowserView

        form = BrowserView.instances.get(window.uid)
        if form is None:
            return
        icon = Icon(str(icon_path))          # sin restricción de tamaño: carga el mejor frame
        icon_big = Icon(str(icon_path), 32, 32)
        _NATIVE_ICON_REFS.extend([icon, icon_big])

        def assign():
            form.Icon = icon
            try:
                hwnd = form.Handle.ToInt64()
                # Forzar WM_SETICON en la ventana para que la barra de tareas lo recoja
                WM_SETICON = 0x0080
                hicon_big = icon.Handle.ToInt64()
                hicon_sm  = icon_big.Handle.ToInt64()
                ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, 1, hicon_big)  # ICON_BIG
                ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, 0, hicon_sm)   # ICON_SMALL
                # Notificar al shell para que refresque la caché de iconos
                ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x0000, None, None)
                _apply_dark_titlebar(hwnd)
            except Exception:
                pass

        if form.InvokeRequired:
            form.Invoke(Action(assign))
        else:
            assign()
    except Exception:
        # El favicon SVG sigue funcionando aunque cambie el backend de pywebview.
        pass


def _spanish_date(value) -> str:
    return f"{value.day} de {_MONTHS_ES[value.month - 1]} {value.year}"


def _spanish_month(value) -> str:
    return f"{_MONTHS_ES[value.month - 1]} {value.year}"


def _fmt_12h(value) -> str:
    """Hora en formato 12h con AM/PM y sin cero inicial (ej. `7:08 PM`)."""
    return value.strftime("%I:%M %p").lstrip("0")


def _human_size(path) -> str:
    """Tamaño legible del archivo (KB/MB/GB). Cadena vacía si no existe."""
    try:
        if not path:
            return ""
        n = os.path.getsize(path)
    except OSError:
        return ""
    units = ("B", "KB", "MB", "GB", "TB")
    size = float(n)
    i = 0
    while size >= 1024 and i < len(units) - 1:
        size /= 1024
        i += 1
    if i == 0:
        return f"{int(size)} {units[i]}"
    return f"{size:.1f} {units[i]}"


def _initiative_payload(i) -> dict:
    """Dict de una iniciativa para la UI (incluye color y fecha de creación)."""
    return {
        "id": i.id,
        "name": i.name,
        "description": i.description or "",
        "color": i.color or "",
        "created_at": i.created_at.isoformat() if i.created_at else "",
        "pinned": i.pinned_at is not None,
    }


def _friendly_model_error(exc: Exception) -> str:
    """Mensaje claro cuando el modelo de transcripción no se puede preparar.

    El fallo típico en otro PC es que el modelo no llegó a descargarse bien (la
    primera vez necesita internet): error «Unable to open file model.bin»."""
    low = str(exc).lower()
    download_hints = ("model.bin", "unable to open file", "couldn't find",
                      "connection", "could not download", "huggingface", "timed out")
    if any(hint in low for hint in download_hints):
        return ("No se pudo preparar el modelo de transcripción. La primera vez "
                "necesita conexión a internet para descargarlo (~480 MB). "
                "Conéctate a internet y vuelve a intentarlo.")
    return str(exc)


def _wav_seconds(path) -> float:
    """Duración en segundos de un WAV (0 si falla)."""
    try:
        with wave.open(str(path), "rb") as wf:
            return wf.getnframes() / (wf.getframerate() or 1)
    except Exception:
        return 0.0


def _open_in_explorer(path: str) -> None:
    """Abre una carpeta/archivo en el explorador del sistema operativo."""
    p = str(path)
    try:
        if sys.platform.startswith("win"):
            os.startfile(p)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", p])
        else:
            subprocess.Popen(["xdg-open", p])
    except Exception:
        pass


def _reveal_in_explorer(path: str) -> None:
    """Abre la CARPETA que contiene el archivo, con el archivo seleccionado.

    En Windows `os.startfile` sobre un .mp4 lo reproduce; esto en cambio muestra
    la carpeta y resalta el archivo, para que el usuario lo encuentre.
    """
    p = str(path)
    try:
        if sys.platform.startswith("win"):
            subprocess.Popen(f'explorer /select,"{p}"')
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-R", p])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(p)])
    except Exception:
        pass


def _import_meetings_from_folder(session, initiative, init_folder):
    """Importa reuniones desde la estructura de carpetas de una versión anterior.

    Estructura esperada:
      <init_folder>/<YYYY-MM mes>/<YYYY-MM-DD_HH-MM-SS_NNNN>/
        grabacion.mp4   (opcional)
        transcripcion.md
    """
    import re
    from datetime import datetime
    from helpmeet.db.models import Meeting, Utterance

    FOLDER_RE = re.compile(r'^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_\d+$')
    UTT_RE = re.compile(r'^\[(\d+):(\d+)\] ([^:]+): (.+)$')

    for month_dir in sorted(init_folder.iterdir()):
        if not month_dir.is_dir():
            continue
        for meeting_dir in sorted(month_dir.iterdir()):
            if not meeting_dir.is_dir():
                continue
            m = FOLDER_RE.match(meeting_dir.name)
            if not m:
                continue
            date_str, time_str = m.group(1), m.group(2).replace('-', ':')
            try:
                started_at = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
            # Título desde el .md o generar uno
            title = meeting_dir.name
            md_path = meeting_dir / "transcripcion.md"
            if md_path.exists():
                for line in md_path.read_text(encoding="utf-8").splitlines():
                    if line.startswith("## Reuni"):
                        title = line.split(":", 1)[-1].strip() if ":" in line else line.strip()
                        break
            # Ruta de vídeo
            video_path = None
            for ext in (".mp4", ".mkv", ".webm", ".mov", ".avi"):
                candidate = meeting_dir / f"grabacion{ext}"
                if candidate.exists():
                    video_path = str(candidate)
                    break
            # Parsear utterances del .md antes de crear el meeting
            utterance_objects = []
            if md_path.exists():
                lines = md_path.read_text(encoding="utf-8").splitlines()
                parsed = []
                for line in lines:
                    um = UTT_RE.match(line.strip())
                    if um:
                        mins, secs = int(um.group(1)), int(um.group(2))
                        raw_speaker = um.group(3).strip()
                        parsed.append({
                            "speaker": "me" if raw_speaker.lower() in ("yo", "me") else "others",
                            "text": um.group(4).strip(),
                            "start": float(mins * 60 + secs),
                        })
                for idx, p in enumerate(parsed):
                    end = parsed[idx + 1]["start"] if idx + 1 < len(parsed) else p["start"] + 5.0
                    utterance_objects.append(Utterance(
                        speaker=p["speaker"],
                        text=p["text"],
                        start_time=p["start"],
                        end_time=end,
                    ))
            # Crear meeting con utterances en la misma transacción (evita orphan-cascade)
            meeting = Meeting(
                initiative_id=initiative.id,
                title=title,
                started_at=started_at,
                audio_path=video_path,
                utterances=utterance_objects,
            )
            session.add(meeting)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise


class Api(InitiativeApiMixin, MeetingApiMixin, RecordingApiMixin, ExportApiMixin, SettingsApiMixin, LicenseApiMixin, SearchApiMixin):
    import os as _os
    _LICENSE_SERVER = _os.environ.get(
        "HELPMEET_LICENSE_SERVER",
        "https://helpmeet-licenses.fly.dev",
    )

    def __init__(self):
        _log.info("Inicializando base de datos")
        try:
            init_db()
            _log.info("Base de datos lista")
        except Exception:
            _log.exception("Error al inicializar la base de datos")
            raise
        settings.apply_env()  # vuelca el token guardado a la variable de entorno
        self._session = get_session()
        self._engine = None
        self._engine_provider = None
        self._engine_model = None
        self._local_engine = None
        self._recorder = None
        self._last_meeting_id = None
        self._screen_rec = None
        self._screen_active = False     # True mientras se graba pantalla
        self._screen_saving = False     # True mientras se muxea el vídeo en 2.º plano
        self._screen_meeting_id = None  # reunión asociada a la grabación de pantalla
        self._screen_preview = None     # vista previa EN ESPERA (antes de grabar)
        self._screen_transform = None   # (x,y,w,h) normalizado: colocación libre OBS
        self._window = None
        self._setup_running = False     # True mientras run_setup() trabaja en 2.º plano
        # Transcripción en segundo plano: cola serie + hilo worker. Permite
        # detener una grabación y empezar otra al instante mientras la anterior
        # se transcribe por detrás (una a una).
        self._jobs = None
        self._jobs_lock = threading.Lock()
        self._jobs_info = {}   # meeting_id -> {meeting_id, title, initiative_id, state, progress, stage}
        self._cancel_jobs = set()  # meeting_ids marcados para cancelar
        self._worker = None

    def set_window(self, window):
        self._window = window

    def set_media_server(self, server):
        self._media_server = server

    def get_media_video_url(self, meeting_id):
        """URL local para reproducir el vídeo de la reunión en un <video>."""
        srv = getattr(self, "_media_server", None)
        if not srv:
            return None
        return srv.url_for(int(meeting_id))

    def list_initiatives(self):
        return [_initiative_payload(i) for i in repo.list_initiatives(self._session)]

    # ---------- Documentos → Markdown ----------
    def _documents_dir(self, initiative_id):
        """Carpeta `documentos/` del proyecto, dentro de la carpeta de exportacion."""
        from helpmeet.db.models import Initiative
        ini = self._session.get(Initiative, int(initiative_id))
        if ini is None:
            return None
        base = settings.get_export_dir()
        return initiative_export_dir(ini, base) / "documentos"

    def list_document_initiatives(self):
        """Proyectos para el desplegable de la pantalla Documentos."""
        return [
            {"id": i.id, "name": i.name, "color": i.color or ""}
            for i in repo.list_initiatives(self._session)
        ]

    def pick_and_convert_documents(self, initiative_id, ocr="auto", extract_images=False):
        """Abre el diálogo, convierte cada archivo y guarda original + .md.

        Corre en el hilo de la llamada JS (no bloquea la ventana). Es tolerante:
        si un archivo falla, sigue con el resto y lo reporta en `failed`.
        """
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False, "error": "El proyecto ya no existe."}
        types = (
            "Documentos (*.pdf;*.docx;*.pptx;*.txt;*.md;*.html;*.htm;*.csv;*.json;*.xml)",
            "Todos los archivos (*.*)",
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True, file_types=types
        )
        files = list(result) if result else []
        if not files:
            return {"ok": False, "cancelled": True, "converted": [], "failed": []}
        converted, failed = [], []
        for src in files:
            name = Path(src).name
            try:
                info = documents.save_and_convert(
                    Path(src), docs_dir, ocr=ocr, extract_images=extract_images
                )
                converted.append(info)
            except documents.EmptyDocumentError:
                failed.append({"name": name, "reason": "Sin texto (¿escaneado?)"})
            except documents.UnsupportedDocumentError:
                failed.append({"name": name, "reason": "Formato no soportado"})
            except Exception as exc:  # noqa: BLE001
                _log.exception("Fallo al convertir %s", src)
                failed.append({"name": name, "reason": str(exc)})
        _log.info("Documentos: %d convertidos, %d fallidos", len(converted), len(failed))
        return {"ok": True, "converted": converted, "failed": failed}

    def list_documents(self, initiative_id):
        """Documentos ya convertidos de un proyecto."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return []
        documents.migrate_flat_to_folders(docs_dir)
        return documents.list_documents(docs_dir)

    def open_document(self, initiative_id, md_name):
        """Abre el .md con la app asociada del sistema."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        folder = documents.doc_folder(docs_dir, Path(md_name).stem)
        _open_in_explorer(str(folder / md_name))
        return {"ok": True}

    def open_document_original(self, initiative_id, md_name):
        """Muestra el archivo original en el Explorador (seleccionado)."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        documents.migrate_flat_to_folders(docs_dir)
        for doc in documents.list_documents(docs_dir):
            if doc["name"] == md_name and doc["original_path"]:
                _reveal_in_explorer(doc["original_path"])
                return {"ok": True}
        return {"ok": False, "error": "No se encontró el original."}

    def open_documents_folder(self, initiative_id):
        """Abre la carpeta `documentos/` del proyecto."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        docs_dir.mkdir(parents=True, exist_ok=True)
        _open_in_explorer(str(docs_dir))
        return {"ok": True}

    def open_document_images(self, initiative_id, md_name):
        """Abre la subcarpeta `imagenes/` del documento indicado."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        folder = documents.doc_folder(docs_dir, Path(md_name).stem)
        imgs = documents.images_dir(folder)
        if not imgs.exists():
            return {"ok": False, "error": "Este documento no tiene imágenes."}
        _open_in_explorer(str(imgs))
        return {"ok": True}

    def delete_document(self, initiative_id, md_name):
        """Borra un documento convertido (el .md y su original)."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        documents.delete_document(docs_dir, md_name)
        return {"ok": True}

    def list_all_documents(self):
        """Todos los documentos convertidos de TODAS las iniciativas, con su proyecto."""
        out = []
        for ini in repo.list_initiatives(self._session):
            docs_dir = initiative_export_dir(ini, settings.get_export_dir()) / "documentos"
            documents.migrate_flat_to_folders(docs_dir)
            for doc in documents.list_documents(docs_dir):
                doc = dict(doc)
                doc["initiative_id"] = ini.id
                doc["initiative_name"] = ini.name
                doc["color"] = ini.color or ""
                out.append(doc)
        out.sort(key=lambda d: d.get("created_at", ""), reverse=True)
        return out

    def read_document(self, initiative_id, md_name):
        """Texto del .md (para el modal 'Ver' y para copiar)."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False, "error": "El proyecto ya no existe."}
        try:
            return {"ok": True, "text": documents.read_markdown(docs_dir, md_name)}
        except FileNotFoundError:
            return {"ok": False, "error": "No se pudo leer el documento."}

    def save_uploaded_document(self, initiative_id, name, data_b64, ocr="auto", extract_images=False):
        """Guarda un archivo arrastrado (base64) y lo convierte a .md."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False, "reason": "El proyecto ya no existe.", "name": name}
        safe = Path(name).name or "documento"
        try:
            raw = base64.b64decode(data_b64)
        except Exception:
            return {"ok": False, "reason": "Archivo ilegible.", "name": safe}
        tmp = Path(tempfile.gettempdir()) / f"helpmeet_up_{safe}"
        try:
            tmp.write_bytes(raw)
            info = documents.save_and_convert(
                tmp, docs_dir, ocr=ocr, extract_images=extract_images
            )
            return {"ok": True, "converted": info}
        except documents.EmptyDocumentError:
            return {"ok": False, "reason": "Sin texto (¿escaneado?)", "name": safe}
        except documents.UnsupportedDocumentError:
            return {"ok": False, "reason": "Formato no soportado", "name": safe}
        except Exception as exc:  # noqa: BLE001
            _log.exception("Fallo al convertir archivo arrastrado %s", safe)
            return {"ok": False, "reason": str(exc), "name": safe}
        finally:
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass

    def toggle_initiative_pin(self, initiative_id):
        """Ancla/desancla una iniciativa (las ancladas salen arriba en la lista)."""
        state = repo.toggle_initiative_pin(self._session, int(initiative_id))
        if state is None:
            return {"ok": False, "error": "La iniciativa ya no existe."}
        return {"ok": True, "id": int(initiative_id), "pinned": bool(state)}

    def set_initiative_description(self, initiative_id, description):
        """Guarda el objetivo/contexto de una iniciativa (va a la cabecera del export)."""
        repo.set_initiative_description(self._session, int(initiative_id), description)
        return {"ok": True}

    def list_library(self, view):
        """Lista el archivo o la papelera en un formato listo para la UI."""
        rows = repo.list_archived(self._session) if view == "archive" else repo.list_trash(self._session)
        result = []
        for row in rows:
            item = row["item"]
            kind = row["kind"]
            stamp = item.archived_at if view == "archive" else item.deleted_at
            result.append({
                "kind": kind,
                "id": item.id,
                "title": item.name if kind == "initiative" else item.title,
                "initiative": "" if kind == "initiative" else item.initiative.name,
                "date": stamp.strftime("%d/%m/%Y %H:%M") if stamp else "",
                "meeting_count": len(item.meetings) if kind == "initiative" else 0,
            })
        return result

    def archive_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de archivar este elemento."}
        try:
            self._move_item_to_archive(kind, int(item_id))
            return {"ok": repo.archive_item(self._session, kind, int(item_id))}
        except Exception as exc:  # noqa: BLE001
            self._session.rollback()
            _log.exception("No se pudo archivar físicamente %s %s", kind, item_id)
            return {"ok": False, "error": str(exc)}

    def trash_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de mover este elemento."}
        return {"ok": repo.trash_item(self._session, kind, int(item_id))}

    def restore_item(self, kind, item_id):
        try:
            self._restore_item_from_archive(kind, int(item_id))
            return {"ok": repo.restore_item(self._session, kind, int(item_id))}
        except Exception as exc:  # noqa: BLE001
            self._session.rollback()
            _log.exception("No se pudo restaurar físicamente %s %s", kind, item_id)
            return {"ok": False, "error": str(exc)}

    def permanently_delete_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de eliminar este elemento."}
        try:
            self._delete_archived_item_files(kind, int(item_id))
            return {"ok": repo.permanently_delete_item(self._session, kind, int(item_id))}
        except Exception as exc:  # noqa: BLE001
            self._session.rollback()
            _log.exception("No se pudo eliminar físicamente %s %s", kind, item_id)
            return {"ok": False, "error": str(exc)}

    def _move_item_to_archive(self, kind: str, item_id: int) -> None:
        from helpmeet.db.models import Initiative, Meeting
        base = settings.get_export_dir()
        archive_base = _archive_root()
        if kind == "meeting":
            meeting = self._session.get(Meeting, item_id)
            if meeting is None:
                raise ValueError("La reunión ya no existe.")
            source = organize_meeting_folder(self._session, item_id, base)
            # Crea la carpeta de proyecto dentro de Archivados con su marcador .helpmeet.
            initiative_export_dir(meeting.initiative, archive_base)
            dest = meeting_export_dir(meeting, archive_base)
            moved = _move_managed_folder(source, dest)
            if moved:
                _remap_meeting_paths(meeting, source, dest)
                _remove_empty_export_parents(source, base)
                self._session.commit()
            return
        if kind == "initiative":
            initiative = self._session.get(Initiative, item_id)
            if initiative is None:
                raise ValueError("El proyecto ya no existe.")

            # Proyectos sin reuniones: no tienen carpeta fisica que archivar.
            # Solo marcamos en DB y limpiamos la carpeta de exportacion si existe.
            active_meetings = [m for m in initiative.meetings
                               if m.archived_at is None and m.deleted_at is None]
            if not active_meetings:
                source = initiative_export_dir(initiative, base)
                # Si solo tiene el marcador .helpmeet, borrar la carpeta vacia.
                marker = source / ".helpmeet"
                only_marker = (source.exists() and marker.exists() and
                               not any(p.name != ".helpmeet" for p in source.iterdir()))
                if only_marker:
                    marker.unlink()
                    source.rmdir()
                return

            source = export_initiative(self._session, item_id, base)
            dest = initiative_export_dir(initiative, archive_base)
            # initiative_export_dir crea el destino; para mover la carpeta completa
            # necesitamos retirarlo si solo contiene el marcador recien creado.
            marker = dest / ".helpmeet"
            if dest.exists() and not any(p.name != ".helpmeet" for p in dest.iterdir()):
                if marker.exists():
                    marker.unlink()
                dest.rmdir()
            moved = _move_managed_folder(source, dest)
            if moved:
                for meeting in initiative.meetings:
                    _remap_meeting_paths(meeting, source, dest)
                self._session.commit()
            return
        raise ValueError("Tipo de elemento no soportado.")

    def _restore_item_from_archive(self, kind: str, item_id: int) -> None:
        from helpmeet.db.models import Initiative, Meeting
        base = settings.get_export_dir()
        archive_base = _archive_root()
        if kind == "meeting":
            meeting = self._session.get(Meeting, item_id)
            if meeting is None:
                raise ValueError("La reunión ya no existe.")
            source = meeting_export_dir(meeting, archive_base)
            initiative_export_dir(meeting.initiative, base)
            dest = meeting_export_dir(meeting, base)
            moved = _move_managed_folder(source, dest)
            if moved:
                _remap_meeting_paths(meeting, source, dest)
                _remove_empty_export_parents(source, archive_base)
                self._session.commit()
            return
        if kind == "initiative":
            initiative = self._session.get(Initiative, item_id)
            if initiative is None:
                raise ValueError("El proyecto ya no existe.")
            source = initiative_export_dir(initiative, archive_base)
            dest = initiative_export_dir(initiative, base)
            marker = dest / ".helpmeet"
            if dest.exists() and not any(p.name != ".helpmeet" for p in dest.iterdir()):
                if marker.exists():
                    marker.unlink()
                dest.rmdir()
            moved = _move_managed_folder(source, dest)
            if moved:
                for meeting in initiative.meetings:
                    _remap_meeting_paths(meeting, source, dest)
                self._session.commit()
            return
        raise ValueError("Tipo de elemento no soportado.")

    def _delete_archived_item_files(self, kind: str, item_id: int) -> None:
        from helpmeet.db.models import Initiative, Meeting
        archive_base = _archive_root()
        if kind == "meeting":
            meeting = self._session.get(Meeting, item_id)
            if meeting is None:
                return
            _delete_archived_folder(meeting_export_dir(meeting, archive_base))
            return
        if kind == "initiative":
            initiative = self._session.get(Initiative, item_id)
            if initiative is None:
                return
            _delete_archived_folder(initiative_export_dir(initiative, archive_base))
            return
        raise ValueError("Tipo de elemento no soportado.")

    def _item_in_use(self, kind, item_id):
        meeting_ids = set()
        if self._recorder and self._recorder.meeting:
            meeting_ids.add(self._recorder.meeting.id)
        if self._screen_meeting_id:
            meeting_ids.add(self._screen_meeting_id)
        if kind == "meeting":
            return item_id in meeting_ids
        if kind == "initiative":
            return any((repo.get_meeting(self._session, mid) and
                        repo.get_meeting(self._session, mid).initiative_id == item_id)
                       for mid in meeting_ids)
        return False

    def create_initiative(self, name, color=None):
        name = (name or "").strip()
        existing = repo.list_initiatives(self._session)
        if any((i.name or "").strip().lower() == name.lower() for i in existing):
            return {"error": "duplicate_name"}
        i = repo.create_initiative(self._session, name, color=color)
        return _initiative_payload(i)

    def sync_initiatives_with_folders(self):
        """Sincroniza iniciativas con las carpetas en export_dir.
        - Carpeta borrada + iniciativa tenía reuniones → papelera.
        - Carpeta nueva sin iniciativa en DB → crea iniciativa.
        """
        from pathlib import Path
        _SKIP = {"recuperados"}  # carpetas reservadas por Helpmeet
        export_dir = Path(settings.get_export_dir())
        if not export_dir.exists():
            return {"trashed": [], "created": []}
        folders = [p for p in export_dir.iterdir() if p.is_dir()]
        folder_names_lower = {p.name.lower(): p.name for p in folders}
        initiatives = repo.list_initiatives(self._session)
        init_names_lower = {i.name.lower(): i for i in initiatives}
        trashed, created = [], []
        # Iniciativas en DB cuya carpeta desapareció
        for name_lower, init in init_names_lower.items():
            meetings = repo.list_meetings(self._session, init.id)
            if not meetings:
                continue
            if name_lower not in folder_names_lower:
                repo.trash_item(self._session, "initiative", init.id)
                trashed.append(init.id)
        # Carpetas → crear iniciativa si no existe, luego importar reuniones si está vacía
        for folder_path in folders:
            name_lower = folder_path.name.lower()
            if name_lower in _SKIP:
                continue
            try:
                if name_lower not in init_names_lower:
                    new_init = repo.create_initiative(self._session, folder_path.name)
                    created.append(new_init.id)
                    _import_meetings_from_folder(self._session, new_init, folder_path)
                else:
                    existing_init = init_names_lower[name_lower]
                    existing_meetings = repo.list_meetings(self._session, existing_init.id)
                    if not existing_meetings:
                        _import_meetings_from_folder(self._session, existing_init, folder_path)
            except Exception:
                self._session.rollback()
        return {"trashed": trashed, "created": created}

    def rename_initiative(self, initiative_id, name):
        initiative_id = int(initiative_id)
        name = (name or "").strip()
        existing = repo.list_initiatives(self._session)
        if any((i.name or "").strip().lower() == name.lower() and i.id != initiative_id
               for i in existing):
            return {"ok": False, "error": "duplicate_name"}
        repo.rename_initiative(self._session, initiative_id, name)
        return {"ok": True}

    def set_initiative_color(self, initiative_id, color):
        repo.set_initiative_color(self._session, int(initiative_id), color)
        return {"ok": True}

    def rename_meeting(self, meeting_id, title):
        repo.rename_meeting(self._session, int(meeting_id), title)
        return {"ok": True}

    def set_meeting_date(self, meeting_id, date_str):
        """Cambia la fecha del calendario de una reunión (started_at).
        date_str: 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM'. Vacío = no cambiar."""
        from datetime import timezone
        date_str = (date_str or "").strip()
        if not date_str:
            return {"ok": False, "error": "Fecha vacía"}
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"ok": False, "error": "Reunión no encontrada"}
        try:
            if "T" in date_str:
                dt = datetime.strptime(date_str, "%Y-%m-%dT%H:%M")
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                dt = dt.replace(hour=m.started_at.hour, minute=m.started_at.minute)
            m.started_at = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            self._session.commit()
            return {"ok": True, "started_at": m.started_at.strftime("%Y-%m-%d %H:%M")}
        except ValueError:
            return {"ok": False, "error": "Formato de fecha inválido"}

    def set_meeting_context(self, meeting_id, context):
        meeting = repo.set_meeting_context(self._session, int(meeting_id), context)
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        return {"ok": True, "context": meeting.context or ""}

    def add_meeting_note(self, meeting_id, text):
        """Añade una entrada de "Contexto" a la transcripción de una reunión.
        Aparece arriba del todo y con la etiqueta Contexto."""
        text = (text or "").strip()
        if not text:
            return {"ok": False}
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        note = repo.add_note(self._session, int(meeting_id), text, is_context=True)
        return {"ok": True, "note": {
            "id": note.id, "kind": "context", "time": "", "offset": 0.0,
            "text": note.text,
        }}

    def add_note_post(self, meeting_id, text):
        """Añade una nota normal a una reunión ya terminada (no es 'contexto')."""
        text = (text or "").strip()
        if not text:
            return {"ok": False}
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        note = repo.add_note(self._session, int(meeting_id), text, is_context=False)
        offset = max(0.0, (note.created_at - meeting.started_at).total_seconds())
        def _stamp(s):
            m, sec = divmod(int(s), 60); h, m = divmod(m, 60)
            return f"{h:02d}:{m:02d}:{sec:02d}" if h else f"{m:02d}:{sec:02d}"
        return {"ok": True, "note": {
            "id": note.id, "kind": "note", "time": _stamp(offset),
            "wall_time": note.created_at.strftime("%H:%M"),
            "offset": offset, "text": note.text,
        }}

    def move_meeting(self, meeting_id, initiative_id):
        repo.move_meeting(self._session, int(meeting_id), int(initiative_id))
        return {"ok": True}

    def get_glossary(self, initiative_id):
        from helpmeet.glossary import build_glossary
        glos = build_glossary(self._session, int(initiative_id))
        return [{"term": t, "count": c} for t, c in glos]

    def _transcribing_ids(self):
        """Reuniones que ahora mismo se están transcribiendo en segundo plano."""
        with self._jobs_lock:
            return {mid for mid, info in self._jobs_info.items()
                    if info.get("state") in ("queued", "running")}

    def _meeting_payload(self, m, frase_count, transcribing):
        """Construye el dict de una reunión para la UI. `frase_count` viene de un
        COUNT agregado (no de cargar todas las frases) y `transcribing` es el
        conjunto de reuniones en proceso."""
        total = int((m.ended_at - m.started_at).total_seconds()) if m.ended_at else 0
        mm, ss = divmod(max(0, total), 60)
        is_video = bool(m.audio_path and str(m.audio_path).lower().endswith(".mp4"))
        # Origen de la reunión para la UI: audio grabado, pantalla grabada o
# vídeo importado. Las grabaciones de pantalla usan el nombre
        # "DD-MM-YY HH-MM-SS.mp4" (ver start_screen_record); los importados
        # conservan su nombre original.
        import re as _re
        stem = Path(m.audio_path).stem if m.audio_path else ""
        if not m.audio_path:
            source = ""
        elif not is_video:
            source = "audio"
        elif (_re.fullmatch(r"\d{2}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}", stem)
              or stem.lower().startswith("grabacion")   # nombre legacy de grabaciones
              or stem.lower().startswith("video_temp")):
            source = "screen"
        else:
            source = "import"
        if m.id in transcribing:
            status = "processing"   # transcribiéndose en segundo plano
        elif is_video and frase_count == 0:
            status = "pending"
        elif m.ended_at:
            status = "done"
        else:
            status = "pending"
        return {
            "id": m.id,
            "title": m.title,
            "date": m.started_at.strftime("%d/%m/%Y %H:%M"),
            "started_at": m.started_at.strftime("%Y-%m-%dT%H:%M:%S"),
            "time": _fmt_12h(m.started_at),
            "month_key": m.started_at.strftime("%Y-%m"),
            "month_label": _spanish_month(m.started_at),
            "status": status,
            "frases": frase_count,
            "dur": f"{mm:02d}:{ss:02d}" if m.ended_at else "—",
            "size": _human_size(m.audio_path),
            "has_video": is_video,
            "source": source,
        }

    def list_meetings(self, initiative_id):
        # Refrescar por si una transcripción en segundo plano (otra sesión)
        # acaba de añadir frases a alguna reunión.
        self._session.expire_all()
        meetings = repo.list_meetings(self._session, int(initiative_id))
        transcribing = self._transcribing_ids()
        counts = repo.utterance_counts(self._session, [m.id for m in meetings])
        return [self._meeting_payload(m, counts.get(m.id, 0), transcribing)
                for m in meetings]

    def get_bootstrap_state(self):
        """P-06: un solo viaje al backend al arrancar.

        Antes la UI pedía las reuniones iniciativa por iniciativa (N+1) y además
        monitores, archivo, papelera y trabajos por separado. Aquí se devuelve
        todo de una vez, con las reuniones agrupadas en UNA consulta y los conteos
        de frases agregados."""
        self._session.expire_all()
        initiatives = [_initiative_payload(i)
                       for i in repo.list_initiatives(self._session)]
        grouped = repo.list_meetings_by_initiative(self._session)
        all_ids = [m.id for ms in grouped.values() for m in ms]
        counts = repo.utterance_counts(self._session, all_ids)
        transcribing = self._transcribing_ids()
        meetings_by_initiative = {
            str(iid): [self._meeting_payload(m, counts.get(m.id, 0), transcribing)
                       for m in ms]
            for iid, ms in grouped.items()
        }
        # Las iniciativas sin reuniones también deben figurar (lista vacía).
        for i in initiatives:
            meetings_by_initiative.setdefault(str(i["id"]), [])
        try:
            monitors = self.list_monitors()
        except Exception:
            monitors = []
        with self._jobs_lock:
            jobs = list(self._jobs_info.values())
        return {
            "version": __version__,
            "initiatives": initiatives,
            "meetings_by_initiative": meetings_by_initiative,
            "monitors": monitors,
            "library_counts": {
                "archive": len(repo.list_archived(self._session)),
                "trash": len(repo.list_trash(self._session)),
            },
            "background_jobs": jobs,
            "default_mic_muted": bool(settings.get_transcription_settings().get("default_mic_muted", False)),
            "screen_recording": self._screen_rec is not None,
            "screen_meeting_id": self._screen_meeting_id,
            "setup_done": settings.get_setup_done(),
        }

    def search(self, query):
        out = []
        for r in repo.search(self._session, query):
            m = r["meeting"]
            out.append({
                "meeting_id": m.id,
                "meeting_title": m.title,
                "initiative": m.initiative.name,
                "date": m.started_at.strftime("%d/%m/%Y %H:%M"),
                "kind": r["kind"],
                "speaker": r["speaker"],
                "text": r["text"],
            })
        return out

    def get_transcript(self, meeting_id):
        self._session.expire_all()  # ver frases añadidas en segundo plano
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"title": "", "context": "", "started_at": "", "utterances": [],
                    "assets": {"captures": [], "notes": [], "video": None, "audio": None},
                    "video_path": None}
        video = m.audio_path if (m.audio_path and str(m.audio_path).lower().endswith(".mp4")
                                 and os.path.exists(m.audio_path)) else None
        audio = m.audio_path if (m.audio_path and not str(m.audio_path).lower().endswith(".mp4")
                                 and os.path.exists(m.audio_path)) else None
        video_duration = ""
        audio_duration = ""
        if video:
            from helpmeet.media import media_duration
            secs = int(media_duration(video))
            if secs > 0:
                hours, rem = divmod(secs, 3600)
                mins, sec = divmod(rem, 60)
                video_duration = f"{hours}:{mins:02d}:{sec:02d}" if hours else f"{mins}:{sec:02d}"
        elif m.audio_path and os.path.exists(m.audio_path):
            try:
                from helpmeet.media import media_duration
                secs = int(media_duration(m.audio_path))
                if secs > 0:
                    hours, rem = divmod(secs, 3600)
                    mins, sec = divmod(rem, 60)
                    audio_duration = f"{hours}:{mins:02d}:{sec:02d}" if hours else f"{mins}:{sec:02d}"
            except Exception:
                pass

        def stamp(seconds):
            minutes, secs = divmod(max(0, int(seconds or 0)), 60)
            return f"{minutes:02d}:{secs:02d}"

        participants = repo.list_participants(self._session, m.initiative_id)
        timeline = []
        for u in m.utterances:
            timeline.append({
                "id": u.id, "kind": "utterance", "speaker": u.speaker,
                "text": u.text, "start": u.start_time, "end": u.end_time,
                "highlighted": bool(u.highlighted),
                "participant_id": u.participant_id,
                "display_name": repo.resolved_speaker_name(u, participants),
                "time": stamp(u.start_time), "_sort": float(u.start_time),
            })
        captures = []
        for cap in m.captures:
            offset = max(0.0, (cap.taken_at - m.started_at).total_seconds())
            item = {
                "id": cap.id, "kind": "capture", "time": stamp(offset),
                "clock": _fmt_12h(cap.taken_at) if cap.taken_at else "",
                "code": cap.code,
                "offset": offset, "path": cap.image_path, "note": cap.note or "",
                "_sort": offset,
            }
            captures.append({key: value for key, value in item.items() if key != "_sort"})
            timeline.append(item)
        notes = []
        for note in m.notes:
            if note.is_context:
                # Las entradas de Contexto van al timeline (arriba del todo,
                # más recientes primero) y sin marca de tiempo.
                item = {
                    "id": note.id, "kind": "context", "time": "",
                    "offset": 0.0, "text": note.text,
                    "_sort": -note.created_at.timestamp(),
                }
                notes.append({key: value for key, value in item.items() if key != "_sort"})
                timeline.append(item)
            else:
                # Las notas normales van a assets.notes (tab Notas) y también
                # al timeline para que no se pierdan al exportar/copiar contexto.
                if note.created_at and m.started_at:
                    offset = max(0.0, (note.created_at - m.started_at).total_seconds())
                    wall_time = note.created_at.strftime("%H:%M")
                else:
                    offset = 0.0
                    wall_time = ""
                item = {
                    "id": note.id, "kind": "note", "time": stamp(offset),
                    "wall_time": wall_time,
                    "offset": offset, "text": note.text,
                    "_sort": offset,
                }
                notes.append({key: value for key, value in item.items() if key != "_sort"})
                timeline.append(item)
        timeline.sort(key=lambda item: (item["_sort"], item["kind"] != "utterance"))
        for item in timeline:
            item.pop("_sort", None)

        return {
            "title": m.title,
            "context": m.context or "",
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "initiative_id": m.initiative_id,
            "participants": [{"id": p.id, "name": p.name, "is_me": bool(p.is_me)}
                             for p in participants],
            "utterances": timeline,
            "assets": {"captures": captures, "notes": notes, "video": video, "audio": audio},
            "video_path": video,
            "video_duration": video_duration,
            "audio_duration": audio_duration,
            "duration": audio_duration,
        }

    def update_utterance(self, utterance_id, changes):
        """Edita una frase: texto y/o hablante. `changes` es un dict con
        opcionalmente `text` y/o `speaker` ("me"|"others")."""
        changes = changes or {}
        utt = repo.update_utterance(
            self._session, int(utterance_id),
            text=changes.get("text"), speaker=changes.get("speaker"),
        )
        if utt is None:
            return {"ok": False, "error": "La frase ya no existe."}
        return {"ok": True, "id": utt.id, "text": utt.text, "speaker": utt.speaker}

    def toggle_utterance_highlight(self, utterance_id):
        """Marca/desmarca una frase como importante (★). Devuelve el nuevo estado."""
        state = repo.toggle_utterance_highlight(self._session, int(utterance_id))
        if state is None:
            return {"ok": False, "error": "La frase ya no existe."}
        return {"ok": True, "id": int(utterance_id), "highlighted": bool(state)}

    def delete_utterance(self, utterance_id):
        """Elimina una frase de la transcripción."""
        ok = repo.delete_utterance(self._session, int(utterance_id))
        return {"ok": bool(ok)}

    def update_note(self, note_id, changes):
        """Actualiza el texto de una nota o contexto."""
        from helpmeet.db.repository.meeting_repository import update_note as _update_note
        text = changes.get("text") if isinstance(changes, dict) else changes
        result = _update_note(self._session, int(note_id), text=text)
        return {"ok": result is not None}

    def delete_note(self, note_id):
        """Elimina una nota o entrada de contexto."""
        from helpmeet.db.repository.meeting_repository import delete_note as _delete_note
        ok = _delete_note(self._session, int(note_id))
        return {"ok": bool(ok)}

    # ---------- Participantes ----------
    def _participants_payload(self, initiative_id):
        return [{"id": p.id, "name": p.name, "is_me": bool(p.is_me)}
                for p in repo.list_participants(self._session, int(initiative_id))]

    def list_participants(self, initiative_id):
        """Participantes de una iniciativa (lista reutilizable en sus reuniones)."""
        return {"ok": True, "participants": self._participants_payload(initiative_id)}

    def add_participants(self, initiative_id, names):
        """Da de alta participantes. `names` puede ser una lista o texto con un
        nombre por línea (para pegar varios de golpe)."""
        repo.add_participants(self._session, int(initiative_id), names)
        return {"ok": True, "participants": self._participants_payload(initiative_id)}

    def rename_participant(self, participant_id, name):
        p = repo.rename_participant(self._session, int(participant_id), name)
        if p is None:
            return {"ok": False, "error": "Nombre no válido o participante inexistente."}
        return {"ok": True, "participants": self._participants_payload(p.initiative_id)}

    def delete_participant(self, participant_id):
        p = repo.get_participant(self._session, int(participant_id))
        initiative_id = p.initiative_id if p else None
        ok = repo.delete_participant(self._session, int(participant_id))
        payload = self._participants_payload(initiative_id) if initiative_id else []
        return {"ok": bool(ok), "participants": payload}

    def set_me_participant(self, initiative_id, participant_id):
        """Marca quién eres tú (tu micrófono) en la iniciativa."""
        pid = int(participant_id) if participant_id not in (None, "") else None
        repo.set_me_participant(self._session, int(initiative_id), pid)
        return {"ok": True, "participants": self._participants_payload(initiative_id)}

    def assign_utterance_participant(self, utterance_id, participant_id):
        """Asigna una frase a un participante concreto (None = sin asignar)."""
        pid = int(participant_id) if participant_id not in (None, "") else None
        utt = repo.assign_utterance_participant(self._session, int(utterance_id), pid)
        if utt is None:
            return {"ok": False, "error": "La frase ya no existe."}
        return {"ok": True, "id": utt.id, "participant_id": utt.participant_id}

    def get_capture_image(self, capture_id):
        """Devuelve la imagen de una captura como data URL base64.

        WebView2 bloquea la carga de `file://` como sub-recurso, así que las
        miniaturas no se ven con una ruta de archivo. Incrustarlas en base64
        (igual que la previsualización) evita ese bloqueo. Se cargan bajo
        demanda (una por tarjeta) para no inflar `get_transcript`."""
        cap = repo.get_capture(self._session, int(capture_id))
        if cap is None or not cap.image_path or not os.path.exists(cap.image_path):
            return {"ok": False, "data_url": ""}
        ext = os.path.splitext(cap.image_path)[1].lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(
            ext.lstrip("."), "application/octet-stream")
        with open(cap.image_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("ascii")
        return {"ok": True, "data_url": f"data:{mime};base64,{b64}"}

    def get_capture_thumbnail(self, capture_id):
        """Miniatura JPEG pequeña de una captura para las tarjetas (P-09).

        Antes la tarjeta cargaba el PNG original completo (varios MB) solo para
        mostrarlo a tamaño reducido. Aquí se genera una vez una miniatura ligera
        (se cachea en `captures/thumbs`) y se reutiliza. El original solo se pide
        al ampliar (lupa). Si la miniatura no se pudiera crear, cae al original."""
        cap = repo.get_capture(self._session, int(capture_id))
        if cap is None or not cap.image_path or not os.path.exists(cap.image_path):
            return {"ok": False, "data_url": ""}
        from helpmeet.media import make_thumbnail
        thumbs_dir = config.CAPTURES_DIR / "thumbs"
        thumb = thumbs_dir / f"{int(capture_id)}.jpg"
        try:
            fresh = (thumb.exists() and
                     thumb.stat().st_mtime >= os.path.getmtime(cap.image_path))
        except OSError:
            fresh = False
        if not fresh:
            make_thumbnail(cap.image_path, str(thumb))
        if thumb.exists():
            with open(thumb, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode("ascii")
            return {"ok": True, "data_url": f"data:image/jpeg;base64,{b64}"}
        return self.get_capture_image(capture_id)  # fallback al original

    _VIDEO_EXTS = (".mp4", ".mkv", ".mov", ".avi", ".webm")

    def get_meeting_thumbnail(self, meeting_id):
        """Miniatura JPEG del primer fotograma del vídeo de una reunión (para
        la cabecera). Mismo patrón que get_capture_thumbnail: se genera una
        vez, se cachea en `captures/thumbs`, y se reutiliza."""
        m = repo.get_meeting(self._session, int(meeting_id))
        if (m is None or not m.audio_path or not os.path.exists(m.audio_path)
                or not str(m.audio_path).lower().endswith(self._VIDEO_EXTS)):
            return {"ok": False, "data_url": ""}
        from helpmeet.media import make_thumbnail
        thumbs_dir = config.CAPTURES_DIR / "thumbs"
        thumb = thumbs_dir / f"meeting-{int(meeting_id)}.jpg"
        try:
            fresh = (thumb.exists() and
                     thumb.stat().st_mtime >= os.path.getmtime(m.audio_path))
        except OSError:
            fresh = False
        if not fresh:
            make_thumbnail(m.audio_path, str(thumb))
        if thumb.exists():
            with open(thumb, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode("ascii")
            return {"ok": True, "data_url": f"data:image/jpeg;base64,{b64}"}
        return {"ok": False, "data_url": ""}

    def export_meeting_by_id(self, meeting_id):
        out = export_meeting(self._session, int(meeting_id), settings.get_export_dir())
        return {"path": str(out)}

    def export_transcript_txt(self, meeting_id):
        """Muestra Guardar como y exporta únicamente la transcripción en TXT."""
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        initial_dir = settings.get_export_dir()
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(initial_dir) if initial_dir.exists() else "",
            save_filename=transcript_filename(meeting),
            file_types=("Archivo de texto (*.txt)",),
        )
        if not result:
            return {"ok": False, "cancelled": True}
        selected = result[0] if isinstance(result, (list, tuple)) else result
        path = Path(selected)
        if path.suffix.lower() != ".txt":
            path = path.with_suffix(".txt")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(build_transcript_txt(meeting), encoding="utf-8-sig")
        return {"ok": True, "path": str(path)}

    def export_transcript_package(self, meeting_id):
        """Guarda un ZIP con la transcripción y todos sus recursos visibles."""
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        initial_dir = settings.get_export_dir()
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(initial_dir) if initial_dir.exists() else "",
            save_filename=transcript_package_filename(meeting),
            file_types=("Paquete ZIP (*.zip)",),
        )
        if not result:
            return {"ok": False, "cancelled": True}
        selected = result[0] if isinstance(result, (list, tuple)) else result
        path = Path(selected)
        if path.suffix.lower() != ".zip":
            path = path.with_suffix(".zip")
        payload = export_transcript_package(meeting, path)
        return {"ok": True, **payload}

    def export_transcript(self, meeting_id):
        """TXT si solo hay texto; ZIP cuando existen imágenes o archivos."""
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        has_captures = any(Path(cap.image_path).is_file() for cap in meeting.captures)
        has_file = bool(meeting.audio_path and Path(meeting.audio_path).is_file())
        has_assets = has_captures or has_file
        initial_dir = settings.get_export_dir()
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(initial_dir) if initial_dir.exists() else "",
            save_filename=(transcript_package_filename(meeting) if has_assets
                           else transcript_filename(meeting)),
            file_types=(("Paquete ZIP (*.zip)",) if has_assets
                        else ("Archivo de texto (*.txt)",)),
        )
        if not result:
            return {"ok": False, "cancelled": True}
        selected = result[0] if isinstance(result, (list, tuple)) else result
        path = Path(selected).with_suffix(".zip" if has_assets else ".txt")
        if has_assets:
            payload = export_transcript_package(meeting, path)
            return {"ok": True, "format": "zip", **payload}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(build_transcript_txt(meeting), encoding="utf-8-sig")
        return {"ok": True, "format": "txt", "path": str(path),
                "captures": 0, "files": 0}

    def export_initiative_by_id(self, initiative_id):
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        return {"path": str(out)}

    def open_initiative_folder(self, initiative_id):
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}

    def open_path(self, path):
        """Abre en el Explorador la carpeta indicada (la de una exportación)."""
        if path:
            _open_in_explorer(path)
            return {"ok": True}
        return {"ok": False}

    def open_meeting_folder(self, meeting_id):
        """Abre en el Explorador la carpeta de una reunión.

        Si todavía no se había exportado, la exporta primero para que siempre
        haya algo que abrir.
        """
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"ok": False}
        exports = settings.get_export_dir()
        # Regenera la iniciativa para migrar también las reuniones antiguas del
        # mismo mes y retirar archivos sueltos de la estructura anterior.
        export_meeting(self._session, m.id, exports)
        folder = meeting_export_dir(m, exports)
        _open_in_explorer(folder)
        return {"ok": True, "path": str(folder)}

    @staticmethod
    def _meeting_duration(m):
        if m.ended_at and m.started_at:
            total = int((m.ended_at - m.started_at).total_seconds())
            mm, ss = divmod(total, 60)
            return f"{mm} min {ss} s"
        return ""

    # ---------- Ajustes ----------
    def debug_get_settings(self):
        """Devuelve info de debug sobre get_settings."""
        import traceback
        try:
            s = self.get_settings()
            return {"ok": True, "data": s, "keys": list(s.keys())}
        except Exception as e:
            return {"ok": False, "error": str(e), "trace": traceback.format_exc()}

    def copy_initiative_context(self, initiative_id):
        """Refresca el export y devuelve el texto de `contexto.md` para copiarlo.

        Reutiliza la exportación normal (deja la carpeta al día) y lee el
        documento combinado, que ya incluye la cabecera de instrucciones,
        el objetivo, el glosario y todas las reuniones."""
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        ctx = Path(out) / "contexto.md"
        text = ctx.read_text(encoding="utf-8") if ctx.exists() else ""
        return {"ok": bool(text.strip()), "text": text, "path": str(out)}

    def copy_meeting_context(self, meeting_id, language=None):
        """Devuelve el texto de UNA reunion (con cabecera para la IA) para copiarlo.
        Si `language` se especifica, filtra solo utterances de ese idioma."""
        text = build_meeting_context(self._session, int(meeting_id), language=language)
        return {"ok": bool(text.strip()), "text": text}

    def _pick_folder(self):
        """Abre el diálogo nativo para elegir una carpeta. Devuelve la ruta o None."""
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None

    def _pick_file(self):
        """Abre el diálogo nativo para elegir un archivo de video/audio."""
        types = (
            "Video o audio (*.mp4;*.mkv;*.mov;*.avi;*.webm;*.mp3;*.m4a;*.wav;*.ogg)",
            "Todos los archivos (*.*)",
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=types
        )
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None

    def _move_to_initiative_folder(self, src: str, initiative_id: int) -> str:
        """Mueve el archivo a la carpeta de exportación de la iniciativa.

        Si ya está dentro de esa carpeta no hace nada. Si hay conflicto de
        nombre agrega un sufijo numérico. Devuelve la ruta final del archivo."""
        initiative = repo.get_initiative(self._session, initiative_id)
        if initiative is None:
            return src
        base_dir = settings.get_export_dir()
        dest_dir = initiative_export_dir(initiative, base_dir)
        src_path = Path(src)
        dest = dest_dir / src_path.name
        # Si ya está en el destino correcto, no mover
        if src_path.resolve() == dest.resolve():
            return str(dest)
        # Resolver conflictos de nombre
        if dest.exists():
            stem, suffix = src_path.stem, src_path.suffix
            n = 1
            while dest.exists():
                dest = dest_dir / f"{stem}_{n}{suffix}"
                n += 1
        try:
            shutil.move(str(src_path), str(dest))
            _log.info("Video movido a carpeta de iniciativa: %s", dest)
        except Exception as exc:
            _log.warning("No se pudo mover el video a la carpeta de iniciativa: %s", exc)
            return src  # si falla el move, usar ruta original
        return str(dest)

    def choose_export_dir(self):
        path = self._pick_folder()
        if path:
            settings.set_export_dir(path)
            return {"ok": True, "path": str(path)}
        return {"ok": False}

    def export_meeting_to(self, meeting_id):
        """Exporta UNA reunión a una carpeta elegida en el momento (no la de ajustes)."""
        folder = self._pick_folder()
        if not folder:
            return {"ok": False}
        out = export_meeting(self._session, int(meeting_id), folder)
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}

    def export_initiative_to(self, initiative_id):
        """Exporta la iniciativa completa a una carpeta elegida en el momento."""
        folder = self._pick_folder()
        if not folder:
            return {"ok": False}
        out = export_initiative(self._session, int(initiative_id), folder)
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}

    # ---- Controles de ventana (frameless) ----
    def win_minimize(self):
        if self._window:
            self._window.minimize()
        return {"ok": True}

    def win_refresh_theme(self, is_dark=False):
        """Re-aplica el icono y color de la barra de titulo segun el tema."""
        if not self._window or not sys.platform.startswith("win"):
            return {"ok": True}
        # pywebview puede serializar booleanos como strings
        is_dark = is_dark in (True, "true", "True", 1, "1")
        web_dir = Path(__file__).parent / "web"
        icon_name = "helpmeet-dark.ico" if is_dark else "helpmeet.ico"
        icon_path = web_dir / "assets" / icon_name
        if not icon_path.exists():
            icon_path = web_dir / "assets" / "helpmeet.ico"
        _apply_native_window_icon(self._window, icon_path)
        return {"ok": True}

    def check_for_update(self):
        """Consulta la version mas reciente desde GitHub Releases."""
        try:
            import urllib.request, json as _j
            from helpmeet.version import __version__
            req = urllib.request.Request(
                "https://api.github.com/repos/mimotech/helpmeet/releases/latest",
                headers={"Accept": "application/vnd.github+json", "User-Agent": "Helpmeet"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = _j.loads(resp.read())
            latest = (data.get("tag_name") or "").lstrip("v")
            if not latest:
                return {"available": False, "current": __version__}
            if _version_newer(latest, __version__):
                asset = data.get("assets", [{}])[0]
                url = asset.get("browser_download_url", data.get("html_url", ""))
                return {"available": True, "current": __version__, "version": latest, "url": url}
            return {"available": False, "current": __version__}
        except Exception:
            return {"available": False, "current": ""}

    def win_maximize(self):
        """Alterna maximizado ↔ restaurado respetando la barra de tareas."""
        if not self._window:
            return {"ok": True}
        if not sys.platform.startswith("win"):
            self._window.toggle_fullscreen()
            return {"ok": True}
        try:
            from System import Action
            from System.Windows.Forms import Screen
            from webview.platforms.winforms import BrowserView
            form = BrowserView.instances.get(self._window.uid)
            if form is None:
                return {"ok": True}
            def toggle():
                wa = Screen.GetWorkingArea(form)
                is_max = (form.Left == wa.X and form.Top == wa.Y
                          and form.Width == wa.Width and form.Height == wa.Height)
                if is_max:
                    b = getattr(self, '_pre_max_bounds', None)
                    if b:
                        form.SetBounds(b[0], b[1], b[2], b[3])
                    else:
                        form.SetBounds(wa.X + 60, wa.Y + 60, 1100, 720)
                else:
                    self._pre_max_bounds = (form.Left, form.Top, form.Width, form.Height)
                    form.SetBounds(wa.X, wa.Y, wa.Width, wa.Height)
            if form.InvokeRequired:
                form.Invoke(Action(toggle))
            else:
                toggle()
        except Exception:
            pass
        return {"ok": True}

    def win_close(self):
        if self._window:
            self._window.destroy()
        return {"ok": True}

    def win_is_maximized(self):
        if not sys.platform.startswith("win"):
            return {"maximized": False}
        try:
            from System.Windows.Forms import Screen
            from webview.platforms.winforms import BrowserView
            form = BrowserView.instances.get(self._window.uid)
            if form:
                wa = Screen.GetWorkingArea(form)
                return {"maximized": (form.Left == wa.X and form.Top == wa.Y
                                      and form.Width == wa.Width and form.Height == wa.Height)}
        except Exception:
            pass
        return {"maximized": False}

    def win_start_move(self):
        """Mueve la ventana siguiendo el ratón mientras el botón izquierdo esté pulsado."""
        import threading, time as _time
        if not sys.platform.startswith("win"):
            return {"ok": True}
        def _loop():
            try:
                import ctypes, ctypes.wintypes
                from System import Action
                from webview.platforms.winforms import BrowserView
                form = BrowserView.instances.get(self._window.uid)
                if form is None:
                    return
                p0 = ctypes.wintypes.POINT()
                ctypes.windll.user32.GetCursorPos(ctypes.byref(p0))
                sx, sy = p0.x, p0.y
                ox, oy = form.Left, form.Top
                pt = ctypes.wintypes.POINT()
                while ctypes.windll.user32.GetAsyncKeyState(0x01) & 0x8000:
                    ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
                    dx = pt.x - sx; dy = pt.y - sy
                    def _mv(x=ox + dx, y=oy + dy):
                        form.SetBounds(x, y, form.Width, form.Height)
                    if form.InvokeRequired:
                        form.Invoke(Action(_mv))
                    else:
                        _mv()
                    _time.sleep(0.012)
            except Exception:
                pass
        threading.Thread(target=_loop, daemon=True).start()
        return {"ok": True}

    def win_start_resize(self, direction):
        """Trackea el ratón y redimensiona la ventana mientras el botón esté pulsado."""
        import threading, time as _time
        if not sys.platform.startswith("win"):
            return {"ok": True}
        def _loop():
            try:
                import ctypes, ctypes.wintypes
                from System import Action
                from webview.platforms.winforms import BrowserView
                form = BrowserView.instances.get(self._window.uid)
                if form is None:
                    return
                # Posición inicial del ratón
                p0 = ctypes.wintypes.POINT()
                ctypes.windll.user32.GetCursorPos(ctypes.byref(p0))
                sx, sy = p0.x, p0.y
                # Bounds iniciales de la ventana
                ox = form.Left; oy = form.Top; ow = form.Width; oh = form.Height
                MIN_W, MIN_H = 500, 380
                pt = ctypes.wintypes.POINT()
                d = direction.lower()
                while ctypes.windll.user32.GetAsyncKeyState(0x01) & 0x8000:
                    ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
                    dx = pt.x - sx; dy = pt.y - sy
                    nx, ny, nw, nh = ox, oy, ow, oh
                    if 'e' in d: nw = max(MIN_W, ow + dx)
                    if 's' in d: nh = max(MIN_H, oh + dy)
                    if 'w' in d: nw = max(MIN_W, ow - dx); nx = ox + (ow - nw)
                    if 'n' in d: nh = max(MIN_H, oh - dy); ny = oy + (oh - nh)
                    def _set(x=nx, y=ny, w=nw, h=nh):
                        form.SetBounds(x, y, w, h)
                    if form.InvokeRequired:
                        form.Invoke(Action(_set))
                    else:
                        _set()
                    _time.sleep(0.012)
            except Exception:
                pass
        threading.Thread(target=_loop, daemon=True).start()
        return {"ok": True}


def run():
    import platform
    _instance_lock = _acquire_single_instance()
    if _instance_lock is None:
        _log.info("Helpmeet ya estaba abierto — se activó esa ventana en vez de abrir otra")
        return
    _log.info("=" * 60)
    _log.info("Helpmeet %s — iniciando", __version__)
    _log.info("Python %s | %s", sys.version.split()[0], platform.platform())
    _log.info("DATA_DIR: %s", config.DATA_DIR)
    _log.info("EXE: %s", sys.executable)
    # Verificar si el modelo Vosk está disponible en caché
    try:
        from helpmeet.transcription.vosk_engine import model_is_downloaded
        from helpmeet import settings as _s
        _model_name = _s.get_transcription_model()
        if model_is_downloaded(_model_name):
            _log.info("Modelo '%s' encontrado en caché", _model_name)
        else:
            _log.warning("Modelo '%s' NO está en caché — "
                         "se descargará la primera vez que se transcriba", _model_name)
    except Exception:
        _log.debug("No se pudo verificar el modelo en caché", exc_info=True)
    _set_windows_app_identity()
    api = Api()
    from helpmeet.media_server import MediaServer

    def _resolve_video(mid):
        s = get_session()   # sesión propia: el server corre en otro hilo
        try:
            mm = repo.get_meeting(s, int(mid))
            return mm.audio_path if mm and mm.audio_path else None
        finally:
            s.close()

    media_server = MediaServer(_resolve_video)
    media_server.start()
    api.set_media_server(media_server)
    web_dir = Path(__file__).parent / "web"
    icon_path = web_dir / "assets" / "helpmeet.ico"
    window = webview.create_window(
        "Helpmeet", str(web_dir / "index.html"),
        js_api=api, width=1100, height=720,
        frameless=True, easy_drag=False,
    )
    api.set_window(window)
    # Perfil persistente de WebView2. Sin esto (modo privado por defecto de
    # pywebview) el tema oscuro, el "tour visto" y las preferencias de la
    # interfaz se pierden cada vez que se cierra la app.
    webview.start(
        _apply_native_window_icon, args=(window, icon_path),
        private_mode=False,
        storage_path=str(config.DATA_DIR / "webview"),
    )
