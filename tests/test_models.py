from datetime import datetime
from helpmeet.db.models import Initiative, Meeting, Utterance, Capture


def test_initiative_with_meeting_and_utterance(session):
    ini = Initiative(name="Sistema de Login")
    meeting = Meeting(title="Endpoints", started_at=datetime.now(), initiative=ini)
    Utterance(speaker="me", text="hola", start_time=0.0, end_time=1.0, meeting=meeting)
    session.add(ini)
    session.commit()

    assert ini.id is not None
    assert meeting.initiative_id == ini.id
    assert ini.meetings[0].utterances[0].text == "hola"


def test_speaker_only_accepts_me_or_others(session):
    meeting = Meeting(title="t", started_at=datetime.now(), initiative=Initiative(name="x"))
    utt = Utterance(speaker="others", text="t", start_time=0.0, end_time=1.0, meeting=meeting)
    session.add(meeting)
    session.commit()
    assert utt.speaker == "others"


def test_capture_links_to_meeting_and_utterance(session):
    meeting = Meeting(title="m", started_at=datetime.now(), initiative=Initiative(name="i"))
    utt = Utterance(speaker="me", text="mira", start_time=2.0, end_time=3.0, meeting=meeting)
    cap = Capture(image_path="data/captures/x.png", meeting=meeting)
    session.add(meeting)
    session.commit()
    cap.near_utterance_id = utt.id
    session.commit()
    assert meeting.captures[0].near_utterance_id == utt.id
