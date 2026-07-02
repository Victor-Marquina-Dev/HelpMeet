# Recorte de vídeo para transcribir solo la parte importante — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir recortar visualmente uno o varios tramos de una grabación y transcribir solo esa parte, en lugar de procesar el vídeo completo.

**Architecture:** Frontend (app.js) añade un recortador estilo CapCut dentro de la tarjeta de grabación: reproductor `<video>` servido por un mini-servidor HTTP local con soporte de Range, línea de tiempo con miniaturas (generadas con PyAV) y manijas de recorte. El backend recibe la lista de tramos, extrae y concatena solo ese audio con PyAV, lo transcribe con faster-whisper y remapea las marcas de tiempo al vídeo original.

**Tech Stack:** Python 3.12, pywebview (WebView2), PyAV (ffmpeg), faster-whisper, http.server, JavaScript/CSS vanilla, pytest.

**Diseño aprobado:** `docs/superpowers/specs/2026-07-02-recorte-video-transcripcion-design.md`

**Nota de nomenclatura:** el parámetro nuevo se llama `clip_segments` en todo el backend para NO colisionar con la variable local `segments` (resultado de `transcribe_file`) que ya existe en `_transcribe_video`.

**Comando de tests (Windows):** `.\.venv\Scripts\python.exe -m pytest <ruta> -v`

---

## Parte 1 — Lógica de tramos (funciones puras)

### Task 1: Normalizar y fusionar tramos

Función pura que ordena, recorta a `[0, duración]`, descarta inválidos y fusiona solapamientos. Vive en un módulo nuevo dedicado a la lógica de tramos.

**Files:**
- Create: `helpmeet/media_segments.py`
- Test: `tests/test_media_segments.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_media_segments.py
from helpmeet.media_segments import normalize_segments


def test_orders_and_merges_overlaps():
    # (1,2) y (1.5,4) se solapan → (1,4); luego (3,5) se solapa con (1,4) → (1,5)
    assert normalize_segments([(3, 5), (1, 2), (1.5, 4)], 10) == [(1.0, 5.0)]


def test_clamps_to_bounds():
    assert normalize_segments([(-1, 3)], 10) == [(0.0, 3.0)]
    assert normalize_segments([(5, 20)], 10) == [(5.0, 10.0)]


def test_drops_empty_or_inverted():
    assert normalize_segments([(5, 5), (4, 2)], 10) == []


def test_keeps_disjoint_sorted():
    assert normalize_segments([(8, 12), (2, 3)], 10) == [(2.0, 3.0), (8.0, 10.0)]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_segments.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'helpmeet.media_segments'`

- [ ] **Step 3: Write minimal implementation**

```python
# helpmeet/media_segments.py
"""Lógica pura de tramos de tiempo para el recorte de vídeo.

Un "tramo" es un par (inicio, fin) en segundos. Estas funciones no tocan
archivos ni PyAV: solo transforman listas de números, así que son fáciles de
probar y de razonar.
"""


def normalize_segments(segments, duration):
    """Devuelve tramos válidos, recortados a [0, duration], ordenados y fusionados.

    - Descarta tramos con fin <= inicio.
    - Recorta inicio a >= 0 y fin a <= duration.
    - Ordena por inicio y fusiona los que se solapan o se tocan.
    """
    cleaned = []
    for seg in segments:
        start = max(0.0, float(seg[0]))
        end = min(float(duration), float(seg[1]))
        if end > start:
            cleaned.append((start, end))
    cleaned.sort(key=lambda s: s[0])
    merged = []
    for start, end in cleaned:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_segments.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add helpmeet/media_segments.py tests/test_media_segments.py
git commit -m "feat(recorte): normalización de tramos de tiempo"
```

---

### Task 2: Remapear tiempo local → tiempo del vídeo original

Tras concatenar los tramos, un tiempo del audio recortado (`local`) debe volver al tiempo del vídeo original (`global`) para que los saltos "ir al minuto X" cuadren.

**Files:**
- Modify: `helpmeet/media_segments.py`
- Test: `tests/test_media_segments.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_media_segments.py  (añadir al final)
from helpmeet.media_segments import map_local_to_global


def test_map_local_to_global_single():
    segs = [(1.0, 3.0)]
    assert map_local_to_global(0.0, segs) == 1.0
    assert map_local_to_global(1.5, segs) == 2.5


def test_map_local_to_global_multi():
    segs = [(1.0, 3.0), (4.0, 5.0)]   # duraciones 2.0 y 1.0
    assert map_local_to_global(0.0, segs) == 1.0    # inicio tramo 1
    assert map_local_to_global(2.0, segs) == 4.0    # inicio tramo 2 (offset local 2.0)
    assert map_local_to_global(2.5, segs) == 4.5


def test_map_local_to_global_past_end_clamps():
    segs = [(1.0, 3.0), (4.0, 5.0)]
    assert map_local_to_global(99.0, segs) == 5.0   # más allá del total → fin del último
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_segments.py::test_map_local_to_global_multi -v`
Expected: FAIL — `ImportError: cannot import name 'map_local_to_global'`

