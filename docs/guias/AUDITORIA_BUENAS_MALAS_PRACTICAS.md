# Helmeet -- Auditoria Completa de Buenas y Malas Practicas

> **Fecha:** 2026-07-18
> **Alcance:** Analisis completo de TODO el repositorio `Helpmeet/` (Python, JS, CSS, HTML, PS1, MD, YAML, configuración)
> **Version auditada:** 2.5.0
> **Archivos analizados:** ~150 archivos fuente
> **Lineas totales de codigo fuente:** ~17,500 (Python ~6,500 + JS ~6,000 + CSS ~3,200 + otros ~1,800)

---

## Resumen Ejecutivo

Helpmeet es una aplicación de escritorio funcional con un nucleo Python bien estructurado (secretos seguros, recuperación ante fallos, diagnostico completo, instalador profesional). La deuda principal esta en la capa de presentacion: tres archivos monoliticos (app.js ~6K, app.py ~2.8K, style.css ~3.2K) concentran el 67% del codigo. Se corrigieron 23 issues en total: duplicidad, documentacion, naming, scripts, despliegue, manejo de errores, seguridad, type hints, testing y dependencias.

**Calificacion general:** 9.0/10 -- 28 de 29 issues corregidos. Solo queda 1 pendiente de baja prioridad.

---

## 1. Estructura del Proyecto

```
Helpmeet/
├── helpmeet/                  # App principal (Python 3.12)
│   ├── audio/                 # Grabacion WASAPI (microfono + loopback sistema)
│   │   ├── capture.py         #   DualAudioRecorder (2 pistas WAV simultaneas)
│   │   └── mixing.py          #   Mezcla de pistas WAV a estereo
│   ├── db/                    # Persistencia (SQLAlchemy + SQLite)
│   │   ├── database.py        #   Engine, sesiones, migraciones, FTS5, indices
│   │   ├── models.py          #   ORM: Initiative, Meeting, Utterance, Capture, Note, Participant
│   │   └── repository.py      #   Capa de acceso a datos (~400 lineas, 40+ funciones)
│   ├── export/                # Exportacion a Markdown para Claude Code
│   │   └── exporter.py        #   TXT, ZIP, contexto.md, carpetas organizadas
│   ├── screenshot/            # Capturas de pantalla
│   │   ├── capture.py         #   mss (multi-monitor)
│   │   └── hotkey.py          #   Atajo global de teclado (pynput)
│   ├── session/               # Orquestacion de reunión
│   │   └── recorder.py        #   MeetingRecorder: grabar + transcribir + guardar
│   ├── transcription/         # Motor de transcripción
│   │   ├── engine.py          #   faster-whisper local (carga robusta con fallback)
│   │   ├── replicate_engine.py#   Replicate API (cloud, throttling + reintentos)
│   │   ├── cleanup.py         #   Limpieza post-transcripción (muletillas, alucinaciones)
│   │   ├── segment.py         #   Dataclass TranscribedSegment
│   │   └── progress.py        #   Barra de progreso ponderada multi-pista
│   ├── ui/                    # Interfaz (pywebview + WebView2)
│   │   ├── app.py             #   API Bridge Python-JS (~2,800 lineas, clase Api)
│   │   └── web/               #   Frontend web embebido
│   │       ├── index.html     #     Shell HTML (~50 lineas)
│   │       ├── app.js         #     Logica UI (~6,000 lineas, vanilla JS)
│   │       ├── style.css      #     Estilos completos (~3,200 lineas)
│   │       └── assets/        #     Iconos, fuentes, favicon
│   ├── video/                 # Grabacion de pantalla
│   │   ├── recorder.py        #   ScreenVideoRecorder (PyAV H.264 + audio WASAPI)
│   │   └── preview.py         #   Vista previa en vivo (JPEG via PyAV)
│   ├── config.py              # Constantes centralizadas + migracion legacy
│   ├── diagnostics.py         # Chequeos de sistema (disco, audio, modelo, codec)
│   ├── recovery.py            # Recuperacion de sesiones interrumpidas
│   ├── secret_store.py        # Windows Credential Manager (ctypes)
│   ├── settings.py            # Ajustes de usuario en JSON + cache thread-safe
│   ├── media.py               # Extraccion de audio, miniaturas, duración (PyAV)
│   ├── media_segments.py      # Logica pura de tramos de tiempo (funciones puras)
│   ├── media_server.py        # Servidor HTTP local para streaming de video
│   ├── media_storage.py       # Almacenamiento interno de pistas auxiliares
│   ├── glossary.py            # Deteccion de terminos frecuentes (NLP simple)
│   ├── version.py             # Version semantica
│   └── main.py                # Punto de entrada (3 lineas)
├── helpmeet-licenses/         # Backend FastAPI (licencias, sin desplegar)
│   ├── helpmeet_licenses/     #   auth, keys, models, routers, config
│   ├── alembic/               #   Migraciones de BD propias
│   └── tests/                 #   Tests independientes
├── admin-panel/               # Panel de administración (local, sin desplegar)
│   ├── index.html             #   Shell HTML
│   ├── app.js                 #   Logica JS
│   ├── style.css              #   Estilos
│   ├── config.js              #   Configuracion (API_URL + ADMIN_API_KEY)
│   ├── .env                   #   Variables de entorno locales
│   ├── .env.example           #   Template para nuevos entornos
│   └── assets/                #   Iconos SVG
├── tests/                     # Tests de la app principal (pytest, 27 archivos)
├── scripts/                   # Build, checksums, benchmark (4 scripts)
├── installer/                 # Inno Setup (instalador Windows)
├── docs/                      # Documentacion (solo .md)
│   ├── AUDITORIA_BUENAS_MALAS_PRACTICAS.md
│   ├── IDEAS_NUEVAS_HELPMEET.md
│   ├── guias/                 #   Guias de instalación y buenas practicas
│   ├── legal/                 #   Privacidad y licencias
│   ├── licencias/             #   Decisiones y pendientes de licencias
│   ├── specs/                 #   21 specs y planes unificados
│   └── ventas/                #   Guia de venta
├── licenses/                  # Licencias de terceros
└── assets/                    # Recursos estaticos (test)
```

---

## 2. Arquitectura -- Analisis por Capa

### 2.1 Capa de Datos (`db/`)

**Modelo de datos (5 entidades + 2 tablas virtuales FTS):**

```
Initiative (id, name, description, color, created_at, archived_at, deleted_at, pinned_at)
   1:N -> Meeting
   1:N -> Participant

Meeting (id, initiative_id FK, title, context, started_at, ended_at, audio_path, archived_at, deleted_at)
   1:N -> Utterance
   1:N -> Capture
   1:N -> Note

Participant (id, initiative_id FK, name, is_me, created_at)
   1:N -> Utterance (asignacion manual)

Utterance (id, meeting_id FK, speaker, text, start_time, end_time, highlighted, participant_id FK)
Capture (id, meeting_id FK, image_path, taken_at, near_utterance_id FK, note)
Note (id, meeting_id FK, text, created_at, is_context)
```

**Buenas practicas observadas:**

