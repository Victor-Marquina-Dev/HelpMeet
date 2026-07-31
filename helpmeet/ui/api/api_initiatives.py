"""Metodos de gestion de iniciativas, archivo y papelera."""

from helpmeet.db import repository as repo
from helpmeet import settings
from pathlib import Path


class InitiativeApiMixin:
    """gestion de iniciativas, archivo y papelera.."""
    def _item_in_use(self, kind: str, item_id: int) -> bool:
        meeting_ids = set()
        if self._recorder and self._recorder.meeting:
            meeting_ids.add(self._recorder.meeting.id)
        if self._screen_meeting_id:
            meeting_ids.add(self._screen_meeting_id)
        if kind == "meeting":
            return item_id in meeting_ids
        if kind == "initiative":
            return any((repo.get_meeting(self._session, mid) and
                        repo.get_meeting(self._session, mid).initiative_id == item_id)
                       for mid in meeting_ids)
        return False


    def archive_item(self, kind: str, item_id: int) -> dict:
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de archivar este elemento."}
        return {"ok": repo.archive_item(self._session, kind, int(item_id))}


    def create_initiative(self, name: str, color: str | None = None) -> dict:
        i = repo.create_initiative(self._session, name, color=color)
        return _initiative_payload(i)


    def get_glossary(self, initiative_id: int) -> list[dict]:
        from helpmeet.glossary import build_glossary
        glos = build_glossary(self._session, int(initiative_id))
        return [{"term": t, "count": c} for t, c in glos]


    def list_initiatives(self) -> list[dict]:
        return [_initiative_payload(i) for i in repo.list_initiatives(self._session)]


    def list_library(self, view: str) -> list[dict]:
        """Lista el archivo o la papelera en un formato listo para la UI."""
        rows = repo.list_archived(self._session) if view == "archive" else repo.list_trash(self._session)
        result = []
        for row in rows:
            item = row["item"]
            kind = row["kind"]
            stamp = item.archived_at if view == "archive" else item.deleted_at
            result.append({
                "kind": kind,
                "id": item.id,
                "title": item.name if kind == "initiative" else item.title,
                "initiative": "" if kind == "initiative" else item.initiative.name,
                "date": stamp.strftime("%d/%m/%Y %H:%M") if stamp else "",
                "meeting_count": len(item.meetings) if kind == "initiative" else 0,
            })
        return result


    def permanently_delete_item(self, kind: str, item_id: int) -> dict:
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de eliminar este elemento."}
        return {"ok": repo.permanently_delete_item(self._session, kind, int(item_id))}


    def rename_initiative(self, initiative_id: int, name: str) -> dict:
        repo.rename_initiative(self._session, int(initiative_id), name)
        return {"ok": True}


    def restore_item(self, kind: str, item_id: int) -> dict:
        return {"ok": repo.restore_item(self._session, kind, int(item_id))}


    def set_initiative_color(self, initiative_id: int, color: str) -> dict:
        repo.set_initiative_color(self._session, int(initiative_id), color)
        return {"ok": True}


    def set_initiative_description(self, initiative_id: int, description: str) -> dict:
        """Guarda el objetivo/contexto de una iniciativa (va a la cabecera del export)."""
        repo.set_initiative_description(self._session, int(initiative_id), description)
        return {"ok": True}


    def sync_initiatives_with_folders(self) -> dict:
        """Sincroniza iniciativas con las carpetas en export_dir.
        - Carpeta borrada + iniciativa tenía reuniones → papelera.
        - Carpeta nueva sin iniciativa en DB → crea iniciativa.
        """
        from pathlib import Path
        _SKIP = {"recuperados"}  # carpetas reservadas por Helpmeet
        export_dir = Path(settings.get_export_dir())
        if not export_dir.exists():
            return {"trashed": [], "created": []}
        folders = [p for p in export_dir.iterdir() if p.is_dir()]
        folder_names_lower = {p.name.lower(): p.name for p in folders}
        initiatives = repo.list_initiatives(self._session)
        init_names_lower = {i.name.lower(): i for i in initiatives}
        trashed, created = [], []
        # Iniciativas en DB cuya carpeta desapareció
        for name_lower, init in init_names_lower.items():
            meetings = repo.list_meetings(self._session, init.id)
            if not meetings:
                continue
            if name_lower not in folder_names_lower:
                repo.trash_item(self._session, "initiative", init.id)
                trashed.append(init.id)
        # Carpetas → crear iniciativa si no existe, luego importar reuniones si está vacía
        for folder_path in folders:
            name_lower = folder_path.name.lower()
            if name_lower in _SKIP:
                continue
            try:
                if name_lower not in init_names_lower:
                    new_init = repo.create_initiative(self._session, folder_path.name)
                    created.append(new_init.id)
                    _import_meetings_from_folder(self._session, new_init, folder_path)
                else:
                    existing_init = init_names_lower[name_lower]
                    existing_meetings = repo.list_meetings(self._session, existing_init.id)
                    if not existing_meetings:
                        _import_meetings_from_folder(self._session, existing_init, folder_path)
            except Exception:
                self._session.rollback()
        return {"trashed": trashed, "created": created}


    def toggle_initiative_pin(self, initiative_id: int) -> dict:
        """Ancla/desancla una iniciativa (las ancladas salen arriba en la lista)."""
        state = repo.toggle_initiative_pin(self._session, int(initiative_id))
        if state is None:
            return {"ok": False, "error": "La iniciativa ya no existe."}
        return {"ok": True, "id": int(initiative_id), "pinned": bool(state)}


    def trash_item(self, kind: str, item_id: int) -> dict:
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de mover este elemento."}
        return {"ok": repo.trash_item(self._session, kind, int(item_id))}

