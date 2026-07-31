"""Helpers compartidos entre los repositorios especializados."""

from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting, Capture


def _get_item(session: Session, kind: str, item_id: int):
    model = Initiative if kind == "initiative" else Meeting if kind == "meeting" else None
    return session.get(model, item_id) if model is not None else None


def get_capture(session: Session, capture_id: int) -> Capture | None:
    return session.get(Capture, capture_id)
