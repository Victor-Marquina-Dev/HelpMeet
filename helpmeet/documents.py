"""Conversión de documentos (PDF, Word, PowerPoint, texto…) a Markdown.

Módulo puro: recibe rutas (`Path`) y trabaja con el sistema de archivos. No
conoce la interfaz de usuario ni la base de datos. La orquestación (elegir el
archivo, calcular la carpeta del proyecto) vive en la capa `Api` de la app.
"""

from __future__ import annotations

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
