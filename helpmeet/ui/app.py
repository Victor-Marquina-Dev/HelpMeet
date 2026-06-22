import os
import sys
import subprocess
import webview
from pathlib import Path
from helpmeet.db.database import init_db, get_session
from helpmeet.db import repository as repo
from helpmeet.transcription.engine import TranscriptionEngine
from helpmeet.transcription.replicate_engine import ReplicateTranscriptionEngine
from helpmeet.session.recorder import MeetingRecorder
from helpmeet.export.exporter import export_meeting, export_initiative, meeting_export_dir
from helpmeet import config
from helpmeet import settings


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


class Api:
    def __init__(self):
        init_db()
        settings.apply_env()  # vuelca el token guardado a la variable de entorno
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
        meetings = repo.list_meetings(self._session, int(initiative_id))
        return [
            {"id": m.id, "title": m.title, "date": m.started_at.strftime("%d/%m/%Y %H:%M")}
            for m in meetings
        ]

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
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"title": "", "started_at": "", "utterances": []}
        return {
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "utterances": [
                {"speaker": u.speaker, "text": u.text}
                for u in sorted(m.utterances, key=lambda u: u.start_time)
            ],
        }

    def export_meeting_by_id(self, meeting_id):
        out = export_meeting(self._session, int(meeting_id), settings.get_export_dir())
        return {"path": str(out)}

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

    def start_recording(self, initiative_id, title):
        if self._engine is None:
            if config.USE_REPLICATE:
                self._engine = ReplicateTranscriptionEngine()
            else:
                self._engine = TranscriptionEngine()
        title = (title or "").strip() or "Reunión"
        live = not config.USE_REPLICATE
        self._recorder = MeetingRecorder(
            int(initiative_id), title, self._engine,
            live=live,
            chunk_seconds=config.CHUNK_SECONDS,
            on_utterance=self._push_utterance,
            on_status=self._push_status,
        )
        self._recorder.start()
        m = self._recorder.meeting
        return {
            "meeting_id": m.id,
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "live": live,
        }

    def _push_utterance(self, speaker, text, start, end):
        if self._window:
            safe = text.replace("\\", "\\\\").replace("'", "\\'")
            self._window.evaluate_js(f"addUtterance('{speaker}', '{safe}')")

    def _push_status(self, text):
        if self._window:
            safe = text.replace("\\", "\\\\").replace("'", "\\'")
            self._window.evaluate_js(f"setStatus('{safe}')")

    def list_monitors(self):
        from helpmeet.screenshot.capture import list_monitors
        return list_monitors()

    def take_capture(self, monitor_index=1):
        if self._recorder:
            self._recorder.capture_screenshot(int(monitor_index))
            return {"ok": True}
        return {"ok": False}

    def add_note(self, text):
        text = (text or "").strip()
        if self._recorder and text:
            self._recorder.add_note(text)
            return {"ok": True}
        return {"ok": False}

    def stop_recording(self):
        if not self._recorder:
            return {"ok": False, "duration": ""}
        self._recorder.stop()
        m = self._recorder.meeting
        if m.ended_at and m.started_at:
            total = int((m.ended_at - m.started_at).total_seconds())
            mm, ss = divmod(total, 60)
            duration = f"{mm} min {ss} s"
        else:
            duration = ""
        utterances = [
            {"speaker": u.speaker, "text": u.text}
            for u in sorted(m.utterances, key=lambda u: u.start_time)
        ]
        return {"ok": True, "duration": duration, "utterances": utterances}

    def export(self):
        if self._recorder and self._recorder.meeting:
            out = export_meeting(self._session, self._recorder.meeting.id,
                                 settings.get_export_dir())
            return {"path": str(out)}
        return {"path": None}

    # ---------- Ajustes ----------
    def get_settings(self):
        token = settings.get_api_token()
        return {
            "export_dir": str(settings.get_export_dir()),
            "has_token": bool(token),
            "token_hint": ("…" + token[-4:]) if token else "",
        }

    def set_api_token(self, token):
        settings.set_api_token(token)
        self._engine = None  # forzar recrear el motor con el token nuevo
        return {"ok": True}

    def _pick_folder(self):
        """Abre el diálogo nativo para elegir una carpeta. Devuelve la ruta o None."""
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None

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
    api = Api()
    web_dir = Path(__file__).parent / "web"
    window = webview.create_window(
        "Helpmeet", str(web_dir / "index.html"),
        js_api=api, width=1100, height=720,
    )
    api.set_window(window)
    webview.start()
