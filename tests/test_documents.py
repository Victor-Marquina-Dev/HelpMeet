from pathlib import Path
from helpmeet import documents


def test_supported_extensions_incluye_los_formatos_v1():
    exts = documents.SUPPORTED_EXTENSIONS
    for e in (".pdf", ".docx", ".pptx", ".txt", ".html", ".csv"):
        assert e in exts
    # Fuera de alcance en v1:
    assert ".xlsx" not in exts


def test_is_supported_es_insensible_a_mayusculas():
    assert documents.is_supported(Path("Informe.PDF")) is True
    assert documents.is_supported(Path("hoja.xlsx")) is False


def test_subcarpetas_originales_dentro_de_documentos(tmp_path):
    docs = tmp_path / "documentos"
    assert documents.originals_dir(docs) == docs / "originales"
