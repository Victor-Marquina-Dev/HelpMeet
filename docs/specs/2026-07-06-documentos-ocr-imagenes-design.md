# Diseño: OCR, extracción de imágenes y carpeta por documento (v3)

**Fecha:** 2026-07-06
**Estado:** Aprobado (mockup v3 validado por el usuario)
**Base:** amplía `2026-07-06-documentos-md-rediseno-design.md`
**Mockup aprobado:** rediseño v3 con opciones OCR + extraer imágenes e indicadores.

## 1. Objetivo

Añadir a la sección "Documentos → .md" tres capacidades y rematar el diseño:

1. **OCR** para PDFs escaneados (sin texto copiable), con el motor **RapidOCR**
   (onnxruntime, se empaqueta en el `.exe`). Modo **Automático** (solo si hace
   falta), **Forzar siempre** o **Desactivado**.
2. **Extraer imágenes** del documento (opción por conversión), guardándolas en
   una subcarpeta `imagenes/`.
3. **Carpeta por documento**: cada documento pasa a vivir en
   `documentos/<nombre>/` con el original, el `.md` y `imagenes/`. Los documentos
   ya convertidos se **migran automáticamente** a esta estructura.
4. **Diseño final** (mockup v3): una línea de "Convertir a", fila de opciones,
   sin recuadros que encierren todo, iconos de línea (no emojis), indicadores
   **OCR** / **nº de imágenes** en cada documento, y la estructura de carpeta
   visible en el modal "Ver".

### Fuera de alcance (v3)

- OCR de archivos de imagen sueltos (.png/.jpg) — se puede añadir después reusando
  el mismo motor; ahora el OCR aplica a **PDF**.
- Meter el `.md` en el `contexto.md` de Claude (sigue manual).
- Traducción/limpieza del texto OCR (se guarda el texto reconocido tal cual).

## 2. Decisiones (con el usuario)

| Tema | Decisión |
|---|---|
| Motor OCR | RapidOCR (`rapidocr-onnxruntime`), empaquetado en el `.exe` |
| Cuándo OCR | Automático cuando el `.md` sale sin texto; modos Forzar/Desactivar |
| Extraer imágenes | Casilla opt-in por conversión |
| Estructura | Carpeta por documento (`documentos/<stem>/`) |
| Existentes | Migración automática a la nueva estructura |
| Diseño | El del mockup v3 (una línea, sin cajas, iconos de línea) |

## 3. Nueva estructura de almacenamiento

```
documentos/
  Catalogo-productos/              ← carpeta = nombre base del documento
    Catalogo-productos.pdf         ← original
    Catalogo-productos.md          ← texto para la IA
    .ocr                           ← marcador: se usó OCR (archivo vacío)
    imagenes/                      ← solo si se extrajeron imágenes
      img-001.png
      img-002.png
```

- **Identidad** de un documento: sigue siendo el nombre del `.md`
  (`Catalogo-productos.md`); su carpeta es el *stem* (`Catalogo-productos`).
- **Marcador `.ocr`**: archivo vacío que indica que el texto vino de OCR (para el
  indicador de la UI). Sin base de datos: todo se deriva de los archivos.
- **`imagenes/`**: existe solo si se extrajeron imágenes; su recuento es el nº que
  muestra la UI.

### Migración

`migrate_flat_to_folders(docs_dir)` (idempotente):
- Por cada `*.md` suelto en `docs_dir` (estructura vieja): crear `docs_dir/<stem>/`,
  mover el `.md` dentro, y mover su original desde `docs_dir/originales/<...>` a la
  carpeta nueva.
- Si `originales/` queda vacío, borrarlo.
- No hace nada si ya no hay `.md` sueltos (segunda llamada = no-op).
- La llaman los métodos de listado de `Api` (por iniciativa) antes de listar.

## 4. Módulos

### 4.1 `helpmeet/documents.py` (reescritura del almacenamiento)

Firmas nuevas/cambiadas (sigue siendo puro: `Path` + stdlib; OCR/imágenes por
inyección o import perezoso desde submódulos):

