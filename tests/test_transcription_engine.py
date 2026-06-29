from types import SimpleNamespace

from helpmeet.transcription import engine as engine_mod
from helpmeet.transcription.engine import TranscriptionEngine


class FakeModel:
    def __init__(self):
        self.options = None

    def transcribe(self, path, **options):
        self.options = options
        segment = SimpleNamespace(
            text="transcripción correcta", start=0.0, end=2.0,
            no_speech_prob=0.1,
        )
        return iter([segment]), SimpleNamespace(duration=2.0)


def _engine_with_fake_model():
    engine = TranscriptionEngine.__new__(TranscriptionEngine)
    engine._model = FakeModel()
    return engine


def test_accurate_quality_uses_beam_search_and_context():
    engine = _engine_with_fake_model()

    result = engine.transcribe_file("video.wav", quality="accurate")

    assert result[0].text == "Transcripción correcta"
    assert engine._model.options["beam_size"] == 5
    assert engine._model.options["condition_on_previous_text"] is True


def test_fast_quality_keeps_low_latency_options():
    engine = _engine_with_fake_model()

    engine.transcribe_file("live.wav", quality="fast")

    assert engine._model.options["beam_size"] == 1
    assert engine._model.options["condition_on_previous_text"] is False


def test_load_model_falls_back_to_lighter_model(monkeypatch):
    calls = []

    def fake_load(name):
        calls.append(name)
        if name == "large-v3":
            raise RuntimeError("Unable to open file 'model.bin'")
        return f"model:{name}"

    monkeypatch.setattr(engine_mod, "_load_single_model", fake_load)

    model, loaded_name = engine_mod._load_model("large-v3")

    assert model == "model:medium"
    assert loaded_name == "medium"
    assert calls == ["large-v3", "medium"]
