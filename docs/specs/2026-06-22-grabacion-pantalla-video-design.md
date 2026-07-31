# Grabación de pantalla con video (estilo OBS) — Diseño

**Fecha:** 2026-06-22
**Estado:** Aprobado el diseño general; pendiente revisión del usuario antes del plan.

## Objetivo

Añadir un botón **🎥 Grabar pantalla** que grabe un monitor en video `.mp4` **con sonido** (audio del sistema + micrófono) y lo guarde como entregable en la carpeta de la iniciativa seleccionada. Independiente de la transcripción.

## Decisiones del usuario (del brainstorming)

| Decisión | Elección |
|---|---|
| ¿Para qué? | **Entregar/archivar el video** junto a la transcripción. |
| ¿Cuándo graba? | **Botón aparte** (🎥), independiente de la transcripción. |
| Audio del video | **Sistema + micrófono**, mezclados (reutiliza el WASAPI existente). |
| Calidad/tamaño | **Máxima nitidez** (resolución nativa, ~30 fps). Asume archivos grandes. |
| Qué se graba | El **monitor seleccionado** (reutiliza el selector de monitor de las capturas). |
| Dónde se guarda | **Carpeta de la iniciativa**, nombre `AAAA-MM-DD_HH-MM-SS_grabacion.mp4`. |

## Enfoque elegido

**PyAV todo-en-uno (sin dependencias nuevas).** Verificado empíricamente:
- `av.formats_available` incluye `gdigrab`, `dshow`, `mp4`; `av.codecs_available` incluye `h264`.
- `av.open('desktop', format='gdigrab')` capturó un fotograma real (3840×1080, los dos monitores) en 0,33 s.

Descartados: `ffmpeg.exe` externo (requeriría incluir un binario ~80 MB sin aportar nada que PyAV no dé) y captura con Python puro vía `mss` (demasiada CPU a máxima nitidez, va a tirones).

## Arquitectura

Tres piezas que corren en paralelo durante la grabación y se combinan al parar:

```
[gdigrab: monitor]  --frames-->  [encoder libx264]  -->  video_temp.mp4 (solo video)
[WASAPI: micrófono] --PCM----->  me.wav
[WASAPI: sistema]   --PCM----->  others.wav
                                        |
                            (al parar) mezcla -> mixed.wav
                                        |
                            mux (video copy + audio AAC) -> <destino>.mp4
```

**Por qué grabar video y audio por separado y unir al final (mux):**
- El audio WASAPI tiene tiempo exacto por muestreo (no se desincroniza nunca).
- El video lleva la **marca de tiempo real (PTS)** de cada fotograma de gdigrab. Si el PC suelta algún fotograma en reuniones largas, el PTS sigue siendo correcto, así que **imagen y sonido no se desincronizan** (el punto frágil clásico de estos grabadores, resuelto de raíz).
- El video se codifica una sola vez mientras se graba; el `mux` final solo **copia** el stream de video (rápido) y añade el audio en AAC.

## Componentes y archivos

### Nuevos

- **`helpmeet/video/__init__.py`** — paquete nuevo.
- **`helpmeet/video/recorder.py`** — clase `ScreenVideoRecorder`:
  - `__init__(dest_path, monitor, fps, on_status=None)` donde `monitor = {"left","top","width","height"}`.
  - `start()`: arranca el `DualAudioRecorder` (audio) en un tmp y un hilo de video que abre gdigrab con `offset_x/offset_y/video_size` del monitor y codifica a `video_temp.mp4`.
  - `stop()`: detiene hilos, mezcla audio, hace el `mux` final a `dest_path`, limpia temporales. Tolerante a fallos parciales (ver Errores).
- **`helpmeet/audio/mixing.py`** — `mix_wavs(me_wav, others_wav, out_wav, rate=48000)`: carga ambos WAV con `wave`+`numpy`, remuestrea a `rate`, los lleva a estéreo, iguala longitudes (rellena el más corto), suma con protección de saturación (clip a int16) y escribe `out_wav`. Si falta una pista, usa solo la disponible.

### Modificados

