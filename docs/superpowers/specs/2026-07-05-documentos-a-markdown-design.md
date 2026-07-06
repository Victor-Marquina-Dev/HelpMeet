# Diseño: Documentos → Markdown

**Fecha:** 2026-07-05
**Estado:** Aprobado (pendiente de plan de implementación)

## 1. Objetivo

Añadir a Helpmeet una sección **"Documentos"** que convierta archivos
(PDF, Word, PowerPoint, texto plano, HTML, CSV) a **Markdown (`.md`)**, para
poder pasarle a Claude/ChatGPT un `.md` ligero en vez del documento original
(menos tokens, mejor lectura por la IA).

La conversión se hace con **`markitdown`** (utilidad de Microsoft) empaquetada
dentro de la app.

### Qué NO hace esta versión (fuera de alcance)

- **No** inyecta el `.md` automáticamente en el `contexto.md` de Claude. La
  decisión del usuario fue "solo convertir y guardar"; él decide luego qué
  mandar a la IA.
- **No** hace OCR de PDFs escaneados (imágenes de papel sin texto real). Esos
  documentos producirían un `.md` vacío; se avisa al usuario y se deja OCR para
  una versión futura.
- **No** convierte Excel (`.xlsx`). Se descartó porque arrastra `pandas`
  (+40-50 MB al instalador) y no es un caso prioritario. Ampliable a futuro.
- **No** admite formatos binarios antiguos `.doc` / `.ppt`; solo los modernos
  `.docx` / `.pptx` (limitación de `markitdown`).

## 2. Decisiones ya tomadas (con el usuario)

| Decisión | Elección |
|---|---|
| Propósito | Solo convertir y guardar (no auto-inyectar en contexto) |
| Acceso en la UI | Nuevo botón en la barra lateral, **debajo de "Calendario"** |
| Organización | Por proyecto/iniciativa (el usuario elige el proyecto) |
| Qué se guarda | El **original** y el **`.md`** generado |
| Formatos v1 | PDF, `.docx`, `.pptx`, texto/HTML/CSV. **Sin Excel** |
| Motor | `markitdown` empaquetado en el `.exe` |

## 3. Arquitectura general

El patrón existente de Helpmeet se respeta tal cual:

- **Backend Python** (`helpmeet/ui/app.py`, clase `Api`) expone métodos
  llamados desde el frontend vía `pywebview.api.<método>()`.
- **Frontend** (`helpmeet/ui/web/app.js`) renderiza pantallas dentro de
  `<main>` según `STATE.screen`, y cablea los botones de navegación.
- **Empaquetado** con PyInstaller (`Helpmeet.spec`).

Se añaden tres piezas:

1. **Módulo de conversión** (nuevo): `helpmeet/documents.py`.
2. **Métodos en `Api`** (en `app.py`) que la UI invoca.
3. **Pantalla "Documentos"** en el frontend (`index.html`, `app.js`, `style.css`).

Diseño para aislamiento: el módulo `documents.py` no conoce nada de la UI ni de
webview; recibe rutas y devuelve datos. La `Api` orquesta (diálogos de archivo,
hilos, respuestas a la UI). El frontend solo pinta y llama a `Api`. Cada pieza
se entiende y prueba por separado.

## 4. Módulo `helpmeet/documents.py`

Responsabilidad única: conversión de un archivo a Markdown y gestión del
almacenamiento por proyecto en disco. Sin estado, sin UI.

### 4.1 Formatos admitidos

```python
SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx",
    ".txt", ".md", ".html", ".htm", ".csv", ".json", ".xml",
}
```

(La lista final se ajusta a lo que `markitdown` soporta sin extras pesados; la
guía es "todo lo que no arrastre `pandas` ni OCR".)

### 4.2 Conversión

```python
def convert_to_markdown(source: Path) -> str:
    """Convierte un archivo a texto Markdown. Lanza excepción si falla."""
```

- Usa `markitdown` **como librería** (no como comando externo):
  `from markitdown import MarkItDown; MarkItDown().convert(str(source)).text_content`.
- Instancia de `MarkItDown` reutilizable (crear una y cachear).
- Si el resultado sale vacío o solo espacios → se trata como
  "sin texto extraíble" (típico de PDF escaneado) y se informa al usuario.

