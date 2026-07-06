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


def test_convert_to_markdown_extrae_el_texto(tmp_path):
    src = tmp_path / "nota.txt"
    src.write_text("Hola equipo\nEsto es una prueba", encoding="utf-8")
    md = documents.convert_to_markdown(src)
    assert "Hola equipo" in md
    assert "prueba" in md


def test_convert_to_markdown_archivo_vacio_lanza_sin_texto(tmp_path):
    src = tmp_path / "vacio.txt"
    src.write_text("   \n  ", encoding="utf-8")
    import pytest
    with pytest.raises(documents.EmptyDocumentError):
        documents.convert_to_markdown(src)
