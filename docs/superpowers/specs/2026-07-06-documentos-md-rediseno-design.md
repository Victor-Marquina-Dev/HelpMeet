# Diseño: Rediseño de "Documentos → .md" (v2)

**Fecha:** 2026-07-06
**Estado:** Aprobado (mockup validado por el usuario)
**Base:** amplía la función descrita en `2026-07-05-documentos-a-markdown-design.md`
**Mockup aprobado:** rediseño interactivo con tokens reales de la app (claro/oscuro).

## 1. Objetivo

Rediseñar la sección de documentos ya existente para que sea más clara y potente:

- Renombrar a **"Documentos → .md"** (barra lateral y título).
- **Arrastrar y soltar** archivos en la sección.
- Mostrar **todos los documentos de todas las iniciativas juntos**, con **filtro por
  iniciativa** y **búsqueda** por nombre.
- Separar **destino** (a qué proyecto se guarda lo que subes) del **filtro** (qué ves).
- Botón **"Ver"** que abre un **modal** con el contenido del `.md`, con **Copiar .md** y
  **Abrir .md** dentro.
- En cada fila: **Copiar .md** (junto a la carpeta del original).
- **Eliminar** borra el `.md` **y** el original (ya lo hace; se explicita en la UI).
- Diseño de tarjetas con icono por tipo de archivo y etiqueta de color del proyecto.

### Fuera de alcance (v2)

- OCR de PDFs escaneados, Excel (siguen fuera, igual que v1).
- Meter los `.md` automáticamente en el `contexto.md` de Claude (sigue siendo manual).
- Editar el `.md` desde el modal (solo lectura + copiar + abrir).

## 2. Decisiones tomadas (con el usuario, vía mockup)

| Tema | Decisión |
|---|---|
| Nombre | "Documentos → .md" |
| Lista | Todos los documentos de todas las iniciativas, con etiqueta de proyecto |
| Filtro | "Iniciativa: Todas ▾" (solo afecta a lo que se ve) + búsqueda por nombre |
| Destino de subida | Selector "Convertir a: [proyecto]" arriba, independiente del filtro |
| Subir | Botón "Elegir archivos…" (diálogo nativo) **y** arrastrar-soltar |
| Ver | Modal con el contenido del `.md`, botones "Copiar .md" y "Abrir .md" |
| Fila | Ver · Copiar .md (📋) · Original (📂, revela en carpeta) · Eliminar (🗑) |
| Eliminar | Borra `.md` y original; con confirmación |

## 3. Cambios en el backend (`documents.py` + `Api` en `app.py`)

### 3.1 Módulo puro `helpmeet/documents.py` (añadir)

```python
def read_markdown(docs_dir: Path, md_name: str) -> str:
    """Devuelve el texto del .md indicado (para el modal y para copiar)."""
```

- Lee `docs_dir / md_name` en UTF-8. Si no existe, lanza `FileNotFoundError`.

El resto del módulo (`convert_to_markdown`, `save_and_convert`, `list_documents`,
`delete_document`, `originals_dir`, `is_supported`, excepciones) no cambia.

### 3.2 Métodos nuevos/ajustados en `Api` (orquestación)

- `list_all_documents(self)` — recorre `repo.list_initiatives`, calcula el `documentos/`
  de cada una (`_documents_dir`), llama a `documents.list_documents` y **añade a cada
  documento** `initiative_id`, `initiative_name` y `color`. Devuelve una lista plana
  ordenada por fecha de modificación descendente. Es la fuente de la lista de la UI.
- `read_document(self, initiative_id, md_name)` — devuelve el texto del `.md`
  (`documents.read_markdown`). Lo usa el modal "Ver" y "Copiar .md".
- `save_uploaded_document(self, initiative_id, name, data_b64)` — para arrastrar-soltar:
  decodifica el base64 a un archivo temporal con el nombre original, llama a
  `documents.save_and_convert(temp, docs_dir)` y borra el temporal. Devuelve el mismo
  dict que la conversión, o un error tolerante (`{"ok": False, "name", "reason"}`).
  Tolera los mismos errores que `pick_and_convert_documents` (vacío, no soportado).
- Se conservan: `pick_and_convert_documents` (diálogo nativo, destino = proyecto
  seleccionado), `list_document_initiatives`, `open_document`, `open_document_original`,
  `delete_document`. `list_documents(initiative_id)` puede quedarse (compatibilidad) o
  retirarse si nada lo usa tras el rediseño.

**Nota de arquitectura:** `documents.py` sigue siendo puro (solo `Path` + stdlib +
markitdown). Todo lo que toca DB/exportación/temporales vive en `Api`.

### 3.3 Drag & drop: por qué base64

En pywebview (WebView2/EdgeChromium) el evento `drop` del navegador entrega un objeto
`File` **sin la ruta absoluta** en disco. Como markitdown convierte desde un archivo,
el frontend lee el archivo soltado con `FileReader.readAsDataURL`, manda `{name, base64}`
al backend, y el backend lo escribe a un temporal y lo convierte. El botón "Elegir
archivos…" sigue usando el diálogo nativo (da la ruta directa, más eficiente). Ambos
caminos terminan en `documents.save_and_convert`.