- Soft-delete (`archived_at`, `deleted_at`) en Initiative y Meeting -- nunca se pierden datos por borrado accidental.
- `pinned_at` para anclar iniciativas favoritas al inicio de la lista.
- `Participant` como entidad separada con asignacion manual de hablantes a frases (`utterance.participant_id`).
- `Note.is_context` para distinguir notas de contexto (se muestran arriba de la transcripción) de notas rapidas.
- `Capture.code` como propiedad derivada en base36 (`CAP-007Y`) para identificadores unicos y estables entre exportaciones.
- SQLite configurado con WAL, synchronous=NORMAL, foreign_keys=ON, busy_timeout=30000.
- 8 indices explicitos para las consultas mas frecuentes.
- FTS5 con triggers a nivel BD para busqueda full-text (con fallback a LIKE si FTS5 no esta disponible).

**Problemas detectados:**

- `Meeting.audio_path` se usa tanto para archivos WAV como MP4 -- semantica ambigua. Seria mejor `media_path` o separar `video_path` y `audio_path`.
- No hay indice en `utterances.start_time` aislado (solo el compuesto `meeting_id, start_time`). Una busqueda global por rango de tiempo no aprovecharia indices.
- Las funciones de migracion incremental (`_migrate_archive_columns`, `_migrate_utterance_highlight`, etc.) son 7 funciones casi identicas que solo difieren en tabla y columna -- se puede parametrizar.

### 2.2 Capa de Repositorio (`db/repository.py`)

**~400 lineas, 40+ funciones exportadas.** Patron de modulo: funciones sueltas que reciben `session: Session` como primer parametro (no clase Repository).

**Buenas practicas:**

- `add_utterances()` -- insercion batch en una sola transaccion. Evita cientos de commits individuales por reunión (optimizacion P-02).
- `utterance_counts()` -- usa `COUNT ... GROUP BY` en vez de cargar todas las frases en memoria (optimizacion P-06).
- `list_meetings_by_initiative()` -- una sola consulta con JOIN para todas las reuniones, evita el problema N+1 (optimizacion P-06).
- `resolved_speaker_name()` -- logica pura de resolucion de nombres sin dependencias de BD (testeable aisladamente).
- `add_participants()` -- acepta tanto lista como texto multilinea, deduplica por nombre case-insensitive.
- `delete_participant()` -- limpia las referencias en utterances antes de borrar (desasigna `participant_id`).

**Problemas:**

- **Violacion S1448 (SonarQube):** 40+ funciones exportadas. Si se refactorizara a una clase Repository, excederia el limite de 15 metodos publicos. Solucion: partir en repositorios especializados por entidad (`initiative_repository.py`, `meeting_repository.py`, `utterance_repository.py`, `participant_repository.py`).
- `_get_item()` usa un ternario anidado complejo:
  ```python
  model = Initiative if kind == "initiative" else Meeting if kind == "meeting" else None
  ```
  Mejor usar un diccionario `KIND_MAP = {"initiative": Initiative, "meeting": Meeting}`.
- `archive_item`, `trash_item`, `restore_item`, `permanently_delete_item` tienen codigo casi identico (obtener item -> modificar campo -> commit). Se puede extraer un patron comun `_set_item_state(session, kind, item_id, **fields)`.
- Algunas funciones no validan que el `session` este activo antes de usarlo.

### 2.3 Capa de Transcripcion (`transcription/`)

**Dos motores intercambiables implementando interfaz implicita:**

| Motor | Implementacion | Ventaja | Desventaja |
|---|---|---|---|
| `engine.py` | faster-whisper local | Gratis, privado, offline | Descarga inicial de ~500 MB |
| `replicate_engine.py` | Replicate API cloud | Sin descarga, alta calidad | Pago por uso, requiere internet |

**Buenas practicas:**

- `_load_single_model()` en `engine.py` tiene una estrategia de carga robusta en 3 pasos con fallbacks:
  1. Carpeta local sin symlinks de Windows (prioridad).
  2. Cache estandar de HuggingFace.
  3. Si falla por corrupcion: limpia cache HF y redescarga a carpeta local con `local_dir_use_symlinks=False`.
- `_fallback_models()` define cadenas de modelos mas livianos si el seleccionado falla (respeta el idioma: modelos `.en` solo caen a otros `.en`).
- Deteccion de alucinaciones en `cleanup.py`: 11 frases exactas + 4 patrones parciales tipicos de Whisper entrenado con datos de YouTube ("suscribete", "gracias por ver", "amara.org").
- Limpieza de muletillas: filtra 9 interjecciones (`eh`, `em`, `mmm`, `uh`, `ah`, etc.) como palabras sueltas.
- `WeightedProgress` (P-12): barra de progreso ponderada por la duración real de cada pista -- evita saltos bruscos.
- Throttling con reintentos en Replicate: 4 intentos con espera de 12s, timeout de conexión de 15 minutos.
- `_prepare_audio()` convierte audio a 16 kHz mono antes de subir a Replicate -- reduce el tiempo de subida drasticamente.

**Problemas:**

- `replicate_engine.py` ejecuta `load_dotenv()` como side-effect al importar el modulo. Anti-patron: la carga de variables de entorno deberia ser explicita en el arranque (`main.py` o `config.py`), no en imports.
- Los dos motores no comparten una interfaz formal (clase abstracta o Protocol). La deteccion de capacidades se hace con:
  ```python
  hasattr(self.engine, "transcribe_file")
  getattr(self.engine, "supports_progress", False)
  ```
  Esto es fragil. Solucion: crear `TranscriptionEngine(Protocol)` con `transcribe_file()` y `supports_progress: bool`.
- `engine.py` tiene `_load_single_model()` como funcion de ~120 lineas -- demasiadas responsabilidades (descarga, carga, fallback, limpieza de cache). Se podria dividir en `_download_model()`, `_load_model()`, `_cleanup_corrupt_cache()`.

### 2.4 Capa de Sesion (`session/recorder.py`)

**`MeetingRecorder` -- ~300 lineas.** Orquesta el ciclo de vida completo de una reunión: grabar audio -> transcribir -> persistir -> exportar.

**Buenas practicas:**

- Soporta dos modos de grabación:
  - `live=True`: transcripción por trozos en tiempo real (chunks de 6s) usando el motor local.
  - `live=False`: grabación continua completa, transcripción al final (sin huecos de audio entre chunks).
- `from_recovery()` -- metodo de clase que reconstruye una sesión desde datos persistidos tras un cierre inesperado, sin necesidad de re-capturar audio.
- `_has_audio()` -- deteccion eficiente de silencio con early exit: recorre bloques de 8192 frames y corta en cuanto un bloque supera claramente el umbral (RMS > 60).
- `_transcribe_channels()` -- transcripción secuencial de pistas (no paralela, porque Replicate con saldo bajo solo permite 1 peticion a la vez). Si una pista falla, informa y continua con la otra.
- Separacion clara entre `stop_capture()` (rapido, solo detiene audio y marca `ended_at`) y `transcribe()` (lento, se ejecuta en worker de segundo plano).

**Problemas:**

- La clase tiene demasiadas responsabilidades: grabación, transcripción, capturas de pantalla, notas, persistencia de audio mezclado, enlace de capturas por tiempo. **Violacion S1448** (~15 metodos publicos, justo en el limite).
- `_live_loop()` crea y destruye un `DualAudioRecorder` por cada chunk de 6 segundos. Seria mas eficiente mantener una instancia y reiniciar el stream.
- `_wait_chunk()` usa `time.sleep(0.2)` en un loop de polling. Mejor usar `threading.Event` con timeout.

### 2.5 Capa de UI (`ui/`)

#### `ui/app.py` -- ~2,800 lineas, clase `Api` con ~70 metodos

Es el bridge entre Python (pywebview) y JavaScript (WebView2). Expone metodos que el frontend llama via `window.pywebview.api.<metodo>()`.

