import helpmeet.transcription.replicate_engine as re_mod
from helpmeet.transcription.replicate_engine import (
    ReplicateTranscriptionEngine,
    _is_throttle,
)


class FakeThrottle(Exception):
    status = 429


def _patch_client(monkeypatch, run_fn):
    """Hace que replicate.Client(...) devuelva un cliente cuyo .run es run_fn."""
    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def run(self, version, input):  # noqa: A002 - misma firma que la librería
            return run_fn(version, input)

    monkeypatch.setattr(re_mod.replicate, "Client", FakeClient)
    monkeypatch.setattr(re_mod.time, "sleep", lambda s: None)
    monkeypatch.setattr(re_mod, "_prepare_audio", lambda p: p)


def test_is_throttle_detects_429():
    assert _is_throttle(FakeThrottle())
    assert _is_throttle(Exception("Request was throttled"))
    assert _is_throttle(Exception("rate limit 429"))
    assert not _is_throttle(Exception("algún otro error"))


def test_run_retries_on_throttle_then_succeeds(monkeypatch, tmp_path):
    f = tmp_path / "a.wav"
    f.write_bytes(b"RIFFfake")
    calls = {"n": 0}

    def fake_run(version, input):
        calls["n"] += 1
        if calls["n"] < 3:
            raise FakeThrottle("throttled")
        return {"segments": [{"text": "hola", "start": 0.0, "end": 1.0}]}

    _patch_client(monkeypatch, fake_run)

    segs = ReplicateTranscriptionEngine().transcribe_file(str(f))
    assert calls["n"] == 3          # reintentó hasta lograrlo
    assert len(segs) == 1
    assert "hola" in segs[0].text.lower()


def test_drops_silence_segments_by_no_speech_prob(monkeypatch, tmp_path):
    f = tmp_path / "a.wav"
    f.write_bytes(b"RIFFfake")

    def fake_run(version, input):
        return {"segments": [
            {"text": "¡Gol!", "start": 0.0, "end": 1.0, "no_speech_prob": 0.95},
            {"text": "revisamos el endpoint", "start": 1.0, "end": 2.0,
             "no_speech_prob": 0.1},
        ]}

    _patch_client(monkeypatch, fake_run)

    segs = ReplicateTranscriptionEngine().transcribe_file(str(f))
    texts = " ".join(s.text for s in segs)
    assert "endpoint" in texts
    assert "Gol" not in texts


def test_run_raises_non_throttle_immediately(monkeypatch, tmp_path):
    f = tmp_path / "a.wav"
    f.write_bytes(b"RIFFfake")
    calls = {"n": 0}

    def fake_run(version, input):
        calls["n"] += 1
        raise ValueError("error que no es de límite")

    _patch_client(monkeypatch, fake_run)

    try:
        ReplicateTranscriptionEngine().transcribe_file(str(f))
        assert False, "debió lanzar la excepción"
    except ValueError:
        pass
    assert calls["n"] == 1          # NO reintenta si no es throttling
