import os
import sys
import time
import wave
import json
import base64
import queue
import threading
import tempfile
import subprocess
import shutil
import webview
from pathlib import Path
from datetime import timedelta
from helpmeet.db.database import init_db, get_session
from helpmeet.db import repository as repo
# El motor de transcripción (faster-whisper) se importa de forma perezosa dentro
# de los métodos que lo crean: cargarlo arrastra CTranslate2/PyAV/numpy (~1 s) y
# la ventana no lo necesita para abrirse, solo al grabar/transcribir.
from helpmeet.session.recorder import MeetingRecorder
from helpmeet.export.exporter import (
    export_meeting, export_initiative, meeting_export_dir, build_meeting_context,
    build_transcript_txt, transcript_filename, export_transcript_package,
    transcript_package_filename,
)
from helpmeet import config
from helpmeet import settings


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


def _apply_native_window_icon(window, icon_path: Path) -> None:
    """Aplica el .ico a WinForms después de que pywebview cree la ventana."""
    if not sys.platform.startswith("win") or not window.events.shown.wait(15):
        return
    try:
        from System import Action
        from System.Drawing import Icon
        from webview.platforms.winforms import BrowserView

        form = BrowserView.instances.get(window.uid)
        if form is None:
            return
        icon = Icon(str(icon_path), 256, 256)
        _NATIVE_ICON_REFS.append(icon)  # conservar el handle durante toda la app

        def assign():
            form.Icon = icon

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


