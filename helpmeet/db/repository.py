from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting, Utterance, Capture


def create_initiative(session: Session, name: str, description: str | None = None) -> Initiative:
    ini = Initiative(name=name, description=description)
    session.add(ini)
    session.commit()
    return ini


def list_initiatives(session: Session) -> list[Initiative]:
    return list(session.scalars(select(Initiative).order_by(Initiative.created_at)))


def start_meeting(session: Session, initiative_id: int, title: str) -> Meeting:
    meeting = Meeting(initiative_id=initiative_id, title=title, started_at=datetime.now())
    session.add(meeting)
    session.commit()
    return meeting


def end_meeting(session: Session, meeting_id: int) -> None:
    meeting = session.get(Meeting, meeting_id)
    meeting.ended_at = datetime.now()
    session.commit()


def get_meeting(session: Session, meeting_id: int) -> Meeting:
    return session.get(Meeting, meeting_id)


def add_utterance(session: Session, meeting_id: int, speaker: str, text: str,
                  start_time: float, end_time: float) -> Utterance:
    utt = Utterance(meeting_id=meeting_id, speaker=speaker, text=text,
                    start_time=start_time, end_time=end_time)
    session.add(utt)
    session.commit()
    return utt


def add_capture(session: Session, meeting_id: int, image_path: str,
                near_utterance_id: int | None = None, note: str | None = None) -> Capture:
    cap = Capture(meeting_id=meeting_id, image_path=image_path,
                  near_utterance_id=near_utterance_id, note=note)
    session.add(cap)
    session.commit()
    return cap
