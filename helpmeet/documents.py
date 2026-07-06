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


def doc_folder(docs_dir: Path, stem: str) -> Path:
    """Carpeta propia de un documento dentro de `docs_dir`."""
    return Path(docs_dir) / stem


def images_dir(doc_dir: Path) -> Path:
    """Subcarpeta donde se guardan las imágenes extraídas de un documento."""
    return Path(doc_dir) / "imagenes"


def _unique_stem(docs_dir: Path, stem: str) -> str:
    """Devuelve un nombre base libre: `informe`, `informe (2)`, `informe (3)`…

    Comprueba que no exista ya una carpeta de documento con ese nombre.
    """
    candidate = stem
    index = 2
    while (Path(docs_dir) / candidate).exists():
        candidate = f"{stem} ({index})"
        index += 1
    return candidate


def convert_to_markdown(source: Path, *, ocr: str = "auto") -> tuple[str, bool]:
    """Convierte un archivo a texto Markdown.

    Devuelve una tupla `(texto, uso_ocr)`. `uso_ocr` indica si el texto se
    obtuvo mediante reconocimiento óptico (solo aplica a PDF escaneados).
    `ocr` controla la estrategia: `"auto"` (solo si el PDF no tiene texto),
    `"force"` (siempre OCR para PDF) o cualquier otro valor para desactivarlo.

    Lanza `UnsupportedDocumentError` si el formato no está soportado y
    `EmptyDocumentError` si no se pudo extraer texto (típico de PDF escaneado
    sin OCR disponible).
    """
    source = Path(source)
    if not is_supported(source):
        raise UnsupportedDocumentError(source.suffix or source.name)
    result = _get_converter().convert(str(source))
    text = (getattr(result, "text_content", "") or "").strip()
    used_ocr = False
    if source.suffix.lower() == ".pdf":
        need_ocr = (ocr == "force") or (not text and ocr == "auto")
        if need_ocr:
            from helpmeet import ocr as ocr_mod
            recognized = (ocr_mod.ocr_pdf(source) or "").strip()
            if recognized:
                text, used_ocr = recognized, True
    if not text:
        raise EmptyDocumentError(source.name)
    return text, used_ocr


def save_and_convert(
    source: Path,
    docs_dir: Path,
    *,
    ocr: str = "auto",
    extract_images: bool = False,
) -> dict:
    """Convierte `source` y lo guarda en su propia carpeta dentro de `docs_dir`.

    La carpeta resultante (`docs_dir/<stem>/`) contiene el original, el
    `.md` y, opcionalmente, un marcador `.ocr` y una subcarpeta `imagenes/`.
    Devuelve un dict con los datos del documento resultante. Propaga
    `EmptyDocumentError` / `UnsupportedDocumentError` si la conversión falla
    (en ese caso NO deja archivos a medias).
    """
    source = Path(source)
    docs_dir = Path(docs_dir)
    # Convertir primero: si falla, no copiamos nada.
    markdown, used_ocr = convert_to_markdown(source, ocr=ocr)

    stem = _unique_stem(docs_dir, source.stem)
    folder = doc_folder(docs_dir, stem)
    folder.mkdir(parents=True, exist_ok=True)
    original_dest = folder / f"{stem}{source.suffix}"
    md_dest = folder / f"{stem}.md"

    shutil.copy2(source, original_dest)
    md_dest.write_text(markdown, encoding="utf-8")
    if used_ocr:
        (folder / ".ocr").touch()

    images = 0
    if extract_images:
        from helpmeet import doc_images
        images = doc_images.extract_images(source, images_dir(folder))

    stat = md_dest.stat()
    return {
        "name": md_dest.name,
        "original_name": original_dest.name,
        "md_path": str(md_dest),
        "original_path": str(original_dest),
        "folder_path": str(folder),
        "size": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "ocr": used_ocr,
        "images": images,
    }


def _doc_original(folder: Path) -> Path | None:
    for p in folder.iterdir():
        if p.is_file() and p.suffix.lower() != ".md" and p.name != ".ocr":
            return p
    return None


def list_documents(docs_dir: Path) -> list[dict]:
    """Lista las carpetas de documentos dentro de `docs_dir`.

    Ordenados por fecha de modificación descendente (lo último, arriba).
    """
    docs_dir = Path(docs_dir)
    if not docs_dir.exists():
        return []
    items = []
    for folder in docs_dir.iterdir():
        if not folder.is_dir() or folder.name in ("originales", "imagenes"):
            continue
        md = folder / f"{folder.name}.md"
        if not md.is_file():
            continue
        original = _doc_original(folder)
        imgs = images_dir(folder)
        n_imgs = len([p for p in imgs.iterdir() if p.is_file()]) if imgs.exists() else 0
        stat = md.stat()
        items.append({
            "name": md.name,
            "original_name": original.name if original else "",
            "md_path": str(md),
            "original_path": str(original) if original else "",
            "folder_path": str(folder),
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "ocr": (folder / ".ocr").exists(),
            "images": n_imgs,
            "_mtime": stat.st_mtime,
        })
    items.sort(key=lambda d: d["_mtime"], reverse=True)
    for d in items:
        d.pop("_mtime", None)
    return items


def read_markdown(docs_dir: Path, md_name: str) -> str:
    """Devuelve el texto del .md indicado (para el modal y para copiar)."""
    stem = Path(md_name).stem
    return (Path(docs_dir) / stem / f"{stem}.md").read_text(encoding="utf-8")


def delete_document(docs_dir: Path, md_name: str) -> None:
    """Borra la carpeta completa del documento indicado."""
    stem = Path(md_name).stem
    shutil.rmtree(Path(docs_dir) / stem, ignore_errors=True)


def migrate_flat_to_folders(docs_dir: Path) -> None:
    """Migra un `docs_dir` con la estructura plana v2 (`originales/` + `*.md`
    sueltos) a la estructura v3 de una carpeta por documento. Idempotente:
    si ya no quedan `.md` sueltos, no hace nada.
    """
    docs_dir = Path(docs_dir)
    if not docs_dir.exists():
        return
    originales = originals_dir(docs_dir)
    for md in list(docs_dir.glob("*.md")):
        stem = md.stem
        folder = docs_dir / stem
        folder.mkdir(exist_ok=True)
        md.replace(folder / f"{stem}.md")
        if originales.exists():
            for orig in originales.iterdir():
                if orig.is_file() and orig.stem == stem:
                    orig.replace(folder / orig.name)
                    break
    if originales.exists() and not any(originales.iterdir()):
        originales.rmdir()
