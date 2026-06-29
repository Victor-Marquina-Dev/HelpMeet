import threading
import time
import uuid
import shutil
import wave
from pathlib import Path
import numpy as np
from helpmeet import config
from helpmeet import recovery
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
        # Carpeta de audio ÚNICA por grabación: así, si esta reunión se
        # transcribe en segundo plano mientras grabas otra, sus WAV no se pisan.
        self._tmp = recovery.recovery_dir() / uuid.uuid4().hex
        self._tmp.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_recovery(cls, data: dict, engine, on_status=None, on_progress=None):
        """Reconstruye el procesador de una grabación persistida sin recapturar."""
        obj = cls.__new__(cls)
        obj.initiative_id = int(data["initiative_id"])
        obj.title = data.get("title") or "Reunión recuperada"
        obj.engine = engine
        obj.live = False
        obj.chunk_seconds = 0
        obj.on_utterance = None
        obj.on_status = on_status
        obj.on_progress = on_progress
        obj._mic_muted = False
        obj._running = False
        obj._session = get_session()
        obj.meeting = repo.get_meeting(obj._session, int(data["meeting_id"]))
        if obj.meeting is None:
            obj._session.close()
            raise ValueError("La reunión asociada ya no existe.")
        obj._last_utterance_id = None
        obj._thread = None
        obj._recorder = None
        obj._tmp = Path(data["work_dir"])
        for _, filename in _CHANNELS:
            recovery.repair_wav(obj._tmp / filename)
        return obj

    def start(self):
        self.meeting = repo.start_meeting(self._session, self.initiative_id, self.title)
        recovery.write_manifest(self._tmp, {
            "version": 1,
            "id": self._tmp.name,
            "kind": "audio",
            "meeting_id": self.meeting.id,
            "initiative_id": self.meeting.initiative_id,
            "title": self.meeting.title,
            "started_at": self.meeting.started_at.isoformat(),
            "state": "recording",
        })
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
        """True si el WAV tiene sonido real (evita transcribir silencio).

        P-03: se lee por bloques y se acumula la suma de cuadrados, así una
        reunión larga no carga toda la pista en memoria. Además corta en cuanto
        un bloque supera claramente el umbral (hay voz)."""
        try:
            total_sq = 0.0
            total = 0
            with wave.open(str(wav), "rb") as wf:
                while True:
                    chunk = wf.readframes(8192)
                    if not chunk:
                        break
                    data = np.frombuffer(chunk, dtype=np.int16).astype(np.float64)
                    if data.size == 0:
                        continue
                    block_rms = np.sqrt(np.dot(data, data) / data.size)
                    if block_rms > threshold * 2:  # voz clara: no hace falta seguir
                        return True
                    total_sq += float(np.dot(data, data))
                    total += data.size
            if total == 0:
                return False
            return np.sqrt(total_sq / total) > threshold
        except Exception:
            return True  # ante la duda, intenta transcribir

    def _store_segments(self, label, wav, elapsed):
        if not wav.exists() or not self._has_audio(wav):
            return
        self._resolve_engine()
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
        if not tracks:
            if self.on_status:
                self.on_status("No se detectó audio grabado")
            raise RuntimeError(
                "No se detectó audio en la grabación. "
                "Comprueba que el micrófono esté activo y sin silenciar."
            )
        from helpmeet.transcription.progress import WeightedProgress
        weighted = WeightedProgress([wav for _, wav in tracks])
        failures = []
        for index, (label, wav) in enumerate(tracks):
            try:
                if self.on_status:
                    self.on_status(f"Transcribiendo pista {index + 1} de {len(tracks)}…")
                if getattr(self.engine, "supports_progress", False):
                    def track_progress(fraction, track=index):
                        if self.on_progress:
                            self.on_progress(weighted.at(track, fraction))
                    segments = self.engine.transcribe_file(
                        str(wav), on_progress=track_progress, quality="fast"
                    )
                else:
                    segments = self.engine.transcribe_file(str(wav))
            except Exception as exc:  # noqa: BLE001 - se informa al usuario
                failures.append(exc)
                if self.on_status:
                    self.on_status(f"No se pudo transcribir una pista: {exc}")
                continue
            rows = [
                {"speaker": label, "text": seg.text,
                 "start_time": seg.start, "end_time": seg.end}
                for seg in segments if seg.text
            ]
            created = repo.add_utterances(self._session, self.meeting.id, rows)
            if created:
                self._last_utterance_id = created[-1].id
            if self.on_utterance:  # modo live: avisar de cada frase
                for u in created:
                    self.on_utterance(u.speaker, u.text, u.start_time, u.end_time)
        if self.on_progress and tracks and getattr(self.engine, "supports_progress", False):
            self.on_progress(1.0)
        if tracks and len(failures) == len(tracks):
            raise RuntimeError(f"No se pudo transcribir el audio: {failures[-1]}")

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

    def stop_capture(self):
        """Detiene SOLO la captura de audio (rápido) y deja los WAV listos.

        Marca la reunión como terminada (su duración). La transcripción se hace
        aparte con `transcribe()`, normalmente desde un worker en segundo plano,
        para no bloquear ni impedir empezar otra grabación."""
        self._running = False
        if self.live:
            if self._thread:
                self._thread.join(timeout=60)
        elif self._recorder:
            self._recorder.stop()
        repo.end_meeting(self._session, self.meeting.id)
        recovery.update_session(self._tmp, state="captured")

    def _resolve_engine(self):
        """Carga el motor de forma perezosa. `engine` puede ser una instancia o
        una *factory* (callable que la crea). Así empezar a grabar NO espera a que
        Whisper cargue: el modelo se carga al comenzar a transcribir (al detener)."""
        if not hasattr(self.engine, "transcribe_file") and callable(self.engine):
            if self.on_status:
                self.on_status("Cargando el modelo…")
            self.engine = self.engine()
        return self.engine

    def _persist_audio(self):
        """Mezcla me.wav + others.wav y guarda grabacion.wav en el directorio
        de medios interno. La ruta queda registrada en meeting.audio_path para
        que el exportador la mueva después a la carpeta del usuario."""
        from helpmeet.media_storage import meeting_media_dir
        from helpmeet.audio.mixing import mix_wavs
        me_wav = self._tmp / "me.wav"
        others_wav = self._tmp / "others.wav"
        media_dir = meeting_media_dir(self.meeting.id)
        media_dir.mkdir(parents=True, exist_ok=True)
        out = media_dir / "grabacion.wav"
        try:
            ok = mix_wavs(me_wav, others_wav, out)
            if ok and out.exists() and out.stat().st_size > 0:
                self.meeting.audio_path = str(out)
                self._session.commit()
        except Exception:
            pass

    def transcribe(self):
        """Transcribe el audio ya grabado y enlaza las capturas por tiempo.

        Se llama después de `stop_capture()`. Al terminar limpia su carpeta de
        audio temporal. En modo live el texto ya se generó durante la grabación."""
        if not self.live:
            self._resolve_engine()
            if self.on_status:
                self.on_status("Preparando la transcripción…")
            self._transcribe_channels()
        self._link_captures_by_time()
        self._persist_audio()
        # Solo se elimina al completar todo. Si Python/Windows se cierra o el
        # motor falla, el manifiesto y los WAV quedan disponibles al reiniciar.
        self._cleanup_tmp()

    def _cleanup_tmp(self):
        shutil.rmtree(self._tmp, ignore_errors=True)

    def stop(self):
        """Compatibilidad: detiene y transcribe de forma síncrona (un solo paso)."""
        self.stop_capture()
        self.transcribe()
