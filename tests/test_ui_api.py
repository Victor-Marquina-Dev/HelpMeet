import threading
from datetime import timedelta
from types import SimpleNamespace

from helpmeet.db import repository as repo
from helpmeet.ui.app import Api, _spanish_date


def _api_with_session(session):
    api = Api.__new__(Api)
    api._session = session
    api._recorder = None
    api._screen_rec = None
    api._screen_active = False
    api._screen_meeting_id = None
    api._last_meeting_id = None
    api._window = None
    api._jobs = None
    api._jobs_lock = threading.Lock()
    api._jobs_info = {}
    api._worker = None
    return api


def test_list_meetings_has_redesign_metadata(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Seguimiento")
    repo.add_utterance(session, meeting.id, "me", "hola", 2.0, 3.0)
    repo.end_meeting(session, meeting.id)

    row = _api_with_session(session).list_meetings(ini.id)[0]

    assert row["status"] == "done"
    assert row["frases"] == 1
    assert row["dur"] != "—"
    assert row["has_video"] is False
    assert row["month_key"] == meeting.started_at.strftime("%Y-%m")
    assert row["month_label"].endswith(str(meeting.started_at.year))


def test_edit_change_speaker_highlight_and_delete_utterance(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Edición")
    u = repo.add_utterance(session, meeting.id, "others", "texto original", 1.0, 2.0)
    api = _api_with_session(session)

    # Editar texto
    r = api.update_utterance(u.id, {"text": "texto corregido"})
    assert r["ok"] and r["text"] == "texto corregido"

    # Cambiar hablante
    r = api.update_utterance(u.id, {"speaker": "me"})
    assert r["ok"] and r["speaker"] == "me"

    # Marcar / desmarcar importante
    assert api.toggle_utterance_highlight(u.id) == {"ok": True, "id": u.id, "highlighted": True}
    assert api.toggle_utterance_highlight(u.id)["highlighted"] is False

    # El transcript refleja el texto y el hablante editados
    item = api.get_transcript(meeting.id)["utterances"][0]
    assert item["text"] == "texto corregido" and item["speaker"] == "me"
    assert item["highlighted"] is False

    # Eliminar
    assert api.delete_utterance(u.id) == {"ok": True}
    assert api.get_transcript(meeting.id)["utterances"] == []
    # Borrar algo inexistente no rompe
    assert api.delete_utterance(u.id) == {"ok": False}


def test_spanish_screen_recording_date_format():
    from datetime import datetime

    assert _spanish_date(datetime(2026, 6, 23)) == "23 de Junio 2026"


def test_video_without_transcript_is_pending(session, tmp_path):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Grabación de pantalla")
    meeting.audio_path = str(tmp_path / "capture.mp4")
    session.commit()
    repo.end_meeting(session, meeting.id)

    row = _api_with_session(session).list_meetings(ini.id)[0]

    assert row["status"] == "pending"
    assert row["has_video"] is True


def test_transcript_contains_real_timeline_and_assets(session, tmp_path):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Diseño")
    meeting.audio_path = str(tmp_path / "screen.mp4")
    (tmp_path / "screen.mp4").write_bytes(b"video")
    utterance = repo.add_utterance(session, meeting.id, "others", "revisamos el flujo", 5.0, 8.0)
    capture = repo.add_capture(session, meeting.id, str(tmp_path / "shot.png"))
    note = repo.add_note(session, meeting.id, "decisión importante")
    capture.taken_at = meeting.started_at + timedelta(seconds=6)
    note.created_at = meeting.started_at + timedelta(seconds=7)
    session.commit()

    data = _api_with_session(session).get_transcript(meeting.id)

    assert data["video_path"] == meeting.audio_path
    assert data["assets"]["video"] == meeting.audio_path
    assert data["assets"]["captures"][0]["id"] == capture.id
    assert data["assets"]["notes"][0]["id"] == note.id
    assert [item["kind"] for item in data["utterances"]] == [
        "utterance", "capture", "note"
    ]
    assert data["utterances"][0]["id"] == utterance.id
    assert data["utterances"][0]["time"] == "00:05"


def test_stop_recording_queues_background_transcription(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión")
    events = {}

    class FakeRecorder:
        def __init__(self, current):
            self.meeting = current
            self.on_status = self.on_progress = self.on_utterance = None

        def stop_capture(self):
            repo.end_meeting(session, self.meeting.id)
            events["stopped"] = True

        def transcribe(self):
            events["transcribed"] = True

    api = _api_with_session(session)
    api._recorder = FakeRecorder(meeting)

    result = api.stop_recording()

    # Detener libera el carril al instante (puedes grabar otra ya)
    assert result["ok"] is True
    assert result["queued"] is True
    assert result["meeting_id"] == meeting.id
    assert api._recorder is None
    assert events.get("stopped") is True

    # ...y la transcripción ocurre en segundo plano (worker en cola)
    api._jobs.join()
    assert events.get("transcribed") is True


def test_each_recorder_uses_a_unique_audio_dir(session, monkeypatch, tmp_path):
    """Cada grabación tiene su carpeta de audio: así una se puede transcribir en
    segundo plano sin que otra grabación pise sus WAV."""
    import helpmeet.session.recorder as rec_mod
    from helpmeet import config

    monkeypatch.setattr(config, "DATA_DIR", tmp_path)
    monkeypatch.setattr(rec_mod, "get_session", lambda: session)

    r1 = rec_mod.MeetingRecorder(1, "A", engine=None)
    r2 = rec_mod.MeetingRecorder(1, "B", engine=None)

    assert r1._tmp != r2._tmp
    assert r1._tmp.exists() and r2._tmp.exists()


def test_push_text_uses_valid_json_for_javascript(session):
    class FakeWindow:
        def __init__(self):
            self.scripts = []

        def evaluate_js(self, script):
            self.scripts.append(script)

    api = _api_with_session(session)
    api._window = FakeWindow()

    api._push_utterance("others", "línea 1\nlínea '2'", 0, 1)
    api._push_status("error:\narchivo 'x'")

    assert api._window.scripts[0].startswith('addUtterance("others", ')
    assert "\\n" in api._window.scripts[0]
    assert api._window.scripts[1].startswith('setStatus("error:')


def test_toggle_meeting_microphone(session):
    class FakeRecorder:
        def __init__(self):
            self.muted = False

        def set_mic_muted(self, muted):
            self.muted = muted

    api = _api_with_session(session)
    api._recorder = FakeRecorder()

    result = api.toggle_meeting_mic_mute(True)

    assert result == {"ok": True, "muted": True}
    assert api._recorder.muted is True


def test_force_video_transcription_replaces_old_text_using_sidecar(session, tmp_path):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Grabación de pantalla")
    video = tmp_path / "grabacion.mp4"
    video.write_bytes(b"video")
    video.with_suffix(".system.wav").write_bytes(b"audio separado")
    meeting.audio_path = str(video)
    session.commit()
    repo.add_utterance(session, meeting.id, "others", "texto incorrecto", 0, 1)

    class FakeEngine:
        supports_progress = True

        def transcribe_file(self, path, **kwargs):
            kwargs["on_progress"](1.0)
            return [SimpleNamespace(text="texto corregido", start=0.0, end=2.0)]

    api = _api_with_session(session)
    api._get_local_engine = lambda: FakeEngine()

    # _transcribe_video es lo que ejecuta el worker en segundo plano (con su
    # propia sesión); aquí lo probamos directo con la sesión de prueba.
    result = api._transcribe_video(session, meeting.id, force=True)

    assert result["ok"] is True
    refreshed = repo.get_meeting(session, meeting.id)
    assert [u.text for u in refreshed.utterances] == ["texto corregido"]
