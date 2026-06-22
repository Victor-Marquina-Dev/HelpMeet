import wave
import numpy as np
from helpmeet.media import extract_audio_to_wav


def _write_wav(path, rate, channels):
    n = rate // 2  # 0.5 s
    t = np.linspace(0, 0.5, n, endpoint=False)
    tone = (np.sin(2 * np.pi * 440 * t) * 8000).astype(np.int16)
    if channels == 2:
        data = np.column_stack([tone, tone]).reshape(-1)
    else:
        data = tone
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())


def test_extract_audio_downsamples_to_16k_mono(tmp_path):
    src = tmp_path / "in.wav"
    _write_wav(src, rate=44100, channels=2)   # estéreo 44.1 kHz
    dst = tmp_path / "out.wav"

    extract_audio_to_wav(str(src), str(dst))

    with wave.open(str(dst), "rb") as w:
        assert w.getframerate() == 16000
        assert w.getnchannels() == 1
        assert w.getnframes() > 0   # hay audio extraído
