import wave
import numpy as np


def _read_wav(path):
    """Devuelve (muestras float32 mono, rate) o (None, None) si no se puede."""
    try:
        with wave.open(str(path), "rb") as w:
            rate = w.getframerate()
            ch = w.getnchannels()
            raw = w.readframes(w.getnframes())
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
        if data.size == 0:
            return None, None
        if ch > 1:
            data = data.reshape(-1, ch).mean(axis=1)
        return data, rate
    except Exception:
        return None, None


def _resample(data, src_rate, dst_rate):
    if data is None or src_rate == dst_rate:
        return data
    n_out = int(len(data) * dst_rate / src_rate)
    if n_out <= 0:
        return data
    return np.interp(
        np.linspace(0, 1, n_out, endpoint=False),
        np.linspace(0, 1, len(data), endpoint=False),
        data,
    )


def mix_wavs(me_wav, others_wav, out_wav, rate: int = 48000) -> bool:
    """Mezcla dos WAV (micrófono + sistema) en un WAV estéreo a `rate`.

    - Si falta una pista, usa solo la disponible.
    - Iguala longitudes (rellena la más corta) y protege de saturación (clip).
    - Devuelve True si escribió audio, False si no había nada que mezclar.
    """
    a, ra = _read_wav(me_wav)
    b, rb = _read_wav(others_wav)
    a = _resample(a, ra, rate)
    b = _resample(b, rb, rate)
    tracks = [t for t in (a, b) if t is not None]
    if not tracks:
        return False
    n = max(len(t) for t in tracks)
    mixed = np.zeros(n, dtype=np.float32)
    for t in tracks:
        padded = np.zeros(n, dtype=np.float32)
        padded[: len(t)] = t
        mixed += padded
    mixed = np.clip(mixed, -32768, 32767).astype(np.int16)
    stereo = np.column_stack([mixed, mixed]).reshape(-1)
    with wave.open(str(out_wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(stereo.tobytes())
    return True
