from helpmeet.db import repository as repo


def test_create_initiative_and_meeting(session):
    ini = repo.create_initiative(session, "Sistema de Login")
    meeting = repo.start_meeting(session, ini.id, "Endpoints")
    assert ini.id is not None
    assert meeting.initiative_id == ini.id
    assert meeting.ended_at is None


def test_add_utterance_and_end_meeting(session):
    ini = repo.create_initiative(session, "X")
    meeting = repo.start_meeting(session, ini.id, "M")
    repo.add_utterance(session, meeting.id, "me", "hola", 0.0, 1.2)
    repo.end_meeting(session, meeting.id)
    refreshed = repo.get_meeting(session, meeting.id)
    assert refreshed.utterances[0].text == "hola"
    assert refreshed.ended_at is not None


def test_add_capture_links_nearest_utterance(session):
    ini = repo.create_initiative(session, "X")
    meeting = repo.start_meeting(session, ini.id, "M")
    u = repo.add_utterance(session, meeting.id, "others", "mira el código", 5.0, 7.0)
    cap = repo.add_capture(session, meeting.id, "data/captures/c1.png", near_utterance_id=u.id)
    assert cap.near_utterance_id == u.id


def test_list_initiatives(session):
    repo.create_initiative(session, "A")
    repo.create_initiative(session, "B")
    assert {i.name for i in repo.list_initiatives(session)} == {"A", "B"}


def test_add_note(session):
    ini = repo.create_initiative(session, "X")
    meeting = repo.start_meeting(session, ini.id, "M")
    note = repo.add_note(session, meeting.id, "ojo: cambiamos a PostgreSQL")
    assert note.id is not None
    refreshed = repo.get_meeting(session, meeting.id)
    assert refreshed.notes[0].text == "ojo: cambiamos a PostgreSQL"
    assert refreshed.notes[0].created_at is not None


def test_rename_initiative(session):
    ini = repo.create_initiative(session, "Viejo nombre")
    repo.rename_initiative(session, ini.id, "Nombre nuevo")
    assert repo.list_initiatives(session)[0].name == "Nombre nuevo"


def test_rename_meeting(session):
    ini = repo.create_initiative(session, "X")
    m = repo.start_meeting(session, ini.id, "Reunión 21/6")
    repo.rename_meeting(session, m.id, "Endpoints de login")
    assert repo.get_meeting(session, m.id).title == "Endpoints de login"


def test_move_meeting_to_another_initiative(session):
    a = repo.create_initiative(session, "A")
    b = repo.create_initiative(session, "B")
    m = repo.start_meeting(session, a.id, "R")
    repo.move_meeting(session, m.id, b.id)
    assert repo.get_meeting(session, m.id).initiative_id == b.id
    assert len(repo.list_meetings(session, a.id)) == 0
    assert len(repo.list_meetings(session, b.id)) == 1


def test_search_finds_utterances_and_notes(session):
    ini = repo.create_initiative(session, "Proyecto")
    m = repo.start_meeting(session, ini.id, "R1")
    repo.add_utterance(session, m.id, "others", "usamos PostgreSQL para esto", 1.0, 2.0)
    repo.add_note(session, m.id, "recordar el token de refresco")
    repo.add_utterance(session, m.id, "me", "nada relevante aquí", 3.0, 4.0)

    # encuentra una frase (búsqueda sin distinguir mayúsculas)
    res = repo.search(session, "postgres")
    assert len(res) == 1
    assert res[0]["kind"] == "frase"
    assert res[0]["meeting"].id == m.id

    # encuentra una nota
    res2 = repo.search(session, "token")
    assert len(res2) == 1
    assert res2[0]["kind"] == "nota"

    # sin resultados
    assert repo.search(session, "kubernetes") == []


def test_archive_and_restore_meeting(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión antigua")

    assert repo.archive_item(session, "meeting", meeting.id)
    assert repo.list_meetings(session, ini.id) == []
    archived = repo.list_archived(session)
    assert [(row["kind"], row["item"].id) for row in archived] == [("meeting", meeting.id)]

    assert repo.restore_item(session, "meeting", meeting.id)
    assert repo.list_meetings(session, ini.id)[0].id == meeting.id
    assert repo.list_archived(session) == []


def test_trash_initiative_hides_children_and_can_restore(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión")

    assert repo.trash_item(session, "initiative", ini.id)
    assert repo.list_initiatives(session) == []
    trash = repo.list_trash(session)
    assert [(row["kind"], row["item"].id) for row in trash] == [("initiative", ini.id)]

    assert repo.restore_item(session, "initiative", ini.id)
    assert repo.list_initiatives(session)[0].id == ini.id
    assert repo.list_meetings(session, ini.id)[0].id == meeting.id


def test_permanent_delete_only_works_from_trash(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión")
    repo.add_utterance(session, meeting.id, "me", "texto", 0, 1)

    assert not repo.permanently_delete_item(session, "meeting", meeting.id)
    repo.trash_item(session, "meeting", meeting.id)
    assert repo.permanently_delete_item(session, "meeting", meeting.id)
    assert repo.get_meeting(session, meeting.id) is None


def test_permanent_delete_initiative_cascades_all_database_content(session):
    ini = repo.create_initiative(session, "Proyecto")
    meeting = repo.start_meeting(session, ini.id, "Reunión")
    utterance = repo.add_utterance(session, meeting.id, "me", "texto", 0, 1)
    repo.add_note(session, meeting.id, "nota")
    repo.add_capture(session, meeting.id, "captura.png", near_utterance_id=utterance.id)

    repo.trash_item(session, "initiative", ini.id)
    assert repo.permanently_delete_item(session, "initiative", ini.id)
    assert repo.get_meeting(session, meeting.id) is None


def test_search_ignores_archived_and_trashed_content(session):
    ini = repo.create_initiative(session, "Proyecto")
    active = repo.start_meeting(session, ini.id, "Activa")
    archived = repo.start_meeting(session, ini.id, "Archivada")
    trashed = repo.start_meeting(session, ini.id, "Papelera")
    for meeting in (active, archived, trashed):
        repo.add_utterance(session, meeting.id, "others", "palabra especial", 0, 1)
    repo.archive_item(session, "meeting", archived.id)
    repo.trash_item(session, "meeting", trashed.id)

    assert [row["meeting"].id for row in repo.search(session, "especial")] == [active.id]