Límite conocido: archivos muy grandes viajan como base64 por el puente JS↔Python (lento
para cientos de MB). Aceptable para documentos ofimáticos normales.

## 4. Cambios en el frontend

### 4.1 `index.html`
- Renombrar la etiqueta del botón `#navDocs`: "Documentos" → "Documentos → .md".
  Ajustar `title`/`aria-label` de `#railDocs` a "Documentos → .md".
- Subir el `?v=` de `app.js` y `style.css`.

### 4.2 `app.js` — reescribir `viewDocs()`
Manteniendo los helpers reales de la app (`el`, `esc`, `customSelect`, `openModal`,
`closeModal`, `confirmModal`, `copyText`, `toast(kind,msg)`, `emptyState`), la pantalla
pasa a tener:

1. **Cabecera** "Documentos → .md" + subtítulo.
2. **Zona convertir**: `customSelect` "Convertir a: [proyecto]" (destino, en `STATE.docsDest`)
   + **dropzone**. La dropzone:
   - Botón "Elegir archivos…" → `api.pickAndConvertDocuments(STATE.docsDest)`.
   - Eventos `dragover`/`drop`: resalta y, al soltar, por cada archivo lee base64 y llama
     `api.saveUploadedDocument(STATE.docsDest, name, b64)`; muestra progreso y toast con
     el resumen (n convertidos / n fallidos).
   - Deshabilitada si no hay proyecto destino (no hay iniciativas).
3. **Barra de lista**: título "Todos los documentos (n)", **buscador** (filtra en cliente
   por `name`) y **filtro** `customSelect` "Iniciativa: Todas / <proyecto>" en `STATE.docsFilter`.
4. **Lista**: `api.listAllDocuments()`, filtrada por iniciativa + búsqueda; cada documento
   es una **tarjeta**:
   - Icono de tipo (color por extensión del original: pdf/doc/ppt/html/txt).
   - Nombre `.md`, etiqueta de proyecto (con su color), original, fecha, tamaño.
   - Acciones: **Ver** (abre modal), **📋 Copiar .md**, **📂 Original**
     (`open_document_original`), **🗑 Eliminar** (con `confirmModal`, borra ambos).
   - Estado vacío con `emptyState` (sin proyectos → "crea un proyecto"; sin documentos →
     "aún no hay documentos").
5. **Modal "Ver"** (`openModal`): cabecera con icono+nombre y botones **📋 Copiar .md**
   (`copyText` del texto crudo) y **↗ Abrir .md** (`open_document`); cuerpo con el
   contenido del `.md`. El markdown se muestra con un **render ligero** (escapando HTML
   primero; soporta encabezados `#`,`##`,`###`, `**negrita**`, `*cursiva*`, `` `code` ``,
   listas `-`, `---` y párrafos). Pie con original + fecha + tamaño.
   - "Copiar .md" copia siempre el **texto crudo** del `.md` (lo que se pasa a la IA), no
     el HTML renderizado.

`STATE` nuevo: `docsDest` (id del proyecto destino), `docsFilter` (`"all"` o id de
iniciativa), `docsQuery` (texto de búsqueda).

### 4.3 `style.css`
Añadir/ajustar los estilos del rediseño (tarjetas, dropzone, barra de lista, modal de
lectura), usando las variables de tema existentes (`--accent`, `--bg-surface`,
`--border-subtle`, etc.) para respetar claro/oscuro. Reemplazar las 6 reglas mínimas
que añadió la v1 por el set del rediseño.

## 5. Manejo de errores

| Situación | Comportamiento |
|---|---|
| Soltar archivo no soportado | Se salta; toast "n sin convertir (nombre)" |
| PDF escaneado / vacío | Aviso "sin texto (¿escaneado?)" en el resumen |
| `read_document` de un `.md` borrado | El modal muestra "No se pudo leer el documento" |
| Sin proyecto destino (no hay iniciativas) | Dropzone y botón deshabilitados; aviso |
| Copiar sin portapapeles (WebView) | `copyText` usa el respaldo `fallbackCopy` |
| Borrar | `confirmModal` antes; borra `.md` + original |

## 6. Pruebas

- **Unitarias** (`tests/test_documents.py`): añadir `read_markdown` (lee contenido; lanza
  `FileNotFoundError` si no existe). El resto del módulo ya está cubierto.
- **Manual/GUI**: subir por diálogo y por arrastrar-soltar; comprobar que aparecen en la
  lista con su etiqueta de proyecto; filtrar por iniciativa; buscar; abrir el modal "Ver",
  copiar, abrir .md; eliminar y confirmar que desaparecen `.md` y original.

## 7. Archivos afectados

- Editar: `helpmeet/documents.py` (añadir `read_markdown`)
- Editar: `tests/test_documents.py` (test de `read_markdown`)
- Editar: `helpmeet/ui/app.py` (`list_all_documents`, `read_document`, `save_uploaded_document`)
- Editar: `helpmeet/ui/web/index.html` (rename nav + cache-bust)
- Editar: `helpmeet/ui/web/app.js` (reescribir `viewDocs` + modal Ver + drag&drop)
- Editar: `helpmeet/ui/web/style.css` (estilos del rediseño)
