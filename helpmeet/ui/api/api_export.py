"""Metodos de exportacion a Markdown, TXT, ZIP y dialogo de archivos."""

import os
import shutil
from pathlib import Path

import webview

from helpmeet import settings
from helpmeet.db import repository as repo
from helpmeet.export.exporter import (
    export_meeting, export_initiative, meeting_export_dir,
    build_meeting_context, transcript_filename,
    export_transcript_package, transcript_package_filename,
    initiative_export_dir,
)


class ExportApiMixin:
    """exportacion a Markdown, TXT, ZIP y dialogo de archivos.."""
    def _move_to_initiative_folder(self, src: str, initiative_id: int) -> str:
        """Mueve el archivo a la carpeta de exportación de la iniciativa.

        Si ya está dentro de esa carpeta no hace nada. Si hay conflicto de
        nombre agrega un sufijo numérico. Devuelve la ruta final del archivo."""
        initiative = repo.get_initiative(self._session, initiative_id)
        if initiative is None:
            return src
        base_dir = settings.get_export_dir()
        dest_dir = initiative_export_dir(initiative, base_dir)
        src_path = Path(src)
        dest = dest_dir / src_path.name
        # Si ya está en el destino correcto, no mover
        if src_path.resolve() == dest.resolve():
            return str(dest)
        # Resolver conflictos de nombre
        if dest.exists():
            stem, suffix = src_path.stem, src_path.suffix
            n = 1
            while dest.exists():
                dest = dest_dir / f"{stem}_{n}{suffix}"
                n += 1
        try:
            shutil.move(str(src_path), str(dest))
            _log.info("Video movido a carpeta de iniciativa: %s", dest)
        except Exception as exc:
            _log.warning("No se pudo mover el video a la carpeta de iniciativa: %s", exc)
            return src  # si falla el move, usar ruta original
        return str(dest)


    def _pick_file(self) -> str | None:
        """Abre el diálogo nativo para elegir un archivo de video/audio."""
        types = (
            "Video o audio (*.mp4;*.mkv;*.mov;*.avi;*.webm;*.mp3;*.m4a;*.wav;*.ogg)",
            "Todos los archivos (*.*)",
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=types
        )
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None


    def _pick_folder(self) -> str | None:
        """Abre el diálogo nativo para elegir una carpeta. Devuelve la ruta o None."""
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None


    def choose_export_dir(self) -> dict:
        path = self._pick_folder()
        if path:
            settings.set_export_dir(path)
            return {"ok": True, "path": str(path)}
        return {"ok": False}


    def copy_initiative_context(self, initiative_id: int) -> dict:
        """Refresca el export y devuelve el texto de `contexto.md` para copiarlo.

        Reutiliza la exportación normal (deja la carpeta al día) y lee el
        documento combinado, que ya incluye la cabecera de instrucciones,
        el objetivo, el glosario y todas las reuniones."""
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        ctx = Path(out) / "contexto.md"
        text = ctx.read_text(encoding="utf-8") if ctx.exists() else ""
        return {"ok": bool(text.strip()), "text": text, "path": str(out)}


    def copy_meeting_context(self, meeting_id: int) -> dict:
        """Devuelve el texto de UNA reunión (con cabecera para la IA) para copiarlo."""
        text = build_meeting_context(self._session, int(meeting_id))
        return {"ok": bool(text.strip()), "text": text}


    def export_initiative_by_id(self, initiative_id: int) -> dict:
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        return {"path": str(out)}


    def export_initiative_to(self, initiative_id: int) -> dict:
        """Exporta la iniciativa completa a una carpeta elegida en el momento."""
        folder = self._pick_folder()
        if not folder:
            return {"ok": False}
        out = export_initiative(self._session, int(initiative_id), folder)
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}


    def export_meeting_by_id(self, meeting_id: int) -> dict:
        out = export_meeting(self._session, int(meeting_id), settings.get_export_dir())
        return {"path": str(out)}


    def export_meeting_to(self, meeting_id: int) -> dict:
        """Exporta UNA reunión a una carpeta elegida en el momento (no la de ajustes)."""
        folder = self._pick_folder()
        if not folder:
            return {"ok": False}
        out = export_meeting(self._session, int(meeting_id), folder)
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}


    def export_transcript(self, meeting_id: int) -> dict:
        """TXT si solo hay texto; ZIP cuando existen imágenes o archivos."""
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        has_captures = any(Path(cap.image_path).is_file() for cap in meeting.captures)
        has_file = bool(meeting.audio_path and Path(meeting.audio_path).is_file())
        has_assets = has_captures or has_file
        initial_dir = settings.get_export_dir()
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(initial_dir) if initial_dir.exists() else "",
            save_filename=(transcript_package_filename(meeting) if has_assets
                           else transcript_filename(meeting)),
            file_types=(("Paquete ZIP (*.zip)",) if has_assets
                        else ("Archivo de texto (*.txt)",)),
        )
        if not result:
            return {"ok": False, "cancelled": True}
        selected = result[0] if isinstance(result, (list, tuple)) else result
        path = Path(selected).with_suffix(".zip" if has_assets else ".txt")
        if has_assets:
            payload = export_transcript_package(meeting, path)
            return {"ok": True, "format": "zip", **payload}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(build_transcript_txt(meeting), encoding="utf-8-sig")
        return {"ok": True, "format": "txt", "path": str(path),
                "captures": 0, "files": 0}


    def export_transcript_package(self, meeting_id: int) -> dict:
        """Guarda un ZIP con la transcripción y todos sus recursos visibles."""
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        initial_dir = settings.get_export_dir()
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(initial_dir) if initial_dir.exists() else "",
            save_filename=transcript_package_filename(meeting),
            file_types=("Paquete ZIP (*.zip)",),
        )
        if not result:
            return {"ok": False, "cancelled": True}
        selected = result[0] if isinstance(result, (list, tuple)) else result
        path = Path(selected)
        if path.suffix.lower() != ".zip":
            path = path.with_suffix(".zip")
        payload = export_transcript_package(meeting, path)
        return {"ok": True, **payload}


    def export_transcript_txt(self, meeting_id: int) -> dict:
        """Muestra Guardar como y exporta únicamente la transcripción en TXT."""
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        initial_dir = settings.get_export_dir()
        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(initial_dir) if initial_dir.exists() else "",
            save_filename=transcript_filename(meeting),
            file_types=("Archivo de texto (*.txt)",),
        )
        if not result:
            return {"ok": False, "cancelled": True}
        selected = result[0] if isinstance(result, (list, tuple)) else result
        path = Path(selected)
        if path.suffix.lower() != ".txt":
            path = path.with_suffix(".txt")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(build_transcript_txt(meeting), encoding="utf-8-sig")
        return {"ok": True, "path": str(path)}


    def open_initiative_folder(self, initiative_id: int) -> dict:
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}


    def open_meeting_folder(self, meeting_id: int) -> dict:
        """Abre en el Explorador la carpeta de una reunión.

        Si todavía no se había exportado, la exporta primero para que siempre
        haya algo que abrir.
        """
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"ok": False}
        exports = settings.get_export_dir()
        # Regenera la iniciativa para migrar también las reuniones antiguas del
        # mismo mes y retirar archivos sueltos de la estructura anterior.
        export_meeting(self._session, m.id, exports)
        folder = meeting_export_dir(m, exports)
        _open_in_explorer(folder)
        return {"ok": True, "path": str(folder)}


    def open_path(self, path: str) -> dict:
        """Abre en el Explorador la carpeta indicada (la de una exportación)."""
        if path:
            _open_in_explorer(path)
            return {"ok": True}
        return {"ok": False}

