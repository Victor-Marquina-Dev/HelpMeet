# Diseño: Recorte de vídeo para transcribir solo la parte importante

**Fecha:** 2026-07-02
**Estado:** diseño aprobado (pendiente de plan de implementación)
**Tipo:** nueva funcionalidad (UI + backend)

---

## 1. Objetivo

Permitir que, en una grabación de pantalla, el usuario **recorte visualmente** un
tramo (o varios) del vídeo y transcriba **solo esa parte**, en lugar de procesar el
vídeo completo. Beneficio: ahorra tiempo y procesamiento cuando solo interesa un
fragmento de la reunión.

## 2. Experiencia de usuario (decisiones aprobadas)

En la tarjeta de una grabación (`videoPanel`), el botón principal pasa a ser
**"Recortar y transcribir"**. Al pulsarlo, la tarjeta se abre como un **acordeón** con un
recortador estilo CapCut:

- **Reproductor de vídeo** embebido, que se reproduce **dentro de la app**.
- **Línea de tiempo con miniaturas** del vídeo (fotogramas equiespaciados).
- **Manijas** de inicio/fin para marcar el tramo, más un cursor de reproducción.
- El tramo marcado aparece como **"Trozo 1 · mm:ss – mm:ss"**, con un botón
  **"+ añadir otro trozo"** para marcar varios.
- Pie con el **total a transcribir** ("1 min 25 s de 5:26 · ahorras ~74%") y el botón
  **"Transcribir selección →"**.

Decisiones cerradas en el brainstorming:

| Decisión | Elección |
|---|---|
| Estilo del recortador | Vídeo dentro de la app (tipo CapCut) |
| Nº de trozos | Uno por defecto; se pueden **añadir varios** |
| Línea de tiempo | **Con miniaturas** del vídeo |
| Qué hace el recorte | **Solo** afecta a la transcripción; el vídeo original no se modifica |

Comportamiento por defecto: al abrir el recortador, la selección inicial es **todo el
vídeo** (0:00 – fin). Así, quien solo quiera transcribir todo abre y pulsa "Transcribir
selección" sin tocar nada; quien quiera recortar mueve las manijas. Para grabaciones ya
transcritas, el botón es **"Retranscribir"** y abre el mismo recortador.

## 3. Viabilidad técnica confirmada

- El vídeo se graba en **H.264 + AAC** (`config.VIDEO_CODEC = "libx264"`), formato que
  **WebView2 reproduce de forma nativa**. → El reproductor embebido es viable.
- Hoy la UI se carga desde archivos locales (`webview.create_window(..., index.html)`) y
  por eso el vídeo se abre en un reproductor externo. Para reproducirlo **dentro** hace
  falta servir el mp4 por HTTP local con soporte de **peticiones por rango (Range)**, que
  es lo que el elemento `<video>` necesita para hacer *seek*.
- Las miniaturas y el recorte de audio se generan con **PyAV**, ya usado en el proyecto
  (`helpmeet/media.py`, `helpmeet/video/preview.py::_encode_jpeg`).

## 4. Arquitectura y componentes

El trabajo se descompone en unidades con una única responsabilidad cada una:

### 4.1 Servidor de media local (nuevo) — `helpmeet/media_server.py`
- **Qué hace:** sirve por HTTP, solo en `127.0.0.1` y en un puerto libre, los vídeos de
  las reuniones del usuario, con soporte de `Range` para permitir *seek*.
- **Interfaz:** `start() -> base_url`, `url_for(meeting_id) -> str`.
- **Seguridad:** únicamente localhost; solo resuelve rutas de vídeos válidos por
  `meeting_id` (nunca sirve rutas arbitrarias del disco).
- **Depende de:** el repositorio de reuniones (para resolver `meeting_id → video_path`).

### 4.2 Miniaturas de vídeo (nuevo método en `Api`) — `helpmeet/ui/app.py`
- **Qué hace:** `get_video_thumbnails(meeting_id, count)` extrae `count` fotogramas
  equiespaciados del vídeo y los devuelve como JPEG en base64.
- **Depende de:** PyAV y `_encode_jpeg` (patrón ya usado en `get_monitor_thumbnails`).

### 4.3 Recorte de audio por tramos (nuevo en `helpmeet/media.py`)
- **Qué hace:** `extract_audio_segments_to_wav(src_path, segments, dest_path) -> str`
  extrae el audio de cada `(inicio, fin)`, los **concatena** en un solo WAV y lo devuelve.
- **Detalle:** usa `container.seek()` para no decodificar el vídeo entero.
- **Depende de:** PyAV (reutiliza el patrón de `extract_audio_to_wav`).

### 4.4 Transcripción con mapeo de tiempos — `helpmeet/ui/app.py::_transcribe_video`
- **Qué hace:** acepta `segments` (lista de `[inicio, fin]` en segundos). Extrae el audio
  de esos tramos, lo transcribe, y **remapea las marcas de tiempo** de cada frase
  transcrita al tiempo del **vídeo original** (suma el desfase del tramo correspondiente).