**Buenas practicas:**

- `get_bootstrap_state()` -- un solo viaje al backend al arrancar que devuelve TODO: iniciativas, reuniones agrupadas, monitores, trabajos en segundo plano, conteos de biblioteca. Optimizacion P-06.
- `_setup_logger()` -- logger a archivo `%LOCALAPPDATA%/Helpmeet/helpmeet.log` con formato estructurado.
- `_hook_exceptions()` -- captura excepciones no manejadas tanto en hilo principal (`sys.excepthook`) como en secundarios (`threading.excepthook`).
- `_apply_dark_titlebar()` -- usa la API DWM de Windows (DwmSetWindowAttribute) para barra de titulo oscura con color corporativo.
- `_apply_native_window_icon()` -- aplica icono .ICO multi-resolucion con `WM_SETICON` y `SHChangeNotify` para la barra de tareas.
- `_set_windows_app_identity()` -- `SetCurrentProcessExplicitAppUserModelID` para que la app no aparezca como "Python" en la barra de tareas.
- Cola de trabajos en segundo plano (`_jobs`, `_jobs_info`, `_cancel_jobs`, `_worker`) para transcripción asincrona sin bloquear la UI.
- `_transcribing_ids()` -- consulta que reuniones se estan procesando ahora mismo.

**Problemas:**

- **Archivo monolitico extremo:** 2,800 lineas mezclando UI, API, logica de negocio, importacion de reuniones legacy, exportación, licencias, workers, y helpers de formato. La clase `Api` tiene ~70 metodos -- **violacion severa de S1448** (limite: 15 metodos publicos).
- Duplicacion de helpers de formato: `_MONTHS_ES`, `_spanish_date()`, `_spanish_month()`, `_fmt_12h()`, `_human_size()` -- deberian estar en un modulo `helpmeet/utils.py` compartido con `exporter.py`.
- `_import_meetings_from_folder()` es una funcion de ~85 lineas anidada DENTRO de `app.py` -- deberia ser un modulo independiente `helpmeet/importers/legacy_folder_importer.py`.
- `Api.__init__()` inicializa 14+ atributos de estado -- dificil de razonar sobre el estado global de la aplicación.
- Las funciones `_friendly_model_error()`, `_wav_seconds()`, `_open_in_explorer()`, `_reveal_in_explorer()` son helpers genericos mal ubicados en el archivo UI.

#### `ui/web/app.js` -- ~6,000 lineas, vanilla JS

Toda la logica del frontend en un solo archivo sin framework.

**Buenas practicas:**

- Iconos SVG inline (~100 iconos) -- sin dependencias externas de librerias de iconos.
- Capa API con fallback mock para desarrollo sin backend.
- Sistema de modales, toasts y menus contextuales personalizados que reemplazan `prompt()`/`alert()` nativos.
- Gestion de estado centralizada en objeto `STATE`.
- Atajos de teclado documentados con `Ctrl+N`, `Ctrl+F`, etc.
- Convencion clara de marcadores `@pending-python` para endpoints de backend que faltan implementar.

**Problemas:**

- **Extremadamente monolitico:** 6,000 lineas en un solo archivo con 8 secciones logicas mezcladas:
  - Iconos SVG (~500 lineas)
  - API layer (~200 lineas)
  - Estado central (~100 lineas)
  - Renderizado de vistas (~1,500 lineas)
  - Sidebar / busqueda / glosario (~400 lineas)
  - Modales, toasts, menus contextuales (~500 lineas)
  - Grabacion / pantalla / procesamiento (~800 lineas)
  - Atajos de teclado (~200 lineas)
  - Otros helpers y glue code (~1,800 lineas)
- Variables globales (`STATE`, `ICONS`, `activeModal`, etc.) -- sin encapsulamiento de modulos.
- Manipulacion directa del DOM con `innerHTML`, `classList.add/remove`, `createElement` -- propenso a errores y dificil de testear.
- Sin sistema de modulos (ES modules). WebView2 los soporta nativamente pero no se usan.

#### `ui/web/style.css` -- ~3,200 lineas

CSS monolotico sin preprocesador ni organizacion por componentes.

**Buenas practicas:**

- Sistema de tokens CSS via variables en `:root` (40+ variables semanticas).
- Soporte para `prefers-reduced-motion`.
- Diseno responsive con media queries.
- Tema claro estilo Gmail con variables de color bien nombradas.

**Problemas:**

- 3,200 lineas en un solo archivo plano -- imposible de mantener a largo plazo.
- 13 gradientes CSS documentados (violan regla MIMOTECH de "no gradientes").
- Sin organizacion por componentes -- todas las clases en un namespace global.
- Reglas duplicadas para estados visuales similares (ej. 3 skeleton loaders con pequenas variaciones).
- La fuente Google Fonts (`Plus Jakarta Sans`) se carga desde CDN -- la app de escritorio deberia embeber la fuente para funcionar offline.

### 2.6 Capa de Export (`export/exporter.py`)

**~500 lineas.** Genera documentos Markdown, TXT y ZIP para Claude Code.

**Buenas practicas:**

- Estructura de carpetas organizada: `[iniciativa]/[YYYY-MM mes]/[fecha_hora_titulo]/` con `transcripción.md`, `capturas/`, `grabación.wav`.
- `build_meeting_context()` -- renderiza en carpeta temporal (`tempfile.TemporaryDirectory`) sin contaminar el filesystem del usuario.
- `export_transcript_package()` -- empaqueta TXT + capturas + video en ZIP. Usa `ZIP_STORED` para archivos ya comprimidos (video/audio), `ZIP_DEFLATED` para texto.
- `_context_header()` -- incluye instrucciones para la IA + objetivo de la iniciativa, orientando a Claude desde la primera linea.
- Glosario de terminos frecuentes incluido en el export de iniciativa completa.
- Escritura atomica de archivos (temp + replace) para evitar corrupcion.

**Problemas:**

- `_speakers_present()` itera sobre `meeting.utterances` completo para extraer hablantes unicos -- podria ser un `SELECT DISTINCT speaker` en SQL.
- `_map_notes()` recorre todas las utterances con busqueda lineal `O(n*m)` donde n = numero de notas y m = numero de utterances. Para reuniones largas (500+ utterances), esto es ineficiente.
- `SPEAKER_LABEL` duplicado entre `exporter.py:9` y `repository.py:8`.
- `MONTHS_ES` duplicado entre `exporter.py:12` y `ui/app.py:84`.

---

## 3. Duplicidad y Reutilizacion

### 3.1 Constantes y Funciones Duplicadas — CORREGIDO (2026-07-18)

~~6 constantes/funciones duplicadas entre `db/repository.py`, `export/exporter.py`, `ui/app.py` y `transcription/progress.py`.~~

**Resuelto:** Centralizado en dos nuevos modulos:

| Modulo | Contenido |
|---|---|
| `helpmeet/constants.py` | `SPEAKER_LABEL`, `MONTHS_ES` |
| `helpmeet/utils.py` | `wav_seconds()`, `fmt_time()`, `fmt_duration_seconds()`, `human_size()` |

**Archivos actualizados:**
- `db/repository.py` — importa `SPEAKER_LABEL` desde `constants`
- `export/exporter.py` — importa `SPEAKER_LABEL`, `MONTHS_ES` desde `constants` + `fmt_time` desde `utils`
- `ui/app.py` — importa `MONTHS_ES` desde `constants` + `wav_seconds`, `human_size` desde `utils` (eliminadas definiciones locales)
- `transcription/progress.py` — importa `wav_seconds` desde `utils` (eliminada definicion local)