```python
def doc_folder(docs_dir: Path, stem: str) -> Path            # docs_dir/<stem>/
def images_dir(doc_dir: Path) -> Path                        # <doc>/imagenes/

def convert_to_markdown(source, *, ocr="auto") -> tuple[str, bool]:
    """Devuelve (markdown, uso_ocr). ocr ∈ {'auto','force','off'}.
    Para PDF: si el texto sale vacío y ocr='auto', o siempre si ocr='force',
    llama a ocr.ocr_pdf(source). Lanza EmptyDocumentError si aun así no hay texto."""

def save_and_convert(source, docs_dir, *, ocr="auto", extract_images=False) -> dict:
    """Crea docs_dir/<stem>/, guarda el original, escribe <stem>.md, marca .ocr
    si se usó OCR y, si extract_images, extrae a imagenes/. Devuelve el dict del
    documento (incluye 'ocr': bool, 'images': int)."""

def list_documents(docs_dir) -> list[dict]      # recorre subcarpetas; cada una = 1 doc
def read_markdown(docs_dir, md_name) -> str     # lee <stem>/<stem>.md
def delete_document(docs_dir, md_name) -> None  # borra la carpeta <stem>/ completa
def migrate_flat_to_folders(docs_dir) -> None
```

Cada dict de `list_documents` incluye ahora: `name`, `original_name`, `md_path`,
`original_path`, `folder_path`, `size`, `created_at`, `ocr` (bool), `images` (int).
`_unique_stem` pasa a comprobar **carpetas** existentes.

### 4.2 `helpmeet/ocr.py` (nuevo)

```python
def ocr_pdf(pdf_path: Path, *, max_pages: int | None = None) -> str:
    """Texto reconocido de un PDF escaneado. Renderiza cada página con pypdfium2
    y la pasa por RapidOCR. Imports perezosos (arrancan modelos ONNX ~1ª vez)."""
```

- **Motor**: `rapidocr-onnxruntime` (usa `onnxruntime`, ya empaquetado).
- **Render de páginas**: `pypdfium2` (pip puro, sin binarios externos, licencia
  permisiva) → imagen por página → RapidOCR.
- Instancia de RapidOCR cacheada (crear el motor es caro).
- Tolerante: si una página falla, continúa; devuelve lo acumulado.

### 4.3 `helpmeet/doc_images.py` (nuevo)

```python
def extract_images(source: Path, dest_dir: Path) -> int:
    """Extrae las imágenes incrustadas del documento a dest_dir (img-001.png…).
    Devuelve cuántas extrajo. Import perezoso de las dependencias por formato."""
```

- **.docx / .pptx**: son ZIP; se leen las imágenes de `word/media/*` /
  `ppt/media/*` con `zipfile` (sin dependencias, licencia libre).
- **.pdf**: imágenes incrustadas con `pypdf` (licencia BSD; se evita PyMuPDF por
  su licencia AGPL, incompatible con producto comercial).
- Formatos sin imágenes (txt/html/csv): devuelve 0.

## 5. Cambios en `Api` (`app.py`)

- `pick_and_convert_documents(initiative_id, ocr, extract_images)` — pasa las
  opciones a `save_and_convert`.
- `save_uploaded_document(initiative_id, name, data_b64, ocr, extract_images)` —
  idem para arrastrar-soltar.
- `list_all_documents` / `list_documents` — llaman a `migrate_flat_to_folders`
  antes de listar; cada documento incluye `ocr` e `images`.
- `open_document_images(initiative_id, md_name)` — abre la carpeta `imagenes/`
  del documento (para el acceso desde el modal).
- `open_document_original` / `open_document` / `delete_document` / `read_document`
  se adaptan a la carpeta por documento (rutas nuevas).

## 6. Frontend (mockup v3, diseño final)

Sobre la reescritura de `viewDocs` (ya hecha en v2), aplicar el diseño del mockup v3:

- **Una línea** "Convertir a: [proyecto] · [Elegir archivos] · o arrastra", **sin
  el recuadro** que la encerraba.
- **Fila de opciones**: un control **OCR** (Automático/Forzar/Desactivado, por
  defecto Automático) y una **casilla "Extraer imágenes"**. Su estado se guarda en
  `STATE.docsOcr` (`'auto'|'force'|'off'`) y `STATE.docsExtractImages` (bool) y se
  pasa a las llamadas de conversión.
- **Iconos de línea** del set `ICONS` de la app (no emojis): añadir `eye` (Ver) y
  `image`/`scan` si faltan; usar `copy`, `folder`, `trash` existentes.
- **Indicadores** en cada documento: etiqueta **OCR** (si `d.ocr`) y **nº de
  imágenes** con icono (si `d.images > 0`).
- **Modal "Ver"**: bloque "Carpeta del documento" arriba (original, `.md`,
  `imagenes/` con nº y acceso a la carpeta), luego el `.md` renderizado; botones
  Copiar .md / Abrir .md como en v2.
