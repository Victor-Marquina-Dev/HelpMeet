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
