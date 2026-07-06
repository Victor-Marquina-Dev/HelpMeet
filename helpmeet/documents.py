"""Conversión de documentos (PDF, Word, PowerPoint, texto…) a Markdown.

Módulo puro: recibe rutas (`Path`) y trabaja con el sistema de archivos. No
conoce la interfaz de usuario ni la base de datos. La orquestación (elegir el
archivo, calcular la carpeta del proyecto) vive en la capa `Api` de la app.
"""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

# Formatos de v1. Excel (.xlsx) queda fuera a propósito: arrastra pandas.
SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx",
    ".txt", ".md", ".html", ".htm", ".csv", ".json", ".xml",
}


def is_supported(path: Path) -> bool:
    """True si la extensión del archivo es convertible en esta versión."""
    return Path(path).suffix.lower() in SUPPORTED_EXTENSIONS


def originals_dir(docs_dir: Path) -> Path:
    """Subcarpeta donde se guarda el archivo original tal cual."""
    return Path(docs_dir) / "originales"


class EmptyDocumentError(Exception):
    """El documento no tenía texto extraíble (p. ej. un PDF escaneado)."""


class UnsupportedDocumentError(Exception):
    """La extensión del archivo no está soportada en esta versión."""


_converter = None


def _get_converter():
    """Instancia de MarkItDown reutilizable (crearla arrastra sus conversores)."""
    global _converter
    if _converter is None:
        from markitdown import MarkItDown
        _converter = MarkItDown(enable_plugins=False)
    return _converter


def convert_to_markdown(source: Path) -> str:
    """Convierte un archivo a texto Markdown.

    Lanza `UnsupportedDocumentError` si el formato no está soportado y
    `EmptyDocumentError` si no se pudo extraer texto (típico de PDF escaneado).
    """
    source = Path(source)
    if not is_supported(source):
        raise UnsupportedDocumentError(source.suffix or source.name)
    result = _get_converter().convert(str(source))
    text = (getattr(result, "text_content", "") or "").strip()
    if not text:
        raise EmptyDocumentError(source.name)
    return text


def _unique_stem(docs_dir: Path, stem: str) -> str:
    """Devuelve un nombre base libre: `informe`, `informe (2)`, `informe (3)`…

    Comprueba tanto el `.md` como el original para no pisar ninguno de los dos.
    """
    candidate = stem
    index = 2
    while (docs_dir / f"{candidate}.md").exists() or _original_exists(docs_dir, candidate):
        candidate = f"{stem} ({index})"
        index += 1
    return candidate


def _original_exists(docs_dir: Path, stem: str) -> bool:
    folder = originals_dir(docs_dir)
    return folder.exists() and any(p.stem == stem for p in folder.iterdir())


def save_and_convert(source: Path, docs_dir: Path) -> dict:
    """Copia el original a `originales/` y genera el `.md` hermano en `docs_dir`.

    Devuelve un dict con los datos del documento resultante. Propaga
    `EmptyDocumentError` / `UnsupportedDocumentError` si la conversión falla
    (en ese caso NO deja archivos a medias).
    """
    source = Path(source)
    docs_dir = Path(docs_dir)
    # Convertir primero: si falla, no copiamos nada.
    markdown = convert_to_markdown(source)

    originals_dir(docs_dir).mkdir(parents=True, exist_ok=True)
    stem = _unique_stem(docs_dir, source.stem)
    original_dest = originals_dir(docs_dir) / f"{stem}{source.suffix}"
    md_dest = docs_dir / f"{stem}.md"

    shutil.copy2(source, original_dest)
    md_dest.write_text(markdown, encoding="utf-8")

    stat = md_dest.stat()
    return {
        "name": md_dest.name,
        "original_name": original_dest.name,
        "md_path": str(md_dest),
        "original_path": str(original_dest),
        "size": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
    }
