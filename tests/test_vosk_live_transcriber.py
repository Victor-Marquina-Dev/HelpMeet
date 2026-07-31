import json

from helpmeet.db import repository as repo
from helpmeet.session.vosk_live_transcriber import VoskLiveTranscriber


class FakeBuffer:
    def __init__(self, data: bytes, rate=16000, channels=1, sampwidth=2):
        self._data = data
        self.rate = rate
        self.channels = channels
        self.sampwidth = sampwidth

    def drain(self) -> bytes:
        data = self._data
        self._data = b""
        return data


class FakeRecognizer:
    """Simula un `vosk.KaldiRecognizer`: cada paso de `steps` es
    ("final", {...json de Result...}) o ("partial", "texto parcial")."""

    def __init__(self, steps=None, final_step=None):
        self._steps = list(steps or [])
        self._final_step = final_step or {"text": ""}
        self._pending = None

    def SetWords(self, enabled):
        pass

    def AcceptWaveform(self, pcm):
        kind, payload = self._steps.pop(0)
        self._pending = payload
        return kind == "final"

    def Result(self):
        return json.dumps(self._pending)

    def PartialResult(self):
        return json.dumps({"partial": self._pending})

    def FinalResult(self):
        return json.dumps(self._final_step)


def _loud_audio(n=3200):
    return b"\x10\x27" * n  # bytes no vacíos, el contenido no importa (Vosk es fake)


def _meeting(session):
    ini = repo.create_initiative(session, "Iniciativa test")
    return repo.start_meeting(session, ini.id, "Reunion test")


def _transcriber(session, meeting_id, on_utterance=None, on_partial=None):
    return VoskLiveTranscriber(
        buffers={}, meeting_id=meeting_id,
        on_utterance=on_utterance, on_partial=on_partial,
        session_factory=lambda: session,
    )


def _words_result(text, start, end):
    return {"text": text, "result": [
        {"word": w, "start": start, "end": end, "conf": 1.0} for w in text.split()
    ]}


def test_drain_once_persists_final_utterance_and_calls_on_utterance(session):
    m = _meeting(session)
    calls = []
    tr = _transcriber(session, m.id, on_utterance=lambda *a: calls.append(a))
    tr._recognizers["me"] = FakeRecognizer(steps=[
        ("final", _words_result("hola mundo", 0.0, 1.0)),
    ])
    buf = FakeBuffer(_loud_audio())

    tr._drain_once("me", buf)

    assert tr.produced_any is True
    saved = repo.get_meeting(session, m.id).utterances
    assert len(saved) == 1
    assert saved[0].text == "Hola mundo"  # clean_text capitaliza
    assert len(calls) == 1
    assert calls[0][0] == saved[0].id  # el id pasado al callback es el real


def test_drain_once_reports_partial_without_persisting(session):
    m = _meeting(session)
    partials = []
    tr = _transcriber(session, m.id, on_partial=lambda label, text: partials.append((label, text)))
    tr._recognizers["me"] = FakeRecognizer(steps=[("partial", "hola mun")])
    buf = FakeBuffer(_loud_audio())

    tr._drain_once("me", buf)

    assert tr.produced_any is False
    assert repo.get_meeting(session, m.id).utterances == []
    assert partials == [("me", "hola mun")]


def test_drain_once_skips_empty_buffer(session):
    m = _meeting(session)
    tr = _transcriber(session, m.id)
    tr._recognizers["me"] = FakeRecognizer(steps=[("final", _words_result("no debería llamarse", 0.0, 1.0))])
    buf = FakeBuffer(b"")

    tr._drain_once("me", buf)

    assert tr.produced_any is False
    assert repo.get_meeting(session, m.id).utterances == []


def test_drain_once_without_recognizer_yet_does_nothing(session):
    """El modelo se carga de forma perezosa en _track_loop; si _drain_once se
    llama antes de que exista el reconocedor de esa pista, no debe romper."""
    m = _meeting(session)
    tr = _transcriber(session, m.id)
    buf = FakeBuffer(_loud_audio())

    tr._drain_once("me", buf)  # sin tr._recognizers["me"]: no debe lanzar

    assert tr.produced_any is False


def test_handle_final_filters_hallucination(session):
    m = _meeting(session)
    tr = _transcriber(session, m.id)

    tr._handle_final("me", {"text": "suscribete al canal"})

    assert tr.produced_any is False
    assert repo.get_meeting(session, m.id).utterances == []


def test_handle_final_clears_partial_on_close(session):
    m = _meeting(session)
    partials = []
    tr = _transcriber(session, m.id, on_partial=lambda label, text: partials.append((label, text)))

    tr._handle_final("me", _words_result("frase cerrada", 0.0, 1.0))

    assert partials[-1] == ("me", "")  # último aviso apaga el parcial en pantalla


def test_finalize_uses_final_result(session):
    m = _meeting(session)
    tr = _transcriber(session, m.id)
    tr._recognizers["me"] = FakeRecognizer(final_step=_words_result("cola pendiente", 0.0, 0.5))

    tr._finalize("me")

    assert tr.produced_any is True
    saved = repo.get_meeting(session, m.id).utterances
    assert saved[0].text == "Cola pendiente"


def test_finalize_without_recognizer_does_nothing(session):
    m = _meeting(session)
    tr = _transcriber(session, m.id)

    tr._finalize("me")  # nunca se llamó a start(): no hay reconocedor

    assert tr.produced_any is False


def test_start_stop_loop_lifecycle(session, monkeypatch):
    m = _meeting(session)
    monkeypatch.setattr(
        VoskLiveTranscriber, "_make_recognizer",
        lambda self: FakeRecognizer(final_step=_words_result("cola", 0.0, 0.5)),
    )
    buf = FakeBuffer(_loud_audio())
    tr = VoskLiveTranscriber(
        buffers={"me": buf}, meeting_id=m.id, session_factory=lambda: session,
    )
    tr.POLL_INTERVAL = 0.05

    tr.start()
    tr.stop_loop()

    assert all(not t.is_alive() for t in tr._threads.values())
    assert "me" in tr._recognizers  # _make_recognizer sí se ejecutó, dentro del hilo

    tr.flush_tail()

    assert tr.produced_any is True
    tr.close()


def test_make_recognizer_failure_does_not_crash_track_loop(session, monkeypatch):
    """Si el modelo falla al cargar (sin internet la 1ª vez, etc.), el hilo de
    la pista debe terminar limpio, no tumbar la grabación."""
    m = _meeting(session)

    def _boom(self):
        raise RuntimeError("sin internet")
    monkeypatch.setattr(VoskLiveTranscriber, "_make_recognizer", _boom)

    tr = VoskLiveTranscriber(
        buffers={"me": FakeBuffer(_loud_audio())}, meeting_id=m.id,
        session_factory=lambda: session,
    )
    tr.start()
    tr.stop_loop()

    assert all(not t.is_alive() for t in tr._threads.values())
    assert "me" not in tr._recognizers
