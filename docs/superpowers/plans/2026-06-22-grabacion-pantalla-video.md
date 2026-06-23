# 🎥 Grabación de pantalla con video — Plan de implementación

> **Para quien ejecuta:** implementar tarea a tarea. Los pasos usan casillas (`- [ ]`).
> **Nota sobre git:** los `commit` son locales; el *push* al remoto se hace solo cuando Víctor lo pida (es su flujo habitual). Se puede agrupar el commit al final de cada tarea.

**Goal:** Añadir un botón **🎥 Grabar pantalla** que graba un monitor a `.mp4` con sonido (sistema + micrófono) y lo guarda en la carpeta de la iniciativa seleccionada.

**Architecture:** PyAV captura la pantalla con `gdigrab` y la codifica a H.264 en un archivo temporal mientras se graba. El audio se captura aparte con el `DualAudioRecorder` (WASAPI) ya existente. Al detener, se mezclan las pistas de audio y se unen (mux) al video en el `.mp4` final. No hace falta instalar nada (verificado: PyAV trae gdigrab + h264).

**Tech Stack:** Python 3.12, PyAV 12.3.0 (gdigrab + libx264 + AAC), pyaudiowpatch (WASAPI), mss (geometría de monitores), pywebview (UI), pytest.

**Comando de tests:** `./.venv/Scripts/python.exe -m pytest <ruta> -v`

---

## Estructura de archivos

- **Crear** `helpmeet/audio/mixing.py` — mezcla dos WAV (mic + sistema) en uno.
- **Crear** `helpmeet/video/__init__.py` — paquete nuevo.
- **Crear** `helpmeet/video/recorder.py` — clase `ScreenVideoRecorder`.
- **Crear** `tests/test_mixing.py`, `tests/test_video_recorder.py`.
- **Modificar** `helpmeet/export/exporter.py` — `initiative_export_dir()`.
- **Modificar** `helpmeet/screenshot/capture.py` — `left/top` + `monitor_geometry()`.
- **Modificar** `helpmeet/config.py` — constantes de video.
- **Modificar** `helpmeet/ui/app.py` — API `start_screen_recording` / `stop_screen_recording`.
- **Modificar** `helpmeet/ui/web/index.html`, `app.js`, `style.css` — botón + indicador REC.
- **Modificar** `tests/test_exporter.py`, `tests/test_screenshot.py` — tests de los helpers nuevos.

---

## Task 1: Helper `initiative_export_dir` en el exporter

**Files:**
- Modify: `helpmeet/export/exporter.py`
- Test: `tests/test_exporter.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `tests/test_exporter.py`:

```python
def test_initiative_export_dir_uses_slug_and_creates(session, tmp_path):
    from helpmeet.export.exporter import initiative_export_dir
    ini = repo.create_initiative(session, "Mi Proyecto Nuevo")
    out = initiative_export_dir(ini, tmp_path)
    assert out == tmp_path / "mi-proyecto-nuevo"
    assert out.exists() and out.is_dir()
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exporter.py::test_initiative_export_dir_uses_slug_and_creates -v`
Expected: FAIL con `ImportError: cannot import name 'initiative_export_dir'`.

- [ ] **Step 3: Implementar el helper**

En `helpmeet/export/exporter.py`, justo después de `meeting_export_dir` (línea ~119), añadir:

```python
def initiative_export_dir(initiative: Initiative, base_dir: Path) -> Path:
    """Carpeta de exportación de una iniciativa (la crea si no existe)."""
    out_dir = Path(base_dir) / _slug(initiative.name)
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir
```

Y en `_export_initiative_folder`, reemplazar la línea `out_dir = Path(base_dir) / _slug(ini.name)` por:

```python
    out_dir = initiative_export_dir(ini, base_dir)
```

- [ ] **Step 4: Ejecutar y ver que pasa (y no rompe el resto)**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exporter.py -v`
Expected: PASS todos.

- [ ] **Step 5: Commit**

```bash
git add helpmeet/export/exporter.py tests/test_exporter.py
git commit -m "feat: helper initiative_export_dir para la carpeta de una iniciativa"
```

---

## Task 2: Geometría de monitores (left/top) para gdigrab

**Files:**
- Modify: `helpmeet/screenshot/capture.py`
- Test: `tests/test_screenshot.py`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `tests/test_screenshot.py`:

