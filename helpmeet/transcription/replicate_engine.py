import os
import time
import wave
import tempfile
import numpy as np
import httpx
import replicate
from dotenv import load_dotenv
from helpmeet import config
from helpmeet.transcription.cleanup import clean_text, is_hallucination
from helpmeet.transcription.segment import TranscribedSegment

# Carga REPLICATE_API_TOKEN desde el archivo .env (no versionado).
load_dotenv()

# Reintentos ante throttling (HTTP 429). Con saldo < $5 Replicate limita a
# 6 peticiones/min y 1 a la vez; el límite se resetea en ~10 s.
MAX_RETRIES = 4
RETRY_WAIT_S = 12

# Tiempo de espera amplio (15 min): el por defecto de la librería es 30 s, que
# se queda corto al subir/procesar el audio de videos largos.
REQUEST_TIMEOUT = httpx.Timeout(900.0, connect=15.0)

# Si un segmento tiene una probabilidad de "no hay voz" mayor que esto, se
# descarta (es silencio y Whisper estaría "alucinando" texto). 0.6 es el
# umbral estándar de Whisper.
NO_SPEECH_MAX = 0.6


def _is_throttle(exc: Exception) -> bool:
    """True si el error es un rechazo por límite de peticiones (429)."""
    if getattr(exc, "status", None) == 429:
        return True
    s = str(exc).lower()
    return "429" in s or "throttl" in s or "rate limit" in s

# Modelo Whisper alojado en Replicate (misma versión que la web de Replicate).
WHISPER_MODEL_VERSION = (
    "openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e"
)

TARGET_SR = 16000  # Whisper trabaja a 16 kHz mono; enviar más es desperdiciar datos


def _prepare_audio(src_path: str) -> str:
    """Convierte el WAV a 16 kHz mono para subir mucho más rápido.

    Devuelve la ruta de un WAV temporal reducido (o el original si algo falla).
    """
    try:
        with wave.open(src_path, "rb") as w:
            sr = w.getframerate()
            ch = w.getnchannels()
            data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if data.size == 0:
            return src_path
        if ch > 1:
            data = data.reshape(-1, ch).mean(axis=1).astype(np.int16)
        if sr != TARGET_SR:
            n_out = int(len(data) * TARGET_SR / sr)
            data = np.interp(
                np.linspace(0, 1, n_out, endpoint=False),
                np.linspace(0, 1, len(data), endpoint=False),
                data,
            ).astype(np.int16)
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp.close()
        with wave.open(tmp.name, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(TARGET_SR)
            w.writeframes(data.tobytes())
        return tmp.name
    except Exception:
        return src_path


class ReplicateTranscriptionEngine:
    """Transcribe enviando el audio al modelo Whisper alojado en Replicate."""

    def transcribe_file(self, audio_path: str) -> list[TranscribedSegment]:
        prepared = _prepare_audio(audio_path)
        try:
            output = self._run(prepared)
        finally:
            if prepared != audio_path and os.path.exists(prepared):
                os.remove(prepared)

        segments = output.get("segments", []) if isinstance(output, dict) else []
        result = []
        for s in segments:
            if s.get("no_speech_prob", 0.0) > NO_SPEECH_MAX:  # silencio: no hay voz
                continue
            raw = s.get("text", "")
            if is_hallucination(raw):   # descarta "suscríbete", "gracias por ver"…
                continue
            text = clean_text(raw)
            if text:
                result.append(
                    TranscribedSegment(text, float(s.get("start", 0.0)), float(s.get("end", 0.0)))
                )
        return result

    def _run(self, prepared: str):
        """Llama a Replicate; si hay throttling (429) espera y reintenta."""
        client = replicate.Client(
            api_token=os.environ.get("REPLICATE_API_TOKEN"),
            timeout=REQUEST_TIMEOUT,
        )
        last_exc = None
        for attempt in range(MAX_RETRIES):
            try:
                with open(prepared, "rb") as audio:
                    return client.run(
                        WHISPER_MODEL_VERSION,
                        input={"audio": audio, "language": config.WHISPER_LANGUAGE},
                    )
            except Exception as exc:  # noqa: BLE001 - se re-lanza si no es throttling
                last_exc = exc
                if _is_throttle(exc) and attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_WAIT_S)
                    continue
                raise
        raise last_exc
