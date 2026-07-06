import zipfile
from pathlib import Path
from helpmeet import doc_images

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f6d0000000049454e44ae426082"
)

def _docx_con_imagen(path: Path, n: int):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        for i in range(n):
            z.writestr(f"word/media/image{i+1}.png", PNG)

def test_extrae_imagenes_de_docx(tmp_path):
    src = tmp_path / "doc.docx"; _docx_con_imagen(src, 2)
    dest = tmp_path / "imagenes"
    n = doc_images.extract_images(src, dest)
    assert n == 2
    assert len(list(dest.glob("*.png"))) == 2

def test_sin_imagenes_devuelve_cero(tmp_path):
    src = tmp_path / "nota.txt"; src.write_text("hola", encoding="utf-8")
    assert doc_images.extract_images(src, tmp_path / "out") == 0
