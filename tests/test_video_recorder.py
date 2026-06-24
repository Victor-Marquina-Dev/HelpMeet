import time
from fractions import Fraction
import av
import numpy as np
from helpmeet.video.recorder import ScreenVideoRecorder
from helpmeet.screenshot.capture import monitor_geometry


def test_screen_recorder_creates_playable_mp4(tmp_path):
    dest = tmp_path / "rec.mp4"
    rec = ScreenVideoRecorder(dest, monitor_geometry(1))
    rec.start()
    time.sleep(2)
    result = rec.stop()

    assert result["ok"] is True
    assert dest.exists() and dest.stat().st_size > 0
    c = av.open(str(dest))
    try:
        assert c.streams.video, "debe tener stream de video"
        dur = float(c.duration) / av.time_base if c.duration else 0.0
    finally:
        c.close()
    assert dur > 0.5  # ~2 s grabados

    # tras parar, las pistas de audio se conservan (para transcribir si se quiere)
    assert any(wav.exists() for _, wav in rec.audio_channels())
    rec.cleanup()  # limpiar temporales al terminar la prueba


def _wide_red_frame():
    pixels = np.zeros((50, 100, 3), dtype=np.uint8)
    pixels[:, :, 0] = 255
    frame = av.VideoFrame.from_ndarray(pixels, format="rgb24")
    frame.time_base = Fraction(1, 30)
    return frame


def test_fit_mode_preserves_aspect_ratio_and_adds_bars(tmp_path):
    rec = ScreenVideoRecorder(
        tmp_path / "fit.mp4",
        {"left": 0, "top": 0, "width": 100, "height": 100},
    )
    frame = _wide_red_frame()
    _, source, sink = rec._scale_filter(frame, "fit")
    source.push(frame)
    result = sink.pull().to_ndarray(format="rgb24")

    assert result.shape == (100, 100, 3)
    assert result[5, 50].max() < 20       # barra negra superior
    assert result[50, 50, 0] > 220        # contenido visible en el centro


def test_fill_mode_crops_without_letterboxing(tmp_path):
    rec = ScreenVideoRecorder(
        tmp_path / "fill.mp4",
        {"left": 0, "top": 0, "width": 100, "height": 100},
    )
    frame = _wide_red_frame()
    _, source, sink = rec._scale_filter(frame, "fill")
    source.push(frame)
    result = sink.pull().to_ndarray(format="rgb24")

    assert result.shape == (100, 100, 3)
    assert result[5, 50, 0] > 220         # no hay barras negras


def test_scale_mode_rejects_unknown_values(tmp_path):
    rec = ScreenVideoRecorder(
        tmp_path / "mode.mp4",
        {"left": 0, "top": 0, "width": 100, "height": 100},
    )
    rec.set_scale_mode("invalid")

    assert rec._scale_mode == "fit"
