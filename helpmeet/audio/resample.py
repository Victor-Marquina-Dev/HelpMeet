"""Resampleo simple de audio PCM16 crudo, compartido por todo lo que alimenta
a Vosk (necesita 16kHz mono): la transcripcion en vivo, el motor de archivo
completo y el demo aislado.

Resampleo ingenuo por trozo (interpolacion lineal, sin estado de filtro entre
llamadas): suficiente para voz, no para audio de calidad de produccion. Mismo
criterio ya usado en `audio/mixing.py`.
"""
import numpy as np

TARGET_RATE = 16000


def to_16k_mono(data: bytes, src_rate: int, channels: int) -> bytes:
    if not data:
        return b""
    arr = np.frombuffer(data, dtype=np.int16).astype(np.float32)
    if channels > 1:
        arr = arr.reshape(-1, channels).mean(axis=1)
    if src_rate != TARGET_RATE and arr.size:
        n_out = max(1, int(arr.size * TARGET_RATE / src_rate))
        arr = np.interp(
            np.linspace(0, 1, n_out, endpoint=False),
            np.linspace(0, 1, arr.size, endpoint=False),
            arr,
        )
    return arr.astype(np.int16).tobytes()