- **Por qué importa:** las frases transcritas salen con tiempos relativos al audio
  recortado; sin remapeo, los saltos de "ir al minuto X" del vídeo no cuadrarían.

### 4.5 Interfaz del recortador (frontend) — `helpmeet/ui/web/app.js` + `style.css`
- **Qué hace:** amplía `videoPanel(t)` con el acordeón: `<video>` apuntando a la URL del
  servidor de media, tira de miniaturas, manijas arrastrables, lista de trozos y botón de
  transcribir. Al confirmar, llama a `api.transcribeMeetingVideo(mid, force, segments)`.
- **Depende de:** 4.1 (URL del vídeo), 4.2 (miniaturas), 4.4 (transcripción con tramos).

## 5. Flujo de datos

1. El usuario abre una reunión con grabación → tarjeta con **"Recortar y transcribir"**.
2. Clic → se abre el acordeón: el JS pide las miniaturas (`get_video_thumbnails`) y apunta
   el `<video>` a `mediaServerUrl/media/{meeting_id}`.
3. El usuario reproduce, arrastra las manijas y define uno o varios trozos.
4. Clic en **"Transcribir selección →"** → `transcribeMeetingVideo(mid, force, segments)`.
5. El backend recorta el audio de los tramos (4.3), transcribe (4.4) y **remapea los
   tiempos** al vídeo original; guarda las frases resultantes.
6. La UI refresca y muestra la transcripción, con tiempos que cuadran con el vídeo.

## 6. Modelo de datos

- **Segmento (frontend → backend):** `{ start: número_segundos, end: número_segundos }`.
- **Selección:** lista ordenada de segmentos `[{start, end}, ...]`. Un solo trozo es una
  lista de un elemento; "todo el vídeo" es `[{start: 0, end: duración}]`.
- No se añaden columnas nuevas en la base de datos: las frases transcritas se guardan como
  hoy, con sus tiempos ya remapeados al vídeo original.

## 7. Manejo de errores y casos borde

- **Vídeo sin pista de audio:** mensaje claro, no se transcribe.
- **Tramo inválido** (fin ≤ inicio, o fuera de la duración): se valida en frontend
  (no deja crear el trozo) y en backend (se ignora/recorta a límites válidos).
- **Tramos solapados o desordenados:** el backend los **normaliza** (ordena y fusiona
  solapamientos) antes de extraer el audio.
- **Selección vacía:** el botón "Transcribir selección" queda deshabilitado.
- **Puerto ocupado** en el servidor de media: se elige otro puerto libre al arrancar.
- **Vídeo antiguo con códec no reproducible por WebView2:** el `<video>` mostrará un aviso
  y el usuario podrá abrirlo en el reproductor externo (como hoy); el recorte por tiempos
  seguirá funcionando aunque no se vea la previsualización.
- **Compatibilidad:** el flujo actual (transcribir todo) se conserva como el caso por
  defecto del recortador (selección = vídeo completo).

## 8. Pruebas

- **Unidad — `extract_audio_segments_to_wav`:** la duración del WAV resultante ≈ suma de
  las duraciones de los tramos; con varios tramos, se concatenan en orden.
- **Unidad — remapeo de tiempos:** una frase en el tiempo local `t` del tramo *k* se
  convierte al tiempo global correcto del vídeo original.
- **Unidad — normalización de segmentos:** tramos solapados/desordenados se fusionan y
  ordenan correctamente; tramos fuera de rango se recortan.
- **Servidor de media:** una petición con cabecera `Range` devuelve `206 Partial Content`
  y el trozo correcto; una ruta a un `meeting_id` inexistente devuelve `404`.

## 9. Fuera de alcance (por ahora)

- Guardar/exportar un **vídeo recortado** (aquí el recorte solo alimenta la transcripción).
- Edición avanzada tipo CapCut (transiciones, unir clips de vídeos distintos, subtítulos
  quemados).
- Recorte de reuniones que solo tienen audio (sin vídeo) — se puede abordar después.

## 10. Archivos afectados (resumen)

| Archivo | Cambio |
|---|---|
| `helpmeet/media_server.py` | **Nuevo:** servidor HTTP local con soporte Range |
| `helpmeet/media.py` | **Nuevo:** `extract_audio_segments_to_wav` + extracción de miniaturas |
| `helpmeet/ui/app.py` | `get_video_thumbnails`, arranque del servidor de media, `transcribe_meeting_video`/`_transcribe_video` aceptan `segments` + remapeo de tiempos |
| `helpmeet/ui/web/app.js` | Recortador (acordeón, timeline, manijas, trozos) en `videoPanel` |
| `helpmeet/ui/web/style.css` | Estilos del recortador |
| `tests/` | Pruebas de recorte de audio, remapeo y normalización |
