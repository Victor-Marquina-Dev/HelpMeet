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
        title = (title or "").strip() or "Reunión"
        self._recorder = MeetingRecorder(
            int(initiative_id), title, self._engine,
            on_utterance=self._push_utterance,
        )
        self._recorder.start()
        m = self._recorder.meeting
        return {
            "meeting_id": m.id,
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
        }

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
        return {"ok": True, "duration": duration}

    def export(self):
        if self._recorder and self._recorder.meeting:
            out = export_meeting(self._session, self._recorder.meeting.id,
                                 config.DATA_DIR / "exports")
            return {"path": str(out)}
        return {"path": None}


def run():
    api = Api()
    web_dir = Path(__file__).parent / "web"
    window = webview.create_window(
        "Helpmeet", str(web_dir / "index.html"),
        js_api=api, width=1100, height=720,
    )
    api.set_window(window)
    webview.start()
