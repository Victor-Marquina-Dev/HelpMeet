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


def test_save_and_convert_guarda_original_y_md(tmp_path):
    src = tmp_path / "origen" / "contrato.txt"
    src.parent.mkdir()
    src.write_text("Cláusula primera: prueba", encoding="utf-8")
    docs = tmp_path / "proyecto" / "documentos"

    info = documents.save_and_convert(src, docs)

    assert (docs / "originales" / "contrato.txt").exists()
    md_path = docs / "contrato.md"
    assert md_path.exists()
    assert "Cláusula primera" in md_path.read_text(encoding="utf-8")
    assert info["name"] == "contrato.md"
    assert info["original_name"] == "contrato.txt"


def test_save_and_convert_no_pisa_nombres_repetidos(tmp_path):
    src = tmp_path / "informe.txt"
    src.write_text("contenido de prueba", encoding="utf-8")
    docs = tmp_path / "documentos"

    first = documents.save_and_convert(src, docs)
    second = documents.save_and_convert(src, docs)

    assert first["name"] == "informe.md"
    assert second["name"] == "informe (2).md"
    assert (docs / "originales" / "informe.txt").exists()
    assert (docs / "originales" / "informe (2).txt").exists()


def test_list_documents_empareja_md_con_original(tmp_path):
    src = tmp_path / "acta.txt"
    src.write_text("orden del día de prueba", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)

    listed = documents.list_documents(docs)
    assert len(listed) == 1
    assert listed[0]["name"] == "acta.md"
    assert listed[0]["original_name"] == "acta.txt"


def test_list_documents_carpeta_inexistente_devuelve_vacio(tmp_path):
    assert documents.list_documents(tmp_path / "no-existe") == []


def test_delete_document_borra_md_y_original(tmp_path):
    src = tmp_path / "borrame.txt"
    src.write_text("texto de prueba", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)

    documents.delete_document(docs, "borrame.md")

    assert not (docs / "borrame.md").exists()
    assert not (docs / "originales" / "borrame.txt").exists()


def test_read_markdown_devuelve_el_contenido(tmp_path):
    src = tmp_path / "nota.txt"
    src.write_text("contenido de prueba para leer", encoding="utf-8")
    docs = tmp_path / "documentos"
    info = documents.save_and_convert(src, docs)
    texto = documents.read_markdown(docs, info["name"])
    assert "contenido de prueba" in texto


def test_read_markdown_inexistente_lanza(tmp_path):
    import pytest
    with pytest.raises(FileNotFoundError):
        documents.read_markdown(tmp_path, "no-existe.md")