- [ ] **Step 3: Write minimal implementation**

```python
# helpmeet/media_segments.py  (añadir)
def map_local_to_global(local_t, segments):
    """Convierte un tiempo del audio recortado al tiempo del vídeo original.

    `segments` debe estar ya normalizado (ver normalize_segments) y en el mismo
    orden con el que se concatenó el audio. Si `local_t` cae más allá del total,
    devuelve el fin del último tramo.
    """
    acc = 0.0
    for start, end in segments:
        dur = end - start
        if local_t <= acc + dur:
            return start + (local_t - acc)
        acc += dur
    if segments:
        return segments[-1][1]
    return local_t
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_segments.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add helpmeet/media_segments.py tests/test_media_segments.py
git commit -m "feat(recorte): remapeo de tiempos local a global"
```

---

## Parte 2 — Recorte de audio con PyAV

### Task 3: Extraer y concatenar el audio de los tramos a un WAV

**Files:**
- Modify: `helpmeet/media.py`
- Test: `tests/test_media_segments_audio.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_media_segments_audio.py
import wave
import struct
import math
from pathlib import Path
from helpmeet.media import extract_audio_segments_to_wav


def _write_tone_wav(path, seconds, rate=16000):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        for n in range(int(seconds * rate)):
            sample = int(3000 * math.sin(2 * math.pi * 220 * n / rate))
            w.writeframes(struct.pack("<h", sample))


def _wav_duration(path):
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def test_extract_segments_concatenates_durations(tmp_path):
    src = tmp_path / "src.wav"
    dst = tmp_path / "out.wav"
    _write_tone_wav(src, 6.0)                      # 6 segundos de audio
    extract_audio_segments_to_wav(str(src), [(1.0, 3.0), (4.0, 5.0)], str(dst))
    # 2s + 1s = 3s (tolerancia por el seek al keyframe)
    assert abs(_wav_duration(dst) - 3.0) < 0.4


def test_extract_segments_no_audio_raises(tmp_path):
    empty = tmp_path / "empty.txt"
    empty.write_text("no media")
    dst = tmp_path / "out.wav"
    try:
        extract_audio_segments_to_wav(str(empty), [(0.0, 1.0)], str(dst))
        assert False, "debería lanzar excepción"
    except Exception:
        assert not Path(dst).exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_segments_audio.py -v`
Expected: FAIL — `ImportError: cannot import name 'extract_audio_segments_to_wav'`

- [ ] **Step 3: Write minimal implementation**

```python
# helpmeet/media.py  (añadir tras extract_audio_to_wav)
def extract_audio_segments_to_wav(src_path, segments, dest_path, rate=TARGET_RATE):
    """Extrae el audio de cada tramo (inicio, fin) y lo concatena en un WAV mono.

    `segments` es una lista de tuplas en segundos, ya normalizada. Usa seek para
    no decodificar el vídeo entero. Devuelve la ruta del WAV.
    """
    dest = Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    container = av.open(src_path)
    if not container.streams.audio:
        container.close()
        raise ValueError("El archivo no tiene pista de audio.")
    audio_stream = container.streams.audio[0]
    resampler = AudioResampler(format="s16", layout="mono", rate=rate)
    written = 0
    try:
        with wave.open(str(dest), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)

            def write_frames(frames):
                nonlocal written
                for frame in frames:
                    wav.writeframesraw(frame.to_ndarray().tobytes())
                    written += 1

            for start, end in segments:
                # Seek al keyframe anterior a `start` (offset en microsegundos).
                container.seek(int(start * 1_000_000), stream=audio_stream,
                               backward=True, any_frame=False)
                for frame in container.decode(audio=0):
                    t = float(frame.pts * audio_stream.time_base) if frame.pts is not None else 0.0
                    if t < start:
                        continue
                    if t >= end:
                        break
                    write_frames(resampler.resample(frame))
            write_frames(resampler.resample(None))  # vaciar el resampler
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    finally:
        container.close()
    if not written:
        dest.unlink(missing_ok=True)
        raise ValueError("No se pudo extraer audio de los tramos indicados.")
    return str(dest)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_segments_audio.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add helpmeet/media.py tests/test_media_segments_audio.py
git commit -m "feat(recorte): extraer y concatenar audio de tramos con PyAV"
```

