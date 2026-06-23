"""Extrae el audio de un archivo de video o audio a WAV 16 kHz mono.

Usa PyAV (ffmpeg embebido), así que acepta mp4, mkv, mov, avi, webm, mp3,
m4a, wav, ogg… Devuelve un WAV listo para transcribir.
"""
import wave
from pathlib import Path
import av
from av.audio.resampler import AudioResampler

TARGET_RATE = 16000


def extract_audio_to_wav(src_path: str, dest_path: str, rate: int = TARGET_RATE) -> str:
    """Extrae audio a WAV mono sin cargar el archivo completo en memoria.

    El procesamiento por streaming permite transcribir videos de varias horas sin
    crear picos de RAM proporcionales a su duración.
    """
    dest = Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    container = av.open(src_path)
    if not container.streams.audio:
        container.close()
        raise ValueError("El archivo no tiene pista de audio.")

    resampler = AudioResampler(format="s16", layout="mono", rate=rate)
    written = 0
    try:
        with wave.open(str(dest), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)

            def write_frames(frames):
                nonlocal written
                for frame in frames:
                    raw = frame.to_ndarray().tobytes()
                    wav.writeframesraw(raw)
                    written += len(raw)

            for decoded in container.decode(audio=0):
                write_frames(resampler.resample(decoded))
            write_frames(resampler.resample(None))  # vaciar el resampler
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    finally:
        container.close()
    if not written:
        dest.unlink(missing_ok=True)
        raise ValueError("No se pudo extraer audio utilizable del archivo.")
    return str(dest)
