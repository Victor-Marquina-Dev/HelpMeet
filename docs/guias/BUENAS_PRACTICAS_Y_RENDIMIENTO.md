# Helpmeet — Auditoría de rendimiento y buenas prácticas

## 1. Objetivo

Esta guía revisa la aplicación completa y propone mejoras para que Helpmeet:

- Abra más rápido.
- Empiece a grabar sin esperar la carga de Whisper.
- Consuma menos CPU y memoria durante reuniones largas.
- Termine antes el guardado y la transcripción.
- Mantenga una interfaz fluida con muchas iniciativas, reuniones, frases y capturas.
- Sea más estable ante errores de audio, vídeo, disco o cierre inesperado.
- Sea más fácil de mantener, probar y distribuir.

El orden de este documento es importante. Primero deben corregirse los cuellos de botella medidos o claramente visibles en el código; después se aplican optimizaciones menores.

## 2. Alcance revisado

Se revisaron:

- Inicio y empaquetado: `helpmeet/main.py`, `helpmeet/ui/app.py`, `Helpmeet.spec`.
- Interfaz: `helpmeet/ui/web/app.js`, `style.css`, `index.html`.
- SQLite y SQLAlchemy: `helpmeet/db/database.py`, `models.py`, `repository.py`.
- Grabación de audio: `helpmeet/audio/capture.py`, `session/recorder.py`.
- Grabación de pantalla: `helpmeet/video/recorder.py`.
- Transcripción: `helpmeet/transcription/*`.
- Capturas, exportación y recuperación.
- Ajustes, diagnóstico y almacenamiento seguro.
- Pruebas y scripts de distribución.

Datos del repositorio al realizar esta auditoría:

| Métrica | Valor aproximado |
|---|---:|
| Archivos Python | 34 |
| Líneas Python | 3.865 |
| `ui/app.py` | 1.185 líneas |
| `app.js` | 1.982 líneas / 121 KB |
| `style.css` | 756 líneas / 47 KB |
| Importación de `helpmeet.ui.app` | ~710 ms en el equipo revisado |
| Pruebas sin acceso al hardware real | 96 aprobadas |

Estas cifras son una línea base de desarrollo, no un benchmark definitivo de producción.

## 3. Resumen ejecutivo

Los cambios con mayor impacto esperado son:

1. **No cargar Whisper antes de iniciar la grabación.** Actualmente `start_recording()` llama a `_get_engine()` aunque la transcripción ocurre al detener. La primera grabación puede esperar la carga o descarga del modelo sin necesidad.
2. **Guardar frases en lote.** Cada frase transcrita ejecuta un `COMMIT` independiente. Una reunión con cientos de segmentos hace cientos de escrituras sincronizadas en SQLite.
3. **No leer WAV completos en memoria.** `_has_audio()` y `mix_wavs()` cargan pistas completas. En reuniones largas esto provoca picos grandes de RAM, copias adicionales y pausas.
4. **Optimizar SQLite.** Faltan WAL, índices en claves de consulta y una estrategia FTS para búsqueda.
5. **Eliminar el N+1 del arranque.** La interfaz solicita reuniones iniciativa por iniciativa y de forma secuencial.
6. **Reducir el trabajo duplicado de la vista previa.** Durante grabación de pantalla se captura el escritorio una vez para el vídeo y otra vez con MSS para el preview; después se codifica PNG y se envía como base64 varias veces por segundo.
7. **Renderizar solo lo visible.** Las transcripciones completas reconstruyen todos los nodos y descargan capturas completas en base64.
8. **Fortalecer audio e hilos.** Los streams necesitan cierre garantizado con `finally`, señal de parada y propagación controlada de errores.

## 4. Prioridades

