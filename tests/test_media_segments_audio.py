import wave
import struct
import math
from pathlib import Path
from helpmeet.media import extract_audio_segments_to_wav


def _write_tone_wav(path, seconds, rate=16000):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        for n in range(int(seconds * rate)):
            sample = int(3000 * math.sin(2 * math.pi * 220 * n / rate))
            w.writeframes(struct.pack("<h", sample))


def _wav_duration(path):
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def test_extract_segments_concatenates_durations(tmp_path):
    src = tmp_path / "src.wav"
    dst = tmp_path / "out.wav"
    _write_tone_wav(src, 6.0)
    extract_audio_segments_to_wav(str(src), [(1.0, 3.0), (4.0, 5.0)], str(dst))
    assert abs(_wav_duration(dst) - 3.0) < 0.4


def test_extract_segments_no_audio_raises(tmp_path):
    empty = tmp_path / "empty.txt"
    empty.write_text("no media")
    dst = tmp_path / "out.wav"
    try:
        extract_audio_segments_to_wav(str(empty), [(0.0, 1.0)], str(dst))
        assert False, "debería lanzar excepción"
    except Exception:
        assert not Path(dst).exists()
