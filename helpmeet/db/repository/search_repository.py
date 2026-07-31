"""Búsqueda full-text con FTS5 y fallback a LIKE."""

from sqlalchemy import select, func, text, or_
from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting, Utterance, Note


def _active_filters():
    return (
        Meeting.archived_at.is_(None), Meeting.deleted_at.is_(None),
        Initiative.archived_at.is_(None), Initiative.deleted_at.is_(None),
    )


def _has_fts(session: Session) -> bool:
    row = session.execute(text(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' "
        "AND name='utterances_fts'"
    )).scalar()
    return bool(row)


def _search_fts(session: Session, query: str) -> list[dict]:
    clean = " AND ".join(f'"{word}"' for word in query.split() if word)
    if not clean:
        return []
    rows = session.execute(text(f"""
        SELECT m.id AS meeting_id, u.id AS row_id, 'frase' AS kind,
               u.speaker, u.text
        FROM utterances_fts f
        JOIN utterance u ON u.id = f.rowid
        JOIN meeting m ON m.id = u.meeting_id
        JOIN initiative i ON i.id = m.initiative_id
        WHERE utterances_fts MATCH :q
          AND m.archived_at IS NULL AND m.deleted_at IS NULL
          AND i.archived_at IS NULL AND i.deleted_at IS NULL
        UNION ALL
        SELECT m.id AS meeting_id, n.id AS row_id, 'nota' AS kind,
               '' AS speaker, n.text
        FROM notes_fts f
        JOIN note n ON n.id = f.rowid
        JOIN meeting m ON m.id = n.meeting_id
        JOIN initiative i ON i.id = m.initiative_id
        WHERE notes_fts MATCH :q
          AND m.archived_at IS NULL AND m.deleted_at IS NULL
          AND i.archived_at IS NULL AND i.deleted_at IS NULL
    """), {"q": clean})
    result = []
    meeting_cache: dict[int, object] = {}
    for row in rows:
        mid = row.meeting_id
        if mid not in meeting_cache:
            meeting_cache[mid] = session.get(Meeting, mid)
        result.append({
            "meeting": meeting_cache[mid],
            "kind": row.kind,
            "speaker": row.speaker,
            "text": row.text,
        })
    return result


def _search_like(session: Session, query: str) -> list[dict]:
    pattern = f"%{query}%"
    results = []
    utt_stmt = (select(Meeting, Utterance)
                .join(Utterance.meeting)
                .join(Meeting.initiative)
                .where(*_active_filters(), Utterance.text.ilike(pattern)))
    for m, u in session.execute(utt_stmt).all():
        results.append({"meeting": m, "kind": "frase", "speaker": u.speaker, "text": u.text})
    note_stmt = (select(Meeting, Note)
                 .join(Note.meeting)
                 .join(Meeting.initiative)
                 .where(*_active_filters(), Note.text.ilike(pattern)))
    for m, n in session.execute(note_stmt).all():
        results.append({"meeting": m, "kind": "nota", "speaker": "", "text": n.text})
    return results


def search(session: Session, query: str) -> list[dict]:
    query = (query or "").strip()
    if not query:
        return []
    if _has_fts(session):
        return _search_fts(session, query)
    return _search_like(session, query)