| ID | Mejora | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| P-01 | Cargar Whisper después de grabar | Muy alto | Medio | P0 |
| P-02 | Inserción masiva de frases | Muy alto | Bajo | P0 |
| P-03 | Procesamiento WAV por streaming | Muy alto | Medio | P0 |
| P-04 | Sesión SQLAlchemy por operación/hilo | Alto | Medio | P0 |
| P-05 | Audio con cierre y errores seguros | Alto | Medio | P0 |
| P-06 | Endpoint único de arranque | Alto | Medio | P1 |
| P-07 | WAL e índices SQLite | Alto | Bajo | P1 |
| P-08 | Preview de pantalla ligero | Alto | Medio | P1 |
| P-09 | Miniaturas y carga diferida | Alto | Medio | P1 |
| P-10 | Virtualizar transcripciones largas | Alto | Alto | P1 |
| P-11 | Caché de ajustes | Medio | Bajo | P1 |
| P-12 | Codificador de vídeo adaptativo | Alto | Alto | P2 |
| P-13 | Búsqueda con SQLite FTS5 | Alto con muchos datos | Medio | P2 |
| P-14 | Dividir módulos grandes | Medio, mantenibilidad | Medio | P2 |
| P-15 | Observabilidad y benchmarks CI | Alto a largo plazo | Medio | P1 |

## 5. Inicio de la aplicación

### Hallazgo: importaciones evitables

`helpmeet/ui/app.py` importa `MeetingRecorder` al abrir el programa. Ese módulo importa NumPy, PyAudioWPatch y componentes de captura aunque el usuario todavía no vaya a grabar.

Buena práctica:

- Mantener en el arranque únicamente los módulos necesarios para crear la ventana y leer la navegación inicial.
- Importar grabadores, PyAudio, NumPy, PyAV y faster-whisper cuando se solicite la función correspondiente.
- Medir el tiempo desde el proceso hasta `window.events.shown`.

Propuesta:

```python
def start_recording(...):
    from helpmeet.session.recorder import MeetingRecorder
    ...
```

No conviene importar Whisper en segundo plano al arrancar sin permiso: puede reservar mucha memoria cuando el usuario solo quiere consultar una reunión.

### Hallazgo: migraciones repetidas en cada inicio

`init_db()` inspecciona varias veces las columnas existentes y abre varias transacciones de migración.

Mejora:

- Crear una tabla `schema_version`.
- Ejecutar únicamente las migraciones pendientes.
- Reunir inspecciones en una sola conexión.
- Mantener migraciones pequeñas, reversibles y probadas sobre una copia de la base.

### Meta propuesta

- Ventana visible en menos de 800 ms en desarrollo y menos de 1,5 s instalada, sin contar el arranque frío de WebView2.
- Navegación inicial utilizable sin esperar diagnósticos, modelos ni dispositivos de audio.

## 6. Carga de Whisper y transcripción

### P-01: empezar a grabar sin cargar el modelo

Actualmente `Api.start_recording()` ejecuta `_get_engine()` antes de abrir la captura. Sin embargo, `live=False` significa que el modelo no se usa hasta después de detener la reunión.

Esto puede bloquear el botón de grabar mientras:

- Se importa CTranslate2.
- Se reserva memoria para el modelo.
- Se descarga el modelo por primera vez.
- Se valida una caché incompleta.

Diseño recomendado:

1. Iniciar la captura inmediatamente.
2. Guardar en el trabajo de transcripción el nombre de modelo elegido.
3. Cargar el modelo dentro del worker al comenzar la transcripción.
4. Mostrar una etapa separada: `Cargando modelo`, `Descargando modelo`, `Transcribiendo`.
5. Conservar una única instancia del modelo mientras exista trabajo pendiente.
6. Liberar el modelo tras un periodo configurable de inactividad si la memoria es limitada.

No compartir simultáneamente una misma instancia de Whisper entre varios hilos sin comprobar que la librería y la configuración elegida sean seguras.

### Ajustes de rendimiento de faster-whisper

La configuración actual ya usa CPU con `int8`, una buena base para equipos sin GPU. Debe añadirse una configuración explícita y medible:

- `cpu_threads`: derivado de núcleos disponibles, dejando recursos para interfaz y captura.
- `num_workers`: comenzar con 1; medir antes de subirlo.
- `beam_size=1` para modo rápido.
- `beam_size=5` solo en calidad alta.
- VAD activo para evitar procesar silencios.
- Idioma explícito cuando el usuario lo conoce para omitir autodetección.