---

## Parte 3 — Integración en la transcripción

### Task 4: `_transcribe_video` acepta `clip_segments` y remapea tiempos

Propaga `clip_segments` desde la API pública hasta el worker y, cuando existe, recorta el audio y remapea las marcas de tiempo.

**Files:**
- Modify: `helpmeet/ui/app.py` (`transcribe_meeting_video`, `_enqueue_video_job`, `_transcribe_video`)

- [ ] **Step 1: Ampliar la firma pública `transcribe_meeting_video`**

Reemplazar el método actual (`helpmeet/ui/app.py:1383-1392`) por:

```python
    def transcribe_meeting_video(self, meeting_id, force=False, clip_segments=None):
        """Encola la transcripción del vídeo en SEGUNDO PLANO y vuelve enseguida.

        `clip_segments`: lista opcional de {"start": seg, "end": seg}. Si viene,
        solo se transcribe ese/esos tramos del vídeo."""
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None or not m.audio_path or not os.path.exists(m.audio_path):
            return {"ok": False, "error": "No se encontró el video de esta reunión."}
        if m.utterances and not force:
            return {"ok": True, "already": True, "meeting_id": m.id}
        self._enqueue_video_job(m.id, m.title, m.initiative_id, bool(force), clip_segments)
        return {"ok": True, "queued": True, "meeting_id": m.id}
```

- [ ] **Step 2: Pasar `clip_segments` por la cola de trabajos**

Reemplazar `_enqueue_video_job` (`helpmeet/ui/app.py:1708-1719`) por:

```python
    def _enqueue_video_job(self, meeting_id, title, initiative_id, force, clip_segments=None):
        """Encola la transcripción del .mp4 de una reunión en segundo plano."""
        on_status = lambda text, _mid=meeting_id: self._job_event(_mid, stage=text)
        on_progress = lambda frac, _mid=meeting_id: self._job_event(_mid, progress=frac)

        def run():
            s = get_session()   # sesión propia del worker (otro hilo)
            try:
                self._transcribe_video(s, meeting_id, force, on_status, on_progress,
                                       clip_segments=clip_segments)
            finally:
                s.close()
        self._enqueue_job(meeting_id, title, initiative_id, run)
```

> Nota: las otras dos llamadas a `_enqueue_video_job` (líneas ~1606 y ~2333) no pasan `clip_segments`; al ser un parámetro con valor por defecto `None`, siguen funcionando sin cambios.

- [ ] **Step 3: Recortar y remapear dentro de `_transcribe_video`**

3a. Cambiar la firma (`helpmeet/ui/app.py:1394-1395`) a:

```python
    def _transcribe_video(self, session, meeting_id, force=False,
                          on_status=None, on_progress=None, clip_segments=None):
```

3b. Justo después de crear `wav` y antes de `from helpmeet.media_storage import available_tracks` (sobre la línea 1413), insertar el bloque de recorte:

```python
        # Recorte opcional: si el usuario marcó tramos, se transcribe solo eso.
        clip_norm = None
        if clip_segments:
            from helpmeet.media_segments import normalize_segments
            from helpmeet.media import extract_audio_segments_to_wav, media_duration
            duration = media_duration(m.audio_path)
            clip_norm = normalize_segments(
                [(seg["start"], seg["end"]) for seg in clip_segments], duration)
            if not clip_norm:
                # El worker ignora el valor de retorno: los errores se informan al
                # usuario por excepción (los captura _job_worker y muestra el mensaje).
                raise ValueError("La selección de recorte no es válida.")
```

3c. Sustituir el bloque `tracks = available_tracks(...)` + `if tracks / else` (líneas ~1413-1423) para que, cuando haya recorte, use el audio recortado en vez de las pistas completas:

```python
        from helpmeet.media_storage import available_tracks
        new_segments = []
        try:
            if clip_norm:
                on_status("Recortando el audio seleccionado…")
                extract_audio_segments_to_wav(m.audio_path, clip_norm, str(wav))
                tracks = [("others", wav)]
                on_status("Cargando el modelo de transcripción…")
            else:
                tracks = available_tracks(m.id, m.audio_path)
                if tracks:
                    on_status("Cargando el modelo de transcripción…")
                else:
                    on_status("Extrayendo el audio del video…")
                    extract_audio_to_wav(m.audio_path, str(wav))
                    tracks = [("others", wav)]
                    on_status("Cargando el modelo de transcripción…")
```

