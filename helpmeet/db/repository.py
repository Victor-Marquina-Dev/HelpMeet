from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting, Utterance, Capture, Note


def create_initiative(session: Session, name: str, description: str | None = None) -> Initiative:
    ini = Initiative(name=name, description=description)
    session.add(ini)
    session.commit()
    return ini


def list_initiatives(session: Session) -> list[Initiative]:
    return list(session.scalars(select(Initiative).order_by(Initiative.created_at)))


def list_meetings(session: Session, initiative_id: int) -> list[Meeting]:
    ini = session.get(Initiative, initiative_id)
    if ini is None:
        return []
    return sorted(ini.meetings, key=lambda m: m.started_at, reverse=True)


def rename_initiative(session: Session, initiative_id: int, name: str) -> Initiative:
    ini = session.get(Initiative, initiative_id)
    if ini and name and name.strip():
        ini.name = name.strip()
        session.commit()
    return ini


def rename_meeting(session: Session, meeting_id: int, title: str) -> Meeting:
    m = session.get(Meeting, meeting_id)
    if m and title and title.strip():
        m.title = title.strip()
        session.commit()
    return m


def move_meeting(session: Session, meeting_id: int, initiative_id: int) -> Meeting:
    m = session.get(Meeting, meeting_id)
    if m:
        m.initiative_id = int(initiative_id)
        session.commit()
    return m


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


def add_note(session: Session, meeting_id: int, text: str) -> Note:
    note = Note(meeting_id=meeting_id, text=text)
    session.add(note)
    session.commit()
    return note


def search(session: Session, query: str) -> list[dict]:
    """Busca el texto en frases y notas de TODAS las reuniones.

    Devuelve una lista de dicts {meeting, kind, speaker, text}, sin distinguir
    mayúsculas. `kind` es "frase" o "nota".
    """
    query = (query or "").strip()
    if not query:
        return []
    like = f"%{query}%"
    results: list[dict] = []
    for u in session.scalars(select(Utterance).where(Utterance.text.ilike(like))):
        results.append({"meeting": u.meeting, "kind": "frase",
                        "speaker": u.speaker, "text": u.text})
    for n in session.scalars(select(Note).where(Note.text.ilike(like))):
        results.append({"meeting": n.meeting, "kind": "nota",
                        "speaker": None, "text": n.text})
    return results