class Api:
    def __init__(self):
        init_db()
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
        self._window = None
        # Transcripción en segundo plano: cola serie + hilo worker. Permite
        # detener una grabación y empezar otra al instante mientras la anterior
        # se transcribe por detrás (una a una).
        self._jobs = None
        self._jobs_lock = threading.Lock()
        self._jobs_info = {}   # meeting_id -> {meeting_id, title, initiative_id, state, progress, stage}
        self._worker = None

    def set_window(self, window):
        self._window = window

    def list_initiatives(self):
        return [{"id": i.id, "name": i.name, "description": i.description or "",
                 "pinned": i.pinned_at is not None}
                for i in repo.list_initiatives(self._session)]

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
        return {"ok": repo.archive_item(self._session, kind, int(item_id))}

    def trash_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de mover este elemento."}
        return {"ok": repo.trash_item(self._session, kind, int(item_id))}

    def restore_item(self, kind, item_id):
        return {"ok": repo.restore_item(self._session, kind, int(item_id))}

    def permanently_delete_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de eliminar este elemento."}
        return {"ok": repo.permanently_delete_item(self._session, kind, int(item_id))}

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

    def create_initiative(self, name):
        i = repo.create_initiative(self._session, name)
        return {"id": i.id, "name": i.name}

    def rename_initiative(self, initiative_id, name):
        repo.rename_initiative(self._session, int(initiative_id), name)
        return {"ok": True}

    def rename_meeting(self, meeting_id, title):
        repo.rename_meeting(self._session, int(meeting_id), title)
        return {"ok": True}

    def move_meeting(self, meeting_id, initiative_id):
        repo.move_meeting(self._session, int(meeting_id), int(initiative_id))
        return {"ok": True}

    def get_glossary(self, initiative_id):
        from helpmeet.glossary import build_glossary
        glos = build_glossary(self._session, int(initiative_id))
        return [{"term": t, "count": c} for t, c in glos]

    def list_meetings(self, initiative_id):
        # Refrescar por si una transcripción en segundo plano (otra sesión)
        # acaba de añadir frases a alguna reunión.
        self._session.expire_all()
        meetings = repo.list_meetings(self._session, int(initiative_id))
        with self._jobs_lock:
            transcribing = {mid for mid, info in self._jobs_info.items()
                            if info.get("state") in ("queued", "running")}
        result = []
        for m in meetings:
            total = int((m.ended_at - m.started_at).total_seconds()) if m.ended_at else 0
            mm, ss = divmod(max(0, total), 60)
            is_video = bool(m.audio_path and str(m.audio_path).lower().endswith(".mp4"))
            if m.id in transcribing:
                status = "processing"   # transcribiéndose en segundo plano
            elif is_video and not m.utterances:
                status = "pending"
            elif m.ended_at:
                status = "done"
            else:
                status = "pending"
            result.append({
                "id": m.id,
                "title": m.title,
                "date": m.started_at.strftime("%d/%m/%Y %H:%M"),
                "time": _fmt_12h(m.started_at),
                "month_key": m.started_at.strftime("%Y-%m"),
                "month_label": _spanish_month(m.started_at),
                "status": status,
                "frases": len(m.utterances),
                "dur": f"{mm:02d}:{ss:02d}" if m.ended_at else "—",
                "has_video": is_video,
            })
        return result

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
            return {"title": "", "started_at": "", "utterances": [],
                    "assets": {"captures": [], "notes": [], "video": None},
                    "video_path": None}
        video = m.audio_path if (m.audio_path and str(m.audio_path).lower().endswith(".mp4")
                                 and os.path.exists(m.audio_path)) else None

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
            offset = max(0.0, (note.created_at - m.started_at).total_seconds())
            item = {
                "id": note.id, "kind": "note", "time": stamp(offset),
                "offset": offset, "text": note.text, "_sort": offset,
            }
            notes.append({key: value for key, value in item.items() if key != "_sort"})
            timeline.append(item)
        timeline.sort(key=lambda item: (item["_sort"], item["kind"] != "utterance"))
        for item in timeline:
            item.pop("_sort", None)

        return {
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "initiative_id": m.initiative_id,
            "participants": [{"id": p.id, "name": p.name, "is_me": bool(p.is_me)}
                             for p in participants],
            "utterances": timeline,
            "assets": {"captures": captures, "notes": notes, "video": video},
            "video_path": video,
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
        folder = meeting_export_dir(m, exports)
        if not folder.exists():
            export_meeting(self._session, m.id, exports)
        _open_in_explorer(folder)
        return {"ok": True, "path": str(folder)}

    def _get_engine(self):
        # Transcripción en la nube (Replicate) DESHABILITADA: se usa siempre el
        # motor local de Whisper (faster-whisper), ignorando cualquier
        # preferencia antigua de "replicate" guardada en los ajustes.
        # Si el usuario cambió el modelo en Ajustes, se reconstruye el motor.
        model = settings.get_transcription_model()
        if (self._engine is None or self._engine_provider != "local"
                or self._engine_model != model):
            from helpmeet.transcription.engine import TranscriptionEngine
            self._engine = TranscriptionEngine(model)
            self._engine_provider = "local"
            self._engine_model = model
        return self._engine

    def _get_local_engine(self):
        """Motor LOCAL (faster-whisper) para videos subidos: gratis, sin límites."""
        model = settings.get_transcription_model()
        if self._local_engine is None or self._local_engine.model_name != model:
            from helpmeet.transcription.engine import TranscriptionEngine
            self._local_engine = TranscriptionEngine(model)
        return self._local_engine

    def start_recording(self, initiative_id, title):
        if self._recorder is not None:
            return {"ok": False, "error": "Ya hay una grabación de reunión en curso."}
        if self._screen_rec is not None:
            return {"ok": False, "error": "Detén la grabación de pantalla antes de grabar una reunión."}
        self._get_engine()
        title = (title or "").strip() or "Reunión"
        prefs = settings.get_transcription_settings()
        provider = prefs["provider"]
        if provider == "auto":
            provider = "local"
        # Ambos proveedores graban de forma continua. El motor local procesa al
        # detener: es más rápido que alternar grabación/transcripción por trozos
        # y, sobre todo, no deja huecos de audio.
        live = False
        mic_muted = prefs["default_mic_muted"]
        self._recorder = MeetingRecorder(
            int(initiative_id), title, self._engine,
            live=live,
            chunk_seconds=config.CHUNK_SECONDS,
            on_utterance=self._push_utterance,
            on_status=self._push_status,
            mic_muted=mic_muted,
            on_progress=self._push_progress,
        )
        self._recorder.start()
        m = self._recorder.meeting
        self._last_meeting_id = m.id
        return {
            "ok": True,
            "meeting_id": m.id,
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "live": live,
            "provider": provider,
            "mic_muted": mic_muted,
        }

    def toggle_meeting_mic_mute(self, muted):
        """Silencia/reactiva el micrófono de una grabación de reunión normal."""
        if self._recorder is None:
            return {"ok": False, "error": "No hay una reunión grabándose."}
        self._recorder.set_mic_muted(bool(muted))
        return {"ok": True, "muted": bool(muted)}

    def _push_utterance(self, speaker, text, start, end):
        if self._window:
            self._window.evaluate_js(
                f"addUtterance({json.dumps(speaker)}, {json.dumps(text)})"
            )

    def _push_status(self, text):
        if self._window:
            self._window.evaluate_js(f"setStatus({json.dumps(text)})")

    def _push_progress(self, fraction):
        if self._window:
            self._window.evaluate_js(f"setProgress({max(0.0, min(1.0, float(fraction)))})")

    def _push_preview(self, b64):
        # base64 estándar no lleva comillas ni \, es seguro interpolarlo.
        if self._window:
            self._window.evaluate_js(f"setPreview('{b64}')")

    def list_monitors(self):
        from helpmeet.screenshot.capture import list_monitors
        return list_monitors()

    def take_capture(self, monitor_index=1):
        # Durante una grabación de pantalla, las capturas van a SU reunión.
        if self._screen_active and self._screen_meeting_id:
            from helpmeet.screenshot.capture import take_screenshot
            path = take_screenshot(config.CAPTURES_DIR, int(monitor_index))
            repo.add_capture(self._session, self._screen_meeting_id, path)
            return {"ok": True}
        if self._recorder:
            self._recorder.capture_screenshot(int(monitor_index))
            return {"ok": True}
        return {"ok": False}

    def add_note(self, text):
        text = (text or "").strip()
        if not text:
            return {"ok": False}
        if self._screen_active and self._screen_meeting_id:
            repo.add_note(self._session, self._screen_meeting_id, text)
            return {"ok": True}
        if self._recorder:
            self._recorder.add_note(text)
            return {"ok": True}
        return {"ok": False}

    # ---------- Grabación de pantalla (video) ----------
    def start_screen_recording(self, initiative_id, monitor_index=1):
        """Graba la pantalla a .mp4 (en la carpeta de la iniciativa) y crea una
        reunión para anclar capturas/notas y, opcionalmente al terminar, la
        transcripción."""
        from datetime import datetime
        from helpmeet.db.models import Initiative
        from helpmeet.video.recorder import ScreenVideoRecorder
        from helpmeet.screenshot.capture import monitor_geometry
        from helpmeet.export.exporter import initiative_month_dir

        if self._screen_rec is not None:
            return {"ok": False, "error": "Ya hay una grabación de pantalla en curso."}
        if self._screen_saving:
            return {"ok": False,
                    "error": "Espera unos segundos: se está guardando el vídeo anterior."}
        if self._recorder is not None:
            return {"ok": False,
                    "error": "Termina la grabación de reunión antes de grabar pantalla."}
        ini = self._session.get(Initiative, int(initiative_id))
        if ini is None:
            return {"ok": False, "error": "Selecciona una iniciativa primero."}

        mon = monitor_geometry(int(monitor_index))
        now = datetime.now()
        folder = initiative_month_dir(ini, settings.get_export_dir(), now)
        dest = folder / f"{now:%Y-%m-%d_%H-%M-%S}_grabacion.mp4"
        meeting = repo.start_meeting(self._session, ini.id, _spanish_date(now))
        rec = ScreenVideoRecorder(dest, mon, on_status=self._push_status,
                                  on_preview=self._push_preview)
        mic_muted = settings.get_transcription_settings()["default_mic_muted"]
        rec.set_mic_muted(mic_muted)
        try:
            rec.start()
        except Exception as exc:  # noqa: BLE001
            repo.end_meeting(self._session, meeting.id)
            return {"ok": False, "error": str(exc)}
        self._screen_rec = rec
        self._screen_active = True
        self._screen_meeting_id = meeting.id
        self._push_status("🎥 Grabando pantalla…")
        return {"ok": True, "meeting_id": meeting.id, "mic_muted": mic_muted}

    def toggle_screen_mic_mute(self, muted):
        """Silencia/activa el micrófono durante la grabación de pantalla."""
        if self._screen_rec is not None:
            self._screen_rec.set_mic_muted(bool(muted))
            return {"ok": True, "muted": bool(muted)}
        return {"ok": False}

    def set_screen_monitor(self, monitor_index):
        """Cambia en caliente la pantalla que se está grabando (1 o 2)."""
        if self._screen_rec is not None and self._screen_active:
            from helpmeet.screenshot.capture import monitor_geometry
            self._screen_rec.set_monitor(monitor_geometry(int(monitor_index)))
            return {"ok": True}
        return {"ok": False}

    def set_screen_scale_mode(self, mode):
        """Ajusta la pantalla al lienzo: fit, fill o stretch."""
        if self._screen_rec is not None and self._screen_active:
            self._screen_rec.set_scale_mode(str(mode))
            return {"ok": True, "mode": str(mode)}
        return {"ok": False}

    def stop_screen_recording(self):
        """Detiene la grabación y devuelve enseguida: el muxeo del .mp4 (que puede
        tardar varios segundos) se hace en SEGUNDO PLANO, para no bloquear la app.
        Al terminar avisa a la UI con `window.onScreenVideoSaved`."""
        rec = self._screen_rec
        if rec is None:
            return {"ok": False, "error": "No hay grabación de pantalla en curso."}
        self._screen_active = False
        meeting_id = self._screen_meeting_id
        initiative_id = None
        if meeting_id:
            m = repo.get_meeting(self._session, meeting_id)
            initiative_id = m.initiative_id if m is not None else None
        audio_channels = list(rec.audio_channels())
        # Libera el estado de grabación; el guardado va aparte. Bloqueamos solo
        # una NUEVA grabación de pantalla hasta que termine de muxearse esta.
        self._reset_screen_state()
        self._screen_saving = True
        threading.Thread(
            target=self._save_screen_video_bg,
            args=(rec, meeting_id, initiative_id, audio_channels),
            daemon=True,
        ).start()
        return {"ok": True, "meeting_id": meeting_id, "saving": True}

    def _save_screen_video_bg(self, rec, meeting_id, initiative_id, audio_channels):
        """Muxea el vídeo y lo asocia a la reunión sin bloquear la interfaz.
        Usa su propia sesión de BD (corre en un hilo aparte)."""
        ok = False
        audio = True
        try:
            result = rec.stop()
            path = result.get("path")
            ok = bool(result.get("ok") and path)
            audio = result.get("audio", True)
            if ok:
                video_path = Path(path)
                # Pistas de micro y sistema por separado: Whisper transcribe
                # mucho mejor cada una aislada que la mezcla final del vídeo.
                for label, source in audio_channels:
                    if source.exists() and source.stat().st_size > 44:
                        suffix = ".mic.wav" if label == "me" else ".system.wav"
                        shutil.copy2(source, video_path.with_suffix(suffix))
            try:
                rec.cleanup()
            except Exception:
                pass
            if meeting_id:
                from helpmeet.db.database import get_session
                session = get_session()
                try:
                    meeting = repo.get_meeting(session, meeting_id)
                    if meeting is not None and ok:
                        meeting.audio_path = path
                        session.commit()
                    repo.end_meeting(session, meeting_id)
                finally:
                    session.close()
        except Exception:
            ok = False
        finally:
            self._screen_saving = False
            self._notify_screen_saved(meeting_id, initiative_id, ok, audio)

    def _notify_screen_saved(self, meeting_id, initiative_id, ok, audio):
        if self._window:
            self._window.evaluate_js(
                "window.onScreenVideoSaved && window.onScreenVideoSaved("
                f"{json.dumps(meeting_id)}, {json.dumps(initiative_id)}, "
                f"{json.dumps(bool(ok))}, {json.dumps(bool(audio))})"
            )

    def _finish_meeting_info(self, meeting_id):
        m = repo.get_meeting(self._session, meeting_id)
        if m is None:
            return {"meeting_id": meeting_id, "title": "", "started_at": "", "utterances": []}
        return {
            "meeting_id": meeting_id,
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "utterances": [{"speaker": u.speaker, "text": u.text}
                           for u in sorted(m.utterances, key=lambda u: u.start_time)],
        }

    def transcribe_meeting_video(self, meeting_id, force=False):
        """Encola la transcripción del vídeo en SEGUNDO PLANO y vuelve enseguida,
        para poder seguir grabando otro vídeo sin esperar."""
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None or not m.audio_path or not os.path.exists(m.audio_path):
            return {"ok": False, "error": "No se encontró el video de esta reunión."}
        if m.utterances and not force:
            return {"ok": True, "already": True, "meeting_id": m.id}
        self._enqueue_video_job(m.id, m.title, m.initiative_id, bool(force))
        return {"ok": True, "queued": True, "meeting_id": m.id}

    def _transcribe_video(self, session, meeting_id, force=False,
                          on_status=None, on_progress=None):
        """Transcribe el .mp4 de una reunión usando `session` (la del worker).

        Las grabaciones nuevas usan las pistas aisladas de micrófono/sistema.
        Para videos antiguos (solo mezcla MP4), se prioriza Replicate cuando hay
        token porque ofrece mejor precisión con una única petición."""
        from helpmeet.media import extract_audio_to_wav
        on_status = on_status or (lambda *_: None)
        on_progress = on_progress or (lambda *_: None)
        m = repo.get_meeting(session, int(meeting_id))
        if m is None or not m.audio_path or not os.path.exists(m.audio_path):
            return {"ok": False, "error": "No se encontró el video de esta reunión."}

        tmp_dir = config.DATA_DIR / "tmp_audio"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp = tempfile.NamedTemporaryFile(dir=tmp_dir, suffix=".wav", delete=False)
        wav = Path(tmp.name)
        tmp.close()
        video_path = Path(m.audio_path)
        sidecars = [
            ("me", video_path.with_suffix(".mic.wav")),
            ("others", video_path.with_suffix(".system.wav")),
        ]
        tracks = [(speaker, path) for speaker, path in sidecars if path.exists()]
        new_segments = []
        try:
            if tracks:
                engine = self._get_local_engine()
            else:
                on_status("Extrayendo el audio del video…")
                extract_audio_to_wav(m.audio_path, str(wav))
                tracks = [("others", wav)]
                # Nube deshabilitada: siempre Whisper local, sin importar el token.
                engine = self._get_local_engine()

            from helpmeet.transcription.progress import WeightedProgress
            weighted = WeightedProgress([path for _, path in tracks])
            for index, (speaker, audio_path) in enumerate(tracks):
                on_status(f"Transcribiendo pista {index + 1} de {len(tracks)}…")
                if getattr(engine, "supports_progress", False):
                    def _progress(frac, track=index):
                        on_progress(weighted.at(track, frac))
                    segments = engine.transcribe_file(
                        str(audio_path), on_progress=_progress,
                        no_speech_max=0.95, quality="accurate"
                    )
                else:
                    segments = engine.transcribe_file(str(audio_path))
                for seg in segments:
                    if seg.text:
                        new_segments.append((speaker, seg))

            if not new_segments:
                raise ValueError("No se detectó voz clara en el video.")

            if force:
                for utterance in list(m.utterances):
                    session.delete(utterance)
                session.commit()
            for speaker, seg in new_segments:
                repo.add_utterance(session, m.id, speaker,
                                   seg.text, seg.start, seg.end)
            self._link_screen_captures(m.id, session)
        finally:
            try:
                if wav.exists():
                    wav.unlink()
            except Exception:
                pass
        return {"ok": True, "meeting_id": m.id}

    def _link_screen_captures(self, meeting_id, session=None):
        """Ancla cada captura a la frase de su momento (por tiempo)."""
        session = session or self._session
        m = repo.get_meeting(session, meeting_id)
        utts = sorted(m.utterances, key=lambda u: u.start_time)
        if not utts:
            return
        for cap in m.captures:
            if cap.near_utterance_id is not None:
                continue
            offset = (cap.taken_at - m.started_at).total_seconds()
            best = utts[0]
            for u in utts:
                if u.start_time <= offset:
                    best = u
                else:
                    break
            cap.near_utterance_id = best.id
        session.commit()

    def _reset_screen_state(self):
        self._screen_rec = None
        self._screen_active = False
        self._screen_meeting_id = None

    def reveal_path(self, path):
        """Abre el Explorador con el archivo seleccionado (no lo reproduce)."""
        if path:
            _reveal_in_explorer(path)
            return {"ok": True}
        return {"ok": False}

    def stop_recording(self):
        if not self._recorder:
            return {"ok": False, "duration": ""}
        recorder = self._recorder
        # 1) Detener SOLO la captura (rápido) y liberar el carril al instante:
        #    capturas/notas dejan de apuntar a esta reunión y ya puedes empezar
        #    otra grabación enseguida.
        recorder.stop_capture()
        self._recorder = None
        m = recorder.meeting
        duration = self._meeting_duration(m)
        # 2) La transcripción se hace en segundo plano (cola serie).
        self._queue_transcription(recorder)
        return {"ok": True, "meeting_id": m.id, "duration": duration,
                "queued": True, "utterances": []}

    @staticmethod
    def _meeting_duration(m):
        if m.ended_at and m.started_at:
            total = int((m.ended_at - m.started_at).total_seconds())
            mm, ss = divmod(total, 60)
            return f"{mm} min {ss} s"
        return ""

    # ---------- Transcripción en segundo plano (cola serie) ----------
    def _ensure_worker(self):
        if self._jobs is None:
            self._jobs = queue.Queue()
            self._worker = threading.Thread(target=self._job_worker, daemon=True)
            self._worker.start()

    def _enqueue_job(self, meeting_id, title, initiative_id, run):
        """Encola un trabajo de transcripción (grabación o vídeo) en segundo plano.

        `run` es un invocable que hace la transcripción usando SU propia sesión
        de BD (no la del hilo principal)."""
        self._ensure_worker()
        with self._jobs_lock:
            self._jobs_info[meeting_id] = {
                "meeting_id": meeting_id, "title": title,
                "initiative_id": initiative_id,
                "state": "queued", "progress": 0.0, "stage": "En cola",
            }
        self._push_jobs()
        self._jobs.put((meeting_id, run))

    def _queue_transcription(self, recorder):
        """Encola una grabación ya detenida para transcribirla por detrás."""
        m = recorder.meeting
        mid = m.id
        # Redirigir los avisos del recorder al indicador de segundo plano
        # (no a la barra de 'procesando', que ya no se usa al detener).
        recorder.on_utterance = None
        recorder.on_status = lambda text, _mid=mid: self._job_event(_mid, stage=text)
        recorder.on_progress = lambda frac, _mid=mid: self._job_event(_mid, progress=frac)
        self._enqueue_job(mid, m.title, m.initiative_id, recorder.transcribe)

    def _enqueue_video_job(self, meeting_id, title, initiative_id, force):
        """Encola la transcripción del .mp4 de una reunión en segundo plano."""
        on_status = lambda text, _mid=meeting_id: self._job_event(_mid, stage=text)
        on_progress = lambda frac, _mid=meeting_id: self._job_event(_mid, progress=frac)

        def run():
            s = get_session()   # sesión propia del worker (otro hilo)
            try:
                self._transcribe_video(s, meeting_id, force, on_status, on_progress)
            finally:
                s.close()
        self._enqueue_job(meeting_id, title, initiative_id, run)

    def _job_worker(self):
        while True:
            meeting_id, run = self._jobs.get()
            try:
                self._job_event(meeting_id, state="running", stage="Transcribiendo…")
                run()
                self._job_event(meeting_id, state="done", progress=1.0, stage="Listo")
            except Exception as exc:  # noqa: BLE001 - se informa al usuario
                self._job_event(meeting_id, state="error", stage=f"Error: {exc}")
            finally:
                self._jobs.task_done()
                self._finish_job(meeting_id)

    def _job_event(self, mid, **changes):
        with self._jobs_lock:
            info = self._jobs_info.get(mid)
            if info is None:
                return
            for key, value in changes.items():
                if value is not None:
                    info[key] = float(value) if key == "progress" else value
        self._push_jobs()

    def _finish_job(self, mid):
        with self._jobs_lock:
            info = dict(self._jobs_info.get(mid, {}))
        ok = info.get("state") == "done"
        ini_id = info.get("initiative_id")
        if self._window:
            self._window.evaluate_js(
                f"window.onJobFinished && window.onJobFinished("
                f"{json.dumps(mid)}, {json.dumps(ini_id)}, {json.dumps(bool(ok))})"
            )

        def _drop():
            time.sleep(4)  # deja ver "Listo"/"Error" un momento
            with self._jobs_lock:
                self._jobs_info.pop(mid, None)
            self._push_jobs()
        threading.Thread(target=_drop, daemon=True).start()

    def _push_jobs(self):
        if not self._window:
            return
        with self._jobs_lock:
            jobs = list(self._jobs_info.values())
        try:
            self._window.evaluate_js(
                f"window.onBackgroundJobs && window.onBackgroundJobs({json.dumps(jobs)})"
            )
        except Exception:
            pass

    def get_background_jobs(self):
        """Estado actual de las transcripciones en segundo plano (para la UI)."""
        with self._jobs_lock:
            return list(self._jobs_info.values())

    def export(self):
        meeting_id = (self._recorder.meeting.id if self._recorder and self._recorder.meeting
                      else self._last_meeting_id)
        if meeting_id:
            out = export_meeting(self._session, meeting_id, settings.get_export_dir())
            return {"path": str(out)}
        return {"path": None}

    # ---------- Ajustes ----------
    def get_diagnostics(self):
        """Informe de "primera ejecución": disco, modelo, audio, WebView2 y export."""
        from helpmeet import diagnostics
        return diagnostics.run_diagnostics(
            config.DATA_DIR, settings.get_export_dir(),
            settings.get_transcription_model(),
        )

    def get_recording_preflight(self, kind, monitor_index=1):
        """Diagnóstico específico que se recalcula antes de cada grabación."""
        from helpmeet import diagnostics
        monitor = None
        if kind == "screen":
            try:
                from helpmeet.screenshot.capture import monitor_geometry
                monitor = monitor_geometry(int(monitor_index))
                monitor["index"] = int(monitor_index)
            except Exception:
                monitor = None
        return diagnostics.recording_preflight(
            str(kind), config.DATA_DIR, settings.get_export_dir(),
            settings.get_transcription_model(), monitor=monitor,
            fps=config.VIDEO_FPS,
        )

    def backup_database(self):
        """Copia la base de datos y los ajustes a una carpeta elegida.

        Es una copia de seguridad de tu contenido (iniciativas, reuniones,
        transcripciones, notas…). No incluye las grabaciones ni las capturas,
        que pueden ocupar varios GB y siguen en su sitio."""
        dest = self._pick_folder()
        if not dest:
            return {"ok": False, "cancelled": True}
        from datetime import datetime as _dt
        stamp = _dt.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_dir = Path(dest) / f"helpmeet-backup-{stamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        try:
            self._session.commit()  # vuelca lo pendiente antes de copiar
        except Exception:
            pass
        copied = []
        for name in ("helpmeet.sqlite", "settings.json"):
            src = config.DATA_DIR / name
            if src.exists():
                shutil.copy2(src, backup_dir / name)
                copied.append(name)
        return {"ok": bool(copied), "path": str(backup_dir)}

    def wipe_all_data(self):
        """Borra TODOS los datos locales: base de datos, ajustes, capturas,
        grabaciones interrumpidas, temporales y el token guardado. NO toca la
        carpeta de exportación (son tus archivos). Deja la app como recién
        instalada. La interfaz debe recargarse después."""
        from helpmeet.db import database
        try:
            self._session.close()
        except Exception:
            pass
        database.dispose_engine()
        config.wipe_data_dir()
        try:
            from helpmeet import secret_store
            secret_store.delete_secret()
        except Exception:
            pass
        init_db()
        self._session = get_session()
        self._engine = None
        self._local_engine = None
        self._engine_provider = None
        self._engine_model = None
        return {"ok": True}

    def get_settings(self):
        token = settings.get_api_token()
        return {
            "export_dir": str(settings.get_export_dir()),
            "has_token": bool(token),
            "token_hint": ("…" + token[-4:]) if token else "",
            "ai_instructions": settings.get_ai_instructions(),
            "consent_seen": settings.get_consent_seen(),
            **settings.get_transcription_settings(),
        }

    def mark_consent_seen(self):
        """Marca que el usuario aceptó el aviso de consentimiento de grabación."""
        settings.set_consent_seen(True)
        return {"ok": True}

    def set_ai_instructions(self, text):
        """Guarda la cabecera de instrucciones para la IA (vacío = plantilla por defecto)."""
        settings.set_ai_instructions(text or "")
        return {"ok": True, "text": settings.get_ai_instructions()}

    def copy_initiative_context(self, initiative_id):
        """Refresca el export y devuelve el texto de `contexto.md` para copiarlo.

        Reutiliza la exportación normal (deja la carpeta al día) y lee el
        documento combinado, que ya incluye la cabecera de instrucciones,
        el objetivo, el glosario y todas las reuniones."""
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        ctx = Path(out) / "contexto.md"
        text = ctx.read_text(encoding="utf-8") if ctx.exists() else ""
        return {"ok": bool(text.strip()), "text": text, "path": str(out)}

    def copy_meeting_context(self, meeting_id):
        """Devuelve el texto de UNA reunión (con cabecera para la IA) para copiarlo."""
        text = build_meeting_context(self._session, int(meeting_id))
        return {"ok": bool(text.strip()), "text": text}

    def set_api_token(self, token):
        settings.set_api_token(token)
        self._engine = None  # forzar recrear el motor con el token nuevo
        self._engine_provider = None
        return {"ok": True}

    def get_transcription_settings(self):
        return settings.get_transcription_settings()

    def set_transcription_settings(self, values):
        result = settings.set_transcription_settings(values or {})
        # El motor se reconstruye en el próximo uso (puede haber cambiado el modelo).
        self._engine = None
        self._engine_provider = None
        self._engine_model = None
        return {"ok": True, **result}

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

    def import_media(self, initiative_id):
        """Pide un video/audio, le saca el audio, lo transcribe (LOCAL) y lo guarda.

        Los videos subidos se transcriben en el PC (faster-whisper): gratis, sin
        límite de tiempo ni de saldo, ideal para archivos grandes.
        """
        from helpmeet.media import extract_audio_to_wav
        src = self._pick_file()
        if not src:
            return {"ok": False}

        title = Path(src).stem or "Video importado"
        meeting = repo.start_meeting(self._session, int(initiative_id), title)
        tmp_dir = config.DATA_DIR / "tmp_audio"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp = tempfile.NamedTemporaryFile(dir=tmp_dir, suffix=".wav", delete=False)
        wav = Path(tmp.name)
        tmp.close()
        try:
            self._push_status("📹 Extrayendo el audio del video…")
            extract_audio_to_wav(src, str(wav))
            audio_seconds = _wav_seconds(wav)
            self._push_status("📹 Preparando el modelo (la 1ª vez se descarga)…")
            engine = self._get_local_engine()

            start = time.time()

            def _progress(frac):
                pct = int(frac * 100)
                eta = ""
                if frac > 0.02:
                    rem = (time.time() - start) / frac * (1 - frac)
                    if rem > 3:
                        eta = f" · ~{int(rem // 60)} min {int(rem % 60)} s restantes"
                self._push_status(f"📹 Transcribiendo… {pct}%{eta}")
                if self._window:
                    self._window.evaluate_js(f"setProgress({frac})")

            utterances = []
            # Para archivos priorizamos precisión: beam search más amplio y
            # contexto entre segmentos. El filtro 0.95 solo elimina silencio claro.
            for seg in engine.transcribe_file(str(wav), on_progress=_progress,
                                              no_speech_max=0.95,
                                              quality="accurate"):
                if not seg.text:
                    continue
                repo.add_utterance(self._session, meeting.id, "others",
                                   seg.text, seg.start, seg.end)
                utterances.append({"speaker": "others", "text": seg.text})
            if not utterances:
                raise ValueError(
                    "No se detectó voz en el archivo. Comprueba que tenga audio audible."
                )
        except Exception as exc:  # noqa: BLE001 - se informa al usuario
            self._session.delete(meeting)
            self._session.commit()
            self._push_status("")
            return {"ok": False, "error": str(exc)}
        finally:
            try:
                wav.unlink(missing_ok=True)
            except Exception:
                pass

        repo.end_meeting(self._session, meeting.id)
        # La duración debe ser la del video, no el rato que tardó en importar.
        if audio_seconds:
            meeting.ended_at = meeting.started_at + timedelta(seconds=int(audio_seconds))
            self._session.commit()
        self._push_status("")
        return {
            "ok": True,
            "meeting_id": meeting.id,
            "title": title,
            "started_at": meeting.started_at.strftime("%Y-%m-%d %H:%M"),
            "utterances": utterances,
        }

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


def run():
    _set_windows_app_identity()
    api = Api()
    web_dir = Path(__file__).parent / "web"
    icon_path = web_dir / "assets" / "helpmeet.ico"
    window = webview.create_window(
        "Helpmeet", str(web_dir / "index.html"),
        js_api=api, width=1100, height=720,
    )
    api.set_window(window)
    webview.start(_apply_native_window_icon, args=(window, icon_path))
