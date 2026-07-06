# Documentos → Markdown — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una sección "Documentos" que convierte PDF/Word/PowerPoint/texto a Markdown con `markitdown`, guardando el original y el `.md` organizados por proyecto.

**Architecture:** Un módulo puro `helpmeet/documents.py` (conversión + almacenamiento en disco, sin UI ni DB) que se prueba con `tmp_path`. La clase `Api` de `app.py` orquesta (diálogo de archivos, cálculo de la carpeta por proyecto) y llama al módulo. El frontend (pywebview) añade un botón de navegación y una pantalla `docs` que invoca a `Api` por `pywebview.api`.

**Tech Stack:** Python 3.12, `markitdown` (Microsoft), pywebview 5.1, SQLAlchemy (solo para leer iniciativas), PyInstaller (empaquetado), pytest.

**Spec:** `docs/superpowers/specs/2026-07-05-documentos-a-markdown-design.md`

---

## File Structure

- **Crear** `helpmeet/documents.py` — Conversión a Markdown y almacenamiento por carpeta. Funciones puras que reciben `Path`. No importa webview ni modelos de DB.
- **Crear** `tests/test_documents.py` — Tests unitarios con `tmp_path`.
- **Modificar** `helpmeet/ui/app.py` — Métodos nuevos en `Api` + helper `_documents_dir`.
- **Modificar** `helpmeet/ui/web/index.html` — Botón `#navDocs` en `.sidebar-nav` y `#railDocs` en el rail.
- **Modificar** `helpmeet/ui/web/app.js` — Wrappers en `api`, cableado de navegación y función `renderDocs()`.
- **Modificar** `helpmeet/ui/web/style.css` — Estilos de la pantalla `docs`.
- **Modificar** `requirements.txt` — Dependencia `markitdown`.
- **Modificar** `Helpmeet.spec` — Empaquetado (hidden imports / collect).

---

## Task 1: Añadir la dependencia `markitdown`

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Añadir la dependencia acotada (sin Excel/OCR/nube)**

Añadir al final de `requirements.txt`:

```
markitdown[pdf,docx,pptx]==0.1.1
```

- [ ] **Step 2: Instalar en el entorno virtual**

Run (PowerShell, con el venv del proyecto):
```
.\.venv\Scripts\python.exe -m pip install "markitdown[pdf,docx,pptx]==0.1.1"
```
Expected: Instala `markitdown` y sus dependencias (`pdfminer.six`, `python-docx`, `python-pptx`, `mammoth`, `markdownify`, `beautifulsoup4`, `magika`, …) sin errores.

- [ ] **Step 3: Verificar que importa y convierte**

Run:
```
.\.venv\Scripts\python.exe -c "from markitdown import MarkItDown; print(MarkItDown().convert_stream.__name__ if hasattr(MarkItDown(),'convert_stream') else 'ok')"
```
Expected: imprime `ok` (o `convert_stream`) sin trazas de error. Confirma que la librería carga.

- [ ] **Step 4: Commit**

```bash
git add requirements.txt
git commit -m "build: añadir markitdown para conversión de documentos a Markdown"
```

---

## Task 2: Módulo `documents.py` — formatos y carpetas

**Files:**
- Create: `helpmeet/documents.py`
- Test: `tests/test_documents.py`

- [ ] **Step 1: Escribir el test que falla (carpetas y extensiones)**

Crear `tests/test_documents.py`:

```python
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
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'helpmeet.documents'`.

- [ ] **Step 3: Implementación mínima**

Crear `helpmeet/documents.py`:

```python
"""Conversión de documentos (PDF, Word, PowerPoint, texto…) a Markdown.

Módulo puro: recibe rutas (`Path`) y trabaja con el sistema de archivos. No
conoce la interfaz de usuario ni la base de datos. La orquestación (elegir el
archivo, calcular la carpeta del proyecto) vive en la capa `Api` de la app.
"""

from __future__ import annotations

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
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/documents.py tests/test_documents.py
git commit -m "feat(documents): formatos soportados y layout de carpetas"
```