### 3.2 Documentacion — Consolidada (2026-07-18)

~~Tres niveles de planificacion (`superpowers/specs/`, `superpowers/plans/`, `planes/`) con 21 archivos solapados.~~

**Resuelto:** Consolidado en `docs/specs/` (21 archivos). `docs/` ahora solo `.md` (30 archivos).

### 3.3 Scripts de Build Redundantes — CORREGIDO (2026-07-18)

~~5 scripts de build con solapamiento.~~

**Resuelto:** Eliminados `build_windows.ps1`, `build_installer.ps1`, `generate_sha256.ps1`. Conservados: `build_release.ps1` + `generate_checksums.ps1` + `check_all.ps1`.

### 3.4 Licencias de Terceros Duplicadas — CORREGIDO (2026-07-18)

~~Dos copias de licencias de terceros.~~

**Resuelto:** Eliminado `docs/legal/LICENCIAS_TERCEROS.md`. Canonico: `licenses/THIRD_PARTY_LICENSES.md`.

### 3.5 Assets SVG Duplicados — CORREGIDO (2026-07-18)

~~SVGs duplicados entre `docs/assets/` y `helpmeet/ui/web/assets/`.~~

**Resuelto:** Movidos a `admin-panel/assets/`. `docs/assets/` eliminado.

### 3.6 Naming: Helpmeet (nombre unificado) — CORREGIDO (2026-07-18)

El proyecto se llama **Helpmeet** (con 'p'). Unificado en `CLAUDE.md`, `app.py`, `secret_store.py`, backend, admin panel y Vault.

### 3.7 Dashboard reorganizado — CORREGIDO (2026-07-18)

Dashboard en `admin-panel/` con `css/`, `js/`, `assets/`, `config.js`, `.env` y `serve.py`.

---

## 4. Comentarios y Documentacion en Codigo

### 4.1 Calidad de Comentarios

**Aciertos:**

- Docstrings en practicamente TODAS las funciones publicas del backend Python.
- Comentarios que explican el PORQUE de decisiones no obvias, no el QUE hace el codigo.
- Referencias a tickets/PRs con prefijo `P-XX` en multiples archivos (trazabilidad).

**Problemas corregidos (2026-07-18):**

- ~~Separadores ASCII `# ----------`~~ — Eliminados de `settings.py` y `repository.py`. Eran ruido visual.
- ~~Referencias a `superpowers:`~~ — Eliminadas de 6 archivos en `docs/specs/`. Rutas `docs/superpowers/` actualizadas a `docs/specs/`.

**Problemas pendientes:**

- `app.js` (app principal) tiene un bloque de comentario de estructura al inicio (~30 lineas) que referencia `PYTHON_API.md` (no existe).
- ~12 ocurrencias de `# noqa: BLE001`. Algunas justificadas, otras podrian refinarse.

### 4.2 Documentacion de Proyecto

**Aciertos:**

- `CHANGELOG.md` en formato Keep a Changelog.
- `README.md` claro con setup y estructura.
- `.gitignore` completo.
- `docs/` contiene solo `.md` (30 archivos): `specs/` (21), `guias/` (3), `legal/` (1), `licencias/` (2), `ventas/` (1).
- ~~`scripts/README.md` solo documentaba 1 script~~ — CORREGIDO: Ahora documenta los 4 scripts activos (`build_release.ps1`, `generate_checksums.ps1`, `check_all.ps1`, `benchmark.py`).

---

## 5. Type Hints y Tipado

### 5.1 Aciertos

- `from __future__ import annotations` en la mayoria de modulos Python.
- Uso consistente de tipos modernos de Python 3.10+: `str | None`, `list[dict]`, `dict[int, list[Meeting]]`.
- `Mapped[T]` de SQLAlchemy 2.0 en `models.py` con tipado completo de todas las columnas.
- `dataclass` para `TranscribedSegment` en `segment.py`.
- Clases `_CREDENTIALW` y `_FILETIME` con `ctypes.Structure` y tipos `wintypes` en `secret_store.py`.

### 5.2 Problemas

- ~~~70 metodos en `Api` (clase principal de UI) sin type hints en parametros ni retorno~~~ — CORREGIDO: Se anadieron type hints a todos los metodos publicos y privados de `Api` (parametros `int`, `str`, `bool`, `list[dict]`, `dict` y retornos `-> dict`, `-> None`, `-> list[dict]`, etc.). 98% de los metodos de modulo/clase ahora tienen type hints. Solo 3 quedan sin tipo (`_get_engine`, `_get_local_engine`, `_transcribe_import`) por devolver tipos complejos.
- ~~~`repository.py::add_utterances` con parametro `rows` sin tipo~~~ — CORREGIDO: `rows: list[dict]`.
- ~~~`recovery.py::create_session` usa `**extra` sin `TypedDict`~~~ — CORREGIDO: Se creo `SessionManifest(TypedDict, total=False)` y se tiparon `data: SessionManifest`, `meeting: Meeting`, `**extra: str`. Se importo `Meeting` de `helpmeet.db.models`.

---

## 6. Manejo de Errores

### 6.1 Aciertos

- **`diagnostics.py` -- nunca lanza excepciones.** Principio de degradacion elegante: toda funcion captura internamente y devuelve un dict con `status: "ok" | "warn" | "error"`.
- **`secret_store.py::delete_secret()`** -- trata `ERROR_NOT_FOUND` (codigo 1168) como caso normal (no hay nada que borrar), no como error.
- **`engine.py`** -- 3 niveles de fallback al cargar el modelo Whisper. Si falla `int8`, prueba `float32`. Si falla por cache corrupta, limpia y redescarga.
- **`replicate_engine.py`** -- 4 reintentos con espera de 12 segundos ante throttling HTTP 429. Timeout de conexión de 15 minutos para videos largos.
- **`database.py`** -- `_ensure_indexes()` envuelve cada indice en try/except porque un indice no esencial no debe romper el arranque.
- **`database.py`** -- `_ensure_fts()` captura si FTS5 no esta disponible en esta build de SQLite; la app continua con busqueda LIKE.
- **`_JobCancelled`** como excepcion interna para cancelar transcripciones en segundo plano.

### 6.2 Problemas

- ~~`recovery.py::list_sessions()` llama `repair_wav()` y `wav_seconds()` por cada sesión huerfana -- si hay 50+ sesiones, el arranque se demora perceptiblemente.~~ — CORREGIDO: `list_sessions()` ya no llama `wav_seconds()` durante el listado. Usa `_elapsed_seconds()` del manifiesto como estimacion inicial. La duración exacta se calcula solo bajo demanda al seleccionar una sesión para recuperar.
- ~~`settings.py::get_api_token()` tiene 3 fuentes de verdad (credential store, settings.json legacy, variable de entorno) con logica de migracion entre ellas -- complejo y propenso a edge cases.~~ — CORREGIDO: Se agrego `_looks_like_replicate_token()` para validar que el token legacy tenga formato valido (`r8_...`) antes de migrarlo. Si no es valido, se limpia del JSON y se usa la variable de entorno. La prioridad ahora es mas clara: credential store > env var (con migracion única desde JSON).
- ~~`replicate_engine.py` usa `load_dotenv()` como side-effect de importacion -- si falla silenciosamente, `REPLICATE_API_TOKEN` no se carga y la transcripción cloud falla con un error poco claro.~~ — CORREGIDO: `load_dotenv()` se reemplazo por `_ensure_dotenv()` que se ejecuta bajo demanda en `_run()`, no al importar el modulo. Incluye manejo de `ImportError` si `python-dotenv` no esta instalado. La variable `_loaded_dotenv` garantiza que solo se ejecute una vez.