3d. En el bucle que acumula frases (líneas ~1445-1449), remapear los tiempos cuando hay recorte:

```python
                for seg in segments:
                    if self._is_job_cancelled(meeting_id):
                        raise _JobCancelled()
                    if not seg.text:
                        continue
                    if clip_norm:
                        from helpmeet.media_segments import map_local_to_global
                        from helpmeet.transcription.segment import TranscribedSegment
                        seg = TranscribedSegment(
                            seg.text,
                            map_local_to_global(seg.start, clip_norm),
                            map_local_to_global(seg.end, clip_norm),
                        )
                    new_segments.append((speaker, seg))
```

- [ ] **Step 4: Verificar que no se rompe la transcripción normal**

Run: `.\.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: PASS (todos los tests existentes siguen verdes; el flujo sin `clip_segments` no cambia).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/ui/app.py
git commit -m "feat(recorte): transcribir solo los tramos seleccionados con remapeo de tiempos"
```

---

## Parte 4 — Servidor de media local

### Task 5: `MediaServer` HTTP con soporte de Range

Sirve los vídeos de reuniones por `127.0.0.1` con `Range` (necesario para que el `<video>` haga seek). Solo resuelve rutas válidas por `meeting_id`.

**Files:**
- Create: `helpmeet/media_server.py`
- Test: `tests/test_media_server.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_media_server.py
import urllib.request
from helpmeet.media_server import MediaServer


def test_serves_range(tmp_path):
    f = tmp_path / "video.mp4"
    f.write_bytes(b"ABCDEFGHIJ")            # 10 bytes conocidos
    server = MediaServer(lambda mid: str(f) if mid == 7 else None)
    base = server.start()
    try:
        req = urllib.request.Request(f"{base}/media/7", headers={"Range": "bytes=0-3"})
        resp = urllib.request.urlopen(req, timeout=5)
        assert resp.status == 206
        assert resp.read() == b"ABCD"
        assert resp.headers["Content-Range"] == "bytes 0-3/10"
    finally:
        server.stop()


def test_unknown_meeting_returns_404(tmp_path):
    server = MediaServer(lambda mid: None)
    base = server.start()
    try:
        try:
            urllib.request.urlopen(f"{base}/media/999", timeout=5)
            assert False, "debería devolver 404"
        except urllib.error.HTTPError as e:
            assert e.code == 404
    finally:
        server.stop()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_server.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'helpmeet.media_server'`

- [ ] **Step 3: Write minimal implementation**

```python
# helpmeet/media_server.py
"""Mini-servidor HTTP local para reproducir vídeos de reuniones dentro de la app.

WebView2 carga la UI desde file://, y desde ahí no puede reproducir otro archivo
local en un <video>. Este servidor sirve el mp4 por http://127.0.0.1 con soporte
de Range (peticiones parciales), que es lo que el <video> necesita para hacer
seek. Solo escucha en localhost y solo resuelve rutas por meeting_id válido.
"""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class MediaServer:
    def __init__(self, resolve_path):
        """`resolve_path(meeting_id) -> ruta_str | None`."""
        self._resolve_path = resolve_path
        self._httpd = None
        self._thread = None
        self.base_url = ""

    def start(self):
        if self._httpd:
            return self.base_url
        resolve = self._resolve_path

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass  # sin ruido en consola

            def do_GET(self):
                parts = self.path.strip("/").split("/")
                if len(parts) != 2 or parts[0] != "media":
                    self.send_error(404)
                    return
                try:
                    mid = int(parts[1])
                except ValueError:
                    self.send_error(404)
                    return
                path = resolve(mid)
                if not path or not Path(path).exists():
                    self.send_error(404)
                    return
                self._serve(Path(path))

            def _serve(self, path):
                size = path.stat().st_size
                rng = self.headers.get("Range")
                start, end, status = 0, size - 1, 200
                if rng and rng.startswith("bytes="):
                    status = 206
                    spec = rng[len("bytes="):].split("-")
                    if spec[0]:
                        start = int(spec[0])
                    if len(spec) > 1 and spec[1]:
                        end = int(spec[1])
                    end = min(end, size - 1)
                length = max(0, end - start + 1)
                self.send_response(status)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(length))
                if status == 206:
                    self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.end_headers()
                with open(path, "rb") as fh:
                    fh.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = fh.read(min(65536, remaining))
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                        except (BrokenPipeError, ConnectionResetError):
                            break
                        remaining -= len(chunk)

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = self._httpd.server_address[1]
        self.base_url = f"http://127.0.0.1:{port}"
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return self.base_url

    def url_for(self, meeting_id):
        return f"{self.base_url}/media/{int(meeting_id)}"

    def stop(self):
        if self._httpd:
            self._httpd.shutdown()
            self._httpd = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_media_server.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add helpmeet/media_server.py tests/test_media_server.py
git commit -m "feat(recorte): servidor de media local con soporte Range"
```

