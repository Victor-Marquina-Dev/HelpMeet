"""OCR de PDFs escaneados con RapidOCR (onnxruntime) + pypdfium2."""
from __future__ import annotations

import logging
from pathlib import Path

_log = logging.getLogger("helpmeet")
_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _engine = RapidOCR()
    return _engine


def _render_pages(pdf_path, max_pages=None):
    """Lista de imágenes (numpy RGB) por página."""
    import pypdfium2 as pdfium
    import numpy as np
    pdf = pdfium.PdfDocument(str(pdf_path))
    pages = []
    try:
        total = len(pdf)
        limit = total if max_pages is None else min(total, max_pages)
        for i in range(limit):
            page = pdf[i]
            bitmap = page.render(scale=2.0)
            pil = bitmap.to_pil().convert("RGB")
            pages.append(np.asarray(pil))
    finally:
        pdf.close()
    return pages


def _ocr_image(image) -> str:
    result, _ = _get_engine()(image)
    if not result:
        return ""
    return "\n".join(line[1] for line in result)


def ocr_pdf(pdf_path, *, max_pages: int | None = None) -> str:
    """Texto reconocido de un PDF escaneado. Tolerante a fallos por página."""
    try:
        pages = _render_pages(Path(pdf_path), max_pages)
    except Exception:
        _log.exception("OCR: no se pudo renderizar %s", pdf_path)
        return ""
    parts = []
    for idx, image in enumerate(pages):
        try:
            text = _ocr_image(image).strip()
            if text:
                parts.append(text)
        except Exception:
            _log.exception("OCR: fallo en la página %d", idx + 1)
    return "\n\n".join(parts)