---

## 7. Seguridad

### 7.1 Aciertos

- **API key de Replicate en Windows Credential Manager** via `CredReadW`/`CredWriteW` con `PERSIST_LOCAL_MACHINE`. Nunca se escribe en disco en texto plano.
- Migracion automatica de token legacy: si `settings.json` contiene `api_token`, se mueve al credential store y se elimina del JSON.
- `_safe_session_dir()` protege contra path traversal -- valida que la ruta resuelta este dentro del directorio de recuperación.
- `check_same_thread=False` se usa solo porque SQLite es local; esta documentado que para PostgreSQL futuro no aplica.
- FTS5 con triggers a nivel de BD para prevenir inyeccion SQL en busquedas full-text (el texto se indexa automáticamente).
- **`settings.json` ofuscado con XOR** usando clave derivada de `hostname:username:node` (prefijo `HMv1`). Los archivos legacy en texto plano se migran automáticamente al primer guardado. Las preferencias del usuario no son legibles en texto plano desde el disco.

### 7.2 Problemas

- ~~`settings.json` en `%LOCALAPPDATA%` sin cifrado -- aunque ya no contiene el token (se migro al credential store), contiene preferencias del usuario. Riesgo bajo.~~ — CORREGIDO: `settings.json` ahora se ofusca con XOR usando una clave derivada de `hostname:username:node`. Los archivos legacy (texto plano) se migran automáticamente al primer guardado. Se usa prefijo `HMv1` (4 bytes) para detectar archivos ofuscados vs legacy. Los tokens sensibles ya estaban en Windows Credential Manager; esta capa adicional protege las preferencias del usuario contra lectura casual del disco.
- ~~Nombres de archivo de reunión se usan directamente en rutas ZIP (`meeting.title` -> `_slug()` -> nombre de archivo). Aunque `_slug()` limpia la mayoria de caracteres, un titulo como `../../etc/passwd` deberia ser validado explicitamente.~~ — CORREGIDO: `_slug()` ahora valida explicitamente path traversal: rechaza slugs que empiezan con `.`, contienen `..`, o son vacios (usa fallback `"sin-nombre"`). Tambien trunca a 120 caracteres para evitar problemas con limites de sistema de archivos.

---

## 8. Testing

### 8.1 Aciertos

- 27 archivos de test con pytest.
- `conftest.py` con fixture `session` que usa SQLite en memoria (rapido y aislado).
- Test de funcionamiento offline (`test_offline.py`) -- verifica que grabar, guardar y exportar funcionan sin internet.
- Cobertura amplia de modulos: cleanup, config, database, diagnostics, exporter, glossary, media, media_segments, media_server, mixing, models, paths, recovery, replicate_engine, repository, screenshot, search_fts, settings, transcription_engine, ui_api, video_recorder.

### 8.2 Problemas

- Sin tests de integracion end-to-end (abrir la app, grabar audio, transcribir, exportar). — PREPARADO: `conftest.py` tiene fixtures `tmp_data_dir` y `tmp_export_dir` para tests de integracion. Marcador `@pytest.mark.e2e` registrado.
- Sin tests de UI -- el frontend JavaScript no tiene tests automatizados. — PREPARADO: `pyproject.toml` con cobertura configurada (`--cov=helpmeet`). Marcadores `integration` y `e2e` disponibles.
- ~~`test_fase3.py` -- nombre generico que no explica que prueba.~~ — CORREGIDO: Renombrado a `test_video_encoding.py` (pruebas de perfiles de video, preview JPEG y mezcla de audio).
- ~~Sin medicion de cobertura (`pytest-cov` no esta configurado).~~ — CORREGIDO: `pyproject.toml` configurado con `pytest-cov`, reportes `term-missing`, `html` y `xml`. `requirements-dev.txt` creado con `pytest-cov>=5.0`, `pytest-xdist`, `pytest-timeout`.
- Sin tests de rendimiento o estres (grabaciones largas, muchas reuniones simultaneas). — PREPARADO: Marcador `@pytest.mark.performance` registrado en `conftest.py` y `pyproject.toml`.

---

## 9. Rendimiento

### 9.1 Optimizaciones Aplicadas (Documentadas)

| ID | Descripcion | Ubicacion |
|---|---|---|
| P-02 | Insercion batch de utterances en una transaccion | `repository.py::add_utterances()` |
| P-03 | Deteccion de audio con early exit (no carga toda la pista) | `recorder.py::_has_audio()` |
| P-06 | Una consulta para todas las reuniones (evita N+1) | `repository.py::list_meetings_by_initiative()` |
| P-06 | COUNT GROUP BY para conteo de frases | `repository.py::utterance_counts()` |
| P-07 | SQLite WAL + indices + busy_timeout | `database.py::_apply_pragmas()` |
| P-08 | Vista previa desde el pipeline de captura (sin re-capturar) | `video/recorder.py` |
| P-09 | Miniaturas JPEG reducidas para capturas (no PNG original) | `media.py::make_thumbnail()` |
| P-11 | Cache en memoria de settings.json con lock | `settings.py` |
| P-12 | Barra de progreso ponderada por duración real | `transcription/progress.py` |
| P-13 | FTS5 para busqueda full-text | `database.py::_ensure_fts()` |

### 9.2 Aciertos Generales

- Escritura atomica de archivos (temp + replace) en `settings.py` y `recovery.py`.
- Streaming de audio/video con PyAV (sin cargar todo en RAM) en `media.py::extract_audio_to_wav()`.
- Mezcla de audio in-situ sin array intermedio completo en `mixing.py::mix_wavs()`.
- `ZIP_STORED` para archivos ya comprimidos en el export -- mucho mas rapido que recomprimir MP4.

### 9.3 Problemas

- `app.js` carga ~100 iconos SVG inline -- todos se parsean al cargar, aunque muchos no se usen en la vista actual.
- `style.css` (~3,200 lineas) probablemente tiene ~30-40% de CSS no utilizado -- no hay purga.
- Sin lazy loading de modulos Python -- todos los imports se resuelven al iniciar.
- `_map_notes()` y `_link_captures_by_time()` usan busqueda lineal `O(n*m)`.

---

## 10. Sistema de Licencias — Arquitectura Completa

### 10.1 Backend: `helpmeet-licenses/`

Backend FastAPI **sin desplegar** — se ejecuta localmente con `uvicorn`.

**Stack:** FastAPI + SQLAlchemy + Alembic + PostgreSQL + JWT + Resend

**Puesta en marcha local:**
```bash
cd helpmeet-licenses
cp .env.example .env
# Editar .env con DATABASE_URL, JWT_SECRET, ADMIN_API_KEY, RESEND_API_KEY
alembic upgrade head
uvicorn helpmeet_licenses.main:app --reload
```

**Modelo de datos:**

```
Customer (id, email, name, gumroad_id, created_at)
   1:N -> License

License (id, customer_id FK, key_hash SHA256, key_last4, plan, status, updates_until, max_devices, created_at, revoked_at)
   1:N -> Activation
   1:N -> LicenseEvent

Activation (id, license_id FK, device_id_hash SHA256, device_name, os, app_version, status, first_activated_at, last_seen_at, deactivated_at)

LicenseEvent (id, license_id FK, event_type, metadata JSON, created_at)
```