```python
def test_list_monitors_includes_geometry():
    from helpmeet.screenshot.capture import list_monitors
    mons = list_monitors()
    assert mons  # al menos un monitor
    for key in ("index", "left", "top", "width", "height"):
        assert key in mons[0]
    assert mons[0]["width"] > 0 and mons[0]["height"] > 0


def test_monitor_geometry_returns_box():
    from helpmeet.screenshot.capture import monitor_geometry
    g = monitor_geometry(1)
    assert set(g) == {"left", "top", "width", "height"}
    assert g["width"] > 0 and g["height"] > 0
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_screenshot.py -v`
Expected: FAIL (`monitor_geometry` no existe; `list_monitors` no tiene `left`).

- [ ] **Step 3: Implementar**

En `helpmeet/screenshot/capture.py`, reemplazar `list_monitors` y añadir `monitor_geometry`:

```python
def list_monitors() -> list[dict]:
    """Lista las pantallas disponibles (índice 1 = principal)."""
    with mss.mss() as sct:
        mons = sct.monitors  # [0] = todas juntas; [1..] = cada pantalla
    out = []
    for i in range(1, len(mons)):
        m = mons[i]
        out.append({
            "index": i, "left": m["left"], "top": m["top"],
            "width": m["width"], "height": m["height"],
        })
    return out


def monitor_geometry(monitor_index: int = 1) -> dict:
    """Geometría (left, top, width, height) del monitor indicado."""
    with mss.mss() as sct:
        m = sct.monitors[monitor_index]
    return {"left": m["left"], "top": m["top"],
            "width": m["width"], "height": m["height"]}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_screenshot.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add helpmeet/screenshot/capture.py tests/test_screenshot.py
git commit -m "feat: geometria de monitores (left/top) y monitor_geometry para gdigrab"
```

---

## Task 3: Mezclar audio (`mix_wavs`)

**Files:**
- Create: `helpmeet/audio/mixing.py`
- Test: `tests/test_mixing.py`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_mixing.py`:

```python
import wave
import numpy as np
from helpmeet.audio.mixing import mix_wavs


