"""Extrae el audio de un archivo de video o audio a WAV 16 kHz mono.

Usa PyAV (ffmpeg embebido), así que acepta mp4, mkv, mov, avi, webm, mp3,
m4a, wav, ogg… Devuelve un WAV listo para transcribir.
"""
import wave
import numpy as np
import av
from av.audio.resampler import AudioResampler

TARGET_RATE = 16000


def extract_audio_to_wav(src_path: str, dest_path: str, rate: int = TARGET_RATE) -> str:
    """Lee `src_path` (video o audio) y escribe un WAV mono `rate` Hz en `dest_path`."""
    container = av.open(src_path)
    if not container.streams.audio:
        container.close()
        raise ValueError("El archivo no tiene pista de audio.")

    resampler = AudioResampler(format="s16", layout="mono", rate=rate)
    chunks: list[np.ndarray] = []

    def _collect(frames):
        for fr in frames:
            chunks.append(fr.to_ndarray().reshape(-1))

    try:
        for frame in container.decode(audio=0):
            _collect(resampler.resample(frame))
        _collect(resampler.resample(None))  # vaciar el buffer del resampler
    finally:
        container.close()

    data = np.concatenate(chunks).astype(np.int16) if chunks else np.array([], dtype=np.int16)
    with wave.open(dest_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())
    return dest_path