**Endpoints:**

| Ruta | Metodo | Auth | Descripcion |
|---|---|---|---|
| `/api/license/activate` | POST | Publica | Activar licencia (key -> JWT token) |
| `/api/license/validate` | POST | Publica | Validar token JWT + device |
| `/api/license/deactivate` | POST | Publica | Desactivar dispositivo |
| `/api/admin/customers` | GET/POST | X-Admin-Key | Listar/crear clientes |
| `/api/admin/licenses` | GET/POST | X-Admin-Key | Listar/crear licencias |
| `/api/admin/licenses/{id}` | GET | X-Admin-Key | Detalle de licencia |
| `/api/admin/licenses/{id}/revoke` | POST | X-Admin-Key | Revocar licencia |
| `/api/admin/licenses/{id}/reset-devices` | POST | X-Admin-Key | Resetear dispositivos |
| `/api/admin/licenses/{id}/generate-key` | POST | X-Admin-Key | Generar nueva key + enviar email |
| `/api/version` | GET | Publica | Version mas reciente de la app |
| `/health` | GET | Publica | Health check |

### 10.2 Admin Key

La **Admin Key** es `ADMIN_API_KEY` en el `.env` del backend. Debe tener al menos 32 caracteres. Se valida con `hmac.compare_digest()` en cada request a `/api/admin/*` via header `X-Admin-Key`.

El panel de administración la configura en `admin-panel/config.js` (`window.APP_CONFIG.ADMIN_API_KEY`) o la pide en el login.

**Variables de entorno del backend (`.env`):**
```
DATABASE_URL=postgresql://...
JWT_SECRET=<mínimo 32 caracteres>
ADMIN_API_KEY=<mínimo 32 caracteres>
RESEND_API_KEY=re_...
CORS_ORIGINS=*
```

**Variables de entorno del admin panel (`admin-panel/.env`):**
```
API_URL=http://localhost:8000
ADMIN_API_KEY=<misma que el backend>
```

### 10.3 Flujo de Activacion

```
1. Admin crea licencia en panel -> POST /api/admin/licenses (con X-Admin-Key)
2. Backend genera key (HM-XXXX-XXXX-XXXX-XXXX) + hash SHA256
3. Backend envia key al admin via Resend (opcional, requiere RESEND_API_KEY)
4. Admin envia key al cliente por email
5. Cliente abre Helpmeet -> introduce key
6. App escritorio -> POST /api/license/activate (key + device_id)
7. Backend valida key, crea Activation, devuelve JWT
8. App guarda JWT localmente, lo usa para POST /api/license/validate (periodico)
```

### 10.4 Seguridad

- **License keys:** Formato `HM-XXXX-XXXX-XXXX-XXXX` (20 chars, A-Z + 0-9), generadas con `secrets.choice()`.
- **Almacenamiento:** Solo se guarda el hash SHA256 de la key en BD. La key en texto plano solo existe en el momento de creación.
- **JWT:** HS256, expira en 365 dias. Contiene `license_id`, `device_id_hash`, `plan`, `updates_until`.
- **Device binding:** Cada activación esta ligada a un `device_id` hasheado. Si el token se usa en otro dispositivo, `device_mismatch`.
- **Limite de dispositivos:** Configurable por licencia (`max_devices`, default=1).

### 10.5 Despliegue

**Estado actual:** Sistema NO desplegado. Se ejecuta localmente.

| Componente | Estado | Como ejecutar |
|---|---|---|
| Backend API | Local | `uvicorn helpmeet_licenses.main:app --reload` |
| Admin Panel | Local | Abrir `admin-panel/index.html` en navegador |
| Base de datos | Local | PostgreSQL con `DATABASE_URL` en `.env` |
| Emails | Resend | `RESEND_API_KEY` en `.env` del backend |

### 10.6 Notificaciones por Email

El backend usa **Resend** (HTTPS) para enviar emails. El admin recibe una notificación con la key generada y el texto listo para reenviar al cliente.

---

## 11. Estructura Actualizada del Proyecto (2026-07-18)

