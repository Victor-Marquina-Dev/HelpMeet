import threading
import time
import wave
import numpy as np
from helpmeet import config
from helpmeet.db.database import get_session
from helpmeet.db import repository as repo
from helpmeet.audio.capture import DualAudioRecorder
from helpmeet.screenshot.capture import take_screenshot

_CHANNELS = (("me", "me.wav"), ("others", "others.wav"))


class MeetingRecorder:
    """Orquesta una reunión.

    - live=True  : graba por trozos y transcribe en vivo (modo local).
    - live=False : graba la reunión entera sin cortes y la transcribe de una
                   sola vez al parar (modo Replicate). Sin huecos de audio.
    """

    def __init__(self, initiative_id: int, title: str, engine, live: bool = False,
                 chunk_seconds: int = 6, on_utterance=None, on_status=None):
        self.initiative_id = initiative_id
        self.title = title
        self.engine = engine
        self.live = live
        self.chunk_seconds = chunk_seconds
        self.on_utterance = on_utterance
        self.on_status = on_status
        self._running = False
        self._session = get_session()
        self.meeting = None
        self._last_utterance_id = None
        self._thread = None
        self._recorder = None
        self._tmp = config.DATA_DIR / "tmp_audio"

    def start(self):
        self.meeting = repo.start_meeting(self._session, self.initiative_id, self.title)
        self._running = True
        if self.live:
            self._thread = threading.Thread(target=self._live_loop, daemon=True)
            self._thread.start()
        else:
            # grabación continua de toda la reunión (sin huecos)
            self._recorder = DualAudioRecorder(self._tmp)
            self._recorder.start()

    # ---------- modo en vivo (local, por trozos) ----------
    def _live_loop(self):
        elapsed = 0.0
        while self._running:
            rec = DualAudioRecorder(self._tmp)
            rec.start()
            self._wait_chunk()
            rec.stop()
            for label, fname in _CHANNELS:
                self._store_segments(label, self._tmp / fname, elapsed)
            elapsed += self.chunk_seconds

    def _wait_chunk(self):
        slept = 0.0
        while self._running and slept < self.chunk_seconds:
            time.sleep(0.2)
            slept += 0.2

    # ---------- común ----------
    @staticmethod
    def _has_audio(wav, threshold: float = 30.0) -> bool:
        """True si el WAV tiene sonido real (evita transcribir silencio)."""
        try:
            with wave.open(str(wav), "rb") as wf:
                frames = wf.readframes(wf.getnframes())
            if not frames:
                return False
            samples = np.frombuffer(frames, dtype=np.int16)
            if samples.size == 0:
                return False
            rms = np.sqrt(np.mean(samples.astype(np.float64) ** 2))
            return rms > threshold
        except Exception:
            return True  # ante la duda, intenta transcribir

    def _store_segments(self, label, wav, elapsed):
        if not wav.exists() or not self._has_audio(wav):
            return
        for seg in self.engine.transcribe_file(str(wav)):
            if not seg.text:
                continue
            u = repo.add_utterance(self._session, self.meeting.id, label,
                                   seg.text, elapsed + seg.start, elapsed + seg.end)
            self._last_utterance_id = u.id
            if self.on_utterance:
                self.on_utterance(label, seg.text, u.start_time, u.end_time)

    def capture_screenshot(self, monitor_index: int = 1):
        path = take_screenshot(config.CAPTURES_DIR, monitor_index)
        repo.add_capture(self._session, self.meeting.id, path,
                         near_utterance_id=self._last_utterance_id)
        return path

    def _link_captures_by_time(self):
        """Asigna cada captura a la frase de su momento (por tiempo)."""
        utts = sorted(self.meeting.utterances, key=lambda u: u.start_time)
        if not utts:
            return
        for cap in self.meeting.captures:
            if cap.near_utterance_id is not None:
                continue
            offset = (cap.taken_at - self.meeting.started_at).total_seconds()
            best = utts[0]
            for u in utts:
                if u.start_time <= offset:
                    best = u
                else:
                    break
            cap.near_utterance_id = best.id
        self._session.commit()

    def stop(self):
        self._running = False
        if self.live:
            if self._thread:
                self._thread.join(timeout=60)
        else:
            # parar grabación y transcribir TODO el audio de una vez
            self._recorder.stop()
            if self.on_status:
                self.on_status("Transcribiendo con Replicate… (puede tardar un poco)")
            for label, fname in _CHANNELS:
                self._store_segments(label, self._tmp / fname, 0.0)
        self._link_captures_by_time()
        repo.end_meeting(self._session, self.meeting.id)