---

## Parte 5 — Miniaturas y arranque del servidor

### Task 6: `get_video_thumbnails` en la clase `Api`

**Files:**
- Modify: `helpmeet/ui/app.py` (dentro de `class Api`, junto a `get_monitor_thumbnails`)

- [ ] **Step 1: Añadir el método**

Insertar en la clase `Api` (por ejemplo justo después de `get_monitor_thumbnails`):

```python
    def get_video_thumbnails(self, meeting_id, count=12):
        """Devuelve `count` miniaturas equiespaciadas del vídeo como JPEG base64.

        Cada elemento: {"t": segundos, "thumb": base64_o_vacío}. Se usa para
        dibujar la línea de tiempo del recortador."""
        import base64
        import av
        from helpmeet.media import media_duration
        from helpmeet.video.preview import _encode_jpeg
        m = repo.get_meeting(self._session, int(meeting_id))
        if not m or not m.audio_path or not os.path.exists(m.audio_path):
            return []
        path = m.audio_path
        duration = media_duration(path)
        if duration <= 0:
            return []
        count = max(1, min(int(count), 40))
        THUMB_H = 60
        result = []
        try:
            container = av.open(path)
            if not container.streams.video:
                container.close()
                return []
            stream = container.streams.video[0]
            for i in range(count):
                t = duration * (i + 0.5) / count
                try:
                    container.seek(int(t * 1_000_000), stream=stream,
                                   backward=True, any_frame=False)
                    frame = next(container.decode(video=0))
                    sw, sh = frame.width, frame.height
                    tw = max(2, int(sw * THUMB_H / sh))
                    tw -= tw % 2
                    scaled = frame.reformat(width=tw, height=THUMB_H,
                                            format="yuvj420p", interpolation="LANCZOS")
                    jpeg = _encode_jpeg(scaled, tw, THUMB_H)
                    b64 = base64.b64encode(jpeg).decode() if jpeg else ""
                except Exception:
                    b64 = ""
                result.append({"t": round(t, 2), "thumb": b64})
            container.close()
        except Exception:
            return result
        return result
```

- [ ] **Step 2: Smoke test manual (no unitario: requiere un vídeo real)**

Verificación diferida a la Task 10 (al lanzar la app con una grabación real). Aquí solo se comprueba que el módulo importa sin errores de sintaxis:

Run: `.\.venv\Scripts\python.exe -c "import helpmeet.ui.app"`
Expected: sin salida (importa correctamente).

- [ ] **Step 3: Commit**

```bash
git add helpmeet/ui/app.py
git commit -m "feat(recorte): miniaturas de vídeo para la línea de tiempo"
```

---

### Task 7: Arrancar el `MediaServer` y exponer la URL a la UI

**Files:**
- Modify: `helpmeet/ui/app.py` (`class Api`: `set_media_server`, `get_media_video_url`; función `run`)

- [ ] **Step 1: Métodos en `Api`**

Añadir en la clase `Api` (junto a `set_window`):

```python
    def set_media_server(self, server):
        self._media_server = server

    def get_media_video_url(self, meeting_id):
        """URL local para reproducir el vídeo de la reunión en un <video>."""
        srv = getattr(self, "_media_server", None)
        if not srv:
            return None
        return srv.url_for(int(meeting_id))
```

- [ ] **Step 2: Arrancar el servidor en `run()`**

En `run()` (`helpmeet/ui/app.py:2602-2610`), justo después de `api = Api()` y antes de `webview.create_window(...)`, añadir:

```python
    from helpmeet.media_server import MediaServer

    def _resolve_video(mid):
        s = get_session()   # sesión propia: el server corre en otro hilo
        try:
            mm = repo.get_meeting(s, int(mid))
            return mm.audio_path if mm and mm.audio_path else None
        finally:
            s.close()

    media_server = MediaServer(_resolve_video)
    media_server.start()
    api.set_media_server(media_server)
```

- [ ] **Step 3: Verificar arranque**

