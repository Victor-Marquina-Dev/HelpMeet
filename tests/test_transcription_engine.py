import json
import wave

import numpy as np

from helpmeet.transcription import engine as engine_mod
from helpmeet.transcription.engine import TranscriptionEngine


class FakeRecognizer:
    """Simula `vosk.KaldiRecognizer`: cada `AcceptWaveform()` consume el
    siguiente paso del guion. `script`: lista de ("final", {...json...}) o
    ("partial", "texto")."""

    def __init__(self, script):
        self._script = list(script)
        self._pending = None

    def SetWords(self, enabled):
        pass

    def AcceptWaveform(self, pcm):
        if not self._script:
            self._pending = ""
            return False
        kind, payload = self._script.pop(0)
        self._pending = payload
        return kind == "final"

    def Result(self):
        return json.dumps(self._pending)

    def PartialResult(self):
        return json.dumps({"partial": self._pending if isinstance(self._pending, str) else ""})

    def FinalResult(self):
        return json.dumps({"text": ""})


def _write_wav(path, seconds=1.0, rate=16000):
    n = int(rate * seconds)
    data = np.zeros(n, dtype=np.int16).tobytes()
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(data)


def _engine_with_fake_recognizer(monkeypatch, script, recognizer_cls=FakeRecognizer):
    import vosk
    monkeypatch.setattr(vosk, "KaldiRecognizer", lambda model, rate: recognizer_cls(script))
    engine = TranscriptionEngine.__new__(TranscriptionEngine)
    engine._model = object()  # nunca se usa de verdad: el FakeRecognizer ignora el argumento
    engine.model_name = "vosk-model-small-es-0.42"
    engine.requested_model_name = "vosk-model-small-es-0.42"
    return engine


def _words_result(text, start, end):
    return {"text": text, "result": [
        {"word": w, "start": start, "end": end, "conf": 1.0} for w in text.split()
    ]}


def test_transcribe_file_returns_cleaned_segments(tmp_path, monkeypatch):
    wav = tmp_path / "audio.wav"
    _write_wav(wav, seconds=1.0)
    engine = _engine_with_fake_recognizer(monkeypatch, script=[
        ("final", _words_result("hola mundo", 0.0, 0.6)),
    ])

    segments = engine.transcribe_file(str(wav))

    assert len(segments) == 1
    assert segments[0].text == "Hola mundo"  # clean_text capitaliza
    assert segments[0].start == 0.0
    assert segments[0].end == 0.6


def test_transcribe_file_calls_on_progress_up_to_one(tmp_path, monkeypatch):
    wav = tmp_path / "audio.wav"
    _write_wav(wav, seconds=2.0)  # varios trozos de _CHUNK_FRAMES
    engine = _engine_with_fake_recognizer(monkeypatch, script=[])
    seen = []

    engine.transcribe_file(str(wav), on_progress=seen.append)

    assert seen, "on_progress debe llamarse al menos una vez"
    assert seen[-1] == 1.0
    assert all(0.0 <= f <= 1.0 for f in seen)
    assert seen == sorted(seen)  # monótono creciente


def test_transcribe_file_filters_hallucination(tmp_path, monkeypatch):
    wav = tmp_path / "audio.wav"
    _write_wav(wav, seconds=1.0)
    engine = _engine_with_fake_recognizer(monkeypatch, script=[
        ("final", {"text": "suscribete al canal"}),
    ])

    segments = engine.transcribe_file(str(wav))

    assert segments == []


def test_transcribe_file_includes_trailing_final_result(tmp_path, monkeypatch):
    wav = tmp_path / "audio.wav"
    _write_wav(wav, seconds=1.0)

    class RecognizerWithTail(FakeRecognizer):
        def FinalResult(self):
            return json.dumps(_words_result("cola pendiente", 0.9, 1.2))

    engine = _engine_with_fake_recognizer(monkeypatch, script=[], recognizer_cls=RecognizerWithTail)

    segments = engine.transcribe_file(str(wav))

    assert len(segments) == 1
    assert segments[0].text == "Cola pendiente"


def test_constructor_resolves_model_from_settings(monkeypatch):
    monkeypatch.setattr(engine_mod, "get_vosk_model", lambda name: f"model:{name}")
    import helpmeet.settings as settings_mod
    monkeypatch.setattr(settings_mod, "get_transcription_model", lambda: "vosk-model-small-es-0.42")

    engine = TranscriptionEngine()

    assert engine.model_name == "vosk-model-small-es-0.42"
    assert engine._model == "model:vosk-model-small-es-0.42"


def test_constructor_uses_explicit_model_name(monkeypatch):
    monkeypatch.setattr(engine_mod, "get_vosk_model", lambda name: f"model:{name}")

    engine = TranscriptionEngine("vosk-model-es-0.42")

    assert engine.model_name == "vosk-model-es-0.42"
    assert engine.requested_model_name == "vosk-model-es-0.42"
