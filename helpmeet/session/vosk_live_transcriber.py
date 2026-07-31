"""Transcripcion en vivo con Vosk: el texto aparece palabra a palabra mientras
se habla, no a saltos de N segundos como con un motor por lotes.

Vosk es un motor de STREAMING. Se le va alimentando el audio en trozos chicos
(`POLL_INTERVAL` segundos) apenas llega, y el propio motor decide cuando una
frase esta "cerrada" (silencio detectado) — no hay que esperar a juntar un
trozo grande para transcribir. Mientras la frase sigue abierta, Vosk devuelve
un RESULTADO PARCIAL que se refina en cada pasada (`on_partial`); cuando la
cierra, ese resultado se persiste como frase definitiva (`on_utterance`) —
nunca se guarda un parcial en la base, solo frases cerradas.

Cada pista tiene su PROPIO `KaldiRecognizer`: a diferencia de CTranslate2
(Whisper), el estado de la decodificacion vive en el reconocedor, no en el
modelo, asi que dos pistas transcriben a la vez de verdad, sin necesitar un
lock compartido.

El modelo se resuelve solo (via `settings.get_transcription_model()`), no
recibe un `engine_factory` externo: a diferencia del motor de archivo
completo, aqui no hace falta un objeto con `transcribe_file()`, alcanza con
saber que modelo Vosk cargar. La carga ocurre DENTRO del hilo de cada pista,
no en `start()`: asi "Grabar" no espera a que Vosk cargue (ni a que se
descargue la primera vez) — mismo criterio que ya usaba ProgressiveTranscriber
con Whisper (ver P-01 en session/recorder.py)."""
import json
import logging
import threading
import time

from helpmeet import settings
from helpmeet.audio.resample import to_16k_mono, TARGET_RATE
from helpmeet.db import repository as repo
from helpmeet.db.database import get_session
from helpmeet.transcription.cleanup import clean_text, is_hallucination
from helpmeet.transcription.vosk_engine import get_vosk_model

log = logging.getLogger("helpmeet")


class VoskLiveTranscriber:
    """Misma interfaz publica que tenia `ProgressiveTranscriber`
    (start/stop_loop/flush_tail/close/produced_any) para que `MeetingRecorder`
    y `ScreenVideoRecorder` puedan usarla sin cambios extra, mas `on_partial`
    para el texto en vivo que todavia puede cambiar."""

    POLL_INTERVAL = 0.3  # se drena el ring buffer 3 veces por segundo

    def __init__(self, buffers: dict, meeting_id: int, language: str = "",
                 on_utterance=None, on_partial=None, session_factory=get_session):
        self._buffers = buffers
        self._meeting_id = meeting_id
        self._language = language
        self._on_utterance = on_utterance
        self._on_partial = on_partial
        self._session_factory = session_factory
        self._session = None
        self._session_lock = threading.Lock()
        self._running = False
        self._threads: dict[str, threading.Thread] = {}
        self._recognizers: dict[str, object] = {}
        self.produced_any = False

    def _ensure_session(self):
        with self._session_lock:
            if self._session is None:
                self._session = self._session_factory()
            return self._session

    def _make_recognizer(self):
        import vosk
        model_name = settings.get_transcription_model()
        model = get_vosk_model(model_name)
        rec = vosk.KaldiRecognizer(model, float(TARGET_RATE))
        rec.SetWords(True)  # timestamps por palabra: los usamos para start/end de cada frase
        return rec

    def start(self) -> None:
        self._running = True
        for label, buf in self._buffers.items():
            t = threading.Thread(target=self._track_loop, args=(label, buf), daemon=True)
            t.start()
            self._threads[label] = t

    def stop_loop(self) -> None:
        self._running = False
        for t in self._threads.values():
            t.join(timeout=15)

    def flush_tail(self) -> None:
        """Cierra cada reconocedor y persiste lo que quedara sin finalizar
        (FinalResult fuerza el cierre de la frase en curso, si habia una)."""
        for label, buf in self._buffers.items():
            self._drain_once(label, buf)  # ultimo trozo pendiente del ring buffer
            self._finalize(label)

    def close(self) -> None:
        if self._session is not None:
            self._session.close()
            self._session = None

    def _track_loop(self, label: str, buf) -> None:
        try:
            self._recognizers[label] = self._make_recognizer()
        except Exception:  # noqa: BLE001 - se registra; flush_tail() lo tolera (get() devuelve None)
            log.exception("Transcripción en vivo (Vosk): no se pudo cargar el modelo para '%s'", label)
            return
        while self._running:
            time.sleep(self.POLL_INTERVAL)
            if not self._running:
                break
            self._drain_once(label, buf)

    def _drain_once(self, label: str, buf) -> None:
        try:
            rec = self._recognizers.get(label)
            if rec is None:
                return
            data = buf.drain()
            if not data:
                return
            pcm = to_16k_mono(data, buf.rate, buf.channels)
            if not pcm:
                return
            if rec.AcceptWaveform(pcm):
                self._handle_final(label, json.loads(rec.Result()))
            else:
                partial = json.loads(rec.PartialResult()).get("partial", "").strip()
                if partial and self._on_partial:
                    self._on_partial(label, partial)
        except Exception:  # noqa: BLE001 - nunca debe tumbar la grabacion
            log.exception("Transcripcion en vivo (Vosk): fallo procesando pista '%s'", label)

    def _finalize(self, label: str) -> None:
        try:
            rec = self._recognizers.get(label)
            if rec is None:
                return
            self._handle_final(label, json.loads(rec.FinalResult()))
        except Exception:  # noqa: BLE001
            log.exception("Transcripcion en vivo (Vosk): fallo cerrando pista '%s'", label)

    def _handle_final(self, label: str, result: dict) -> None:
        text = (result.get("text") or "").strip()
        if not text or is_hallucination(text):
            if self._on_partial:
                self._on_partial(label, "")  # limpia el parcial en pantalla
            return
        text = clean_text(text)
        if not text:
            return
        words = result.get("result") or []
        start = words[0]["start"] if words else 0.0
        end = words[-1]["end"] if words else start
        row = {"speaker": label, "text": text, "start_time": start, "end_time": end,
               "language": self._language}
        session = self._ensure_session()
        created = repo.add_utterances(session, self._meeting_id, [row])
        self.produced_any = True
        if self._on_partial:
            self._on_partial(label, "")  # la frase ya quedo fija: se apaga el parcial
        if self._on_utterance and created:
            u = created[0]
            self._on_utterance(u.id, u.speaker, u.text, u.start_time, u.end_time)