No paralelizar las dos pistas en CPU de forma automática: dos inferencias pesadas pueden duplicar memoria y hacer más lenta la máquina. Evaluarlo únicamente mediante benchmark por hardware.

### Preparación del audio

Convertir las pistas a mono, 16 kHz y PCM16 mediante streaming antes de Whisper puede reducir lectura y almacenamiento temporal. Medirlo contra la decodificación interna de faster-whisper antes de fijarlo como comportamiento definitivo.

### Progreso

- Enviar como máximo 5–10 actualizaciones por segundo a WebView.
- Ignorar cambios menores a 1 punto porcentual.
- No ejecutar `evaluate_js` por cada cambio mínimo.
- Diferenciar progreso indeterminado de porcentaje real.

### Metas propuestas

- El botón Grabar empieza a capturar en menos de 500 ms después del diagnóstico.
- El tiempo de transcripción se mide como `duración de proceso / duración de audio`.
- Registrar por separado carga de modelo, preparación, inferencia y persistencia.

## 7. Persistencia de frases y SQLite

### P-02: insertar frases en una sola transacción

`repository.add_utterance()` hace `session.commit()` por cada segmento. Esta es una de las mejoras más claras.

Crear una operación masiva:

```python
def add_utterances(session, meeting_id, rows):
    objects = [Utterance(meeting_id=meeting_id, **row) for row in rows]
    session.add_all(objects)
    session.flush()
    session.commit()
    return objects
```

Reglas:

- Una transacción por pista o por reunión, no por frase.
- Si se desea progreso en vivo, usar lotes de 25–50 frases o confirmar cada 1–2 segundos.
- Hacer rollback completo ante error.
- Conservar la recuperación de los WAV hasta que la transacción termine.

### P-04: sesión por operación o hilo

`Api` conserva una sesión SQLAlchemy de larga duración. Además existen workers y grabadores con sesiones propias. Aunque hay llamadas a `expire_all()`, una sesión persistente acumula estado, dificulta la concurrencia y puede devolver relaciones antiguas.

Buena práctica:

- Crear un context manager `session_scope()`.
- Abrir una sesión corta por llamada de API.
- Nunca pasar una sesión o entidad ORM activa a otro hilo.
- Pasar identificadores y datos simples entre hilos.
- Cerrar siempre la sesión en `finally`.

Ejemplo:

```python
@contextmanager
def session_scope():
    session = SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
```

### P-07: WAL, pragmas e índices

