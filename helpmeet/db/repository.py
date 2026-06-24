from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting, Utterance, Capture, Note, Participant

SPEAKER_LABEL = {"me": "Yo", "others": "Los demás"}


def create_initiative(session: Session, name: str, description: str | None = None) -> Initiative:
    ini = Initiative(name=name, description=description)
    session.add(ini)
    session.commit()
    return ini


def list_initiatives(session: Session) -> list[Initiative]:
    # Ancladas primero (las más recientemente ancladas arriba); el resto por fecha.
    stmt = select(Initiative).where(
        Initiative.archived_at.is_(None), Initiative.deleted_at.is_(None)
    ).order_by(
        Initiative.pinned_at.is_(None), Initiative.pinned_at.desc(),
        Initiative.created_at,
    )
    return list(session.scalars(stmt))


def toggle_initiative_pin(session: Session, initiative_id: int) -> bool | None:
    """Ancla/desancla una iniciativa. Devuelve el nuevo estado (anclada o no)."""
    ini = session.get(Initiative, int(initiative_id))
    if ini is None:
        return None
    ini.pinned_at = None if ini.pinned_at else datetime.now()
    session.commit()
    return ini.pinned_at is not None


def list_archived(session: Session) -> list[dict]:
    """Iniciativas y reuniones archivadas, sin incluir elementos en papelera."""
    initiatives = list(session.scalars(
        select(Initiative).where(
            Initiative.archived_at.is_not(None), Initiative.deleted_at.is_(None)
        ).order_by(Initiative.archived_at.desc())
    ))
    meetings = list(session.scalars(
        select(Meeting).join(Meeting.initiative).where(
            Meeting.archived_at.is_not(None), Meeting.deleted_at.is_(None),
            Initiative.archived_at.is_(None), Initiative.deleted_at.is_(None),
        ).order_by(Meeting.archived_at.desc())
    ))
    return ([{"kind": "initiative", "item": item} for item in initiatives] +
            [{"kind": "meeting", "item": item} for item in meetings])


def list_trash(session: Session) -> list[dict]:
    """Elementos en papelera; no duplica reuniones dentro de una iniciativa eliminada."""
    initiatives = list(session.scalars(
        select(Initiative).where(Initiative.deleted_at.is_not(None))
        .order_by(Initiative.deleted_at.desc())
    ))
    meetings = list(session.scalars(
        select(Meeting).join(Meeting.initiative).where(
            Meeting.deleted_at.is_not(None), Initiative.deleted_at.is_(None)
        ).order_by(Meeting.deleted_at.desc())
    ))
    return ([{"kind": "initiative", "item": item} for item in initiatives] +
            [{"kind": "meeting", "item": item} for item in meetings])


def list_meetings(session: Session, initiative_id: int) -> list[Meeting]:
    ini = session.get(Initiative, initiative_id)
    if ini is None or ini.archived_at is not None or ini.deleted_at is not None:
        return []
    return sorted(
        (m for m in ini.meetings if m.archived_at is None and m.deleted_at is None),
        key=lambda m: m.started_at, reverse=True,
    )


def archive_item(session: Session, kind: str, item_id: int) -> bool:
    item = _get_item(session, kind, item_id)
    if item is None:
        return False
    item.archived_at = datetime.now()
    item.deleted_at = None
    session.commit()
    return True


def trash_item(session: Session, kind: str, item_id: int) -> bool:
    item = _get_item(session, kind, item_id)
    if item is None:
        return False
    item.deleted_at = datetime.now()
    item.archived_at = None
    session.commit()
    return True


def restore_item(session: Session, kind: str, item_id: int) -> bool:
    item = _get_item(session, kind, item_id)
    if item is None:
        return False
    item.archived_at = None
    item.deleted_at = None
    # Restaurar una reunión también reactiva su iniciativa contenedora.
    if kind == "meeting":
        item.initiative.archived_at = None
        item.initiative.deleted_at = None
    session.commit()
    return True


def permanently_delete_item(session: Session, kind: str, item_id: int) -> bool:
    item = _get_item(session, kind, item_id)
    if item is None or item.deleted_at is None:
        return False
    session.delete(item)
    session.commit()
    return True


def _get_item(session: Session, kind: str, item_id: int):
    model = Initiative if kind == "initiative" else Meeting if kind == "meeting" else None
    return session.get(model, item_id) if model is not None else None


def rename_initiative(session: Session, initiative_id: int, name: str) -> Initiative:
    ini = session.get(Initiative, initiative_id)
    if ini and name and name.strip():
        ini.name = name.strip()
        session.commit()
    return ini


