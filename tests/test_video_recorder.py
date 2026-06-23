import time
import av
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
