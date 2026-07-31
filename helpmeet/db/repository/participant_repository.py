"""Funciones de acceso a datos para participantes."""

from sqlalchemy import select
from sqlalchemy.orm import Session
from helpmeet.db.models import Participant, Utterance


def get_participant(session: Session, participant_id: int) -> Participant | None:
    return session.get(Participant, int(participant_id))


def list_participants(session: Session, initiative_id: int) -> list[Participant]:
    stmt = (select(Participant)
            .where(Participant.initiative_id == int(initiative_id))
            .order_by(Participant.created_at, Participant.id))
    return list(session.scalars(stmt))


def add_participants(session: Session, initiative_id: int, names) -> list[Participant]:
    if isinstance(names, str):
        names = names.replace(",", "\n").splitlines()
    existing = {p.name.strip().lower() for p in list_participants(session, initiative_id)}
    created: list[Participant] = []
    seen = set(existing)
    for raw in names or []:
        name = (raw or "").strip()
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        p = Participant(initiative_id=int(initiative_id), name=name)
        session.add(p)
        created.append(p)
    if created:
        session.commit()
    return created


def rename_participant(session: Session, participant_id: int, name: str) -> Participant | None:
    p = session.get(Participant, int(participant_id))
    if p is None or not (name or "").strip():
        return None
    p.name = name.strip()
    session.commit()
    return p


def delete_participant(session: Session, participant_id: int) -> bool:
    p = session.get(Participant, int(participant_id))
    if p is None:
        return False
    session.query(Utterance).filter(
        Utterance.participant_id == p.id
    ).update({Utterance.participant_id: None})
    session.delete(p)
    session.commit()
    return True


def set_me_participant(session: Session, initiative_id: int,
                       participant_id: int | None) -> None:
    for p in list_participants(session, initiative_id):
        p.is_me = (participant_id is not None and p.id == int(participant_id))
    session.commit()


def assign_utterance_participant(session: Session, utterance_id: int,
                                 participant_id: int | None) -> Utterance | None:
    utt = session.get(Utterance, int(utterance_id))
    if utt is None:
        return None
    utt.participant_id = int(participant_id) if participant_id is not None else None
    session.commit()
    return utt
