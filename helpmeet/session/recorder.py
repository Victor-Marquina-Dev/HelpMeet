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
        self._thread = None
        self._tmp = config.DATA_DIR / "tmp_audio"

    def start(self):
        self.meeting = repo.start_meeting(self._session, self.initiative_id, self.title)
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        elapsed = 0.0
        while self._running:
            rec = DualAudioRecorder(self._tmp)
            rec.start()
            self._wait_chunk()
            rec.stop()
            for label, fname in (("me", "me.wav"), ("others", "others.wav")):
                self._store_segments(label, self._tmp / fname, elapsed)
            elapsed += self.chunk_seconds

    def _wait_chunk(self):
        """Espera el trozo en pasos cortos para poder cortar al pulsar Parar."""
        slept = 0.0
        while self._running and slept < self.chunk_seconds:
            time.sleep(0.2)
            slept += 0.2

    def _store_segments(self, label, wav, elapsed):
        """Transcribe un WAV y guarda cada frase, avisando a la UI."""
        if not wav.exists():
            return
        for seg in self.engine.transcribe_file(str(wav)):
            if not seg.text:
                continue
            u = repo.add_utterance(self._session, self.meeting.id, label,
                                   seg.text, elapsed + seg.start, elapsed + seg.end)
            self._last_utterance_id = u.id
            if self.on_utterance:
                self.on_utterance(label, seg.text, u.start_time, u.end_time)

    def capture_screenshot(self):
        path = take_screenshot(config.CAPTURES_DIR)
        repo.add_capture(self._session, self.meeting.id, path,
                         near_utterance_id=self._last_utterance_id)
        return path

    def stop(self):
        # Detener y ESPERAR a que termine el último trozo (transcripción incluida),
        # así no llegan frases después de marcar la reunión como finalizada.
        self._running = False
        if self._thread:
            self._thread.join(timeout=60)
        repo.end_meeting(self._session, self.meeting.id)
