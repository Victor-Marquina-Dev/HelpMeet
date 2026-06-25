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


def test_get_bootstrap_state_groups_meetings_and_counts(session):
    # Dos iniciativas: una con reuniones, otra vacía.
    a = repo.create_initiative(session, "Con reuniones")
    b = repo.create_initiative(session, "Vacía")
    m1 = repo.start_meeting(session, a.id, "Primera")
    repo.add_utterances(session, m1.id, [
        {"speaker": "me", "text": "uno", "start_time": 0.0, "end_time": 1.0},
        {"speaker": "me", "text": "dos", "start_time": 1.0, "end_time": 2.0},
    ])
    repo.end_meeting(session, m1.id)
    m2 = repo.start_meeting(session, a.id, "Segunda")  # sin frases

    state = _api_with_session(session).get_bootstrap_state()

    ids = {i["id"] for i in state["initiatives"]}
    assert {a.id, b.id} <= ids
    mbi = state["meetings_by_initiative"]
    # Las claves llegan como str (JSON) y la iniciativa vacía aparece con [].
    assert mbi[str(b.id)] == []
    rows = {r["id"]: r for r in mbi[str(a.id)]}
    assert rows[m1.id]["frases"] == 2
    assert rows[m2.id]["frases"] == 0
    assert "monitors" in state and "background_jobs" in state
    assert state["library_counts"] == {"archive": 0, "trash": 0}


def test_utterance_counts_aggregates_without_loading_rows(session):
    ini = repo.create_initiative(session, "X")
    m = repo.start_meeting(session, ini.id, "R")
    repo.add_utterances(session, m.id, [
        {"speaker": "me", "text": "a", "start_time": 0.0, "end_time": 1.0},
        {"speaker": "others", "text": "b", "start_time": 1.0, "end_time": 2.0},
        {"speaker": "me", "text": "c", "start_time": 2.0, "end_time": 3.0},
    ])
    assert repo.utterance_counts(session, [m.id]) == {m.id: 3}
    assert repo.utterance_counts(session, []) == {}
    assert repo.utterance_counts(session).get(m.id) == 3


def test_make_thumbnail_shrinks_image(tmp_path):
    import numpy as np
    import mss.tools
    from helpmeet.media import make_thumbnail
    w, h = 1200, 800
    rgb = np.random.default_rng(0).integers(0, 256, (h, w, 3), dtype="uint8")
    src = tmp_path / "cap.png"
    src.write_bytes(mss.tools.to_png(rgb.tobytes(), (w, h)))
    dest = tmp_path / "thumb.jpg"
    out = make_thumbnail(str(src), str(dest), max_width=480)
    assert out is not None and dest.exists()
    assert dest.stat().st_size < src.stat().st_size


def test_get_capture_thumbnail_returns_jpeg(session, tmp_path, monkeypatch):
    import numpy as np
    import mss.tools
    from helpmeet import config
    monkeypatch.setattr(config, "CAPTURES_DIR", tmp_path)
    ini = repo.create_initiative(session, "P")
    m = repo.start_meeting(session, ini.id, "R")
    src = tmp_path / "cap.png"
    rgb = np.random.default_rng(1).integers(0, 256, (600, 900, 3), dtype="uint8")
    src.write_bytes(mss.tools.to_png(rgb.tobytes(), (900, 600)))
    cap = repo.add_capture(session, m.id, str(src))
    r = _api_with_session(session).get_capture_thumbnail(cap.id)
    assert r["ok"] and r["data_url"].startswith("data:image/jpeg;base64,")
    # La segunda llamada reutiliza la miniatura cacheada (mismo resultado).
    assert _api_with_session(session).get_capture_thumbnail(cap.id)["ok"]


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