### 4.3 Almacenamiento por proyecto

Se reutiliza la carpeta de exportación existente
(`settings.get_export_dir()`) y el slug de iniciativa
(`exporter._slug` / `initiative_export_dir`). Estructura:

```
<carpeta de exportación>/
  <slug-del-proyecto>/
    documentos/
      originales/
        contrato.pdf          ← original tal cual
      contrato.md             ← Markdown generado
```

Funciones:

```python
def documents_dir(initiative, base_dir) -> Path        # <slug>/documentos/
def originals_dir(initiative, base_dir) -> Path        # <slug>/documentos/originales/
def save_and_convert(initiative, source, base_dir) -> dict
def list_documents(initiative, base_dir) -> list[dict]
def delete_document(initiative, md_name, base_dir) -> None
```

- `save_and_convert`: copia el original a `originales/`, genera el `.md`
  hermano en `documentos/`, devuelve
  `{"name", "md_path", "original_path", "original_name", "size", "created_at"}`.
- **Colisión de nombres**: si ya existe un `.md` con ese nombre base, se añade
  sufijo ` (2)`, ` (3)`… tanto al original como al `.md` para no pisar nada.
- `list_documents`: recorre la carpeta `documentos/`, empareja cada `.md` con su
  original en `originales/` (por nombre base) y devuelve la lista ordenada por
  fecha de modificación descendente.
- `delete_document`: borra el `.md` y su original emparejado.

## 5. Métodos en la clase `Api` (`app.py`)

Nombres siguiendo el estilo existente (`import_media`, `list_meetings`…):

```python
def list_document_initiatives(self)        # proyectos para el desplegable
def pick_and_convert_documents(self, initiative_id)  # diálogo + conversión en hilo
def list_documents(self, initiative_id)
def open_document(self, initiative_id, md_name)      # abre el .md
def open_document_original(self, initiative_id, md_name)
def open_documents_folder(self, initiative_id)
def delete_document(self, initiative_id, md_name)
```

- **Selección de archivos**: `create_file_dialog(webview.OPEN_DIALOG,
  allow_multiple=True, file_types=(...))` — mismo patrón que `_pick_files()`.
  `file_types` filtra a los formatos admitidos + "Todos los archivos".
- **Conversión en segundo plano**: se lanza en un hilo (como los *jobs* de
  transcripción). Durante el proceso se emite progreso/estado a la UI mediante
  el mismo canal de eventos que ya usa la app (p. ej. `window.evaluate_js`
  o el mecanismo `_job_event` existente), para no congelar la ventana.
- **Errores por archivo**: la conversión de varios archivos es tolerante: si uno
  falla (formato no soportado, PDF escaneado, archivo corrupto), se registra su
  error y se continúa con el resto. La respuesta incluye
  `{"ok", "converted": [...], "failed": [{"name", "reason"}]}`.
- **Abrir archivo/carpeta**: reutiliza el helper de apertura nativa ya presente
  en `app.py` (el que abre carpetas de exportación con el explorador).

## 6. Frontend

### 6.1 `index.html`

Añadir un `side-item` debajo de `#navMeetings` dentro de `.sidebar-nav`:

```html
<button class="side-item" id="navDocs"><span class="si-label">Documentos</span></button>
```

Y el botón equivalente en el rail colapsado (`.sidebar-rail`), tras
`#railMeetings`:

```html
<button class="rail-btn" id="railDocs" aria-label="Documentos" title="Documentos"></button>
```

### 6.2 `app.js`

- Nuevo valor de pantalla: `STATE.screen === 'docs'`.
- Cablear `#navDocs` (y `#railDocs`): fijan `STATE.screen = 'docs'`, resetean
  selección de proyecto/reunión y llaman a `renderMain()` + `renderTopStatus()`.
