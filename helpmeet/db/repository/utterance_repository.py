"""Funciones de acceso a datos para frases (utterances)."""

from sqlalchemy.orm import Session
from helpmeet.db.models import Utterance, Participant
from helpmeet.constants import SPEAKER_LABEL


def add_utterance(session: Session, meeting_id: int, speaker: str, text: str,
                  start_time: float, end_time: float,
                  language: str = "") -> Utterance:
    utt = Utterance(meeting_id=meeting_id, speaker=speaker, text=text,
                    start_time=start_time, end_time=end_time,
                    language=language)
    session.add(utt)
    session.commit()
    return utt


def add_utterances(session: Session, meeting_id: int, rows: list[dict]) -> list[Utterance]:
    objects = [
        Utterance(meeting_id=meeting_id, speaker=row["speaker"], text=row["text"],
                  start_time=row["start_time"], end_time=row["end_time"],
                  language=row.get("language", ""))
        for row in rows
    ]
    if not objects:
        return []
    session.add_all(objects)
    session.commit()
    return objects


def get_utterance(session: Session, utterance_id: int) -> Utterance | None:
    return session.get(Utterance, int(utterance_id))


def update_utterance(session: Session, utterance_id: int, *, text: str | None = None,
                     speaker: str | None = None) -> Utterance | None:
    utt = session.get(Utterance, int(utterance_id))
    if utt is None:
        return None
    if text is not None:
        utt.text = text
    if speaker in ("me", "others"):
        utt.speaker = speaker
    session.commit()
    return utt


def toggle_utterance_highlight(session: Session, utterance_id: int) -> bool | None:
    utt = session.get(Utterance, int(utterance_id))
    if utt is None:
        return None
    utt.highlighted = not bool(utt.highlighted)
    session.commit()
    return utt.highlighted


def delete_utterance(session: Session, utterance_id: int) -> bool:
    utt = session.get(Utterance, int(utterance_id))
    if utt is None:
        return False
    session.delete(utt)
    session.commit()
    return True


def resolved_speaker_name(utterance: Utterance, participants: list[Participant]) -> str:
    by_id = {p.id: p for p in participants}
    if utterance.participant_id and utterance.participant_id in by_id:
        return by_id[utterance.participant_id].name
    if utterance.speaker == "me":
        me = next((p for p in participants if p.is_me), None)
        return me.name if me else SPEAKER_LABEL["me"]
    if utterance.speaker == "others":
        guests = [p for p in participants if not p.is_me]
        if len(guests) == 1:
            return guests[0].name
        return SPEAKER_LABEL["others"]
    return SPEAKER_LABEL.get(utterance.speaker, utterance.speaker)
