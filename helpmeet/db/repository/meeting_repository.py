"""Funciones de acceso a datos para reuniones."""

from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting, Utterance, Capture, Note


def list_meetings(session: Session, initiative_id: int) -> list[Meeting]:
    ini = session.get(Initiative, initiative_id)
    if ini is None or ini.archived_at is not None or ini.deleted_at is not None:
        return []
    return sorted(
        (m for m in ini.meetings if m.archived_at is None and m.deleted_at is None),
        key=lambda m: m.started_at, reverse=True,
    )


def list_meetings_by_initiative(session: Session) -> dict[int, list[Meeting]]:
    stmt = (select(Meeting).join(Meeting.initiative).where(
        Meeting.archived_at.is_(None), Meeting.deleted_at.is_(None),
        Initiative.archived_at.is_(None), Initiative.deleted_at.is_(None),
    ).order_by(Meeting.started_at.desc()))
    grouped: dict[int, list[Meeting]] = {}
    for m in session.scalars(stmt):
        grouped.setdefault(m.initiative_id, []).append(m)
    return grouped


def utterance_counts(session: Session, meeting_ids=None) -> dict[int, int]:
    stmt = (select(Utterance.meeting_id, func.count(Utterance.id))
            .group_by(Utterance.meeting_id))
    if meeting_ids is not None:
        ids = list(meeting_ids)
        if not ids:
            return {}
        stmt = stmt.where(Utterance.meeting_id.in_(ids))
    return dict(session.execute(stmt).all())


def rename_meeting(session: Session, meeting_id: int, title: str) -> Meeting:
    m = session.get(Meeting, meeting_id)
    if m and title and title.strip():
        m.title = title.strip()
        session.commit()
    return m


def set_meeting_context(session: Session, meeting_id: int,
                        context: str | None) -> Meeting | None:
    meeting = session.get(Meeting, int(meeting_id))
    if meeting:
        text = (context or "").strip()
        meeting.context = text or None
        session.commit()
    return meeting


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


def add_capture(session: Session, meeting_id: int, image_path: str,
                near_utterance_id: int | None = None, note: str | None = None) -> Capture:
    cap = Capture(meeting_id=meeting_id, image_path=image_path,
                  near_utterance_id=near_utterance_id, note=note)
    session.add(cap)
    session.commit()
    return cap


def add_note(session: Session, meeting_id: int, text: str,
             is_context: bool = False) -> Note:
    note = Note(meeting_id=meeting_id, text=text, is_context=bool(is_context))
    session.add(note)
    session.commit()
    return note


def get_note(session: Session, note_id: int) -> Note | None:
    return session.get(Note, int(note_id))


def update_note(session: Session, note_id: int, *, text: str | None = None) -> Note | None:
    note = session.get(Note, int(note_id))
    if note is None:
        return None
    if text is not None:
        note.text = text
    session.commit()
    return note


def delete_note(session: Session, note_id: int) -> bool:
    note = session.get(Note, int(note_id))
    if note is None:
        return False
    session.delete(note)
    session.commit()
    return True
