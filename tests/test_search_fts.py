"""Pruebas de la búsqueda con FTS5 (P-13) y de su fallback a LIKE."""
from helpmeet.db import repository as repo
from helpmeet.db.database import _ensure_fts


def _seed(session):
    ini = repo.create_initiative(session, "Proyecto")
    m = repo.start_meeting(session, ini.id, "Reunión")
    repo.add_utterance(session, m.id, "me", "Revisar el presupuesto del Q3", 0.0, 1.0)
    repo.add_utterance(session, m.id, "others", "Hola, qué tal", 1.0, 2.0)
    repo.add_note(session, m.id, "Pendiente: cerrar contrato")
    return ini, m


def test_search_fts_matches_by_prefix_and_kinds(session):
    assert _ensure_fts(session.bind) is True
    _seed(session)

    # Prefijo: "presu" casa "presupuesto".
    hits = repo.search(session, "presu")
    assert any(h["kind"] == "frase" and "presupuesto" in h["text"].lower() for h in hits)

    # Encuentra también en notas.
    notes = repo.search(session, "contrato")
    assert any(h["kind"] == "nota" for h in notes)

    # Varias palabras = todas deben aparecer (AND).
    assert repo.search(session, "presupuesto q3")
    assert repo.search(session, "presupuesto inexistente") == []


def test_search_fts_reflects_edits_and_deletes(session):
    assert _ensure_fts(session.bind) is True
    _ini, m = _seed(session)
    u = repo.add_utterance(session, m.id, "me", "texto original alfa", 2.0, 3.0)

    assert repo.search(session, "alfa")
    # Editar: el índice se actualiza por triggers.
    repo.update_utterance(session, u.id, text="texto cambiado beta")
    assert repo.search(session, "alfa") == []
    assert repo.search(session, "beta")
    # Borrar: desaparece del índice.
    repo.delete_utterance(session, u.id)
    assert repo.search(session, "beta") == []


def test_search_like_fallback_without_fts(session):
    # Sin llamar a _ensure_fts no hay índice: debe usar LIKE y seguir funcionando.
    _seed(session)
    assert not repo._has_fts(session)
    hits = repo.search(session, "presupuesto")
    assert any("presupuesto" in h["text"].lower() for h in hits)
    # LIKE es por subcadena: "upuest" también casa.
    assert repo.search(session, "upuest")


def test_search_empty_query_returns_empty(session):
    _seed(session)
    assert repo.search(session, "   ") == []


def test_fts_rebuild_indexes_preexisting_data(session):
    # Simula una base de una versión anterior: primero los datos, DESPUÉS el índice.
    _seed(session)
    assert not repo._has_fts(session)
    assert _ensure_fts(session.bind) is True  # crea el índice y reindexa lo que había
    session.expire_all()
    hits = repo.search(session, "presupuesto")
    assert any("presupuesto" in h["text"].lower() for h in hits)