def _tone(path, rate, seconds, freq):
    n = int(rate * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    data = (np.sin(2 * np.pi * freq * t) * 8000).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(data.tobytes())


def test_mix_wavs_combines_two_tracks(tmp_path):
    me, others, out = tmp_path / "me.wav", tmp_path / "others.wav", tmp_path / "mix.wav"
    _tone(me, 44100, 0.5, 440)
    _tone(others, 48000, 1.0, 880)   # la más larga manda
    assert mix_wavs(me, others, out) is True
    with wave.open(str(out), "rb") as w:
        assert w.getframerate() == 48000
        assert w.getnchannels() == 2
        dur = w.getnframes() / w.getframerate()
        raw = w.readframes(w.getnframes())
    assert abs(dur - 1.0) < 0.05
    assert np.abs(np.frombuffer(raw, dtype=np.int16)).max() > 0  # no es silencio


def test_mix_wavs_one_track_only(tmp_path):
    me, out = tmp_path / "me.wav", tmp_path / "mix.wav"
    _tone(me, 44100, 0.3, 440)
    assert mix_wavs(me, tmp_path / "missing.wav", out) is True
    assert out.exists()


def test_mix_wavs_no_audio_returns_false(tmp_path):
    out = tmp_path / "mix.wav"
    assert mix_wavs(tmp_path / "no1.wav", tmp_path / "no2.wav", out) is False
    assert not out.exists()
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_mixing.py -v`
Expected: FAIL con `ModuleNotFoundError: helpmeet.audio.mixing`.

- [ ] **Step 3: Implementar `mix_wavs`**

Crear `helpmeet/audio/mixing.py`:

```python
import wave
import numpy as np


def _read_wav(path):
    """Devuelve (muestras float32 mono, rate) o (None, None) si no se puede."""
    try:
        with wave.open(str(path), "rb") as w:
            rate = w.getframerate()
            ch = w.getnchannels()
            raw = w.readframes(w.getnframes())
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
        if data.size == 0:
            return None, None
        if ch > 1:
            data = data.reshape(-1, ch).mean(axis=1)
        return data, rate
    except Exception:
        return None, None


def _resample(data, src_rate, dst_rate):
    if data is None or src_rate == dst_rate:
        return data
    n_out = int(len(data) * dst_rate / src_rate)
    if n_out <= 0:
        return data
    return np.interp(
        np.linspace(0, 1, n_out, endpoint=False),
        np.linspace(0, 1, len(data), endpoint=False),
        data,
    )


def mix_wavs(me_wav, others_wav, out_wav, rate: int = 48000) -> bool:
    """Mezcla dos WAV (micrófono + sistema) en un WAV estéreo a `rate`.

    - Si falta una pista, usa solo la disponible.
    - Iguala longitudes (rellena la más corta) y protege de saturación (clip).
    - Devuelve True si escribió audio, False si no había nada que mezclar.
    """
    a, ra = _read_wav(me_wav)
    b, rb = _read_wav(others_wav)
    a = _resample(a, ra, rate)
    b = _resample(b, rb, rate)
    tracks = [t for t in (a, b) if t is not None]
    if not tracks:
        return False
    n = max(len(t) for t in tracks)
    mixed = np.zeros(n, dtype=np.float32)
    for t in tracks:
        padded = np.zeros(n, dtype=np.float32)
        padded[: len(t)] = t
        mixed += padded
    mixed = np.clip(mixed, -32768, 32767).astype(np.int16)
    stereo = np.column_stack([mixed, mixed]).reshape(-1)
    with wave.open(str(out_wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(stereo.tobytes())
    return True
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_mixing.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/audio/mixing.py tests/test_mixing.py
git commit -m "feat: mix_wavs mezcla microfono + sistema en un WAV estereo"
```

---

## Task 4: Constantes de video en config

**Files:**
- Modify: `helpmeet/config.py`

- [ ] **Step 1: Añadir constantes**

En `helpmeet/config.py`, antes de `def ensure_dirs()`, añadir:

```python
# Grabación de pantalla (video)
VIDEO_FPS = 30
VIDEO_CODEC = "libx264"
VIDEO_PRESET = "veryfast"   # rápido para no soltar fotogramas al grabar
VIDEO_CRF = "18"            # calidad alta (menor = mejor; 18 ≈ sin pérdida visible)
VIDEO_AUDIO_RATE = 48000
```

- [ ] **Step 2: Verificar que importa**

Run: `./.venv/Scripts/python.exe -c "from helpmeet import config; print(config.VIDEO_FPS, config.VIDEO_PRESET)"`
Expected: `30 veryfast`

- [ ] **Step 3: Commit**

```bash
git add helpmeet/config.py
git commit -m "chore: constantes de configuracion para grabacion de video"
```

---

## Task 5: `ScreenVideoRecorder` (núcleo)

**Files:**
- Create: `helpmeet/video/__init__.py` (vacío)
- Create: `helpmeet/video/recorder.py`
- Test: `tests/test_video_recorder.py`

- [ ] **Step 1: Crear el paquete**

Crear `helpmeet/video/__init__.py` vacío.

- [ ] **Step 2: Escribir el smoke test (requiere pantalla real, como test_screenshot)**

Crear `tests/test_video_recorder.py`:

```python
import time
import av
from helpmeet.video.recorder import ScreenVideoRecorder
from helpmeet.screenshot.capture import monitor_geometry


def test_screen_recorder_creates_playable_mp4(tmp_path):
    dest = tmp_path / "rec.mp4"
    rec = ScreenVideoRecorder(dest, monitor_geometry(1))
    rec.start()
    time.sleep(2)
    result = rec.stop()

    assert result["ok"] is True
    assert dest.exists() and dest.stat().st_size > 0
    c = av.open(str(dest))
    try:
        assert c.streams.video, "debe tener stream de video"
        dur = float(c.duration) / av.time_base if c.duration else 0.0
    finally:
        c.close()
    assert dur > 0.5  # ~2 s grabados
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_video_recorder.py -v`
Expected: FAIL con `ModuleNotFoundError: helpmeet.video.recorder`.

- [ ] **Step 4: Implementar `ScreenVideoRecorder`**

Crear `helpmeet/video/recorder.py`:

```python
import threading
from pathlib import Path
import av
from helpmeet import config
from helpmeet.audio.capture import DualAudioRecorder
from helpmeet.audio.mixing import mix_wavs


class ScreenVideoRecorder:
    """Graba un monitor a .mp4 con sonido (sistema + micrófono).

    El video se captura con gdigrab y se codifica a H.264 en un temporal
    mientras se graba; el audio se captura aparte (WASAPI) y se une al final.
    """

    def __init__(self, dest_path, monitor, fps=None, on_status=None):
        self.dest_path = Path(dest_path)
        self.monitor = monitor  # {"left","top","width","height"}
        self.fps = fps or config.VIDEO_FPS
        self.on_status = on_status
        self._running = False
        self._thread = None
        self._tmp_dir = config.DATA_DIR / "tmp_video"
        self._tmp_video = self._tmp_dir / "video_temp.mp4"
        self._audio = None
        self._frames = 0
        self._error = None

    def _status(self, text):
        if self.on_status:
            self.on_status(text)

    def start(self):
        self._tmp_dir.mkdir(parents=True, exist_ok=True)
        self._running = True
        self._audio = DualAudioRecorder(self._tmp_dir)
        self._audio.start()
        self._thread = threading.Thread(target=self._record_video, daemon=True)
        self._thread.start()

    def _record_video(self):
        w = self.monitor["width"] - (self.monitor["width"] % 2)   # pares (yuv420p)
        h = self.monitor["height"] - (self.monitor["height"] % 2)
        try:
            inp = av.open("desktop", format="gdigrab", options={
                "framerate": str(self.fps),
                "offset_x": str(self.monitor["left"]),
                "offset_y": str(self.monitor["top"]),
                "video_size": f"{w}x{h}",
                "draw_mouse": "1",
            })
        except Exception as exc:  # noqa: BLE001
            self._error = f"No se pudo iniciar la captura de pantalla: {exc}"
            self._status("🎥 Error al iniciar la grabación")
            return

        out = av.open(str(self._tmp_video), "w")
        stream = out.add_stream(config.VIDEO_CODEC, rate=self.fps)
        stream.width = w
        stream.height = h
        stream.pix_fmt = "yuv420p"
        stream.options = {"preset": config.VIDEO_PRESET, "crf": config.VIDEO_CRF}
        in_stream = inp.streams.video[0]
        try:
            for frame in inp.decode(in_stream):
                if not self._running:
                    break
                img = frame.reformat(format="yuv420p")
                img.pts = None  # CFR: el codificador asigna PTS a `fps`
                for pkt in stream.encode(img):
                    out.mux(pkt)
                self._frames += 1
        finally:
            for pkt in stream.encode():   # vaciar el codificador
                out.mux(pkt)
            out.close()
            inp.close()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=30)
        if self._audio:
            self._audio.stop()

        if self._error:
            self._status(self._error)
            return {"ok": False, "error": self._error}
        if self._frames == 0 or not self._tmp_video.exists():
            self._status("🎥 No se grabó nada")
            self._cleanup()
            return {"ok": False, "error": "No se capturó ningún fotograma."}

        self._status("🎥 Guardando el video…")
        mixed = self._tmp_dir / "mixed.wav"
        has_audio = mix_wavs(self._tmp_dir / "me.wav",
                             self._tmp_dir / "others.wav",
                             mixed, rate=config.VIDEO_AUDIO_RATE)
        try:
            self._mux(mixed if has_audio else None)
        except Exception as exc:  # noqa: BLE001 - conservar el video aunque falle el audio
            try:
                self._tmp_video.replace(self.dest_path)
            except Exception:
                pass
            self._status("🎥 Video guardado (sin sonido por un error al unir)")
            return {"ok": True, "path": str(self.dest_path),
                    "audio": False, "warning": str(exc)}

        self._cleanup()
        self._status("")
        return {"ok": True, "path": str(self.dest_path), "audio": has_audio}

    def _mux(self, audio_wav):
        self.dest_path.parent.mkdir(parents=True, exist_ok=True)
        vin = av.open(str(self._tmp_video))
        out = av.open(str(self.dest_path), "w")
        in_v = vin.streams.video[0]
        out_v = out.add_stream(template=in_v)  # copia el video sin recodificar
        for pkt in vin.demux(in_v):
            if pkt.dts is None:
                continue
            pkt.stream = out_v
            out.mux(pkt)
        if audio_wav is not None:
            ain = av.open(str(audio_wav))
            out_a = out.add_stream("aac", rate=config.VIDEO_AUDIO_RATE)
            for frame in ain.decode(ain.streams.audio[0]):
                frame.pts = None
                for pkt in out_a.encode(frame):
                    out.mux(pkt)
            for pkt in out_a.encode():
                out.mux(pkt)
            ain.close()
        out.close()
        vin.close()

    def _cleanup(self):
        for name in ("video_temp.mp4", "me.wav", "others.wav", "mixed.wav"):
            p = self._tmp_dir / name
            try:
                if p.exists():
                    p.unlink()
            except Exception:
                pass
```

- [ ] **Step 5: Ejecutar el smoke test (en el PC de Víctor, con pantalla real)**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_video_recorder.py -v`
Expected: PASS. Genera un `.mp4` de ~2 s con stream de video.
Si falla por sincronía/duración, revisar primero el encode CFR antes de tocar otra cosa (ver nota de limitaciones en el spec).

- [ ] **Step 6: Commit**

```bash
git add helpmeet/video/__init__.py helpmeet/video/recorder.py tests/test_video_recorder.py
git commit -m "feat: ScreenVideoRecorder graba pantalla (gdigrab) + audio (WASAPI) a mp4"
```

---

## Task 6: API en `app.py` (start/stop)

**Files:**
- Modify: `helpmeet/ui/app.py`

- [ ] **Step 1: Inicializar el estado**

En `Api.__init__` (tras `self._recorder = None`, línea ~49), añadir:

```python
        self._screen_rec = None
```

- [ ] **Step 2: Añadir los métodos de la API**

En `helpmeet/ui/app.py`, dentro de la clase `Api` (p. ej. después de `add_note`, línea ~202), añadir:

```python
    def start_screen_recording(self, initiative_id, monitor_index=1):
        """Empieza a grabar la pantalla del monitor indicado a un .mp4 en la
        carpeta de la iniciativa. Independiente de la transcripción."""
        from helpmeet.db.models import Initiative
        from helpmeet.video.recorder import ScreenVideoRecorder
        from helpmeet.screenshot.capture import monitor_geometry
        from helpmeet.export.exporter import initiative_export_dir
        from datetime import datetime

        if self._screen_rec is not None:
            return {"ok": False, "error": "Ya hay una grabación de pantalla en curso."}
        ini = self._session.get(Initiative, int(initiative_id))
        if ini is None:
            return {"ok": False, "error": "Selecciona una iniciativa primero."}

        mon = monitor_geometry(int(monitor_index))
        folder = initiative_export_dir(ini, settings.get_export_dir())
        dest = folder / f"{datetime.now():%Y-%m-%d_%H-%M-%S}_grabacion.mp4"
        rec = ScreenVideoRecorder(dest, mon, on_status=self._push_status)
        try:
            rec.start()
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}
        self._screen_rec = rec
        self._push_status("🎥 Grabando pantalla…")
        return {"ok": True}

    def stop_screen_recording(self):
        """Detiene la grabación de pantalla y devuelve la ruta del .mp4."""
        rec = self._screen_rec
        if rec is None:
            return {"ok": False, "error": "No hay grabación de pantalla en curso."}
        result = rec.stop()
        self._screen_rec = None
        return result
```

- [ ] **Step 3: Verificar que la app importa sin errores**

Run: `./.venv/Scripts/python.exe -c "from helpmeet.ui.app import Api; print('ok')"`
Expected: `ok` (sin trazas de error).

- [ ] **Step 4: Commit**

```bash
git add helpmeet/ui/app.py
git commit -m "feat: API start/stop_screen_recording en la UI"
```

---

## Task 7: Interfaz (botón 🎥 + indicador REC)

**Files:**
- Modify: `helpmeet/ui/web/index.html`
- Modify: `helpmeet/ui/web/app.js`
- Modify: `helpmeet/ui/web/style.css`

- [ ] **Step 1: Botón en el HTML**

En `helpmeet/ui/web/index.html`, tras la línea 16 (`btnImport`), añadir:

```html
    <button id="btnScreenRec" class="btn screenrec">🎥 Grabar pantalla</button>
```

- [ ] **Step 2: Estilos del botón y del indicador REC**

En `helpmeet/ui/web/style.css`, tras la regla `.btn.import { ... }` (línea ~82), añadir:

```css
.btn.screenrec { background: #14b8a6; color: #04201c; }
.btn.screenrec.recording { background: var(--red); color: #fff; }
.rec-dot {
  display: inline-block; width: 9px; height: 9px; margin-right: 6px;
  border-radius: 50%; background: #fff; vertical-align: middle;
  animation: recblink 1s steps(2, start) infinite;
}
@keyframes recblink { 50% { opacity: 0.25; } }
```

- [ ] **Step 3: Lógica en el JS**

En `helpmeet/ui/web/app.js`, declarar el estado junto a `let recording = false;` (línea 2):

```javascript
let screenRec = false;
let screenRecTimer = null;
```

Y al final del archivo (tras el handler de `btnExp`), añadir:

```javascript
$("btnScreenRec").onclick = async () => {
  if (!screenRec) {
    if (!activeInitiativeId) {
      alert("Elige una iniciativa en el panel de la izquierda primero.");
      return;
    }
    const mon = $("monitor").value || 1;
    const r = await window.pywebview.api.start_screen_recording(activeInitiativeId, mon);
    if (!r.ok) { alert(r.error || "No se pudo iniciar la grabación."); return; }
    screenRec = true;
    const btn = $("btnScreenRec");
    btn.classList.add("recording");
    let secs = 0;
    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    btn.innerHTML = `<span class="rec-dot"></span>⏹ Detener (${fmt(0)})`;
    screenRecTimer = setInterval(() => {
      secs++;
      btn.innerHTML = `<span class="rec-dot"></span>⏹ Detener (${fmt(secs)})`;
    }, 1000);
  } else {
    clearInterval(screenRecTimer);
    $("btnScreenRec").disabled = true;
    setStatus("🎥 Guardando el video…");
    const r = await window.pywebview.api.stop_screen_recording();
    screenRec = false;
    const btn = $("btnScreenRec");
    btn.classList.remove("recording");
    btn.textContent = "🎥 Grabar pantalla";
    btn.disabled = false;
    if (r.ok && r.path) {
      const aviso = r.audio === false
        ? "Video guardado (sin sonido). ¿Abrir la carpeta?"
        : "✓ Video guardado. ¿Abrir la carpeta?";
      setStatus("✓ Video guardado");
      if (confirm(aviso)) await window.pywebview.api.open_path(r.path);
      setTimeout(() => setStatus(""), 2500);
    } else {
      setStatus("");
      alert(r.error || "No se pudo guardar el video.");
    }
  }
};
```

- [ ] **Step 4: Verificación manual (en el PC de Víctor)**

1. Arrancar la app: `./.venv/Scripts/python.exe -m helpmeet` (o el comando habitual de arranque).
2. Seleccionar una iniciativa.
3. Elegir la pantalla en el selector de monitor.
4. Pulsar **🎥 Grabar pantalla** → el botón se pone rojo con **● ⏹ Detener (MM:SS)** y el contador corre.
5. Esperar ~10 s hablando y con sonido del sistema sonando.
6. Pulsar **⏹ Detener** → "🎥 Guardando el video…" → confirmar "¿Abrir la carpeta?".
7. Comprobar en la carpeta de la iniciativa: un `AAAA-MM-DD_HH-MM-SS_grabacion.mp4` que se reproduce **con imagen y sonido** (sistema + micro) y razonablemente sincronizados.

- [ ] **Step 5: Commit**

```bash
git add helpmeet/ui/web/index.html helpmeet/ui/web/app.js helpmeet/ui/web/style.css
git commit -m "feat: boton 🎥 Grabar pantalla con indicador REC y contador en la UI"
```

---

## Task 8: Vista previa en vivo mientras se graba

Muestra en la zona central una miniatura del monitor (~3-4 fps) mientras grabas. Hilo aparte con `mss`+numpy (sin Pillow); si falla, no afecta a la grabación. Verificación manual (necesita pantalla + ventana).

**Files:**
- Modify: `helpmeet/video/recorder.py`
- Modify: `helpmeet/ui/app.py`
- Modify: `helpmeet/ui/web/app.js`, `helpmeet/ui/web/style.css`

- [ ] **Step 1: Añadir el hilo de vista previa al recorder**

En `helpmeet/video/recorder.py`, en `__init__`, cambiar la firma y añadir estado:

```python
    def __init__(self, dest_path, monitor, fps=None, on_status=None, on_preview=None):
```

Tras `self.on_status = on_status`, añadir:

```python
        self.on_preview = on_preview
        self._preview_thread = None
```

En `start()`, tras arrancar `self._thread` (el de video), añadir:

```python
        if self.on_preview:
            self._preview_thread = threading.Thread(target=self._preview_loop, daemon=True)
            self._preview_thread.start()
```

Y añadir el método (debajo de `_record_video`):

```python
    def _preview_loop(self):
        """Manda una miniatura del monitor a la UI ~3 veces/seg. Nunca rompe la grabación."""
        import time
        import base64
        import mss
        import mss.tools
        import numpy as np
        region = {"left": self.monitor["left"], "top": self.monitor["top"],
                  "width": self.monitor["width"], "height": self.monitor["height"]}
        try:
            with mss.mss() as sct:
                while self._running:
                    img = sct.grab(region)
                    arr = np.frombuffer(img.rgb, dtype=np.uint8).reshape(img.height, img.width, 3)
                    step = max(1, img.width // 480)   # miniatura de ~480 px de ancho
                    small = arr[::step, ::step]
                    png = mss.tools.to_png(small.tobytes(), (small.shape[1], small.shape[0]))
                    self.on_preview(base64.b64encode(png).decode())
                    time.sleep(0.3)
        except Exception:
            pass  # la vista previa nunca debe interrumpir la grabación
```

- [ ] **Step 2: Empujar la vista previa desde la API**

En `helpmeet/ui/app.py`, añadir un método junto a `_push_status`:

```python
    def _push_preview(self, b64):
        if self._window:
            self._window.evaluate_js(f"setPreview('{b64}')")
```

Y en `start_screen_recording`, pasar el callback al crear el recorder:

```python
        rec = ScreenVideoRecorder(dest, mon, on_status=self._push_status,
                                  on_preview=self._push_preview)
```

(El base64 estándar no lleva comillas ni `\`, así que es seguro interpolarlo.)

- [ ] **Step 3: Mostrar el panel de vista previa en el JS**

En `helpmeet/ui/web/app.js`, añadir la función (junto a `setStatus`):

```javascript
function setPreview(b64) {
  const img = document.getElementById("previewImg");
  if (img) img.src = "data:image/png;base64," + b64;
}
```

En el handler de `btnScreenRec`, dentro del bloque de inicio (tras marcar `screenRec = true`), mostrar el panel:

```javascript
    clearTranscript();
    const pane = document.createElement("div");
    pane.className = "preview-pane";
    pane.innerHTML =
      '<div class="preview-label"><span class="rec-dot"></span> Grabando — vista previa</div>' +
      '<img id="previewImg" class="preview-img" alt="vista previa de la grabación">';
    $("transcript").appendChild(pane);
```

Y en el bloque de detener, tras guardar bien (`if (r.ok && r.path)`), limpiar el panel:

```javascript
      clearTranscript();
```

- [ ] **Step 4: Estilos del panel**

En `helpmeet/ui/web/style.css`, añadir:

```css
.preview-pane { max-width: 900px; margin: 0 auto; }
.preview-label { color: var(--red); font-weight: 600; margin: 6px 0 10px; }
.preview-img {
  width: 100%; border: 1px solid var(--border-2);
  border-radius: 12px; background: #000; display: block;
}
```

- [ ] **Step 5: Verificación manual**

Arrancar la app, seleccionar iniciativa, **🎥 Grabar pantalla** → en la zona central se ve la **miniatura del monitor actualizándose** mientras el botón cuenta el tiempo. Al detener, se guarda el `.mp4` y desaparece la vista previa.

- [ ] **Step 6: Commit**

```bash
git add helpmeet/video/recorder.py helpmeet/ui/app.py helpmeet/ui/web/app.js helpmeet/ui/web/style.css
git commit -m "feat: vista previa en vivo (miniatura ~3fps) mientras se graba la pantalla"
```

---

## Verificación final

- [ ] Toda la suite pasa: `./.venv/Scripts/python.exe -m pytest -v`
- [ ] Prueba manual completa de la Task 7 OK (mp4 con imagen + sonido en la carpeta de la iniciativa).
- [ ] `.env`, `data/` y `*.sqlite` siguen ignorados por git antes de cualquier push.

## Notas / límites conocidos (v1)

- Encode **CFR** a `fps`: si en máquinas lentas se soltaran muchos fotogramas, el final del video podría desfasarse del audio; en ese caso se pasaría a PTS real (VFR). El smoke test vigila la duración.
- El `mux` escribe primero todo el video y luego el audio (interleaving sencillo): válido y reproducible en local; un interleaving por tiempo sería una mejora futura para archivos muy largos.
- A **máxima nitidez** el archivo pesa mucho. No se transcribe el video automáticamente (para eso está *📹 Subir video*).
