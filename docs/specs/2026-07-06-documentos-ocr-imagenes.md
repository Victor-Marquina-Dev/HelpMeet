# OCR + imágenes + carpeta por documento (v3) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Añadir OCR (RapidOCR) para escaneados, extracción de imágenes opt-in, y reorganizar el almacenamiento a "una carpeta por documento" con migración automática, más el diseño final (mockup v3).

**Architecture:** `documents.py` pasa a una carpeta por documento (`documentos/<stem>/`). Dos módulos nuevos y puros: `ocr.py` (RapidOCR + pypdfium2) y `doc_images.py` (extraer imágenes de pdf/docx/pptx). `Api` pasa las opciones y migra al listar. El frontend aplica el diseño v3 (opciones + indicadores + estructura en el modal).

**Tech Stack:** Python 3.12, markitdown, `rapidocr-onnxruntime`, `pypdfium2`, `pypdf`, pywebview, pytest.

**Spec:** `docs/superpowers/specs/2026-07-06-documentos-ocr-imagenes-design.md`

Contexto: rama `feat/documentos-a-markdown`, árbol limpio (WIP de "archivar" en stash, se restaura al final). Tests con `.\.venv\Scripts\python.exe -m pytest`. Cada tarea commitea SOLO sus archivos (nunca `git add -A`), con trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ignorar `dist_release/` y el `.drawio`.

---

## Task 1: Almacenamiento "carpeta por documento" + migración (TDD)

**Files:** Modify `helpmeet/documents.py`, `tests/test_documents.py`

Nota: esta tarea **cambia la estructura** y por tanto **reescribe** los tests v2 que asumían `originales/` y `.md` sueltos, y cambia `convert_to_markdown` para devolver `(texto, uso_ocr)`.

- [ ] **Step 1: Reescribir los tests de estructura**

Reemplaza en `tests/test_documents.py` los tests que dependen de la estructura vieja (`test_save_and_convert_*`, `test_list_documents_*`, `test_delete_document_*`, `test_read_markdown_*`, y ajusta `test_convert_to_markdown_extrae_el_texto` para desempaquetar la tupla). Nuevos tests:

```python
def test_convert_to_markdown_devuelve_texto_y_flag_ocr(tmp_path):
    src = tmp_path / "nota.txt"
    src.write_text("Hola equipo", encoding="utf-8")
    texto, uso_ocr = documents.convert_to_markdown(src)
    assert "Hola equipo" in texto
    assert uso_ocr is False


def test_save_and_convert_crea_carpeta_por_documento(tmp_path):
    src = tmp_path / "contrato.txt"
    src.write_text("Cláusula primera", encoding="utf-8")
    docs = tmp_path / "documentos"
    info = documents.save_and_convert(src, docs)
    carpeta = docs / "contrato"
    assert (carpeta / "contrato.txt").exists()        # original
    assert (carpeta / "contrato.md").exists()          # .md
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
    src = tmp_path / "acta.txt"; src.write_text("orden del día", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)
    listed = documents.list_documents(docs)
    assert len(listed) == 1
    assert listed[0]["name"] == "acta.md"
    assert listed[0]["original_name"] == "acta.txt"
    assert listed[0]["ocr"] is False and listed[0]["images"] == 0


def test_read_markdown_desde_carpeta(tmp_path):
    src = tmp_path / "x.txt"; src.write_text("texto de prueba", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)
    assert "texto de prueba" in documents.read_markdown(docs, "x.md")


def test_delete_document_borra_la_carpeta(tmp_path):
    src = tmp_path / "borrame.txt"; src.write_text("bla", encoding="utf-8")
    docs = tmp_path / "documentos"
    documents.save_and_convert(src, docs)
    documents.delete_document(docs, "borrame.md")
    assert not (docs / "borrame").exists()


def test_migrate_flat_to_folders(tmp_path):
    # Simula estructura vieja: originales/ + .md suelto
    docs = tmp_path / "documentos"
    (docs / "originales").mkdir(parents=True)
    (docs / "viejo.md").write_text("contenido viejo", encoding="utf-8")
    (docs / "originales" / "viejo.pdf").write_bytes(b"%PDF-1.4 fake")
    documents.migrate_flat_to_folders(docs)
    assert (docs / "viejo" / "viejo.md").exists()
    assert (docs / "viejo" / "viejo.pdf").exists()
    assert not (docs / "viejo.md").exists()
    # idempotente
    documents.migrate_flat_to_folders(docs)
    assert (docs / "viejo" / "viejo.md").exists()
```