Run: `.\.venv\Scripts\python.exe -c "from helpmeet.media_server import MediaServer; s=MediaServer(lambda m: None); print(s.start()); s.stop()"`
Expected: imprime una URL tipo `http://127.0.0.1:XXXXX`.

- [ ] **Step 4: Commit**

```bash
git add helpmeet/ui/app.py
git commit -m "feat(recorte): arrancar servidor de media y exponer URL a la UI"
```

---

## Parte 6 — Interfaz del recortador

### Task 8: Puente JS (API mapping)

**Files:**
- Modify: `helpmeet/ui/web/app.js` (bloque `api` con los `call(...)`, sobre la línea 164)

- [ ] **Step 1: Ampliar/añadir los métodos**

Reemplazar la línea 164:

```javascript
  transcribeMeetingVideo: (mid, force) => call('transcribe_meeting_video', mid, !!force),
```

por:

```javascript
  transcribeMeetingVideo: (mid, force, clipSegments) => call('transcribe_meeting_video', mid, !!force, clipSegments || null),
  getVideoThumbnails: (mid, count) => call('get_video_thumbnails', mid, count || 12),
  getMediaVideoUrl: (mid) => call('get_media_video_url', mid),
```

- [ ] **Step 2: Verificar sintaxis JS**

Run: `.\.venv\Scripts\python.exe -c "import subprocess,sys; sys.exit(subprocess.call(['node','--check','helpmeet/ui/web/app.js']))"`
Expected: sin errores (exit 0). Si `node` no está disponible, revisar visualmente el bloque.

- [ ] **Step 3: Commit**

```bash
git add helpmeet/ui/web/app.js
git commit -m "feat(recorte): puente JS para recorte y miniaturas"
```

---

### Task 9: Componente recortador en `videoPanel`

Amplía la tarjeta de grabación con el botón "Recortar y transcribir" que abre el acordeón con reproductor, línea de tiempo con miniaturas, manijas y lista de trozos.

**Files:**
- Modify: `helpmeet/ui/web/app.js` (`videoPanel`, sobre la línea 1927; y `transcribeScreenVideo`, línea 1956)

- [ ] **Step 1: Cambiar el botón para abrir el recortador**

En `videoPanel` (líneas 1944-1951), reemplazar el `onclick` del botón para que, en vez de transcribir directo, abra el recortador:

```javascript
  const bt = el('button', hasTx ? 'btn' : 'btn btn-primary', hasTx ? 'Retranscribir' : 'Recortar y transcribir');
  bt.onclick = () => openClipEditor(wrap, t, hasTx);
  actions.appendChild(bt);
```

- [ ] **Step 2: Añadir la función `openClipEditor`**

Insertar después de `videoPanel` (antes de `transcribeScreenVideo`):

