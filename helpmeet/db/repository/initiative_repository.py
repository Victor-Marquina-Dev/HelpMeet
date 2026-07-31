"""Funciones de acceso a datos para iniciativas."""

from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from helpmeet.db.models import Initiative, Meeting
from helpmeet.db.repository._shared import _get_item


def create_initiative(session: Session, name: str, description: str | None = None,
                      color: str | None = None) -> Initiative:
    ini = Initiative(name=name, description=description, color=color)
    session.add(ini)
    session.commit()
    return ini


def list_initiatives(session: Session) -> list[Initiative]:
    stmt = select(Initiative).where(
        Initiative.archived_at.is_(None), Initiative.deleted_at.is_(None)
    ).order_by(
        Initiative.pinned_at.is_(None), Initiative.pinned_at.desc(),
        Initiative.created_at,
    )
    return list(session.scalars(stmt))


def toggle_initiative_pin(session: Session, initiative_id: int) -> bool | None:
    ini = session.get(Initiative, int(initiative_id))
    if ini is None:
        return None
    ini.pinned_at = None if ini.pinned_at else datetime.now()
    session.commit()
    return ini.pinned_at is not None


def list_archived(session: Session) -> list[dict]:
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
    if kind == "meeting":
        item.initiative.archived_at = None
        item.initiative.deleted_at = None
    session.commit()
    return True


def permanently_delete_item(session: Session, kind: str, item_id: int) -> bool:
    item = _get_item(session, kind, item_id)
    if item is None:
        return False
    session.delete(item)
    session.commit()
    return True


def rename_initiative(session: Session, initiative_id: int, name: str) -> Initiative:
    ini = session.get(Initiative, initiative_id)
    if ini and name and name.strip():
        ini.name = name.strip()
        session.commit()
    return ini


def set_initiative_color(session: Session, initiative_id: int, color: str) -> Initiative:
    ini = session.get(Initiative, initiative_id)
    if ini and color:
        ini.color = color.strip()
        session.commit()
    return ini


def get_initiative(session: Session, initiative_id: int) -> Initiative | None:
    return session.get(Initiative, initiative_id)


def set_initiative_description(session: Session, initiative_id: int,
                              description: str | None) -> Initiative:
    ini = session.get(Initiative, initiative_id)
    if ini:
        text = (description or "").strip()
        ini.description = text or None
        session.commit()
    return ini
