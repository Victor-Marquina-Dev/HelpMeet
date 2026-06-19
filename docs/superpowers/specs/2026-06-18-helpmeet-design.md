# Helpmeet — Documento de diseño (planeación)

- **Fecha:** 2026-06-18
- **Estado:** Aprobado por el usuario (Fase 1). Pendiente de plan de implementación.
- **Autor:** Víctor (idea/producto) + Claude Code (diseño técnico)

---

## 1. El problema que resuelve

El usuario participa en **muchas reuniones de programación por Google Meet**. No programa y le cuesta seguir todo el contexto técnico que se discute. Necesita una herramienta que:

1. **Transcriba automáticamente** todo lo que se habla en cada reunión.
2. **Guarde las conversaciones organizadas por "iniciativa"** (un proyecto/tema que abarca varias reuniones), conservando el contexto completo desde que la iniciativa empieza hasta que termina.
3. Permita **tomar capturas de pantalla** cuando aparezca código, una tabla, un diagrama, etc., y que esas imágenes queden **ligadas al momento exacto** de la transcripción.
4. **Exporte todo ese contexto** en un formato que pueda entregarse a **Claude Code**, para que la IA entienda de qué van las reuniones y le ayude.

El objetivo final no es solo "transcribir": es **construir y conservar el contexto** de cada iniciativa para potenciar el trabajo posterior con IA.

## 2. Contexto del usuario (importante para el diseño)

- **No programa** y tiene dificultades con lo técnico. Todas las decisiones priorizan **simplicidad, robustez y poca fricción** sobre potencia o elegancia técnica.
- **Equipo (Windows 11 Pro):**
  - CPU: **AMD Ryzen 7 3700X** (8 núcleos / 16 hilos) — potente, suficiente para Whisper en CPU.
  - RAM: **32 GB** — de sobra.
  - GPU: **AMD Radeon RX 6600** — **no se usará** para acelerar Whisper (la aceleración estándar requiere NVIDIA/CUDA; no aporta y añadiría complejidad).
  - Python detectado: **3.14 (Microsoft Store)** — demasiado nuevo y con restricciones de permisos. **Se instalará Python 3.12** (versión estable con soporte completo de las librerías de ML).

## 3. Estrategia: construcción por fases

Para evitar frustración y entregar valor pronto, el proyecto se construye en 3 fases. **Solo la Fase 1 está diseñada en detalle aquí.**

| Fase | Qué añade | Estado |
|---|---|---|
| **Fase 1 — Lo esencial** | Capturar audio, transcribir, separar "Yo" vs "Los demás", guardar por iniciativa, capturas ligadas, exportar para Claude. | **Diseñada / aprobada** |
| **Fase 2 — Separar voces** | Diarización: detectar "Hablante 1, 2, 3" automáticamente y que el usuario les ponga nombre. | Planeada (futuro) |
| **Fase 3 — Reconocer voces** | Perfiles de voz persistentes: recordar a las personas entre reuniones, con corrección manual del usuario. | Planeada (futuro) |

## 4. Decisiones tomadas (con su razón)

| Decisión | Elección | Razón |
|---|---|---|
| Lenguaje | **Python** | Pedido por el usuario; mejor ecosistema para audio/ML local. |
| Procesamiento de transcripción | **Local** (`faster-whisper`) | Privacidad total (las reuniones no salen del PC), sin costo por uso. La CPU del usuario lo soporta bien. |
| Modelo Whisper | **`small`** (configurable) | Equilibrio precisión/velocidad en español; casi en vivo. Cambiable a `medium`/`base` con un ajuste. |
| Aceleración | **CPU** (no GPU) | La GPU es AMD; la aceleración estándar es NVIDIA. La CPU basta. |
| Identificación de hablantes (Fase 1) | **"Yo" vs "Los demás"** | Separar micrófono (Yo) de audio del sistema (Los demás) es fiable y simple. La identificación individual es Fase 2/3. |
| Interfaz | **Ventana de escritorio con `pywebview`** (interior HTML) | Ventana propia como cualquier programa, pero fácil de hacer atractiva y de mostrar transcripción en vivo. Más simple que una GUI nativa tipo Qt. |
| Disparo de la transcripción | **Manual** (botón Grabar/Parar) | Más fiable que detectar automáticamente el inicio/fin de Meet. |
| Capturas de pantalla | **Disparadas por el usuario** (atajo de teclado global + botón) | El usuario decide qué capturar; se inserta en el momento exacto. |
| Base de datos | **SQLite** vía **SQLAlchemy** | Cero instalación/mantenimiento para una app local de 1 usuario. SQLAlchemy permite migrar a PostgreSQL cambiando una línea si en el futuro hace falta. |
| Exportación | **Carpeta con `.md` + imágenes** | Formato directo para arrastrar a Claude Code. |

## 5. Arquitectura de la Fase 1

La app se divide en **6 componentes**, cada uno con una única responsabilidad, comunicados por interfaces claras. Si uno falla, los demás siguen.