Configurar SQLite al conectar:

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=30000;
```

Añadir índices como mínimo:

- `meetings(initiative_id, started_at)`.
- `meetings(archived_at, deleted_at)`.
- `utterances(meeting_id, start_time)`.
- `utterances(participant_id)`.
- `captures(meeting_id, taken_at)`.
- `captures(near_utterance_id)`.
- `notes(meeting_id, created_at)`.
- `participants(initiative_id, created_at)`.

Los índices deben añadirse mediante migración y comprobarse con `EXPLAIN QUERY PLAN`. Demasiados índices también ralentizan escrituras.

### Consultas a mejorar

- `list_meetings()` carga la iniciativa y su relación completa, después filtra y ordena en Python. Consultar `Meeting` directamente con `WHERE` y `ORDER BY`.
- El estado usa `len(m.utterances)`, lo que carga todas las frases para obtener un conteo. Usar `COUNT` agrupado.
- `list_library()` usa relaciones para nombres y conteos; aplicar `selectinload`, `joinedload` o consultas agregadas explícitas.
- `_item_in_use()` consulta dos veces la misma reunión.
- `get_transcript()` debe cargar relaciones ordenadas explícitamente, evitando orden implícito y consultas tardías.

### P-13: búsqueda

`ILIKE '%texto%'` recorre todas las frases y notas. Para una biblioteca grande:

- Crear tablas virtuales FTS5 para texto de frases y notas.
- Mantenerlas mediante triggers o actualización transaccional.
- Limitar resultados y paginar.
- Incluir fragmentos destacados desde SQLite.
- Mantener fallback a `LIKE` si FTS5 no está disponible.

## 8. Arranque de datos y puente Python–WebView

### P-06: una sola llamada inicial

La interfaz realiza:

1. `list_initiatives()`.
2. `list_monitors()`.
3. Una llamada `list_meetings()` por cada iniciativa, secuencialmente.
4. Consultas separadas para Archivo y Papelera.

Con muchas iniciativas, el tiempo crece linealmente por cruces del puente WebView.

Crear un endpoint `get_bootstrap_state()` que devuelva:

```json
{
  "initiatives": [],
  "meetings_by_initiative": {},
  "monitors": [],
  "library_counts": {"archive": 0, "trash": 0},
  "background_jobs": []
}
```

Alternativa aún más ligera: devolver únicamente reuniones de iniciativas expandidas y cargar el resto al abrirlas.

### Reducir llamadas repetidas

- No llamar `refreshAll()` después de cambios que afectan una sola iniciativa.
- Actualizar el estado local tras renombrar, marcar o eliminar.
- Volver al backend solo para confirmar y reconciliar.
- Agrupar eventos de progreso y trabajos en segundo plano.

## 9. Interfaz y DOM

### P-10: transcripciones largas

`renderTranscript()` crea un nodo, contenido HTML y manejadores para cada elemento. Cambiar de pestaña o refrescar reconstruye todo.

Mejoras en orden:

1. Paginación inicial de 100–200 elementos.
2. Botón o carga automática `Mostrar más`.
3. Virtualización cuando existan miles de frases.
4. Delegación de eventos en el contenedor, en vez de cuatro handlers por frase.
5. Actualización localizada al editar, eliminar o destacar.
6. No volver a llamar `openMeeting()` para cambios que ya están disponibles en memoria.

### Búsqueda dentro de la transcripción

El filtro actual recorre todos los nodos en cada pulsación. Añadir debounce de 150–250 ms para reuniones grandes. Si hay virtualización, buscar sobre los datos y renderizar solo coincidencias.

### División del JavaScript

`app.js` reúne API, estado, navegación, grabación, biblioteca, ajustes y componentes.

Separar gradualmente:

- `api.js`.
- `state.js`.
- `components/`.
- `views/meeting.js`.
- `views/settings.js`.
- `recording.js`.
- `library.js`.

La división mejora mantenibilidad y pruebas. No debe hacerse como una reescritura total; mover una unidad por cambio y conservar contratos.

### CSS

- Eliminar estilos inline repetidos.
- Crear clases para filas, ayudas, encabezados, botones y estados.
- Evitar selectores demasiado generales como `.modal label` cuando existen componentes especiales.
- Añadir `content-visibility: auto` a bloques largos solo después de comprobar WebView2.
- Respetar `prefers-reduced-motion`.

## 10. Capturas e imágenes

### P-09: no enviar la imagen original como miniatura

`get_capture_image()` lee la captura completa, la convierte a base64 y la cruza por WebView. La misma imagen puede pedirse en la línea temporal y nuevamente en Archivos.

Mejora:

- Generar una miniatura WebP o JPEG de 320–480 px al crear la captura.
- Guardar miniatura y original.
- Devolver la miniatura para tarjetas.
- Solicitar el original únicamente al abrir la lupa.
- Cargar miniaturas con `IntersectionObserver` cuando entren al viewport.
- Cachear por `capture_id` en JavaScript.
- Liberar data URLs que ya no se necesiten.

Base64 aumenta el tamaño transferido aproximadamente un tercio. Si pywebview permite un servidor local o esquema seguro para recursos, evaluar servir archivos por URL local en lugar de incrustarlos.

## 11. Grabación de audio

### P-05: cierre garantizado

Cada hilo de captura debe envolver stream y WAV en `try/finally`:

- Cerrar stream aunque falle `read()`.
- Cerrar WAV para completar cabecera.
- Registrar el error del hilo.
- Avisar al controlador principal.
- No terminar PyAudio mientras un hilo sigue leyendo.

Sustituir el booleano compartido por `threading.Event`. Después de `join(timeout)`, comprobar `is_alive()`. Si continúa vivo, no llamar a `terminate()` como si hubiera cerrado correctamente.

### Buffer y escritura

- Medir buffers de 1024, 2048 y 4096 frames.
- Mantener latencia baja solo si existe transcripción en vivo.
- En grabación continua, un buffer moderadamente mayor reduce llamadas Python.
- Evitar conversiones de audio durante captura; hacerlas después o en un pipeline separado.

### P-03: detección de silencio por streaming

`MeetingRecorder._has_audio()` lee el WAV completo y convierte todo a `float64` para calcular RMS.

Cambiar a lectura por bloques:

```python
sum_sq = 0
samples = 0
while chunk := wav.readframes(8192):
    data = np.frombuffer(chunk, dtype=np.int16).astype(np.float32)
    sum_sq += np.dot(data, data)
    samples += data.size