- **`helpmeet/screenshot/capture.py`** — `list_monitors()` añade `left` y `top` a cada dict (mss ya los expone en `sct.monitors[i]`); nueva `monitor_geometry(index) -> {"left","top","width","height"}`.
- **`helpmeet/export/exporter.py`** — nueva `initiative_export_dir(initiative, base_dir) -> Path` que devuelve `Path(base_dir)/_slug(initiative.name)` (reutiliza el `_slug` ya existente), creando la carpeta. Centraliza la lógica que hoy vive dentro de `_export_initiative_folder`.
- **`helpmeet/config.py`** — constantes: `VIDEO_FPS = 30`, `VIDEO_CODEC = "libx264"`, `VIDEO_PRESET = "veryfast"`, `VIDEO_CRF = "18"`, `VIDEO_AUDIO_RATE = 48000`. (Máxima nitidez = preset rápido para no soltar fotogramas + CRF bajo.)
- **`helpmeet/ui/app.py`** — API:
  - `start_screen_recording(initiative_id, monitor_index)`: calcula `dest = initiative_export_dir(...) / "AAAA-MM-DD_HH-MM-SS_grabacion.mp4"`, crea el `ScreenVideoRecorder`, lo arranca; devuelve `{"ok":True}` o error. Guarda la instancia en `self._screen_rec`.
  - `stop_screen_recording()`: para el recorder, devuelve `{"ok":True, "path": str(dest)}` para que la UI ofrezca **📂 Abrir carpeta** (reutiliza `open_path`).
  - Estado vía `_push_status` (p. ej. "🎥 Grabando…", "🎥 Guardando video…").
- **`helpmeet/ui/web/index.html`** — botón `btnScreenRec` ("🎥 Grabar pantalla") junto a captura/nota/subir; indicador `● REC` con contador.
- **`helpmeet/ui/web/app.js`** — handler que alterna 🎥 ⇄ ⏹, arranca un contador `MM:SS` con `setInterval`, llama a la API, y al parar muestra un aviso con botón Abrir carpeta. Deshabilita el botón mientras se guarda el `mux`.
- **`helpmeet/ui/web/style.css`** — estilos del botón de video (color propio, p. ej. rojo/teal) y del indicador `● REC` parpadeante.

## Flujo de datos (detalle del `stop`)

1. Hilo de video: `flush` del encoder y cierre del contenedor → `video_temp.mp4` (solo video, con PTS reales).
2. `DualAudioRecorder.stop()` → `me.wav`, `others.wav`.
3. `mix_wavs(me, others, mixed.wav)`.
4. `mux`: abrir `video_temp.mp4` y `mixed.wav`; contenedor de salida `dest.mp4`; copiar paquetes de video (sin recodificar) y codificar el audio a AAC; cerrar.
5. Borrar temporales (`video_temp.mp4`, `me.wav`, `others.wav`, `mixed.wav`).

## Captura de un solo monitor con gdigrab

`av.open('desktop', format='gdigrab', options={"framerate": str(fps), "offset_x": str(left), "offset_y": str(top), "video_size": f"{w}x{h}", "draw_mouse": "1"})`. La geometría (`left/top/w/h`) viene de `monitor_geometry(monitor_index)` (mss). Así se graba solo el monitor elegido (p. ej. 1920×1080), no los dos juntos (3840×1080) — menos CPU y archivo más pequeño.

## Sincronía

El encoder asigna a cada fotograma de salida el **PTS del fotograma de entrada** de gdigrab (tiempo real desde el inicio). Frame rate variable permitido: aunque se suelten fotogramas bajo carga, la línea de tiempo del video coincide con la del audio.

## Manejo de errores

- **gdigrab no abre** (sin display/permisos): `on_status` con error claro, no se crea archivo, `start` devuelve `{"ok":False,"error":...}`.
- **Sin loopback del sistema**: el video se graba solo con micrófono. **Sin micrófono tampoco**: video sin audio (se genera el archivo igualmente).
- **Fallo en el `mux`**: se conserva `video_temp.mp4` (no se pierde lo grabado) y se informa de dónde quedó.
- **Parar sin ningún fotograma**: no se crea archivo final; aviso "no se grabó nada".
- **Disco lleno / excepción**: se captura, se informa por `on_status`, no se rompe la app.

## Consideraciones y limitaciones (v1)