### 5.1 Capturador de audio
- **Qué hace:** graba dos fuentes por separado y en paralelo: el **micrófono** (etiquetado "Yo") y el **audio del sistema / loopback** (etiquetado "Los demás"). Entrega el audio en trozos cortos (p. ej. fragmentos de pocos segundos) al motor de transcripción.
- **Cómo se usa:** `iniciar()`, `detener()`; emite trozos de audio con marca de tiempo y etiqueta de fuente.
- **Depende de:** `pyaudiowpatch` (PyAudio con soporte WASAPI loopback en Windows).

### 5.2 Motor de transcripción
- **Qué hace:** convierte cada trozo de audio en texto usando `faster-whisper` (modelo `small`, `compute_type` optimizado para CPU). Usa detección de actividad de voz (VAD) para segmentar frases y descartar silencios.
- **Cómo se usa:** recibe trozos de audio + fuente; devuelve frases con texto, hablante ("Yo"/"Los demás") y marcas de tiempo (inicio/fin).
- **Depende de:** `faster-whisper`.

### 5.3 Capturador de pantalla
- **Qué hace:** al pulsar el atajo de teclado global o el botón 📷, guarda una imagen de la pantalla (monitor principal en Fase 1) con su hora exacta, y la asocia a la frase más cercana en el tiempo.
- **Cómo se usa:** `capturar()` → devuelve ruta de imagen + marca de tiempo.
- **Depende de:** `mss` (captura de pantalla), `pynput` (atajo de teclado global).

### 5.4 Almacenamiento (base de datos)
- **Qué hace:** persiste todo de forma continua (no solo al final) en SQLite, más una carpeta de imágenes para las capturas.
- **Cómo se usa:** funciones para crear/leer iniciativas, reuniones, frases y capturas.
- **Depende de:** `SQLAlchemy` + SQLite. Ver esquema en §6.

### 5.5 Ventana de la app (interfaz)
- **Qué hace:** ventana de escritorio que muestra, a la izquierda, las iniciativas y sus reuniones; en el centro, la transcripción en vivo (separando "Yo"/"Los demás") con las capturas insertadas; arriba, los botones (Grabar/Parar, Captura, Exportar) y el selector de iniciativa activa.
- **Cómo se usa:** el usuario interactúa con botones; el backend empuja actualizaciones de transcripción en vivo a la interfaz.
- **Depende de:** `pywebview` + HTML/CSS/JS propios. La transcripción en vivo se envía a la interfaz mediante la API de `pywebview` (o un canal local ligero).

### 5.6 Exportador para Claude
- **Qué hace:** genera una carpeta por reunión (o por iniciativa) con un archivo `contexto.md` ordenado y una subcarpeta `capturas/` con las imágenes referenciadas.
- **Cómo se usa:** `exportar(reunión | iniciativa)` → ruta de la carpeta generada.
- **Depende de:** solo el almacenamiento (lee de SQLite). Ver formato en §8.

## 6. Modelo de datos (esquema SQLite)

```
initiatives
  id            (PK)
  name          (texto, ej. "Sistema de Login")
  description   (texto, opcional)
  created_at    (fecha/hora)

meetings
  id            (PK)
  initiative_id (FK -> initiatives.id)
  title         (texto, ej. "Endpoints")
  started_at    (fecha/hora)
  ended_at      (fecha/hora, null mientras graba)
  audio_path    (ruta al audio en bruto, opcional, como respaldo)

utterances        (cada "frase" transcrita)
  id            (PK)
  meeting_id    (FK -> meetings.id)
  speaker       ("me" | "others")
  text          (texto transcrito)
  start_time    (segundos desde el inicio de la reunión)
  end_time      (segundos)
  created_at    (fecha/hora)

captures
  id              (PK)
  meeting_id      (FK -> meetings.id)
  image_path      (ruta a la imagen en la carpeta de capturas)
  taken_at        (fecha/hora)
  near_utterance_id (FK -> utterances.id; la frase más cercana en el tiempo)
  note            (texto opcional escrito por el usuario)
```

Jerarquía conceptual: **Iniciativa → Reunión → (Frases + Capturas)**.

## 7. Flujo de una reunión, de principio a fin

1. El usuario abre la app, **selecciona la iniciativa** (o crea una nueva) y pulsa **Grabar**.
2. El capturador de audio graba micrófono + sistema; el motor de transcripción va produciendo frases que se **guardan continuamente** y se muestran en vivo.
3. Cuando aparece algo visual relevante (código, tabla, diagrama), el usuario pulsa el **atajo** o el botón 📷 → se guarda la captura **asociada a la frase de ese momento**.
4. El usuario pulsa **Parar** → se marca `ended_at`. Todo queda guardado.
5. Cuando quiera, pulsa **Exportar para Claude** → obtiene la carpeta lista.

## 8. Formato de exportación para Claude Code

Estructura de carpeta generada:

```
Sistema-de-Login_2026-06-18/
  ├─ contexto.md
  └─ capturas/
       ├─ captura-01.png
       └─ captura-02.png
```

Contenido aproximado de `contexto.md`:

