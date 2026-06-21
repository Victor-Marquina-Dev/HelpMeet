import webview
from pathlib import Path
from helpmeet.db.database import init_db, get_session
from helpmeet.db import repository as repo
from helpmeet.transcription.engine import TranscriptionEngine
from helpmeet.transcription.replicate_engine import ReplicateTranscriptionEngine
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

    def list_meetings(self, initiative_id):
        meetings = repo.list_meetings(self._session, int(initiative_id))
        return [
            {"id": m.id, "title": m.title, "date": m.started_at.strftime("%d/%m/%Y %H:%M")}
            for m in meetings
        ]

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
        out = export_meeting(self._session, int(meeting_id), config.DATA_DIR / "exports")
        return {"path": str(out)}

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
