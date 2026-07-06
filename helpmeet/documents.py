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
