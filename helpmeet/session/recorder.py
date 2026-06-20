import threading
import time
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
