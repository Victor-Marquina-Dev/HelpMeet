from pathlib import Path

import pytest

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


def test_convert_to_markdown_devuelve_texto_y_flag_ocr(tmp_path):
    src = tmp_path / "nota.txt"
    src.write_text("Hola equipo", encoding="utf-8")
    texto, uso_ocr = documents.convert_to_markdown(src)
    assert "Hola equipo" in texto
    assert uso_ocr is False


def test_convert_to_markdown_archivo_vacio_lanza_sin_texto(tmp_path):
    src = tmp_path / "vacio.txt"
    src.write_text("   \n  ", encoding="utf-8")
    with pytest.raises(documents.EmptyDocumentError):
        documents.convert_to_markdown(src)


def test_save_and_convert_crea_carpeta_por_documento(tmp_path):
    src = tmp_path / "contrato.txt"
    src.write_text("Cláusula primera", encoding="utf-8")
    docs = tmp_path / "documentos"
    info = documents.save_and_convert(src, docs)
    carpeta = docs / "contrato"
    assert (carpeta / "contrato.txt").exists()
    assert (carpeta / "contrato.md").exists()
    assert "Cláusula primera" in (carpeta / "contrato.md").read_text(encoding="utf-8")
    assert info["name"] == "contrato.md"
    assert info["ocr"] is False
    assert info["images"] == 0


def test_save_and_convert_no_pisa_carpetas(tmp_path):
    src = tmp_path / "informe.txt"
    src.write_text("x contenido", encoding="utf-8")
    docs = tmp_path / "documentos"
    a = documents.save_and_convert(src, docs)
    b = documents.save_and_convert(src, docs)
    assert a["name"] == "informe.md"
    assert b["name"] == "informe (2).md"
    assert (docs / "informe").is_dir()
    assert (docs / "informe (2)").is_dir()


def test_list_documents_lee_carpetas(tmp_path):
    src = tmp_path / "acta.txt"
    src.write_text("orden del día", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)
    listed = documents.list_documents(docs)
    assert len(listed) == 1
    assert listed[0]["name"] == "acta.md"
    assert listed[0]["original_name"] == "acta.txt"
    assert listed[0]["ocr"] is False and listed[0]["images"] == 0


def test_list_documents_carpeta_inexistente_devuelve_vacio(tmp_path):
    assert documents.list_documents(tmp_path / "no-existe") == []


def test_read_markdown_desde_carpeta(tmp_path):
    src = tmp_path / "x.txt"
    src.write_text("texto de prueba", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)
    assert "texto de prueba" in documents.read_markdown(docs, "x.md")


def test_read_markdown_inexistente_lanza(tmp_path):
    with pytest.raises(FileNotFoundError):
        documents.read_markdown(tmp_path, "no-existe.md")


def test_delete_document_borra_la_carpeta(tmp_path):
    src = tmp_path / "borrame.txt"
    src.write_text("bla", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)
    documents.delete_document(docs, "borrame.md")
    assert not (docs / "borrame").exists()


def test_migrate_flat_to_folders(tmp_path):
    docs = tmp_path / "documentos"
    (docs / "originales").mkdir(parents=True)
    (docs / "viejo.md").write_text("contenido viejo", encoding="utf-8")
    (docs / "originales" / "viejo.pdf").write_bytes(b"%PDF-1.4 fake")
    documents.migrate_flat_to_folders(docs)
    assert (docs / "viejo" / "viejo.md").exists()
    assert (docs / "viejo" / "viejo.pdf").exists()
    assert not (docs / "viejo.md").exists()
    documents.migrate_flat_to_folders(docs)
    assert (docs / "viejo" / "viejo.md").exists()