```javascript
// Recortador estilo CapCut: reproductor + línea de tiempo con miniaturas + manijas.
async function openClipEditor(wrap, t, isRetx) {
  if (wrap.querySelector('.clip-editor')) { wrap.querySelector('.clip-editor').remove(); return; }
  const mid = t.meeting_id || STATE.selMeeting;
  const url = await api.getMediaVideoUrl(mid);
  const ed = el('div', 'clip-editor');
  ed.innerHTML = `
    <video class="clip-video" src="${esc(url || '')}" preload="metadata"></video>
    <div class="clip-tl">
      <div class="clip-thumbs"></div>
      <div class="clip-sel"><span class="clip-h l"></span><span class="clip-h r"></span></div>
      <div class="clip-cursor"></div>
    </div>
    <div class="clip-scale"><span>0:00</span><span class="clip-dur">--:--</span></div>
    <div class="clip-segs"></div>
    <div class="clip-foot">
      <div class="clip-total">Marca un trozo para transcribir</div>
      <div class="clip-actions">
        <button class="btn clip-cancel">Cancelar</button>
        <button class="btn btn-primary clip-go" disabled>Transcribir selección →</button>
      </div>
    </div>`;
  wrap.appendChild(ed);

  const video = ed.querySelector('.clip-video');
  const tl = ed.querySelector('.clip-tl');
  const sel = ed.querySelector('.clip-sel');
  const hL = sel.querySelector('.l'), hR = sel.querySelector('.r');
  const cursor = ed.querySelector('.clip-cursor');
  const segsBox = ed.querySelector('.clip-segs');
  const totalEl = ed.querySelector('.clip-total');
  const goBtn = ed.querySelector('.clip-go');
  const state = { dur: 0, a: 0, b: 0, segs: [] };
  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

  // Miniaturas
  api.getVideoThumbnails(mid, 12).then(thumbs => {
    ed.querySelector('.clip-thumbs').innerHTML = (thumbs || []).map(th =>
      `<i style="background-image:url(data:image/jpeg;base64,${th.thumb})"></i>`).join('');
  });

  function paintSel() {
    const w = tl.clientWidth || 1;
    sel.style.left = (state.a / state.dur * 100) + '%';
    sel.style.width = ((state.b - state.a) / state.dur * 100) + '%';
    const secs = Math.max(0, state.b - state.a);
    totalEl.innerHTML = `Se transcribirá <b>${fmt(secs)}</b> de ${fmt(state.dur)}`;
    goBtn.disabled = secs < 0.5 && state.segs.length === 0;
  }
  function paintSegs() {
    segsBox.innerHTML = state.segs.map((s, i) =>
      `<span class="clip-pill" data-i="${i}">Trozo ${i+1} · ${fmt(s.start)}–${fmt(s.end)} <span class="x">✕</span></span>`
    ).join('') + `<button class="clip-add">+ añadir otro trozo</button>`;
    segsBox.querySelectorAll('.x').forEach(x => x.onclick = e => {
      state.segs.splice(+e.target.closest('.clip-pill').dataset.i, 1); paintSegs(); updateGo();
    });
    segsBox.querySelector('.clip-add').onclick = () => {
      if (state.b - state.a >= 0.5) { state.segs.push({ start: state.a, end: state.b }); paintSegs(); updateGo(); }
    };
  }
  function updateGo() {
    const pending = (state.b - state.a) >= 0.5 ? 1 : 0;
    goBtn.disabled = (state.segs.length + pending) === 0;
  }

  video.addEventListener('loadedmetadata', () => {
    state.dur = video.duration || 0;
    state.a = 0; state.b = state.dur;
    ed.querySelector('.clip-dur').textContent = fmt(state.dur);
    paintSel(); paintSegs();
  });
  video.addEventListener('timeupdate', () => {
    if (state.dur) cursor.style.left = (video.currentTime / state.dur * 100) + '%';
  });

  // Arrastre de manijas
  function drag(handle, isLeft) {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
      const move = ev => {
        const rect = tl.getBoundingClientRect();
        let frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
        const t2 = frac * state.dur;
        if (isLeft) state.a = Math.min(t2, state.b - 0.2);
        else state.b = Math.max(t2, state.a + 0.2);
        paintSel(); updateGo();
      };
      const up = ev => { handle.releasePointerCapture(e.pointerId); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }
  drag(hL, true); drag(hR, false);

  // Clic en la línea de tiempo → mover el cursor de reproducción
  tl.addEventListener('click', e => {
    if (e.target.classList.contains('clip-h')) return;
    const rect = tl.getBoundingClientRect();
    video.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * state.dur;
  });

  ed.querySelector('.clip-cancel').onclick = () => ed.remove();
  goBtn.onclick = async () => {
    const all = state.segs.slice();
    if ((state.b - state.a) >= 0.5) all.push({ start: state.a, end: state.b });
    if (!all.length) return;
    goBtn.disabled = true; goBtn.textContent = 'Transcribiendo…';
    ed.remove();
    await transcribeScreenVideo(mid, isRetx, all);
  };
}
```

- [ ] **Step 3: `transcribeScreenVideo` acepta los tramos**

Reemplazar la firma y la llamada en `transcribeScreenVideo` (líneas 1956-1960):

```javascript
async function transcribeScreenVideo(mid, force, clipSegments) {
  let f = null;
  try { f = await api.transcribeMeetingVideo(mid, force, clipSegments || null); }
  catch (e) { f = { ok: false, error: e && e.message }; }
```

(el resto de la función se mantiene igual).

- [ ] **Step 4: Verificación manual**

Diferida a la Task 10 (necesita estilos). Aquí solo comprobar sintaxis:

Run: `.\.venv\Scripts\python.exe -c "import subprocess,sys; sys.exit(subprocess.call(['node','--check','helpmeet/ui/web/app.js']))"`
Expected: exit 0 (o revisión visual si no hay `node`).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/ui/web/app.js
git commit -m "feat(recorte): recortador visual en la tarjeta de grabación"
```

---

### Task 10: Estilos del recortador + verificación en la app

**Files:**
- Modify: `helpmeet/ui/web/style.css`
- Modify: `helpmeet/ui/web/index.html` (cache buster)

- [ ] **Step 1: Añadir los estilos**

Añadir al final de `helpmeet/ui/web/style.css`:

```css
/* ---- Recortador de vídeo (estilo CapCut) ---- */
.clip-editor { margin-top: 10px; padding: 12px; background: var(--bg-surface);
  border: 1px solid var(--border-subtle); border-radius: var(--r-lg);
  display: flex; flex-direction: column; gap: 10px; animation: setupFadeIn .2s ease; }