def test_meeting_context_round_trip(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Revisión")
    api = _api_with_session(session)

    result = api.set_meeting_context(
        meeting.id, "  Revisar el alcance y los próximos pasos.  "
    )

    assert result == {
        "ok": True, "context": "Revisar el alcance y los próximos pasos."
    }
    assert api.get_transcript(meeting.id)["context"] == result["context"]


def test_participants_lifecycle_and_resolved_names(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión")
    mine = repo.add_utterance(session, meeting.id, "me", "hola soy yo", 1.0, 2.0)
    theirs = repo.add_utterance(session, meeting.id, "others", "hola", 3.0, 4.0)
    api = _api_with_session(session)

    # Alta en bloque (pegar varios), ignora vacíos y duplicados
    r = api.add_participants(ini.id, "Víctor Marquina\nMaría Pérez\n\nMaría Pérez")
    names = [p["name"] for p in r["participants"]]
    assert names == ["Víctor Marquina", "María Pérez"]

    parts = {p["name"]: p for p in r["participants"]}
    # Marcar quién soy yo
    api.set_me_participant(ini.id, parts["Víctor Marquina"]["id"])

    # Con 1 invitado (María), las frases "others" muestran su nombre automáticamente
    items = {u["id"]: u for u in api.get_transcript(meeting.id)["utterances"]}
    assert items[mine.id]["display_name"] == "Víctor Marquina"   # yo, auto
    assert items[theirs.id]["display_name"] == "María Pérez"     # único invitado, auto

    # Con 2+ invitados, "others" sin asignar vuelve a "Los demás"
    api.add_participants(ini.id, ["Juan Soto"])
    items = {u["id"]: u for u in api.get_transcript(meeting.id)["utterances"]}
    assert items[theirs.id]["display_name"] == "Los demás"

    # Asignación manual gana
    api.assign_utterance_participant(theirs.id, parts["María Pérez"]["id"])
    items = {u["id"]: u for u in api.get_transcript(meeting.id)["utterances"]}
    assert items[theirs.id]["display_name"] == "María Pérez"

    # Borrar el participante asignado: se limpia la asignación manual y vuelven
    # las reglas. Quedan Víctor (yo) + Juan → un solo invitado → "Juan Soto".
    api.delete_participant(parts["María Pérez"]["id"])
    items = {u["id"]: u for u in api.get_transcript(meeting.id)["utterances"]}
    assert items[theirs.id]["participant_id"] is None
    assert items[theirs.id]["display_name"] == "Juan Soto"


def test_export_uses_participant_names(session, tmp_path):
    from helpmeet.export.exporter import build_meeting_context
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión")
    repo.add_utterance(session, meeting.id, "me", "abro yo", 1.0, 2.0)
    repo.add_utterance(session, meeting.id, "others", "responde el invitado", 3.0, 4.0)
    api = _api_with_session(session)
    created = api.add_participants(ini.id, ["Víctor Marquina", "Cliente ACME"])["participants"]
    api.set_me_participant(ini.id, created[0]["id"])
    repo.end_meeting(session, meeting.id)

    text = build_meeting_context(session, meeting.id)
    assert "Víctor Marquina: abro yo" in text
    assert "Cliente ACME: responde el invitado" in text  # único invitado → auto


def test_pin_initiative_sorts_first(session):
    api = _api_with_session(session)
    repo.create_initiative(session, "Primera")
    segunda = repo.create_initiative(session, "Segunda")
    tercera = repo.create_initiative(session, "Tercera")

    # Sin anclar: orden por creación
    assert [i["name"] for i in api.list_initiatives()] == ["Primera", "Segunda", "Tercera"]

    # Anclar la tercera: sube arriba
    assert api.toggle_initiative_pin(tercera.id) == {"ok": True, "id": tercera.id, "pinned": True}
    names = [i["name"] for i in api.list_initiatives()]
    assert names[0] == "Tercera"
    assert next(i for i in api.list_initiatives() if i["name"] == "Tercera")["pinned"] is True

    # Anclar la segunda: la más recientemente anclada va primero
    api.toggle_initiative_pin(segunda.id)
    assert [i["name"] for i in api.list_initiatives()][:2] == ["Segunda", "Tercera"]

    # Desanclar la tercera: vuelve abajo
    assert api.toggle_initiative_pin(tercera.id)["pinned"] is False
    assert [i["name"] for i in api.list_initiatives()] == ["Segunda", "Primera", "Tercera"]


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


def test_open_initiative_folder_exports_and_opens_path(session, tmp_path, monkeypatch):
    import helpmeet.ui.app as app_mod

    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunion")
    repo.add_utterance(session, meeting.id, "others", "hola", 0.0, 1.0)
    repo.end_meeting(session, meeting.id)
    opened = []
    monkeypatch.setattr(app_mod.settings, "get_export_dir", lambda: tmp_path)
    monkeypatch.setattr(app_mod, "_open_in_explorer", lambda path: opened.append(path))

    result = _api_with_session(session).open_initiative_folder(ini.id)

    assert result["ok"] is True
    assert opened and str(opened[0]) == result["path"]
    assert (opened[0] / "contexto.md").exists()


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
