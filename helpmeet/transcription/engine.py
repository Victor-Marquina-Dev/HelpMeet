"""Motor de transcripción de archivo completo (Vosk).

Se usa para lo que necesita "dame un WAV, dame frases": importar un
video/audio externo, re-transcribir el video de una reunión, recuperar una
grabación interrumpida. El camino EN VIVO (mientras grabas) no pasa por
aquí — usa `session/vosk_live_transcriber.py`, que alimenta el reconocedor en
streaming en vez de esperar a tener el archivo completo.

Vosk no tiene un concepto de "calidad" ajustable dentro del mismo modelo (a
diferencia de Whisper, que variaba beam_size/condition_on_previous_text según
`quality`): la precisión depende del MODELO elegido (rápido/preciso, ver
`settings.VOSK_TIERS`), no de un parámetro por llamada. `quality` y
`no_speech_max` se aceptan por compatibilidad de firma con quien ya llama a
`transcribe_file()`, pero no cambian nada en este motor.
"""
import logging
import wave

from helpmeet.audio.resample import to_16k_mono, TARGET_RATE
from helpmeet.transcription.cleanup import clean_text, is_hallucination
from helpmeet.transcription.segment import TranscribedSegment
from helpmeet.transcription.vosk_engine import get_vosk_model

log = logging.getLogger("helpmeet")

_CHUNK_FRAMES = 8000  # ~0.5s a 16kHz: tamaño de trozo recomendado para AcceptWaveform


class TranscriptionEngine:
    """Envoltorio de Vosk para transcribir un archivo completo. Carga el
    modelo una vez y transcribe audio."""

    supports_progress = True

    def __init__(self, model_name: str | None = None):
        if model_name is None:
            from helpmeet import settings
            model_name = settings.get_transcription_model()
        self.requested_model_name = model_name
        self.model_name = model_name
        self._model = get_vosk_model(model_name)

    def transcribe_file(self, audio_path: str, on_progress=None,
                        no_speech_max: float = 0.9,
                        quality: str = "fast",
                        language: str | None = None) -> list[TranscribedSegment]:
        """Transcribe un archivo completo. `on_progress(fraccion 0..1)` se
        llama según avanza, proporcional a la duración de audio ya procesada.
        `no_speech_max` y `quality`: aceptados por compatibilidad, sin efecto
        en Vosk (ver docstring del módulo). `language`: sin efecto — el
        idioma queda fijado por el modelo con el que se creó este motor."""
        import vosk
        rec = vosk.KaldiRecognizer(self._model, float(TARGET_RATE))
        rec.SetWords(True)

        with wave.open(audio_path, "rb") as wf:
            results = self._feed_wav(rec, wf, on_progress)

        final = _parse_result(rec.FinalResult())
        if final.get("result"):
            results.append(final)

        if on_progress:
            on_progress(1.0)
        return _results_to_segments(results)

    @staticmethod
    def _feed_wav(rec, wf: wave.Wave_read, on_progress) -> list[dict]:
        """Lee el WAV en trozos, los resamplea a 16kHz mono y los alimenta al
        reconocedor, reportando progreso y devolviendo cada resultado cerrado
        (frase completa detectada por silencio) que Vosk vaya entregando."""
        rate = wf.getframerate()
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        total_frames = wf.getnframes()
        processed_frames = 0
        results: list[dict] = []
        while True:
            chunk = wf.readframes(_CHUNK_FRAMES)
            if not chunk:
                break
            processed_frames += len(chunk) // (channels * sampwidth)
            pcm = to_16k_mono(chunk, rate, channels, sampwidth)
            if pcm and rec.AcceptWaveform(pcm):
                results.append(_parse_result(rec.Result()))
            if on_progress and total_frames:
                on_progress(min(1.0, processed_frames / total_frames))
        return results


def _parse_result(raw_json: str) -> dict:
    import json
    try:
        return json.loads(raw_json)
    except Exception:  # noqa: BLE001 - un resultado corrupto no debe tumbar la transcripción
        log.exception("Vosk devolvió un resultado no parseable")
        return {}


def _results_to_segments(results: list[dict]) -> list[TranscribedSegment]:
    segments: list[TranscribedSegment] = []
    for r in results:
        text = (r.get("text") or "").strip()
        if not text or is_hallucination(text):
            continue
        text = clean_text(text)
        if not text:
            continue
        words = r.get("result") or []
        start = words[0]["start"] if words else 0.0
        end = words[-1]["end"] if words else start
        segments.append(TranscribedSegment(text, start, end))
    return segments
