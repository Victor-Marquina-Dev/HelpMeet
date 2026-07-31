# Banco de pruebas — migración a Vosk (TASK-001 en adelante)

Herramientas para medir Whisper vs Vosk fuera de la app, sobre audio real. Nada de esto toca la base de datos de producción ni el flujo normal de Helpmeet.

## Corpus (`corpus/`, no versionado)

`corpus/` contiene 3 fragmentos de referencia, uno por perfil:

- `01-limpio/` — voz clara, sin ruido de fondo.
- `02-ruido/` — con ruido real de por medio.
- `03-tecnico/` — vocabulario técnico denso.

Cada carpeta tiene:

- `microfono.wav` / `sistema.wav` — las dos pistas por separado (nunca la mezcla final: la mezcla duplica el mismo mono a los dos canales estéreo, así que una vez mezclada la pista es irrecuperable).
- `transcripcion_whisper_borrador.txt` — lo que Whisper transcribió ahí, **sin corregir**. Es el punto de partida de TASK-002, no la verdad de referencia.
- `meta.json` — de dónde salió el fragmento y por qué se eligió.

**Toda la carpeta está en `.gitignore`**: contiene audio y texto de reuniones de trabajo reales. La metodología queda documentada acá; el contenido no se versiona.

## Cómo se armó (o se rearma)

### Opción A — grabación dedicada (recomendada)

1. `python scripts/vosk_bench/grabar_clip.py "C:/Users/embi/Desktop/NuevoHelpmeet/<perfil>"` — graba micrófono + sistema por separado, en tiempo real, sin pasar por la app (ver el script para más detalle). Guarda en una carpeta fuera del repo y fuera de los datos de producción de Helpmeet, a propósito.
2. `python scripts/vosk_bench/importar_grabacion.py "<carpeta_grabada>" 0X-<perfil> --por-que "..."` — copia los WAV al corpus, corre Whisper para el borrador y escribe `meta.json`.

### Opción B — extraer de una reunión ya grabada

Solo funciona si la reunión todavía conserva `microfono.wav`/`sistema.wav` en `%LOCALAPPDATA%\Helpmeet\media\<meeting_id>\` (se borran automáticamente al mezclarse; en la práctica, casi ninguna reunión vieja los conserva). Requiere elegir a mano el tramo de tiempo dentro de la grabación original — ver el historial de TASK-001 en la bitácora del proyecto para el método usado (estadística de RMS por bloques + verificación del dueño sobre qué tramo tenía ruido real).

## Próximos pasos (backlog)

- `banco.py` (TASK-003, pendiente) — corre un motor (Whisper o Vosk) sobre un fragmento del corpus y vuelca a CSV: texto, WER, tiempo a primera palabra, tiempo a frase cerrada, CPU media/pico, RAM pico.