- **Tamaño grande** a máxima nitidez (una reunión larga puede ser varios GB) y uso de CPU mientras graba. Asumido por el usuario.
- **No transcribe** el video automáticamente (es el botón aparte). Si se quisiera texto, ya existe **📹 Subir video**.
- **Solo monitor completo** (no ventana suelta), sin pausa/reanudar.
- **Vista previa en vivo:** mientras se graba, la zona central muestra una miniatura del monitor que se refresca ~3-4 veces por segundo (no 30 fps reales: pasar tantas imágenes a la UI iría a tirones). Se genera con `mss` (ya disponible) reducida con numpy — sin Pillow ni dependencias nuevas — en un hilo aparte que **nunca interrumpe la grabación** si falla.
- **No crea una Reunión** en la BD: el video es un archivo en la carpeta de la iniciativa. (Posible mejora futura: listarlo en `contexto.md` o crear una entrada.)
- **Concurrencia con transcripción local en vivo**: ambas usarían el loopback WASAPI a la vez. WASAPI en modo compartido suele permitir varios clientes de captura, pero hay que **probarlo**; si diera problemas, se documenta "no grabar video y transcribir en local al mismo tiempo". (Con el modo Replicate por defecto no hay solapamiento de transcripción en vivo.)

## Testing

**Automatizable (sin pantalla):**
- `mix_wavs`: dadas dos WAV cortas (tonos), la mezcla dura `max(dur1, dur2)`, no es silencio y es int16 válido. Caso de una sola pista.
- `monitor_geometry` / `list_monitors`: devuelven `left/top/width/height` coherentes con `mss`.
- `initiative_export_dir`: ruta esperada `<base>/<slug>` y crea la carpeta.

**Manual / smoke (requiere pantalla real, en el PC del usuario):**
- `ScreenVideoRecorder` 2 s → `dest.mp4` existe, `av.open` confirma **1 stream de video + 1 de audio** y duración ≈ 2 s (±0,5 s).
- Prueba de UI: 🎥 → contador corre → ⏹ → aviso con **Abrir carpeta** → el `.mp4` se reproduce con imagen y sonido sincronizados.

## Fuera de alcance

Transcripción automática del video, captura de ventana concreta, pausa/reanudar, edición o recorte, subida del video a la nube. (La vista previa en vivo sí entra, en versión ligera ~3-4 fps.)

## Actualización 2026-06-23 — estado final (tras iteración con el usuario)

La función creció respecto al diseño inicial. Comportamiento real implementado y verificado:

- **Crea una reunión**: cada grabación de pantalla genera una `Meeting` (aparece en el panel) para poder anclar capturas y notas; el `.mp4` se guarda en `meeting.audio_path` y en la carpeta de la iniciativa.
- **Capturas y notas durante la grabación**: `📷` y `📝` quedan activos y se anclan a su momento (`take_capture`/`add_note` enrutan a la reunión de pantalla vía `_screen_active`/`_screen_meeting_id`).
- **Silenciar micrófono en caliente**: `🎤`/`🔇` → `DualAudioRecorder.set_mic_muted()` escribe silencio en la pista del micro (afecta video y transcripción). Verificado: `me.wav` RMS 0, sistema intacto.
- **Transcripción opcional y diferida**: ya NO se transcribe al vuelo por canales. Se transcribe **desde el `.mp4`** con `transcribe_meeting_video(meeting_id)` (local, `extract_audio_to_wav` + faster-whisper), idempotente. Disponible al detener **y** al reabrir la reunión (botón **📝 Transcribir este video**). Pista única → hablante `others`.
- **Panel de video** (`appendVideoPanel`): al detener y al abrir una grabación guardada se muestra `<video>` incrustado; si WebView2 bloquea `file://`, `onerror` ofrece **▶ Abrir video** (externo). Reutilizado por `showRecordingResult` y `openMeeting` (con `get_transcript().video_path`).
- **Cambio de monitor en caliente**: el selector de pantalla NO se bloquea; al cambiarlo, `set_screen_monitor` → `ScreenVideoRecorder.set_monitor()` reabre gdigrab en el nuevo monitor y sigue en el **mismo** `.mp4` (escalado al tamaño de salida fijo si difiere la resolución). Verificado: 1→2 produce un video continuo válido.
- **Abrir carpeta = revelar**: `reveal_path` → `explorer /select,"<mp4>"` (antes `os.startfile` reproducía el video en vez de abrir la carpeta).
- **Exclusión mutua**: no se permite grabar pantalla y grabar reunión a la vez (mismo audio WASAPI).

API nueva: `start_screen_recording`, `stop_screen_recording`, `transcribe_meeting_video`, `toggle_screen_mic_mute`, `set_screen_monitor`, `reveal_path`; `get_transcript` añade `video_path`.
