"""Extracción de imágenes incrustadas de documentos (docx/pptx/pdf)."""
from __future__ import annotations
import zipfile
from pathlib import Path

_ZIP_MEDIA = {".docx": "word/media/", ".pptx": "ppt/media/"}
_IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".emf", ".wmf"}


def extract_images(source: Path, dest_dir: Path) -> int:
    source = Path(source); suffix = source.suffix.lower()
    if suffix in _ZIP_MEDIA:
        return _extract_zip(source, _ZIP_MEDIA[suffix], dest_dir)
    if suffix == ".pdf":
        return _extract_pdf(source, dest_dir)
    return 0


def _save(dest_dir: Path, index: int, suffix: str, data: bytes) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / f"img-{index:03d}{suffix}").write_bytes(data)


def _extract_zip(source: Path, media_prefix: str, dest_dir: Path) -> int:
    n = 0
    with zipfile.ZipFile(source) as z:
        for name in z.namelist():
            if name.startswith(media_prefix) and Path(name).suffix.lower() in _IMG_EXT:
                n += 1
                _save(dest_dir, n, Path(name).suffix.lower(), z.read(name))
    return n


def _extract_pdf(source: Path, dest_dir: Path) -> int:
    from pypdf import PdfReader
    reader = PdfReader(str(source))
    n = 0
    for page in reader.pages:
        for image in page.images:
            n += 1
            suffix = Path(image.name).suffix.lower() or ".png"
            _save(dest_dir, n, suffix, image.data)
    return n
