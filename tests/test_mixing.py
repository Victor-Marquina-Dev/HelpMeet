import wave
import numpy as np
from helpmeet.audio.mixing import mix_wavs


def _tone(path, rate, seconds, freq):
    n = int(rate * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    data = (np.sin(2 * np.pi * freq * t) * 8000).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())


def test_mix_wavs_combines_two_tracks(tmp_path):
    me, others, out = tmp_path / "me.wav", tmp_path / "others.wav", tmp_path / "mix.wav"
    _tone(me, 44100, 0.5, 440)
    _tone(others, 48000, 1.0, 880)   # la más larga manda
    assert mix_wavs(me, others, out) is True
    with wave.open(str(out), "rb") as w:
        assert w.getframerate() == 48000
        assert w.getnchannels() == 2
        dur = w.getnframes() / w.getframerate()
        raw = w.readframes(w.getnframes())
    assert abs(dur - 1.0) < 0.05
    assert np.abs(np.frombuffer(raw, dtype=np.int16)).max() > 0  # no es silencio


def test_mix_wavs_one_track_only(tmp_path):
    me, out = tmp_path / "me.wav", tmp_path / "mix.wav"
    _tone(me, 44100, 0.3, 440)
    assert mix_wavs(me, tmp_path / "missing.wav", out) is True
    assert out.exists()


def test_mix_wavs_no_audio_returns_false(tmp_path):
    out = tmp_path / "mix.wav"
    assert mix_wavs(tmp_path / "no1.wav", tmp_path / "no2.wav", out) is False
    assert not out.exists()