.clip-video { width: 100%; max-height: 220px; background: #000; border-radius: var(--r-md); }
.clip-tl { position: relative; height: 46px; border-radius: var(--r-md); overflow: hidden;
  border: 1px solid var(--border-subtle); cursor: pointer; }
.clip-thumbs { display: flex; height: 100%; }
.clip-thumbs i { flex: 1; background-size: cover; background-position: center;
  border-right: 1px solid rgba(0,0,0,.3); }
.clip-sel { position: absolute; top: 0; bottom: 0; border: 2px solid var(--accent);
  background: rgba(170,207,191,.16); box-sizing: border-box; }
.clip-h { position: absolute; top: 50%; transform: translateY(-50%); width: 9px; height: 66%;
  background: var(--accent); border-radius: 3px; cursor: ew-resize; touch-action: none; }
.clip-h.l { left: -5px; } .clip-h.r { right: -5px; }
.clip-cursor { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #fff; pointer-events: none; }
.clip-scale { display: flex; justify-content: space-between; font-family: var(--font-mono);
  font-size: 9px; color: var(--text-faint); }
.clip-segs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.clip-pill { background: var(--accent-soft); border: 1px solid var(--accent); color: #cce8dc;
  border-radius: var(--r-pill); padding: 4px 10px; font-size: 11px; font-family: var(--font-mono);
  display: inline-flex; align-items: center; gap: 6px; }
.clip-pill .x { color: var(--text-muted); cursor: pointer; }
.clip-add { background: transparent; border: 1px dashed var(--border-strong); color: var(--text-muted);
  border-radius: var(--r-pill); padding: 4px 10px; font-size: 11px; cursor: pointer; }
.clip-foot { display: flex; align-items: center; justify-content: space-between;
  border-top: 1px dashed var(--border-subtle); padding-top: 10px; }
.clip-total { font-size: 11.5px; color: var(--accent); }
.clip-total b { color: var(--text-primary); }
.clip-actions { display: flex; gap: 8px; }
```

- [ ] **Step 2: Subir el cache buster**

En `helpmeet/ui/web/index.html`, reemplazar `?v=20260701-22` por `?v=20260702-01` (en las dos referencias: `style.css` y `app.js`).

- [ ] **Step 3: Verificación manual en la app**

```bash
# Preparar una reunión con grabación .mp4 (usar una existente).
.\.venv\Scripts\python.exe -c "from helpmeet.ui.app import run; run()"
```

Comprobar a mano:
1. Abrir una reunión con grabación de pantalla.
2. Pulsar "Recortar y transcribir" → se abre el acordeón con el vídeo reproducible dentro de la app.
3. Aparecen las miniaturas en la línea de tiempo.
4. Arrastrar las manijas cambia el trozo y el texto "Se transcribirá X de Y".
5. "+ añadir otro trozo" añade una píldora.
6. "Transcribir selección" transcribe solo lo marcado; al terminar, los tiempos de las frases cuadran con el vídeo.

Expected: todo lo anterior funciona; el vídeo se ve y se reproduce dentro de la app.

- [ ] **Step 4: Commit**

```bash
git add helpmeet/ui/web/style.css helpmeet/ui/web/index.html
git commit -m "feat(recorte): estilos del recortador y cache buster"
```

---

## Verificación final

- [ ] **Toda la suite en verde**

Run: `.\.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: PASS (incluye los nuevos: `test_media_segments.py`, `test_media_segments_audio.py`, `test_media_server.py`).

- [ ] **Prueba de extremo a extremo** (manual, con una grabación real): recortar un tramo, transcribir, y confirmar que solo se transcribió esa parte y que al pulsar una frase el vídeo salta al momento correcto.

---

## Notas de decisiones (del spec)

- **Solo transcripción:** el recorte NO exporta un vídeo nuevo; solo alimenta la transcripción.
- **Uno o varios trozos:** el modelo es una lista; la UI arranca con un trozo (toda la grabación) y permite añadir más.
- **Compatibilidad:** sin `clip_segments`, el flujo de transcripción actual no cambia.
- **Fuera de alcance:** edición avanzada (transiciones, subtítulos quemados) y recorte de reuniones solo-audio.