```markdown
# Iniciativa: Sistema de Login
## Reunión: Endpoints — 2026-06-18 (12:30–13:10)

[12:41] Yo: ¿Revisamos el endpoint de autenticación? Me da un error raro.
[12:42] Los demás: Sí, el error 500 viene del token que expira. Te paso el código.
        📷 (ver capturas/captura-01.png)
[12:43] Yo: Ah, ya veo. Hay que renovar el token antes.
```

Opcionalmente, el exportador puede generar también un `contexto.md` **consolidado de toda la iniciativa** (todas sus reuniones en orden), para dar a Claude el panorama completo "de inicio a fin".

## 9. Manejo de errores

- **Audio en bruto de respaldo:** mientras graba, se conserva el audio para no perder nada aunque la transcripción se retrase o falle; el texto se rellena cuando el motor puede.
- **Guardado continuo:** las frases se persisten según se generan; si la app se cierra por accidente, lo grabado hasta ese momento ya está en la base de datos.
- **Captura fallida:** si una captura falla, se avisa al usuario pero **la grabación no se detiene**.
- **Modelo no cargado / dispositivo de audio ausente:** la app muestra un mensaje claro y comprensible (no un error técnico) e indica qué revisar.

## 10. Estrategia de pruebas

- **Pruebas por componente:** cada pieza se prueba de forma aislada (ej. el capturador de pantalla guarda una imagen; el exportador genera el `.md` esperado; el almacenamiento crea/lee correctamente).
- **Prueba de integración:** con un archivo de audio de ejemplo (en lugar del micrófono en vivo) se verifica el flujo completo audio → transcripción → guardado → exportación.
- Se prioriza poder probar **sin depender de hardware en vivo** usando audios de muestra.

## 11. Requisitos previos (preparación, una sola vez)

1. **Instalar Python 3.12** desde python.org (no la versión de Microsoft Store). Guía paso a paso para el usuario.
2. Instalar las dependencias del proyecto (se documentará un comando único).
3. Conceder permisos de **micrófono** y captura de **audio del sistema**.

## 12. Fuera de alcance de la Fase 1 (a propósito — YAGNI)

- ❌ Diarización / "Hablante 1, 2, 3" → **Fase 2**.
- ❌ Reconocimiento de voz persistente entre reuniones → **Fase 3**.
- ❌ Detección automática del inicio/fin de Meet (en Fase 1 el control es manual).
- ❌ Edición avanzada de transcripciones, búsqueda full-text, etiquetas, etc. (posible futuro).
- ❌ PostgreSQL (la capa SQLAlchemy deja la puerta abierta, pero no se configura ahora).

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Capturar el audio del sistema en Windows puede ser delicado según el dispositivo de salida. | `pyaudiowpatch` con WASAPI loopback; detectar automáticamente el dispositivo de salida por defecto y permitir elegirlo manualmente. |
| Latencia de transcripción si el `small` va justo. | Procesar en trozos con VAD; permitir bajar a `base` si el PC se satura. |
| Atajo de teclado global bloqueado por permisos. | `pynput`; si falla, el botón 📷 de la interfaz siempre funciona como alternativa. |
| Consideración legal/ética: grabar a terceros puede requerir su consentimiento. | Documentar la recomendación de avisar a los participantes; es responsabilidad del usuario. |

## 14. Stack tecnológico (resumen)

- **Lenguaje:** Python 3.12
- **Audio:** `pyaudiowpatch`
- **Transcripción:** `faster-whisper` (modelo `small`, CPU)
- **Captura de pantalla:** `mss`
- **Atajo global:** `pynput`
- **Base de datos:** `SQLAlchemy` + SQLite
- **Interfaz:** `pywebview` + HTML/CSS/JS
- **Empaquetado (futuro):** posible `.exe` con PyInstaller para no depender de la terminal.

---

## 15. Seguimiento de la construcción (Fase 1)

> Esta lista se actualiza automáticamente conforme se construye cada pieza. ✅ = hecho, ⬜ = pendiente. El detalle paso a paso está en `docs/superpowers/plans/2026-06-18-helpmeet-fase1.md`.

- ✅ **Task 0** — Preparar entorno (Python 3.12) y estructura del proyecto
- ✅ **Task 1** — Modelo de datos (Iniciativa, Reunión, Frases, Capturas)
- ✅ **Task 2** — Inicialización de la base de datos
- ✅ **Task 3** — Repositorio (guardar/leer datos)
- ✅ **Task 4** — Exportador para Claude Code
- ✅ **Task 5** — Capturador de pantalla
- ✅ **Task 6** — Atajo de teclado global (verificado: 10/10 pulsaciones detectadas)
- ⬜ **Task 7** — Motor de transcripción (faster-whisper)
- ⬜ **Task 8** — Capturador de audio (micrófono + sistema)
- ⬜ **Task 9** — Orquestador de la reunión
- ⬜ **Task 10** — Interfaz (ventana de la app)
- ⬜ **Task 11** — Punto de entrada y prueba completa

> **Estado al 2026-06-18:** 6 de 12 tareas completadas. Toda la lógica que no depende de hardware está construida y con **10 pruebas automáticas en verde**. Lo que falta (audio en vivo, transcripción, interfaz) requiere probarlo con tu micrófono.