---

## Task 3: Módulo `documents.py` — conversión a Markdown

**Files:**
- Modify: `helpmeet/documents.py`
- Test: `tests/test_documents.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/test_documents.py`:

```python
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
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -k convert -v`
Expected: FAIL con `AttributeError: module 'helpmeet.documents' has no attribute 'convert_to_markdown'`.

- [ ] **Step 3: Implementación mínima**

Añadir a `helpmeet/documents.py` (bajo los imports, y una función nueva):

```python
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


def convert_to_markdown(source: Path) -> str:
    """Convierte un archivo a texto Markdown.

    Lanza `UnsupportedDocumentError` si el formato no está soportado y
    `EmptyDocumentError` si no se pudo extraer texto (típico de PDF escaneado).
    """
    source = Path(source)
    if not is_supported(source):
        raise UnsupportedDocumentError(source.suffix or source.name)
    result = _get_converter().convert(str(source))
    text = (getattr(result, "text_content", "") or "").strip()
    if not text:
        raise EmptyDocumentError(source.name)
    return text
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -k convert -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/documents.py tests/test_documents.py
git commit -m "feat(documents): convert_to_markdown con markitdown"
```

---

## Task 4: Módulo `documents.py` — guardar original + generar .md

**Files:**
- Modify: `helpmeet/documents.py`
- Test: `tests/test_documents.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/test_documents.py`:

```python
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
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -k save_and_convert -v`
Expected: FAIL con `AttributeError: ... has no attribute 'save_and_convert'`.

- [ ] **Step 3: Implementación mínima**

Añadir a `helpmeet/documents.py`:

```python
import shutil
from datetime import datetime


def _unique_stem(docs_dir: Path, stem: str) -> str:
    """Devuelve un nombre base libre: `informe`, `informe (2)`, `informe (3)`…

    Comprueba tanto el `.md` como el original para no pisar ninguno de los dos.
    """
    candidate = stem
    index = 2
    while (docs_dir / f"{candidate}.md").exists() or _original_exists(docs_dir, candidate):
        candidate = f"{stem} ({index})"
        index += 1
    return candidate


def _original_exists(docs_dir: Path, stem: str) -> bool:
    folder = originals_dir(docs_dir)
    return folder.exists() and any(p.stem == stem for p in folder.iterdir())


def save_and_convert(source: Path, docs_dir: Path) -> dict:
    """Copia el original a `originales/` y genera el `.md` hermano en `docs_dir`.

    Devuelve un dict con los datos del documento resultante. Propaga
    `EmptyDocumentError` / `UnsupportedDocumentError` si la conversión falla
    (en ese caso NO deja archivos a medias).
    """
    source = Path(source)
    docs_dir = Path(docs_dir)
    # Convertir primero: si falla, no copiamos nada.
    markdown = convert_to_markdown(source)

    originals_dir(docs_dir).mkdir(parents=True, exist_ok=True)
    stem = _unique_stem(docs_dir, source.stem)
    original_dest = originals_dir(docs_dir) / f"{stem}{source.suffix}"
    md_dest = docs_dir / f"{stem}.md"

    shutil.copy2(source, original_dest)
    md_dest.write_text(markdown, encoding="utf-8")

    stat = md_dest.stat()
    return {
        "name": md_dest.name,
        "original_name": original_dest.name,
        "md_path": str(md_dest),
        "original_path": str(original_dest),
        "size": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
    }
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -k save_and_convert -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/documents.py tests/test_documents.py
git commit -m "feat(documents): guardar original y generar .md sin pisar nombres"
```

---

## Task 5: Módulo `documents.py` — listar y borrar

**Files:**
- Modify: `helpmeet/documents.py`
- Test: `tests/test_documents.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/test_documents.py`:

```python
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
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -k "list_documents or delete_document" -v`
Expected: FAIL con `AttributeError: ... has no attribute 'list_documents'`.

- [ ] **Step 3: Implementación mínima**

Añadir a `helpmeet/documents.py`:

```python
def _find_original(docs_dir: Path, stem: str) -> Path | None:
    folder = originals_dir(docs_dir)
    if not folder.exists():
        return None
    for p in folder.iterdir():
        if p.is_file() and p.stem == stem:
            return p
    return None


def list_documents(docs_dir: Path) -> list[dict]:
    """Lista los `.md` de la carpeta, emparejados con su original.

    Ordenados por fecha de modificación descendente (lo último, arriba).
    """
    docs_dir = Path(docs_dir)
    if not docs_dir.exists():
        return []
    items = []
    for md in docs_dir.glob("*.md"):
        if not md.is_file():
            continue
        original = _find_original(docs_dir, md.stem)
        stat = md.stat()
        items.append({
            "name": md.name,
            "md_path": str(md),
            "original_name": original.name if original else "",
            "original_path": str(original) if original else "",
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "_mtime": stat.st_mtime,
        })
    items.sort(key=lambda d: d["_mtime"], reverse=True)
    for d in items:
        d.pop("_mtime", None)
    return items


def delete_document(docs_dir: Path, md_name: str) -> None:
    """Borra el `.md` indicado y su original emparejado (si existe)."""
    docs_dir = Path(docs_dir)
    md_path = docs_dir / md_name
    stem = Path(md_name).stem
    original = _find_original(docs_dir, stem)
    md_path.unlink(missing_ok=True)
    if original is not None:
        original.unlink(missing_ok=True)
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -v`
Expected: PASS (todos los tests del archivo).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/documents.py tests/test_documents.py
git commit -m "feat(documents): listar y borrar documentos convertidos"
```

---

## Task 6: Métodos de `Api` en `app.py`

**Files:**
- Modify: `helpmeet/ui/app.py`

- [ ] **Step 1: Añadir el import del módulo**

En la cabecera de `helpmeet/ui/app.py`, junto a los otros imports de `helpmeet` (después de `from helpmeet import settings`), añadir:

```python
from helpmeet import documents
from helpmeet.export.exporter import initiative_export_dir
```

(Nota: `initiative_export_dir` ya se importa en el bloque `from helpmeet.export.exporter import (...)` de arriba; si es así, no lo dupliques — basta con `from helpmeet import documents`.)

- [ ] **Step 2: Añadir helper privado y métodos de `Api`**

Localizar el método `list_initiatives` de la clase `Api` (≈ línea 507). Inmediatamente **después** de ese método, insertar:

```python
    # ---------- Documentos → Markdown ----------
    def _documents_dir(self, initiative_id):
        """Carpeta `documentos/` del proyecto, dentro de la carpeta de exportación."""
        ini = self._session.get(repo.Initiative, int(initiative_id))
        if ini is None:
            return None
        base = settings.get_export_dir()
        return initiative_export_dir(ini, base) / "documentos"

    def list_document_initiatives(self):
        """Proyectos para el desplegable de la pantalla Documentos."""
        return [
            {"id": i.id, "name": i.name, "color": i.color or ""}
            for i in repo.list_initiatives(self._session)
        ]

    def pick_and_convert_documents(self, initiative_id):
        """Abre el diálogo, convierte cada archivo y guarda original + .md.

        Corre en el hilo de la llamada JS (no bloquea la ventana). Es tolerante:
        si un archivo falla, sigue con el resto y lo reporta en `failed`.
        """
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False, "error": "El proyecto ya no existe."}
        types = (
            "Documentos (*.pdf;*.docx;*.pptx;*.txt;*.md;*.html;*.htm;*.csv;*.json;*.xml)",
            "Todos los archivos (*.*)",
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True, file_types=types
        )
        files = list(result) if result else []
        if not files:
            return {"ok": False, "cancelled": True, "converted": [], "failed": []}
        converted, failed = [], []
        for src in files:
            name = Path(src).name
            try:
                info = documents.save_and_convert(Path(src), docs_dir)
                converted.append(info)
            except documents.EmptyDocumentError:
                failed.append({"name": name, "reason": "Sin texto (¿escaneado?)"})
            except documents.UnsupportedDocumentError:
                failed.append({"name": name, "reason": "Formato no soportado"})
            except Exception as exc:  # noqa: BLE001
                _log.exception("Fallo al convertir %s", src)
                failed.append({"name": name, "reason": str(exc)})
        _log.info("Documentos: %d convertidos, %d fallidos", len(converted), len(failed))
        return {"ok": True, "converted": converted, "failed": failed}

    def list_documents(self, initiative_id):
        """Documentos ya convertidos de un proyecto."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return []
        return documents.list_documents(docs_dir)

    def open_document(self, initiative_id, md_name):
        """Abre el .md con la app asociada del sistema."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        _open_in_explorer(str(docs_dir / md_name))
        return {"ok": True}

    def open_document_original(self, initiative_id, md_name):
        """Muestra el archivo original en el Explorador (seleccionado)."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        stem = Path(md_name).stem
        original = documents._find_original(docs_dir, stem)
        if original is None:
            return {"ok": False, "error": "No se encontró el original."}
        _reveal_in_explorer(str(original))
        return {"ok": True}

    def open_documents_folder(self, initiative_id):
        """Abre la carpeta `documentos/` del proyecto."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        docs_dir.mkdir(parents=True, exist_ok=True)
        _open_in_explorer(str(docs_dir))
        return {"ok": True}

    def delete_document(self, initiative_id, md_name):
        """Borra un documento convertido (el .md y su original)."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False}
        documents.delete_document(docs_dir, md_name)
        return {"ok": True}
```

Nota: `repo.Initiative` debe estar accesible. Si `repo` no reexporta `Initiative`, usar en su lugar `from helpmeet.db.models import Initiative` en la cabecera y `self._session.get(Initiative, int(initiative_id))`.

- [ ] **Step 3: Verificar que la app arranca sin errores de import**

Run: `.\.venv\Scripts\python.exe -c "import helpmeet.ui.app"`
Expected: sin trazas de error (import correcto).

- [ ] **Step 4: Verificación con test de humo de la API**

Comprobar que existe el test `tests/test_ui_api.py` y sigue pasando (no debemos romper la carga de `Api`):

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ui_api.py -v`
Expected: PASS (los tests existentes siguen verdes).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/ui/app.py
git commit -m "feat(api): métodos de Documentos (convertir, listar, abrir, borrar)"
```

---

## Task 7: Frontend — botón, pantalla y estilos

**Files:**
- Modify: `helpmeet/ui/web/index.html`
- Modify: `helpmeet/ui/web/app.js`
- Modify: `helpmeet/ui/web/style.css`

- [ ] **Step 1: Botón de navegación en `index.html`**

En `.sidebar-nav` (≈ línea 45-49), añadir tras el botón `#navMeetings`:

```html
        <button class="side-item" id="navDocs"><span class="si-label">Documentos</span></button>
```

En `.sidebar-rail` (≈ línea 73-83), añadir tras `#railMeetings`:

```html
      <button class="rail-btn" id="railDocs" aria-label="Documentos" title="Documentos"></button>
```

- [ ] **Step 2: Wrappers de API en `app.js`**

En el objeto `api` (junto a `revealPath`, ≈ línea 218), añadir:

```javascript
  listDocumentInitiatives: () => call('list_document_initiatives'),
  pickAndConvertDocuments: (iid) => call('pick_and_convert_documents', iid),
  listDocuments: (iid) => call('list_documents', iid),
  openDocument: (iid, name) => call('open_document', iid, name),
  openDocumentOriginal: (iid, name) => call('open_document_original', iid, name),
  openDocumentsFolder: (iid) => call('open_documents_folder', iid),
  deleteDocument: (iid, name) => call('delete_document', iid, name),
```

- [ ] **Step 3: Cableado de navegación en `app.js`**

Junto a `$('#navMeetings').onclick = openMeetingsView;` (≈ línea 5600), añadir:

```javascript
  if ($('#navDocs')) $('#navDocs').onclick = () => { STATE.screen = 'docs'; STATE.selMeeting = null; renderSidebar(); renderMain(); renderTopStatus(); };
  if ($('#railDocs')) $('#railDocs').onclick = () => { STATE.screen = 'docs'; STATE.selMeeting = null; renderSidebar(); renderMain(); renderTopStatus(); };
```

En `renderChrome` (≈ línea 588-594), junto a `const onMeetings = ...` y los `classList.toggle`, añadir:

```javascript
  const onDocs = STATE.screen === 'docs';
  $('#navDocs')?.classList.toggle('active', onDocs);
  $('#railDocs')?.classList.toggle('active', onDocs);
```

- [ ] **Step 4: Enrutar la pantalla en `renderMain`**

Localizar `function renderMain()` (busca `function renderMain`). Añadir una rama para `docs` junto a las demás (`welcome`, `meetings`, `favorites`, `archive`…):

```javascript
  if (STATE.screen === 'docs') { renderDocs(); return; }
```

(Colócala en el mismo punto donde el resto de pantallas deciden qué pintar dentro de `#main`.)

- [ ] **Step 5: Implementar `renderDocs()` en `app.js`**

Añadir esta función (cerca de las otras `render*`, p. ej. tras `renderMeetings`):

```javascript
async function renderDocs() {
  const main = $('#main');
  const inits = await api.listDocumentInitiatives() || [];
  if (STATE.docsInit == null && inits.length) STATE.docsInit = inits[0].id;

  main.innerHTML = `
    <section class="docs-screen">
      <header class="docs-head">
        <h1>Documentos → Markdown</h1>
        <p class="docs-sub">Convierte PDF, Word, PowerPoint o texto a un .md ligero para pasárselo a la IA. Se guarda el original y el .md en la carpeta del proyecto.</p>
      </header>
      <div class="docs-controls">
        <label class="docs-field">
          <span>Proyecto</span>
          <select id="docsInitSelect">
            ${inits.map(i => `<option value="${i.id}" ${i.id === STATE.docsInit ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('')}
          </select>
        </label>
        <button class="btn btn-primary" id="docsPick" ${inits.length ? '' : 'disabled'}>Elegir archivos…</button>
      </div>
      <div class="docs-status" id="docsStatus" aria-live="polite"></div>
      <div class="docs-list" id="docsList"></div>
    </section>`;

  if (!inits.length) {
    $('#docsList').innerHTML = `<p class="docs-empty">Crea primero un proyecto para guardar sus documentos.</p>`;
    return;
  }

  $('#docsInitSelect').onchange = (e) => { STATE.docsInit = parseInt(e.target.value, 10); refreshDocsList(); };
  $('#docsPick').onclick = onDocsPick;
  await refreshDocsList();
}

async function refreshDocsList() {
  const list = $('#docsList');
  if (!list) return;
  const docs = await api.listDocuments(STATE.docsInit) || [];
  if (!docs.length) {
    list.innerHTML = `<p class="docs-empty">Aún no hay documentos convertidos en este proyecto.</p>`;
    return;
  }
  list.innerHTML = docs.map(d => `
    <div class="docs-row" data-name="${escapeHtml(d.name)}">
      <div class="docs-row-main">
        <span class="docs-name">${escapeHtml(d.name)}</span>
        <span class="docs-meta">${escapeHtml(d.original_name || '')}</span>
      </div>
      <div class="docs-row-actions">
        <button class="btn btn-sm" data-act="md">Abrir .md</button>
        <button class="btn btn-sm" data-act="orig">Abrir original</button>
        <button class="btn btn-sm" data-act="folder">Carpeta</button>
        <button class="btn btn-sm btn-danger" data-act="del">Eliminar</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('.docs-row').forEach(row => {
    const name = row.getAttribute('data-name');
    row.querySelector('[data-act="md"]').onclick = () => api.openDocument(STATE.docsInit, name);
    row.querySelector('[data-act="orig"]').onclick = () => api.openDocumentOriginal(STATE.docsInit, name);
    row.querySelector('[data-act="folder"]').onclick = () => api.openDocumentsFolder(STATE.docsInit);
    row.querySelector('[data-act="del"]').onclick = async () => {
      await api.deleteDocument(STATE.docsInit, name);
      await refreshDocsList();
    };
  });
}

async function onDocsPick() {
  const status = $('#docsStatus');
  const btn = $('#docsPick');
  btn.disabled = true;
  status.textContent = 'Convirtiendo…';
  try {
    const res = await api.pickAndConvertDocuments(STATE.docsInit);
    if (res && res.cancelled) { status.textContent = ''; return; }
    const okN = (res.converted || []).length;
    const failN = (res.failed || []).length;
    let msg = `${okN} convertido${okN === 1 ? '' : 's'}`;
    if (failN) msg += ` · ${failN} sin convertir (${res.failed.map(f => f.name).join(', ')})`;
    status.textContent = msg;
    if (typeof toast === 'function') toast(msg);
    await refreshDocsList();
  } catch (e) {
    status.textContent = 'Hubo un error al convertir.';
  } finally {
    btn.disabled = false;
  }
}
```

Notas de integración:
- `escapeHtml` y `toast` ya existen en `app.js`; si el helper de escape tiene otro nombre, usar el existente (busca cómo se escapan nombres en `renderMeetings`/`renderSidebar`).
- Clases de botón (`btn`, `btn-primary`, `btn-sm`, `btn-danger`): usar las que ya tenga la app; si no coinciden, tomar las de la pantalla de Archivados como referencia.

- [ ] **Step 6: Estilos en `style.css`**

Añadir al final de `helpmeet/ui/web/style.css`:

```css
/* ---------- Pantalla Documentos → Markdown ---------- */
.docs-screen { padding: 24px; max-width: 900px; margin: 0 auto; }
.docs-head h1 { margin: 0 0 4px; font-size: 20px; }
.docs-sub { color: var(--text-muted, #8a8f98); margin: 0 0 20px; font-size: 13px; }
.docs-controls { display: flex; gap: 16px; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap; }
.docs-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.docs-field select { min-width: 240px; padding: 6px 8px; }
.docs-status { min-height: 20px; font-size: 13px; color: var(--text-muted, #8a8f98); margin-bottom: 12px; }
.docs-list { display: flex; flex-direction: column; gap: 8px; }
.docs-row { display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 10px 12px; border: 1px solid var(--border, #2a2d34); border-radius: 8px; }
.docs-row-main { display: flex; flex-direction: column; min-width: 0; }
.docs-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.docs-meta { font-size: 12px; color: var(--text-muted, #8a8f98); }
.docs-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
.docs-empty { color: var(--text-muted, #8a8f98); font-size: 13px; }
```

(Usar las variables CSS reales del tema si difieren; buscar `--border` / `--text-muted` u homólogas en `style.css`.)

- [ ] **Step 7: Actualizar el cache-busting de `index.html`**

En `index.html`, subir el número de versión de los `?v=` de `style.css` y `app.js` (≈ líneas 9 y 130) para forzar recarga, p. ej. `?v=20260705-1`.

- [ ] **Step 8: Verificación manual en la app (sin empaquetar)**

Run: `.\.venv\Scripts\python.exe -m helpmeet.main`
Verificar en la ventana:
- Aparece "Documentos" debajo de "Calendario"; al pulsarlo abre la pantalla.
- El desplegable lista los proyectos.
- "Elegir archivos…" abre el diálogo; al elegir un PDF/Word real, aparece en la lista y se crea `documentos/<nombre>.md` + `documentos/originales/<original>` en la carpeta de exportación.
- Los botones Abrir .md / Abrir original / Carpeta / Eliminar funcionan.

- [ ] **Step 9: Commit**

```bash
git add helpmeet/ui/web/index.html helpmeet/ui/web/app.js helpmeet/ui/web/style.css
git commit -m "feat(ui): pantalla Documentos → Markdown"
```

---

## Task 8: Empaquetado con PyInstaller

**Files:**
- Modify: `Helpmeet.spec`

- [ ] **Step 1: Añadir markitdown y sus dependencias a la recogida**

En `Helpmeet.spec`, en la sección de `hiddenimports` (tras los bloques de `collect_submodules` existentes, ≈ línea 32-40), añadir:

```python
hiddenimports += collect_submodules("markitdown")
hiddenimports += collect_submodules("pdfminer")
hiddenimports += ["docx", "pptx", "mammoth", "markdownify", "bs4", "magika"]

datas += collect_data_files("magika", excludes=["**/__pycache__/**", "**/*.pyc"])
```

- [ ] **Step 2: Evitar que el filtro de ruido descarte los conversores de markitdown**

En la función `_is_noise` de `Helpmeet.spec`, el patrón `"/converters/"` está pensado para excluir conversores de otras librerías, pero **markitdown guarda sus conversores en `markitdown/converters/`**. Ajustar para no descartarlos: reemplazar la comprobación

```python
    if any(part in haystack for part in noise_parts):
        return True
```

por

```python
    if any(part in haystack for part in noise_parts):
        # No descartar los conversores propios de markitdown.
        if "/converters/" in haystack and "markitdown" in haystack:
            return False
        return True
```

- [ ] **Step 3: Compilar**

Run: `.\.venv\Scripts\python.exe -m PyInstaller Helpmeet.spec --noconfirm`
Expected: build sin errores; se genera `dist/Helpmeet/Helpmeet.exe`.

- [ ] **Step 4: Verificación obligatoria en la build empaquetada**

Ejecutar `dist/Helpmeet/Helpmeet.exe`, ir a Documentos y **convertir un PDF y un `.docx` reales**.
Expected: se generan los `.md` correctamente y aparecen en la lista. (Si algo falla aquí y no en `python -m helpmeet.main`, es un *hidden import* que falta: añadirlo a `hiddenimports` y recompilar.)

- [ ] **Step 5: Commit**

```bash
git add Helpmeet.spec
git commit -m "build: empaquetar markitdown y sus conversores en el .exe"
```

---

## Self-Review (cobertura del spec)

- **Sección "Objetivo" / formatos v1** → Task 1 (dep), Task 2 (`SUPPORTED_EXTENSIONS`).
- **Conversión con markitdown** → Task 3.
- **Guardar original + .md, colisión de nombres** → Task 4.
- **Listar / borrar** → Task 5.
- **Métodos Api (diálogo, hilo/no bloqueo, errores tolerantes, abrir/ revelar)** → Task 6.
- **Botón bajo Calendario + rail + pantalla + estilos** → Task 7.
- **Empaquetado (hidden imports, filtro `/converters/`, verificación en .exe)** → Task 8.
- **Fuera de alcance (OCR, Excel, auto-contexto)** → respetado (no hay tareas para ello).

Tipos/nombres consistentes: `save_and_convert`, `list_documents`, `delete_document`, `convert_to_markdown`, `EmptyDocumentError`, `UnsupportedDocumentError`, `originals_dir`, `_find_original`, `_documents_dir`, `SUPPORTED_EXTENSIONS` se usan igual en módulo, Api y tests.