- La zona de arrastre es la lista (resalta solo al arrastrar), sin bloque grande.

## 7. Empaquetado (`requirements.txt` + `Helpmeet.spec`)

Nuevas dependencias: `rapidocr-onnxruntime`, `pypdfium2`, `pypdf`.

- **Peso (honesto)**: RapidOCR arrastra `opencv` (se usará
  `opencv-python-headless`), `shapely`, `pyclipper` y modelos ONNX. El añadido
  realista al instalador es **~60-90 MB** (no los 15-30 MB estimados al inicio).
  Es asumible sobre el tamaño actual (faster-whisper/ctranslate2 ya son grandes),
  pero se documenta.
- **PIL/Pillow**: hoy está en `excludes` del `.spec`; RapidOCR/pypdfium2/guardado
  de imágenes lo necesitan → **quitar `PIL` de `excludes`** (igual que se hizo con
  `dotenv`).
- `Helpmeet.spec`: `collect_submodules`/`collect_data_files` para `rapidocr_onnxruntime`
  (incluye sus **modelos ONNX** como datos), `pypdfium2` (su DLL vía
  `collect_dynamic_libs`), `pypdf`, `cv2`, `shapely`, `pyclipper`. Verificar en la
  **build empaquetada** que un PDF escaneado produce texto.

## 8. Manejo de errores

| Situación | Comportamiento |
|---|---|
| PDF escaneado, OCR Automático | Se aplica OCR; el `.md` sale con el texto reconocido |
| PDF escaneado, OCR Desactivado | Aviso "sin texto (¿escaneado?)"; no se guarda a medias |
| OCR falla / motor no carga | Aviso claro; el documento no se convierte, el resto sigue |
| Extraer imágenes sin imágenes | 0 imágenes; no se crea `imagenes/` |
| Migración con nombre colisionado | `_unique_stem` evita pisar carpetas |
| Borrar | Se borra la carpeta `<stem>/` completa (original, .md, imágenes) |

## 9. Pruebas

- **Unitarias `documents.py`**: nueva estructura (save crea `<stem>/` con original
  + `.md`), `list_documents` lee subcarpetas y cuenta imágenes/ocr,
  `delete_document` borra la carpeta, `read_markdown` desde la carpeta,
  `migrate_flat_to_folders` (crea estructura vieja en `tmp_path` y verifica que
  queda migrada e idempotente), colisión de nombres con carpetas.
- **Unitarias `doc_images.py`**: extraer de un `.docx`/`.pptx` de prueba (crear el
  ZIP con una imagen mínima) → cuenta correcta; formato sin imágenes → 0.
- **`ocr.py`**: prueba ligera de que `ocr_pdf` se invoca y tolera errores (se puede
  monkeypatchear el motor para no depender de los modelos en CI).
- **Empaquetado (manual)**: en el `.exe`, convertir un PDF escaneado (OCR) y un
  PDF/DOCX con imágenes (extracción).

## 10. Orden de implementación (fases internas)

Para poder parar con algo funcionando en cada punto:

1. **Almacenamiento**: carpeta por documento + migración (sin deps nuevas).
2. **Extraer imágenes**: `doc_images.py` + opción (deps ligeras: `pypdf`).
3. **OCR**: `ocr.py` + `rapidocr-onnxruntime`/`pypdfium2` (deps pesadas, empaquetado).
4. **Frontend**: opciones + indicadores + estructura en el modal (diseño v3).
5. **Empaquetado**: `.spec` con las nuevas deps; verificación en el `.exe`.

## 11. Archivos afectados

- Editar: `helpmeet/documents.py` (almacenamiento por carpeta + migración + opciones)
- Nuevo: `helpmeet/ocr.py`
- Nuevo: `helpmeet/doc_images.py`
- Editar: `tests/test_documents.py`; Nuevos: `tests/test_doc_images.py`, `tests/test_ocr.py`
- Editar: `helpmeet/ui/app.py` (opciones en conversión, abrir imágenes, migración)
- Editar: `helpmeet/ui/web/app.js` (fila de opciones, indicadores, modal con carpeta)
- Editar: `helpmeet/ui/web/style.css` (opciones, etiquetas OCR/imágenes, bloque de archivos)
- Editar: `requirements.txt`, `Helpmeet.spec` (rapidocr, pypdfium2, pypdf; quitar PIL de excludes)
