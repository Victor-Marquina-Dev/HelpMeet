from pathlib import Path

from helpmeet import ocr


def test_ocr_pdf_tolera_errores(monkeypatch, tmp_path):
    monkeypatch.setattr(ocr, "_render_pages", lambda p, m=None: (_ for _ in ()).throw(RuntimeError("x")))
    assert ocr.ocr_pdf(tmp_path / "x.pdf") == ""


def test_ocr_pdf_junta_texto(monkeypatch, tmp_path):
    monkeypatch.setattr(ocr, "_render_pages", lambda p, m=None: [object(), object()])
    monkeypatch.setattr(ocr, "_ocr_image", lambda img: "linea")
    out = ocr.ocr_pdf(tmp_path / "x.pdf")
    assert out.count("linea") == 2