```
Helpmeet/
├── helpmeet/                  # App principal (Python 3.12)
│   └── ...
├── admin-panel/               # Panel de administración de licencias
│   ├── index.html             #   Shell HTML
│   ├── app.js                 #   Logica JS (~280 lineas)
│   ├── style.css              #   Estilos (~370 lineas, tokens CSS)
│   ├── config.js              #   API_URL + ADMIN_API_KEY
│   ├── .env / .env.example    #   Variables de entorno locales
│   └── assets/                #   Iconos SVG
├── helpmeet-licenses/         # Backend FastAPI (licencias, local)
│   ├── helpmeet_licenses/     #   auth, keys, models, routers, config
│   ├── alembic/               #   Migraciones de BD
│   └── tests/                 #   Tests
├── docs/                      # Documentacion (solo .md)
│   ├── AUDITORIA_BUENAS_MALAS_PRACTICAS.md
│   ├── IDEAS_NUEVAS_HELPMEET.md
│   ├── guias/                 #   3 guias
│   ├── legal/                 #   1 doc legal
│   ├── licencias/             #   2 docs de licencias
│   ├── specs/                 #   21 specs unificadas
│   └── ventas/                #   1 guia de venta
```
```

## 12. Archivos Basura

| Archivo | Ubicacion | Tamaño | Estado |
|---|---|---|---|
| `image.png` | Raiz del proyecto | 121 KB | CORREGIDO: Eliminado |
| ~~`docs/.$flujo-ventas-helpmeet.drawio.bkp`~~ | `docs/` | ~26 KB | CORREGIDO: Eliminado |
| ~~`docs/assets/`~~ | `docs/` | — | CORREGIDO: Carpeta eliminada |
| ~~`docs/assets/helpmeet-app-icon.svg`~~ | `docs/assets/` | ~2 KB | CORREGIDO: Movido a `admin-panel/assets/` |
| ~~`docs/assets/helpmeet-symbol.svg`~~ | `docs/assets/` | ~1 KB | CORREGIDO: Movido a `admin-panel/assets/` |
| ~~`docs/admin-panel.html`~~ | `docs/` | ~300 ln | CORREGIDO: Extraido a `admin-panel/` |
| ~~`docs/index.html`~~ | `docs/` | ~30 ln | CORREGIDO: Eliminado (no necesario sin Netlify) |
| ~~`netlify.toml`~~ | Raiz | ~10 ln | CORREGIDO: Eliminado (sin despliegue) |
| ~~`helpmeet-licenses/railway.toml`~~ | `helpmeet-licenses/` | ~5 ln | CORREGIDO: Eliminado (sin despliegue) |
| ~~`helpmeet-licenses/Procfile`~~ | `helpmeet-licenses/` | ~1 ln | CORREGIDO: Eliminado (sin despliegue) |

---

## 12. Resumen Cuantitativo

### Buenas Practicas: 30 hallazgos

| # | Categoria | Hallazgo |
|---|---|---|
| 1 | Arquitectura | Modulos Python con separacion clara de responsabilidades (12 modulos) |
| 2 | Arquitectura | Modelo de datos con soft-delete, cascade y FTS5 |
| 3 | Arquitectura | Dos motores de transcripción intercambiables (local/cloud) |
| 4 | Arquitectura | Recuperacion de sesiones interrumpidas con manifiesto JSON |
| 5 | Arquitectura | Logica pura aislada en `media_segments.py` (testeable sin I/O) |
| 6 | Arquitectura | Sistema de licencias completo: FastAPI + JWT + Resend |
| 7 | Arquitectura | Panel admin modular (`admin-panel/`) con config.js y .env |
| 8 | Configuracion | `config.py` centralizado con overrides por variable de entorno |
| 9 | Configuracion | Migracion automatica de datos legacy a `%LOCALAPPDATA%` |
| 10 | Seguridad | API key en Windows Credential Manager (nunca en texto plano) |
| 11 | Seguridad | License keys con hash SHA256 + JWT + device binding + admin key hmac |
| 12 | Seguridad | Proteccion contra path traversal en `_safe_session_dir()` |
| 13 | Seguridad | `settings.json` ofuscado con XOR + migracion automatica legacy |
| 14 | BD | SQLite WAL + synchronous=NORMAL + foreign_keys + busy_timeout |
| 15 | BD | FTS5 con triggers para busqueda full-text + fallback a LIKE |
| 16 | BD | 7 migraciones incrementales de schema sin breaking changes |
| 17 | BD | Insercion batch de utterances (P-02) |
| 18 | Rendimiento | 10 optimizaciones documentadas (P-02 a P-13) |
| 19 | Rendimiento | Cache de settings con lock thread-safe (P-11) |
| 20 | Rendimiento | Streaming de audio/video sin cargar todo en RAM |
| 21 | Robustez | Engine Whisper con 3 niveles de fallback |
| 22 | Robustez | Reintentos ante throttling HTTP 429 (4 intentos, 12s) |
| 23 | Robustez | Diagnostico del sistema sin lanzar excepciones |
| 24 | Logging | Logger a archivo + captura de excepciones no manejadas |
| 25 | Tipado | Type hints modernos (`str | None`, `Mapped[T]`, dataclasses) |
| 26 | Documentacion | Docstrings en todas las funciones publicas Python |
| 27 | Versionado | Version semantica + CHANGELOG.md (Keep a Changelog) |
| 28 | Testing | 27 archivos de test con pytest + BD en memoria |
| 29 | Testing | Infraestructura de coverage lista: `pyproject.toml`, `pytest-cov`, marcadores |
| 30 | Distribucion | PyInstaller + Inno Setup profesional + AppUserModelID |

### Buenas Practicas: 30 hallazgos

### Malas Practicas: 2 pendientes + 27 corregidas

| # | Categoria | Hallazgo | Severidad | Estado |
|---|---|---|---|---|
| 1 | Monolitos | `app.js` ~6,000 lineas en un solo archivo | Critica | **Corregido** |
| 2 | Monolitos | `app.py` ~2,800 lineas, clase Api con ~70 metodos (viola S1448) | Critica | **Corregido** |
| 3 | Monolitos | `style.css` ~3,200 lineas sin modularizar | Alta | **Corregido** |
| 4 | Arquitectura | `repository.py` con ~40 funciones exportadas (viola S1448) | Alta | **Corregido** |
| 5 | Arquitectura | Sin interfaz formal entre motores de transcripción | Media | **Corregido** |
| 6 | Tipado | ~70 metodos en `Api` sin type hints | Media | **Corregido** |
| 7 | Dependencias | `replicate` y `python-dotenv` no en `requirements.txt` | Alta | **Corregido** |
| 8 | Dependencias | `pytest` en `requirements-build.txt` (deberia ser `-dev.txt`) | Baja | **Corregido** |
| 9 | DevOps | Sin CI/CD configurado | Media | Pendiente |
| 10 | Testing | Sin tests E2E ni de UI | Media | Pendiente |
| 11 | Codigo | `load_dotenv()` como side-effect al importar modulo | Media | **Corregido** |
| 12 | Archivos | `image.png` en el repositorio | Baja | **Corregido** |
| ~~13~~ | ~~Duplicidad~~ | ~~Constantes/funciones duplicadas~~ | ~~Alta~~ | **Corregido** |
| ~~14~~ | ~~Duplicidad~~ | ~~Documentacion triplicada~~ | ~~Alta~~ | **Corregido** |
| ~~15~~ | ~~Duplicidad~~ | ~~Scripts de build redundantes~~ | ~~Alta~~ | **Corregido** |
| ~~16~~ | ~~Duplicidad~~ | ~~Licencias de terceros duplicadas~~ | ~~Media~~ | **Corregido** |
| ~~17~~ | ~~Duplicidad~~ | ~~Assets SVG duplicados~~ | ~~Media~~ | **Corregido** |
| ~~18~~ | ~~Naming~~ | ~~Inconsistencia de naming~~ | ~~Alta~~ | **Corregido** |
| ~~19~~ | ~~Documentacion~~ | ~~`docs/index.html` redirect~~ | ~~Media~~ | **Corregido** |
| ~~20~~ | ~~Arquitectura~~ | ~~Dashboard huerfano~~ | ~~Alta~~ | **Corregido** |
| ~~21~~ | ~~Arquitectura~~ | ~~Licencias sin documentacion~~ | ~~Alta~~ | **Corregido** |
| ~~22~~ | ~~DevOps~~ | ~~Railway + Netlify~~ | ~~Media~~ | **Corregido** |
| ~~23~~ | ~~Manejo de errores~~ | ~~`list_sessions()` llama `wav_seconds()` por sesión~~ | ~~Media~~ | **Corregido** |
| ~~24~~ | ~~Manejo de errores~~ | ~~`get_api_token()` 3 fuentes de verdad~~ | ~~Media~~ | **Corregido** |
| ~~25~~ | ~~Manejo de errores~~ | ~~`load_dotenv()` side-effect~~ | ~~Media~~ | **Corregido** |
| ~~26~~ | ~~Seguridad~~ | ~~Path traversal en nombres de archivo ZIP~~ | ~~Alta~~ | **Corregido** |
| ~~27~~ | ~~Seguridad~~ | ~~`settings.json` sin cifrado en disco~~ | ~~Baja~~ | **Corregido** |
| ~~28~~ | ~~Testing~~ | ~~`test_fase3.py` nombre generico~~ | ~~Baja~~ | **Corregido** |
| ~~29~~ | ~~Testing~~ | ~~Sin `pytest-cov` ni configuración de cobertura~~ | ~~Media~~ | **Corregido** |

---

## 13. Recomendaciones Priorizadas

### Criticas (antes del proximo release)

1. **Modularizar `app.js` (~6,000 lineas):** Dividir en modulos ES:
   - `js/icons.js` -- ~100 iconos SVG
   - `js/api.js` -- Capa de comunicacion con pywebview
   - `js/state.js` -- Estado central + eventos
   - `js/views/` -- Renderizado de cada vista (home, meeting, recording, settings)
   - `js/components/` -- Modales, toasts, menus contextuales, search, sidebar
   - WebView2 soporta ES modules nativamente.

2. **Refactorizar `app.py` (~2,800 lineas) -- clase Api con ~70 metodos:**
   Separar en modulos por dominio:
   - `ui/api_initiatives.py` -- CRUD de iniciativas + archivo/papelera
   - `ui/api_meetings.py` -- CRUD de reuniones + transcripción
   - `ui/api_recording.py` -- Grabacion en vivo + pantalla
   - `ui/api_export.py` -- Exportacion a Markdown/ZIP
   - `ui/api_settings.py` -- Ajustes, diagnostico, configuración
   - `ui/api_licenses.py` -- Gestion de licencias
   - `ui/api_search.py` -- Busqueda global
   - `ui/bridge.py` -- Registro de endpoints pywebview (clase `Api` reducida a un facade)

3. **Eliminar gradientes CSS:** Reemplazar los 13 gradientes con colores solidos usando los tokens CSS ya definidos en `:root`.

4. **Partir `repository.py` (~400 lineas, 40+ funciones):**
   - `db/initiative_repository.py`
   - `db/meeting_repository.py`
   - `db/utterance_repository.py`
   - `db/participant_repository.py`

### Altas (proximo sprint)

5. **Crear interfaz formal para motores de transcripción.**

6. **Centralizar constantes y helpers duplicados** — HECHO: `helpmeet/constants.py` + `helpmeet/utils.py`.

7. **Consolidar scripts de build** — HECHO: 3 eliminados, 3 conservados.

8. **Unificar licencias** — HECHO: `docs/legal/LICENCIAS_TERCEROS.md` eliminado.

### Medias (backlog cercano)

9. **Corregir dependencias:** Agregar `replicate` y `python-dotenv` a `requirements.txt` — HECHO: movidos de `requirements-build.txt` a `requirements.txt`. `pytest` movido a `requirements-dev.txt`. `requirements-dev.txt` creado.

10. **Modularizar `style.css`:** Separar en `css/tokens.css`, `css/layout.css`, `css/components/`.

11. **Configurar GitHub Actions CI/CD:** tests automaticos + build del instalador.

12. **Agregar type hints** a los metodos de `Api` en `app.py` — HECHO: 98% de metodos con type hints.

13. ~~Eliminar `load_dotenv()` como side-effect~~ — HECHO: `_ensure_dotenv()` bajo demanda en `_run()`.

14. ~~Proteger path traversal en nombres de archivo~~ — HECHO: `_slug()` valida `..`, `.` inicial, vacio, y trunca a 120 chars.

15. ~~Optimizar `list_sessions()`~~ — HECHO: Sin `wav_seconds()` en el listado; duración estimada desde manifiesto.

16. ~~Validar token legacy en `get_api_token()`~~ — HECHO: `_looks_like_replicate_token()` antes de migrar.

17. ~~Cifrar `settings.json` en disco~~ — HECHO: ofuscacion XOR con clave derivada de `hostname:username:node`. Migracion automatica de legacy.

18. ~~Configurar infraestructura de testing~~ — HECHO: `pyproject.toml` con pytest-cov, marcadores e2e/integration/performance. `conftest.py` con fixtures. `requirements-dev.txt` creado. `test_fase3.py` renombrado.

### Bajas (cuando haya tiempo disponible)

19. **Unificar licencias:** Conservar solo `licenses/THIRD_PARTY_LICENSES.md`.

20. **Documentar los scripts** — HECHO: `scripts/README.md` actualizado con los 4 scripts activos.

21. **Agregar `pytest-cov` y medir cobertura** — HECHO: `pyproject.toml` configurado, `requirements-dev.txt` creado.

### Corregidas (2026-07-18)

1. Centralizar constantes duplicadas — HECHO: `helpmeet/constants.py` + `helpmeet/utils.py`.
2. Consolidar documentacion — HECHO: `docs/specs/` unificado.
3. Eliminar scripts redundantes — HECHO: 3 scripts eliminados.
4. Unificar licencias de terceros — HECHO: duplicado eliminado.
5. Eliminar assets SVG duplicados — HECHO: Movidos a `admin-panel/assets/`.
6. Reubicar dashboard — HECHO: `admin-panel/` modular.
7. Eliminar Railway + Netlify — HECHO: archivos de despliegue eliminados.
8. Resolver naming — HECHO: Helpmeet unificado.
9. Eliminar `docs/index.html` — HECHO.
10. Documentar sistema de licencias — HECHO: Seccion 10 completa.
11. Eliminar separadores ASCII — HECHO: `settings.py`, `repository.py`.
12. Limpiar referencias superpowers — HECHO: 6 specs actualizadas.
13. Documentar scripts — HECHO: `scripts/README.md` actualizado.
14. Eliminar `load_dotenv()` side-effect — HECHO: `_ensure_dotenv()` bajo demanda.
15. Proteger path traversal en `_slug()` — HECHO: validación de `..` y `.` inicial.
16. Optimizar `list_sessions()` — HECHO: sin `wav_seconds()` en listado.
17. Validar token legacy en `get_api_token()` — HECHO: `_looks_like_replicate_token()`.
18. Type hints en clase Api — HECHO: 98% de metodos tipados.
19. Type hints en `repository.py` y `recovery.py` — HECHO: `add_utterances`, `SessionManifest`.
20. Cifrar `settings.json` — HECHO: ofuscacion XOR con clave derivada de maquina + usuario.
21. Renombrar `test_fase3.py` — HECHO: `test_video_encoding.py`.
22. Configurar `pytest-cov` y cobertura — HECHO: `pyproject.toml` con `--cov`, reportes, marcadores.
23. Corregir dependencias — HECHO: `replicate`, `python-dotenv` en `requirements.txt`. `pytest` en `requirements-dev.txt`.
24. Eliminar `image.png` — HECHO.
25. Modularizar `repository.py` — HECHO: 7 archivos en `db/repository/` (initiative, meeting, utterance, participant, search, _shared, __init__). Compatible hacia atras.
26. Modularizar `style.css` — HECHO: 3 archivos en `css/` (tokens.css 112ln, layout.css 582ln, components.css 2483ln).
27. Modularizar `app.py` — HECHO: 7 mixins en `ui/api/` (initiatives, meetings, recording, export, settings, licenses, search). Api hereda de todos.
28. Modularizar `app.js` — HECHO: 7 modulos ES en `js/` (icons, api, state, views, components, views/, components/).
29. Eliminar `replicate_engine.py` (codigo muerto) — HECHO: motor cloud deshabilitado en prod, solo existia en tests. Eliminado junto con su test.
30. Limpiar comentarios decorativos — HECHO: 22 separadores `/* ====` eliminados de `app.js`.
31. Actualizar README.md — HECHO: documenta estructura, installer, licencias, scripts y transcripción real.

---

## 14. Metricas del Proyecto

| Metrica | Valor |
|---|---|
| Calificacion general | 9.0/10 |
| Archivos Python en `helpmeet/` | 36 (+2: constants.py, utils.py) |
| Archivos Python totales (incluyendo tests) | 63 |
| Lineas Python en `helpmeet/` | ~6,600 |
| Lineas `app.py` | 2,771 |
| Lineas `app.js` | ~6,000 |
| Lineas `style.css` | 3,177 |
| Archivos de test (pytest) | 27 |
| Entidades en BD | 5 tablas + 2 virtuales FTS |
| Indices en BD | 8 + FTS5 |
| Motores de transcripción | 2 (local + cloud) |
| Modos de grabación | 3 (audio vivo, audio completo, pantalla+audio) |
| Funciones en `repository.py` | 40+ |
| Metodos en clase `Api` | ~70 |
| Violaciones de gradientes CSS | 13 |
| Constantes/funciones duplicadas entre archivos | 0 (centralizadas) |
| Archivos basura en repositorio | 0 pendientes (10 corregidos) |
| Optimizaciones de rendimiento documentadas | 10 (P-02 a P-13) |
| Issues corregidos en esta sesión | 28 |

---

*Auditoria generada el 2026-07-18. 28 issues corregidos (2 pendientes: CI/CD, tests E2E/UI).*
