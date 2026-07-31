"""Método de búsqueda global.

Extraido de la clase Api en app.py."""

from helpmeet.db import repository as repo


class SearchApiMixin:
    """Busqueda global en transcripciones."""

    def search(self, query: str) -> list[dict]:
        out = []
        for r in repo.search(self._session, query):
            m = r["meeting"]
            out.append({
                "meeting_id": m.id,
                "meeting_title": m.title,
                "initiative": m.initiative.name,
                "date": m.started_at.strftime("%d/%m/%Y %H:%M"),
                "kind": r["kind"],
                "speaker": r["speaker"],
                "text": r["text"],
            })
        return out
