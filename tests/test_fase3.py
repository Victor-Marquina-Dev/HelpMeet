"""Pruebas de las mejoras de la Fase 3 (multimedia): perfiles de vídeo,
vista previa derivada (helper JPEG) y mezcla de audio con menos memoria."""
import wave
import numpy as np

from helpmeet.audio.mixing import mix_wavs
from helpmeet.video.recorder import ScreenVideoRecorder, _jpeg_from_rgb


def _write_wav(path, samples, rate, channels=1):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(np.asarray(samples, dtype=np.int16).tobytes())


def test_video_profile_caps_resolution_and_sets_quality():
    mon = {"left": 0, "top": 0, "width": 2560, "height": 1440}

    light = ScreenVideoRecorder("x.mp4", mon, profile="light")
    assert light.fps == 15 and light._crf == "26"
    assert light._out_w <= 1280 and light._out_h <= 720
    assert abs(light._out_w / light._out_h - 16 / 9) < 0.05  # conserva proporción

    native = ScreenVideoRecorder("x.mp4", mon, profile="native")
    assert native._out_w == 2560 and native._out_h == 1440 and native._crf == "18"

    # Perfil inválido cae al de por defecto (equilibrado).
    fallback = ScreenVideoRecorder("x.mp4", mon, profile="inexistente")
    assert fallback.fps == 30 and fallback._out_w <= 1920


def test_jpeg_from_rgb_produces_valid_jpeg():
    rgb = np.random.default_rng(0).integers(0, 256, (240, 320, 3), dtype="uint8")
    data = _jpeg_from_rgb(rgb, 320, 240)
    assert data[:3] == b"\xff\xd8\xff"  # cabecera JPEG (SOI)


def test_mix_wavs_sums_tracks_and_writes_stereo(tmp_path):
    me, others, out = tmp_path / "me.wav", tmp_path / "ot.wav", tmp_path / "mix.wav"
    _write_wav(me, [100, 200, 300], 48000)
    _write_wav(others, [10, 20], 48000)  # más corta: la última muestra no se suma

    assert mix_wavs(me, others, out, rate=48000) is True
    with wave.open(str(out), "rb") as w:
        assert w.getnchannels() == 2
        frames = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    left, right = frames[0::2], frames[1::2]
    assert list(left) == [110, 220, 300]
    assert list(left) == list(right)  # mono duplicado a estéreo


def test_mix_wavs_without_tracks_returns_false(tmp_path):
    _write_wav(tmp_path / "a.wav", [], 48000)
    _write_wav(tmp_path / "b.wav", [], 48000)
    assert mix_wavs(tmp_path / "a.wav", tmp_path / "b.wav", tmp_path / "o.wav") is False
