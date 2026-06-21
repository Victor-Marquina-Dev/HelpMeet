import os
import wave
import tempfile
import numpy as np
import replicate
from dotenv import load_dotenv
from helpmeet import config
from helpmeet.transcription.cleanup import clean_text
from helpmeet.transcription.segment import TranscribedSegment

# Carga REPLICATE_API_TOKEN desde el archivo .env (no versionado).
load_dotenv()

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
            with open(prepared, "rb") as audio:
                output = replicate.run(
                    WHISPER_MODEL_VERSION,
                    input={"audio": audio, "language": config.WHISPER_LANGUAGE},
                )
        finally:
            if prepared != audio_path and os.path.exists(prepared):
                os.remove(prepared)

        segments = output.get("segments", []) if isinstance(output, dict) else []
        result = []
        for s in segments:
            text = clean_text(s.get("text", ""))
            if text:
                result.append(
                    TranscribedSegment(text, float(s.get("start", 0.0)), float(s.get("end", 0.0)))
                )
        return result