- Marcar el botón activo en `renderChrome` (junto a `onMeetings`, `onHome`…).
- Función `renderDocs()` que pinta:
  1. Cabecera con título "Documentos → Markdown" y subtítulo explicativo.
  2. Desplegable de proyectos (poblado con `api.list_document_initiatives()`).
     Recuerda la última selección en `STATE`.
  3. Botón **"Elegir archivos"** + **zona de arrastrar y soltar**.
  4. Estado de conversión (spinner/progreso mientras trabaja).
  5. Lista de documentos convertidos del proyecto seleccionado, cada uno con
     botones *Abrir .md*, *Abrir original*, *Abrir carpeta*, *Eliminar*.
- **Arrastrar y soltar**: capturar `drop` sobre la zona; obtener rutas de los
  ficheros. (Nota de implementación: en pywebview el `File` del navegador puede
  no exponer la ruta absoluta; si es así, el *drop* actúa como disparador y la
  selección real se hace por el diálogo nativo, o se usa la ruta que exponga el
  backend de webview. El plan de implementación validará esto en la build.)
- Al terminar una conversión: refrescar la lista y mostrar *toast* de resultado
  (p. ej. "2 convertidos, 1 no se pudo: escaneado.pdf").

### 6.3 `style.css`

Estilos para la pantalla `docs`: desplegable, zona de *drop*, tarjetas/filas de
la lista de documentos. Reutilizar variables y clases existentes para mantener
el look (claro/oscuro ya soportados por la app).

## 7. Empaquetado (`Helpmeet.spec` y `requirements.txt`)

- Añadir a `requirements.txt` la dependencia acotada, p. ej.
  `markitdown[pdf,docx,pptx]` (sin `[all]`, sin Excel/OCR/nube).
- En `Helpmeet.spec`:
  - `hiddenimports += collect_submodules("markitdown")` y submódulos de sus
    conversores.
  - Incluir dependencias de los conversores que PyInstaller no detecte por
    estático: `pdfminer.six`, `python-docx`, `python-pptx`, `mammoth`,
    `markdownify`, `beautifulsoup4`, `magika` (y sus datos de modelo si aplica).
  - **Ojo con los excludes actuales**: el `.spec` excluye `PIL`, `pandas`, etc.
    y filtra `/converters/`. Hay que asegurarse de **no** filtrar los conversores
    de `markitdown` en `_is_noise` (el patrón `/converters/` podría chocar) y de
    no excluir una dependencia que `markitdown` sí necesite.
  - `onnxruntime` ya está incluido (lo usa `magika`); reutilizable.
- **Verificación obligatoria**: probar la conversión **en la build empaquetada**
  (no solo con `python`), porque los fallos de *hidden imports* solo aparecen en
  el `.exe`.

## 8. Manejo de errores (resumen)

| Situación | Comportamiento |
|---|---|
| Formato no soportado | Se salta ese archivo; aparece en `failed` con motivo claro |
| PDF escaneado / `.md` vacío | Aviso "no se pudo extraer texto (¿escaneado?)" |
| Archivo corrupto / error de `markitdown` | Se captura, se registra, se continúa |
| Sin proyecto seleccionado | El botón de convertir queda deshabilitado |
| Nombre repetido | Sufijo ` (2)`, ` (3)`… en original y `.md` |
| Fallo al abrir carpeta/archivo | *Toast* de error, sin romper la app |

## 9. Pruebas

- **Unitarias** de `documents.py` (sin UI): conversión de un `.txt`/`.html`
  simple, layout de carpetas correcto, colisión de nombres, `list_documents`
  empareja bien original ↔ `.md`, `delete_document` borra ambos, manejo de
  resultado vacío.
- **Manual / empaquetado**: convertir un PDF y un `.docx` reales desde la app
  compilada; verificar que el `.md` y el original quedan en la carpeta correcta
  del proyecto y que los botones de abrir/eliminar funcionan.

## 10. Archivos afectados

- **Nuevo**: `helpmeet/documents.py`
- **Nuevo**: `tests/test_documents.py`
- Editar: `helpmeet/ui/app.py` (métodos en `Api`)
- Editar: `helpmeet/ui/web/index.html` (botón nav + rail)
- Editar: `helpmeet/ui/web/app.js` (pantalla `docs`)
- Editar: `helpmeet/ui/web/style.css` (estilos de la pantalla)
- Editar: `requirements.txt` (dependencia `markitdown`)
- Editar: `Helpmeet.spec` (empaquetado)
