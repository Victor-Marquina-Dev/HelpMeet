import struct
import wave
from datetime import datetime
from types import SimpleNamespace

from helpmeet import config, recovery


def _write_wav(path, seconds=1, rate=8000):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b"\x01\x00" * int(seconds * rate))


def test_repair_wav_after_unclean_close(tmp_path):
    path = tmp_path / "me.wav"
    _write_wav(path, seconds=1.25)
    with path.open("r+b") as fh:
        fh.seek(4)
        fh.write(struct.pack("<I", 0))
        fh.seek(40)
        fh.write(struct.pack("<I", 0))

    assert recovery.repair_wav(path)
    assert 1.24 < recovery.wav_seconds(path) < 1.26


def test_manifest_is_listed_and_can_be_discarded(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    meeting = SimpleNamespace(
        id=17, initiative_id=4, title="Plan semanal", started_at=datetime.now()
    )
    work_dir = recovery.create_session("audio", meeting)
    _write_wav(work_dir / "me.wav", seconds=2)

    sessions = recovery.list_sessions()
    assert len(sessions) == 1
    assert sessions[0]["id"] == work_dir.name
    assert sessions[0]["tracks"] == ["mic"]
    assert sessions[0]["duration"] == "0:02"

    assert recovery.discard_session(work_dir.name)
    assert recovery.list_sessions() == []


def test_discard_rejects_path_traversal(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    try:
        recovery.discard_session("../outside")
    except ValueError as exc:
        assert "inválido" in str(exc)
    else:
        raise AssertionError("Debe rechazar identificadores fuera de recovery")
