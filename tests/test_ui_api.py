from datetime import timedelta
from types import SimpleNamespace

from helpmeet.db import repository as repo
from helpmeet.ui.app import Api


def _api_with_session(session):
    api = Api.__new__(Api)
    api._session = session
    api._recorder = None
    api._screen_rec = None
    api._screen_active = False
    api._screen_meeting_id = None
    api._last_meeting_id = None
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


def test_stop_recording_releases_active_recorder(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión")

    class FakeRecorder:
        def __init__(self, current):
            self.meeting = current

        def stop(self):
            repo.end_meeting(session, self.meeting.id)

    api = _api_with_session(session)
    api._recorder = FakeRecorder(meeting)

    result = api.stop_recording()

    assert result["ok"] is True
    assert result["meeting_id"] == meeting.id
    assert api._recorder is None


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
    api._window = None
    api._get_local_engine = lambda: FakeEngine()

    result = api.transcribe_meeting_video(meeting.id, force=True)

    assert result["ok"] is True
    refreshed = repo.get_meeting(session, meeting.id)
    assert [u.text for u in refreshed.utterances] == ["texto corregido"]