rms = sqrt(sum_sq / samples)
```

También puede detenerse temprano si varios bloques contienen señal claramente superior al umbral.

## 12. Mezcla y guardado de audio

`mix_wavs()` actualmente:

- Lee ambas pistas completas.
- Las convierte a `float32`.
- Reinterpola arrays completos.
- Crea arrays rellenos del tamaño total.
- Genera otra copia estéreo.
- Escribe un WAV temporal completo.

Una reunión larga puede necesitar varias veces el tamaño de las pistas en RAM.

Diseño recomendado:

- Decodificar y remuestrear con PyAV/libswresample por bloques.
- Mezclar bloques alineados y escribir directamente.
- O aplicar un filtro `amix` durante el mux final y evitar el WAV mezclado intermedio.
- Conservar las pistas separadas para transcripción únicamente si el usuario las necesita.
- Mover sidecars terminados en vez de `copy2` cuando origen y destino permitan renombre atómico.

Meta: memoria de mezcla aproximadamente constante, independientemente de la duración.

## 13. Grabación de pantalla

### P-08: preview sin captura duplicada

Actualmente:

- GDI captura el escritorio para codificar vídeo.
- MSS vuelve a capturar el escritorio para la vista previa.
- NumPy reduce la imagen.
- PNG la comprime.
- Base64 la amplía.
- `evaluate_js` la envía aproximadamente 3 veces por segundo.

Esto duplica trabajo mientras la CPU ya está codificando H.264.

Diseño recomendado:

1. Tomar cada N fotogramas del pipeline de vídeo.
2. Enviar una referencia del último frame a una cola de tamaño 1.
3. Si llega uno nuevo, descartar el anterior.
4. Generar preview de 360–480 px en un hilo ligero.
5. Usar JPEG/WebP con calidad 55–70, no PNG para contenido fotográfico.
6. Limitar a 1–2 fps.
7. Detener completamente el preview si el panel está oculto o minimizado.

### P-12: perfil de vídeo adaptativo

H.264 por CPU a resolución nativa, 30 fps y CRF 18 puede competir con Whisper, WebView y otras aplicaciones.

Ofrecer perfiles:

| Perfil | Resolución | FPS | Uso |
|---|---:|---:|---|
| Ligero | 1280×720 máx. | 15 | Documentos y reuniones largas |
| Equilibrado | 1920×1080 máx. | 30 | Recomendado |
| Nativo | Resolución original | 30 | Máxima nitidez |

Detectar de forma segura codificadores de hardware disponibles:

- NVIDIA NVENC.
- Intel Quick Sync.
- AMD AMF.

Siempre conservar fallback `libx264`. No seleccionar hardware solo porque el codec aparece: realizar una codificación corta de prueba.

Otros ajustes:

- CRF 21–23 suele reducir I/O y tamaño frente a 18; validarlo visualmente con texto pequeño.
- Mostrar estimación de espacio por hora.
- Registrar frames capturados, codificados y descartados.

## 14. Exportación

La exportación de una reunión regenera la iniciativa completa. Además `_render_meeting()` puede ejecutarse dos veces por reunión y volver a copiar capturas.

Mejoras:

- `export_meeting()` debe regenerar solamente esa reunión y el índice combinado necesario.
- Renderizar una vez y reutilizar el resultado.
- Copiar capturas solo si origen, tamaño o fecha cambiaron.
- Escribir a archivo temporal y reemplazar al final.
- No borrar archivos antiguos hasta completar la nueva exportación.
- Ejecutar exportaciones grandes en un worker con progreso.
- Usar `bisect` para enlazar notas/capturas por tiempo en lugar de recorrer todas las frases por cada elemento.

## 15. Ajustes y diagnóstico

### P-11: caché de ajustes

Cada getter llama `_load()` y vuelve a leer `settings.json`. `get_transcription_settings()` invoca otros getters que lo leen varias veces.

Crear:

- Caché en memoria protegida por lock.
- Una sola carga inicial.
- Escritura atómica a temporal y `replace`, que ya existe.
- Invalidación explícita después de restaurar o borrar datos.
- Una función que derive idioma, nivel y modelo a partir del mismo diccionario.

### Diagnóstico

- Cachear resultados estables como versión de WebView2 y codecs durante la sesión.
- Volver a comprobar disco y dispositivos cuando el usuario lo solicite.
- Ejecutar enumeración de audio fuera del hilo de UI.
- No bloquear el inicio con diagnóstico completo.

## 16. Recuperación y temporales

- Mantener manifiestos atómicos, como ya se hace.
- Añadir versión de esquema y checksum ligero de metadatos.
- Limpiar temporales únicamente después de confirmar base de datos y archivo final.
- Aplicar retención a temporales abandonados ya procesados.
- No eliminar una recuperación fallida automáticamente.
- Medir espacio antes de copiar o mezclar archivos grandes.
- Preferir `Path.replace()` en el mismo volumen y copia con progreso entre volúmenes.

## 17. Manejo de errores y logging

Hay múltiples `except Exception` que silencian detalles. Algunos están justificados en UI o diagnóstico, pero los errores técnicos deben quedar registrados.

Añadir logging rotativo en `%LOCALAPPDATA%/Helpmeet/logs`:

- Nivel INFO por defecto.
- Rotación por tamaño, máximo 3–5 archivos.
- Sin transcripciones, tokens ni audio en logs.
- Identificador de operación y reunión, no contenido privado.
- Tiempos de cada etapa.
- Stack trace para errores inesperados.

Regla:

- Mostrar al usuario un mensaje breve y accionable.
- Registrar el detalle técnico.
- Nunca usar `pass` si el fallo puede dejar captura, stream, sesión o archivo abierto.

## 18. Arquitectura y mantenibilidad

`Api` mezcla navegación, archivos, grabación, trabajos, diagnóstico, ajustes y exportación.

Separar por servicios:

- `MeetingService`.
- `RecordingService`.
- `ScreenRecordingService`.
- `TranscriptionQueue`.
- `ExportService`.
- `LibraryService`.
- `SettingsService`.

La clase expuesta a pywebview puede delegar en ellos y conservar los nombres públicos actuales.

Buenas prácticas generales:

- Type hints en interfaces públicas.
- Dataclasses o TypedDict para payloads.
- Constantes/enums para estados.
- Inyección de dependencias en grabadores y motores para probar sin hardware.
- Funciones pequeñas con una sola responsabilidad.
- Evitar estado global mutable salvo configuración inmutable.
- No hacer operaciones de disco, red o modelo en el hilo de UI.

## 19. Dependencias y empaquetado

- Mantener versiones reproducibles y actualizar mediante PR separado.
- Separar dependencias activas de funciones deshabilitadas; `replicate` no debería aumentar el instalador si la nube está deshabilitada.
- Revisar `collect_all()` de PyInstaller: puede incluir datos y módulos que nunca se usan.
- Medir tamaño e inicio antes y después de retirar dependencias.
- Generar hashes del instalador y SBOM/licencias.
- No activar UPX sobre DLL que causen problemas de antivirus o carga sin probar una instalación limpia.
- Probar Windows 10 y 11, distintas escalas DPI y equipos sin modelo descargado.

## 20. Pruebas recomendadas

### Unitarias

- Inserción masiva y rollback de frases.
- Consultas con relaciones y conteos.
- Caché/invalidez de ajustes.
- RMS por streaming.
- Mezcla por bloques.
- Cola de preview que descarta frames viejos.
- Migraciones desde cada versión soportada.

### Integración

- Reunión de 1, 30 y 120 minutos con audio simulado.
- Grabación de pantalla cambiando entre relaciones de aspecto.
- Cierre inesperado durante audio, vídeo, mux y transcripción.
- Base con 100 iniciativas, 5.000 reuniones y 500.000 frases sintéticas.
- Exportación con cientos de capturas.

### Hardware

Las pruebas de PyAudio y pantalla deben estar marcadas como `hardware` y separadas del conjunto normal. Deben ejecutarse en un proceso aislado, porque un fallo nativo del controlador puede finalizar Python completo.

## 21. Benchmarks obligatorios

Crear `scripts/benchmark.py` o pruebas marcadas `performance`, sin ejecutarlas en cada test normal.

Medir:

| Métrica | Escenario |
|---|---|
| Tiempo hasta ventana | Inicio frío y caliente |
| Tiempo hasta capturar | Primera y segunda grabación |
| RAM durante grabación | Audio 30/120 min |
| RAM durante mezcla | WAV 30/120 min |
| Tiempo de transcripción | Modelos base/small/medium |
| Velocidad de persistencia | 100/1.000/10.000 frases |
| Apertura de reunión | 100/1.000/10.000 elementos |
| Búsqueda | 10.000/100.000/500.000 frases |
| Preview | CPU con y sin preview |
| Vídeo | frames perdidos, CPU, MB/h |

Guardar mediana, p95 y entorno de prueba. No aceptar una optimización que reduzca tiempo pero aumente errores, pérdida de frames o uso de memoria sin límite.

## 22. Plan de implementación recomendado

### Fase 1 — Ganancias rápidas y estabilidad

1. Mover carga de Whisper al worker posterior a la grabación.
2. Añadir `add_utterances()` y una sola transacción.
3. Convertir `_has_audio()` a streaming.
4. Añadir WAL, foreign keys e índices principales.
5. Cachear `settings.json`.
6. Cerrar audio con `try/finally` y controlar errores de hilos.
7. Añadir mediciones y logging de etapas.

### Fase 2 — Datos e interfaz

1. Crear `get_bootstrap_state()`.
2. Consultas agregadas para conteos.
3. Sesiones cortas por operación/hilo.
4. Carga diferida y caché de miniaturas.
5. Actualizaciones DOM localizadas.
6. Paginación inicial de transcripciones.

### Fase 3 — Multimedia

1. Mezcla/remuestreo por streaming.
2. Preview derivado del pipeline de vídeo.
3. Perfiles de resolución/FPS.
4. Detección y prueba de encoder por hardware.
5. Evitar copias de sidecars y temporales innecesarios.

### Fase 4 — Escala y mantenimiento

1. SQLite FTS5.
2. Virtualización completa.
3. Separar servicios Python y módulos JavaScript.
4. Benchmarks de regresión en CI.
5. Optimizar dependencias y paquete PyInstaller.

## 23. Criterios de aceptación

La optimización se considera completa cuando:

- Grabar no espera la carga o descarga de Whisper.
- Una reunión larga no provoca memoria proporcional a toda la duración durante detección o mezcla.
- Las frases se guardan en lote y no con un commit por segmento.
- Cada worker usa una sesión propia y cerrada.
- La base usa WAL, claves foráneas e índices comprobados.
- El inicio no hace una llamada secuencial por cada iniciativa.
- La vista previa no duplica la captura completa de pantalla.
- Las miniaturas no transportan originales completos innecesariamente.
- Abrir o editar una reunión no reconstruye más DOM del necesario.
- Existen métricas antes/después para inicio, grabación, mezcla, transcripción y navegación.
- Todas las pruebas funcionales continúan aprobándose.
- Las pruebas de hardware están aisladas y documentadas.

## 24. Orden que no debe alterarse

No comenzar por microoptimizaciones visuales, minificar JavaScript o cambiar de framework. El mayor rendimiento vendrá de:

1. Evitar trabajo antes de necesitarlo.
2. Evitar leer archivos completos.
3. Evitar commits y llamadas repetidas.
4. Evitar capturas y codificaciones duplicadas.
5. Renderizar únicamente lo visible.

Después de esas mejoras, volver a medir y decidir si hace falta una arquitectura más compleja.