- [ ] **Step 2: Ejecutar (rojo)**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -v` → varios FAIL (firmas viejas).

- [ ] **Step 3: Reescribir `documents.py`**

Sustituye las funciones de almacenamiento por la estructura de carpeta. Deja intactas `SUPPORTED_EXTENSIONS`, `is_supported`, excepciones. Nuevas/cambiadas:

```python
def doc_folder(docs_dir: Path, stem: str) -> Path:
    return Path(docs_dir) / stem


def images_dir(doc_dir: Path) -> Path:
    return Path(doc_dir) / "imagenes"


def _unique_stem(docs_dir: Path, stem: str) -> str:
    candidate, i = stem, 2
    while (Path(docs_dir) / candidate).exists():
        candidate = f"{stem} ({i})"; i += 1
    return candidate


def convert_to_markdown(source, *, ocr: str = "auto") -> tuple[str, bool]:
    """Devuelve (markdown, uso_ocr). ocr ∈ {'auto','force','off'}."""
    source = Path(source)
    if not is_supported(source):
        raise UnsupportedDocumentError(source.suffix or source.name)
    result = _get_converter().convert(str(source))
    text = (getattr(result, "text_content", "") or "").strip()
    used_ocr = False
    if source.suffix.lower() == ".pdf":
        need = (ocr == "force") or (not text and ocr == "auto")
        if need:
            from helpmeet import ocr as ocr_mod
            recognized = (ocr_mod.ocr_pdf(source) or "").strip()
            if recognized:
                text, used_ocr = recognized, True
    if not text:
        raise EmptyDocumentError(source.name)
    return text, used_ocr


def save_and_convert(source, docs_dir, *, ocr: str = "auto",
                     extract_images: bool = False) -> dict:
    source = Path(source); docs_dir = Path(docs_dir)
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
        "name": md_dest.name, "original_name": original_dest.name,
        "md_path": str(md_dest), "original_path": str(original_dest),
        "folder_path": str(folder), "size": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "ocr": used_ocr, "images": images,
    }


def _doc_original(folder: Path) -> Path | None:
    for p in folder.iterdir():
        if p.is_file() and p.suffix.lower() != ".md" and p.name != ".ocr":
            return p
    return None


def list_documents(docs_dir) -> list[dict]:
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


def read_markdown(docs_dir, md_name) -> str:
    stem = Path(md_name).stem
    return (Path(docs_dir) / stem / f"{stem}.md").read_text(encoding="utf-8")


def delete_document(docs_dir, md_name) -> None:
    stem = Path(md_name).stem
    shutil.rmtree(Path(docs_dir) / stem, ignore_errors=True)


def migrate_flat_to_folders(docs_dir) -> None:
    docs_dir = Path(docs_dir)
    if not docs_dir.exists():
        return
    originales = docs_dir / "originales"
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
```

Asegura que `read_markdown` (de v2) queda con la firma de arriba y que `_find_original`/`_original_exists` viejos se eliminan si ya no se usan.

- [ ] **Step 4: Verde**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add helpmeet/documents.py tests/test_documents.py
git commit -m "feat(documents): una carpeta por documento + migración"
```

---

## Task 2: Extracción de imágenes `doc_images.py` (TDD)

**Files:** Create `helpmeet/doc_images.py`, `tests/test_doc_images.py`; Modify `requirements.txt`

- [ ] **Step 1: Añadir dependencia `pypdf`**

Añadir a `requirements.txt` `pypdf==<versión instalada>`; instalar en el venv:
`.\.venv\Scripts\python.exe -m pip install pypdf` y fijar la versión real.

- [ ] **Step 2: Test que falla (docx/pptx por ZIP; sin imágenes → 0)**

Crear `tests/test_doc_images.py`. Un `.docx`/`.pptx` mínimo es un ZIP con imágenes en `word/media/` / `ppt/media/`. El test crea uno a mano:

```python
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
```

- [ ] **Step 3: Rojo**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_doc_images.py -v` → FAIL (módulo no existe).

- [ ] **Step 4: Implementar `doc_images.py`**

```python
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
        for image in page.images:  # pypdf expone .images con .data y .name
            n += 1
            suffix = Path(image.name).suffix.lower() or ".png"
            _save(dest_dir, n, suffix, image.data)
    return n
```

(Verifica la API real de `pypdf` para `page.images`/`image.data`; si difiere en la versión instalada, adáptala.)

- [ ] **Step 5: Verde + commit**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_doc_images.py -v` → PASS.
```bash
git add helpmeet/doc_images.py tests/test_doc_images.py requirements.txt
git commit -m "feat(documents): extraer imágenes de docx/pptx/pdf"
```

---

## Task 3: OCR `ocr.py` con RapidOCR + pypdfium2

**Files:** Create `helpmeet/ocr.py`, `tests/test_ocr.py`; Modify `requirements.txt`

- [ ] **Step 1: Añadir dependencias**

Instalar y fijar en `requirements.txt`: `rapidocr-onnxruntime` y `pypdfium2`
(`.\.venv\Scripts\python.exe -m pip install rapidocr-onnxruntime pypdfium2`; fija las versiones reales). Verifica import: `.\.venv\Scripts\python.exe -c "import pypdfium2, rapidocr_onnxruntime; print('ok')"`.

- [ ] **Step 2: Test (con monkeypatch, sin depender de modelos en CI)**

Crear `tests/test_ocr.py`:

```python
from pathlib import Path
from helpmeet import ocr

def test_ocr_pdf_tolera_errores(monkeypatch, tmp_path):
    # Si el render o el motor fallan en una página, no debe reventar.
    monkeypatch.setattr(ocr, "_render_pages", lambda p, m=None: (_ for _ in ()).throw(RuntimeError("x")))
    assert ocr.ocr_pdf(tmp_path / "x.pdf") == ""

def test_ocr_pdf_junta_texto(monkeypatch, tmp_path):
    monkeypatch.setattr(ocr, "_render_pages", lambda p, m=None: [object(), object()])
    monkeypatch.setattr(ocr, "_ocr_image", lambda img: "linea")
    out = ocr.ocr_pdf(tmp_path / "x.pdf")
    assert out.count("linea") == 2
```

- [ ] **Step 3: Rojo**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ocr.py -v` → FAIL.

- [ ] **Step 4: Implementar `ocr.py`**

```python
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


def _render_pages(pdf_path: Path, max_pages=None):
    """Devuelve una lista de imágenes (numpy array RGB) por página."""
    import pypdfium2 as pdfium
    import numpy as np
    pdf = pdfium.PdfDocument(str(pdf_path))
    pages = []
    try:
        total = len(pdf)
        limit = total if max_pages is None else min(total, max_pages)
        for i in range(limit):
            page = pdf[i]
            bitmap = page.render(scale=2.0)  # ~144 dpi
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


def ocr_pdf(pdf_path: Path, *, max_pages: int | None = None) -> str:
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
```

(Verifica la API real de RapidOCR: `RapidOCR()(image)` devuelve `(result, elapse)` donde `result` es lista de `[box, text, score]`. Ajusta `_ocr_image` a la versión instalada. Verifica también `page.render(...).to_pil()` en la versión de pypdfium2.)

- [ ] **Step 5: Verde + commit**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ocr.py -v` → PASS.
```bash
git add helpmeet/ocr.py tests/test_ocr.py requirements.txt
git commit -m "feat(documents): OCR de PDFs escaneados con RapidOCR"
```

---

## Task 4: `Api` — opciones de conversión, migración y abrir imágenes

**Files:** Modify `helpmeet/ui/app.py`

- [ ] **Step 1: Actualizar métodos de conversión y añadir los nuevos**

- `pick_and_convert_documents(self, initiative_id, ocr="auto", extract_images=False)`:
  pasar `ocr=ocr, extract_images=extract_images` a `documents.save_and_convert`.