def get_initiative(session: Session, initiative_id: int) -> Initiative | None:
    return session.get(Initiative, initiative_id)


def get_capture(session: Session, capture_id: int) -> Capture | None:
    return session.get(Capture, capture_id)


def set_initiative_description(session: Session, initiative_id: int,
                              description: str | None) -> Initiative:
    """Guarda el objetivo/contexto de la iniciativa (vacío = sin descripción)."""
    ini = session.get(Initiative, initiative_id)
    if ini:
        text = (description or "").strip()
        ini.description = text or None
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


def add_utterances(session: Session, meeting_id: int, rows) -> list[Utterance]:
    """Inserta varias frases en UNA sola transacción (P-02).

    `rows`: iterable de dicts con speaker/text/start_time/end_time. Un commit por
    pista/reunión en vez de uno por frase: una reunión con cientos de segmentos
    pasa de cientos de escrituras sincronizadas a una sola."""
    objects = [
        Utterance(meeting_id=meeting_id, speaker=row["speaker"], text=row["text"],
                  start_time=row["start_time"], end_time=row["end_time"])
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
    """Edita el texto y/o el hablante de una frase. Ignora valores no enviados."""
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
    """Marca/desmarca una frase como importante. Devuelve el nuevo estado."""
    utt = session.get(Utterance, int(utterance_id))
    if utt is None:
        return None
    utt.highlighted = not bool(utt.highlighted)
    session.commit()
    return utt.highlighted


def delete_utterance(session: Session, utterance_id: int) -> bool:
    """Elimina una frase. Devuelve True si existía."""
    utt = session.get(Utterance, int(utterance_id))
    if utt is None:
        return False
    session.delete(utt)
    session.commit()
    return True


# ---------- Participantes ----------
def get_participant(session: Session, participant_id: int) -> Participant | None:
    return session.get(Participant, int(participant_id))


def list_participants(session: Session, initiative_id: int) -> list[Participant]:
    stmt = (select(Participant)
            .where(Participant.initiative_id == int(initiative_id))
            .order_by(Participant.created_at, Participant.id))
    return list(session.scalars(stmt))


def add_participants(session: Session, initiative_id: int, names) -> list[Participant]:
    """Da de alta uno o varios participantes (acepta lista o texto multilínea).

    Ignora líneas vacías y nombres que ya existen en la iniciativa (sin distinguir
    mayúsculas ni espacios sobrantes). Devuelve solo los recién creados."""
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
    """Borra un participante. Las frases que lo tuvieran asignado vuelven a las
    reglas automáticas (su participant_id queda a NULL)."""
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
    """Marca un participante como "yo" (tu micrófono) y desmarca los demás de la
    iniciativa. `participant_id=None` deja a nadie marcado."""
    for p in list_participants(session, initiative_id):
        p.is_me = (participant_id is not None and p.id == int(participant_id))
    session.commit()


def assign_utterance_participant(session: Session, utterance_id: int,
                                 participant_id: int | None) -> Utterance | None:
    """Asigna (o desasigna, con None) una frase a un participante concreto."""
    utt = session.get(Utterance, int(utterance_id))
    if utt is None:
        return None
    utt.participant_id = int(participant_id) if participant_id is not None else None
    session.commit()
    return utt


def resolved_speaker_name(utterance: Utterance, participants: list[Participant]) -> str:
    """Nombre a mostrar para una frase, aplicando las reglas (sin IA):

    1. Asignación manual (participant_id) → ese nombre.
    2. speaker == "me" → el participante marcado "yo" (o "Yo").
    3. speaker == "others" → si hay exactamente un invitado (no-yo) → su nombre;
       si hay 0 o 2+ → "Los demás".
    """
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
    active = (
        Meeting.archived_at.is_(None), Meeting.deleted_at.is_(None),
        Initiative.archived_at.is_(None), Initiative.deleted_at.is_(None),
    )
    utterance_stmt = (select(Utterance).join(Utterance.meeting).join(Meeting.initiative)
                      .where(Utterance.text.ilike(like), *active))
    for u in session.scalars(utterance_stmt):
        results.append({"meeting": u.meeting, "kind": "frase",
                        "speaker": u.speaker, "text": u.text})
    note_stmt = (select(Note).join(Note.meeting).join(Meeting.initiative)
                 .where(Note.text.ilike(like), *active))
    for n in session.scalars(note_stmt):
        results.append({"meeting": n.meeting, "kind": "nota",
                        "speaker": None, "text": n.text})
    return results
