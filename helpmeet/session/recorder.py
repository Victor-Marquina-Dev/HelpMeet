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

    - live=True  : modo heredado por trozos con texto en vivo.
    - live=False : graba la reunión entera sin cortes y la transcribe al parar,
                   tanto en local como con Replicate. Sin huecos de audio.
    """

    def __init__(self, initiative_id: int, title: str, engine, live: bool = False,
                 chunk_seconds: int = 6, on_utterance=None, on_status=None,
                 mic_muted: bool = False, on_progress=None):
        self.initiative_id = initiative_id
        self.title = title
        self.engine = engine
        self.live = live
        self.chunk_seconds = chunk_seconds
        self.on_utterance = on_utterance
        self.on_status = on_status
        self.on_progress = on_progress
        self._mic_muted = bool(mic_muted)
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
            self._recorder.set_mic_muted(self._mic_muted)
            self._recorder.start()

    # ---------- modo en vivo (local, por trozos) ----------
    def _live_loop(self):
        elapsed = 0.0
        while self._running:
            rec = DualAudioRecorder(self._tmp)
            self._recorder = rec
            rec.set_mic_muted(self._mic_muted)
            rec.start()
            self._wait_chunk()
            rec.stop()
            for label, fname in _CHANNELS:
                self._store_segments(label, self._tmp / fname, elapsed)
            elapsed += self.chunk_seconds

    def set_mic_muted(self, muted: bool) -> None:
        """Silencia/reactiva la pista del usuario durante cualquier modo."""
        self._mic_muted = bool(muted)
        if self._recorder is not None:
            self._recorder.set_mic_muted(self._mic_muted)

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

    def add_note(self, text: str):
        """Guarda una nota anclada al momento actual de la reunión."""
        return repo.add_note(self._session, self.meeting.id, text)

    def _transcribe_channels(self):
        """Transcribe las pistas con audio UNA A UNA.

        Replicate con saldo bajo solo permite 1 petición a la vez (burst=1),
        así que NO se puede paralelizar. Si una pista falla, se avisa por
        `on_status` y se sigue con la otra (no se traga el error en silencio)."""
        tracks = [
            (label, self._tmp / fname)
            for label, fname in _CHANNELS
            if (self._tmp / fname).exists() and self._has_audio(self._tmp / fname)
        ]
        for index, (label, wav) in enumerate(tracks):
            try:
                if self.on_status:
                    self.on_status(f"Transcribiendo pista {index + 1} de {len(tracks)}…")
                if getattr(self.engine, "supports_progress", False):
                    def track_progress(fraction, track=index):
                        if self.on_progress and tracks:
                            self.on_progress((track + fraction) / len(tracks))
                    segments = self.engine.transcribe_file(
                        str(wav), on_progress=track_progress, quality="fast"
                    )
                else:
                    segments = self.engine.transcribe_file(str(wav))
            except Exception as exc:  # noqa: BLE001 - se informa al usuario
                if self.on_status:
                    self.on_status(f"No se pudo transcribir una pista: {exc}")
                continue
            for seg in segments:
                if not seg.text:
                    continue
                u = repo.add_utterance(self._session, self.meeting.id, label,
                                       seg.text, seg.start, seg.end)
                self._last_utterance_id = u.id
                if self.on_utterance:
                    self.on_utterance(label, seg.text, u.start_time, u.end_time)
        if self.on_progress and tracks and getattr(self.engine, "supports_progress", False):
            self.on_progress(1.0)

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
                self.on_status("Preparando la transcripción…")
            self._transcribe_channels()
        self._link_captures_by_time()
        repo.end_meeting(self._session, self.meeting.id)