- `save_uploaded_document(self, initiative_id, name, data_b64, ocr="auto", extract_images=False)`:
  idem.
- En `list_all_documents` y `list_documents`: antes de listar, llamar
  `documents.migrate_flat_to_folders(docs_dir)` para cada iniciativa.
- Añadir:

```python
    def open_document_images(self, initiative_id, md_name):
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        stem = Path(md_name).stem
        folder = docs_dir / stem / "imagenes"
        if not folder.exists():
            return {"ok": False, "error": "Este documento no tiene imágenes."}
        _open_in_explorer(str(folder))
        return {"ok": True}
```

- `open_document`, `open_document_original`, `delete_document`, `read_document`:
  ajustar a la carpeta por documento. `read_document` usa `documents.read_markdown`
  (ya resuelve la carpeta). `open_document` abre `docs_dir/<stem>/<stem>.md`.
  `open_document_original` revela el original dentro de la carpeta (usar
  `documents.list_documents` y su `original_path`, o construir la ruta).

- [ ] **Step 2: Verificar**

`.\.venv\Scripts\python.exe -c "import helpmeet.ui.app; print('ok')"` → ok.
`.\.venv\Scripts\python.exe -m pytest tests/test_ui_api.py -q` → PASS.

- [ ] **Step 3: Commit**

```bash
git add helpmeet/ui/app.py
git commit -m "feat(api): opciones OCR/imágenes, migración y abrir imágenes"
```

---

## Task 5: Frontend — diseño v3 (opciones, indicadores, estructura en el modal)

**Files:** Modify `helpmeet/ui/web/app.js`, `helpmeet/ui/web/style.css`

Referencia visual: mockup v3 (una línea "Convertir a" + fila de opciones + indicadores + bloque de carpeta en "Ver"). Reutiliza los helpers reales (`el`, `esc`, `customSelect`, `openModal`, `confirmModal`, `copyText`, `toast`, `emptyState`) y el set de iconos `ICONS`/`svg(name)`.

- [ ] **Step 1: Añadir iconos que faltan**

En `ICONS` (app.js) añadir (si no existen): `eye`, `image`, `scan`:
```javascript
  eye: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
```

- [ ] **Step 2: Wrappers de API**

Añadir/ajustar en `api`:
```javascript
  pickAndConvertDocuments: (iid, ocr, imgs) => call('pick_and_convert_documents', iid, ocr, !!imgs),
  saveUploadedDocument: (iid, name, b64, ocr, imgs) => call('save_uploaded_document', iid, name, b64, ocr, !!imgs),
  openDocumentImages: (iid, name) => call('open_document_images', iid, name),
```

- [ ] **Step 3: Diseño v3 de `viewDocs`**

- Quitar el recuadro `.docs-convert` que encierra la zona de conversión: "Convertir a:" + `customSelect` + botón "Elegir archivos" en **una línea** (`.docs-toolbar`), sin tarjeta.
- **Fila de opciones** (`.docs-opts`): control OCR (chip que cicla `auto → force → off`, texto "OCR: Automático/Forzar/Desactivado", guardado en `STATE.docsOcr`, por defecto `'auto'`) + casilla "Extraer imágenes" (`STATE.docsExtractImages`, por defecto `false`). Pasar ambos a `pickAndConvertDocuments`/`saveUploadedDocument`.
- Sustituir los **emojis** de acciones por `svg('eye')`, `svg('copy')`, `svg('folder')`, `svg('trash')`.
- **Indicadores** en cada tarjeta: si `d.ocr`, una etiqueta `.docs-tag.ocr` con `svg('scan')` "OCR"; si `d.images > 0`, `.docs-tag.img` con `svg('image')` y el número.
- **Zona de arrastre = la lista** (resalta solo al arrastrar), sin bloque grande.
- **Modal "Ver"**: añadir arriba el bloque "Carpeta del documento" listando: original, `.md` (con "(OCR)" si aplica) y, si `d.images>0`, `imagenes/` con el número y un botón/enlace que llama `api.openDocumentImages(d.initiative_id, d.name)`. Debajo, el `.md` renderizado (`mdToHtml`) como en v2. Botones Copiar .md / Abrir .md igual que v2.

- [ ] **Step 4: Estilos**

Actualizar `style.css`: quitar el fondo/borde de `.docs-convert` (o sustituir por `.docs-toolbar`/`.docs-opts` sin caja), estilos de las etiquetas `.docs-tag.ocr` / `.docs-tag.img`, el chip de opciones y el bloque de archivos del modal. Reutilizar variables de tema (claro/oscuro). Basarse en el CSS del mockup v3.

- [ ] **Step 5: Verificar**

- `.\.venv\Scripts\python.exe -c "import helpmeet.ui.app; print('ok')"` → ok.
- `node --check helpmeet/ui/web/app.js` → sin salida.
- Releer el diff: iconos SVG (no emojis), opciones pasadas al backend, indicadores, modal con carpeta.

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/app.js helpmeet/ui/web/style.css
git commit -m "feat(ui): diseño v3 con opciones OCR/imágenes e indicadores"
```

---

## Task 6: Empaquetado (RapidOCR, pypdfium2, pypdf, PIL)

**Files:** Modify `Helpmeet.spec`

- [ ] **Step 1: Quitar PIL de excludes y añadir recogida de las nuevas deps**

- En `Analysis(..., excludes=[...])`: **eliminar `"PIL"`** (RapidOCR/pypdfium2 lo necesitan). Mantener el resto.
- Añadir a la recogida:
```python
hiddenimports += collect_submodules("rapidocr_onnxruntime")
hiddenimports += collect_submodules("pypdfium2")
hiddenimports += ["pypdf", "cv2", "shapely", "pyclipper", "PIL"]
datas += collect_data_files("rapidocr_onnxruntime", excludes=["**/__pycache__/**", "**/*.pyc"])  # modelos ONNX
binaries += collect_dynamic_libs("pypdfium2")
binaries += collect_dynamic_libs("cv2")
```
- Revisar que `_is_noise` no descarte los **modelos** de rapidocr (extensiones `.onnx`) ni datos de cv2; si algún patrón (`/converters/`, etc.) coincidiera, exceptuar como se hizo con markitdown.

- [ ] **Step 2: Compilar**

Run: `.\.venv\Scripts\python.exe -m PyInstaller Helpmeet.spec --noconfirm` → genera `dist/Helpmeet/Helpmeet.exe` sin errores fatales.

- [ ] **Step 3: Verificación en la build**

- Revisar `build/Helpmeet/warn-Helpmeet.txt` por imports que falten de `rapidocr_onnxruntime`, `pypdfium2`, `pypdf`, `cv2`, `PIL`, `shapely`, `pyclipper`.
- Confirmar que los **modelos `.onnx`** de rapidocr están en `dist/Helpmeet/_internal/rapidocr_onnxruntime` (o donde los coloque `collect_data_files`).
- Ejecutar `dist/Helpmeet/Helpmeet.exe` y convertir **un PDF escaneado** (OCR) y **un PDF/DOCX con imágenes** (extracción). Verificar el `.md` con texto y la carpeta `imagenes/`.

- [ ] **Step 4: Commit**

```bash
git add Helpmeet.spec
git commit -m "build: empaquetar RapidOCR, pypdfium2 y pypdf (OCR e imágenes)"
```

---

## Self-Review (cobertura del spec)

- Carpeta por documento + migración → Task 1.
- Extraer imágenes (docx/pptx/pdf, opt-in) → Task 2 + Task 4/5 (opción).
- OCR automático/forzar/off (RapidOCR) → Task 3 + Task 1 (`convert_to_markdown`) + Task 4/5.
- Abrir carpeta de imágenes → Task 4 (`open_document_images`) + Task 5 (modal).
- Diseño v3 (una línea, sin cajas, iconos, indicadores, estructura en modal) → Task 5.
- Empaquetado (deps, PIL, modelos) → Task 6.

Tipos/nombres consistentes: `convert_to_markdown`→`(str,bool)`, `save_and_convert(..., ocr, extract_images)`, `doc_folder`, `images_dir`, `migrate_flat_to_folders`, `ocr_pdf`, `extract_images`, `open_document_images`, `STATE.docsOcr`/`docsExtractImages`, indicadores `d.ocr`/`d.images`.
