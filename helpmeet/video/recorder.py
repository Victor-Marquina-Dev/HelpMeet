import threading
from fractions import Fraction
from pathlib import Path
import av
from helpmeet import config
from helpmeet.audio.capture import DualAudioRecorder
from helpmeet.audio.mixing import mix_wavs

MIC_WAV = "me.wav"        # pista del micrófono (la que escribe DualAudioRecorder)
SYS_WAV = "others.wav"    # pista del audio del sistema
MIXED_WAV = "mixed.wav"   # mezcla de ambas para el audio del mp4
TEMP_VIDEO = "video_temp.mp4"


class ScreenVideoRecorder:
    """Graba un monitor a .mp4 con sonido (sistema + micrófono).

    El video se captura con gdigrab y se codifica a H.264 en un temporal
    mientras se graba; el audio se captura aparte (WASAPI) y se une al final.
    """

    def __init__(self, dest_path, monitor, fps=None, on_status=None, on_preview=None):
        self.dest_path = Path(dest_path)
        self.monitor = dict(monitor)  # monitor actual (puede cambiarse en caliente)
        self.fps = fps or config.VIDEO_FPS
        self.on_status = on_status
        self.on_preview = on_preview
        self._running = False
        self._thread = None
        self._preview_thread = None
        self._monitor_lock = threading.Lock()
        self._monitor_changed = threading.Event()
        # Tamaño de salida fijo = el del primer monitor (pares para yuv420p). Si
        # luego se cambia a un monitor de otra resolución, se escala a este tamaño.
        self._out_w = monitor["width"] - monitor["width"] % 2
        self._out_h = monitor["height"] - monitor["height"] % 2
        self._tmp_dir = config.DATA_DIR / "tmp_video"
        self._tmp_video = self._tmp_dir / TEMP_VIDEO
        self._audio = None
        self._mic_muted = False
        self._frames = 0
        self._error = None

    def _status(self, text):
        if self.on_status:
            self.on_status(text)

    def start(self):
        self._tmp_dir.mkdir(parents=True, exist_ok=True)
        self._running = True
        self._audio = DualAudioRecorder(self._tmp_dir)
        self._audio.set_mic_muted(self._mic_muted)
        self._audio.start()
        self._thread = threading.Thread(target=self._record_video, daemon=True)
        self._thread.start()
        if self.on_preview:
            self._preview_thread = threading.Thread(target=self._preview_loop, daemon=True)
            self._preview_thread.start()

    def set_mic_muted(self, muted: bool) -> None:
        """Silencia/activa el micrófono durante la grabación."""
        self._mic_muted = bool(muted)
        if self._audio is not None:
            self._audio.set_mic_muted(self._mic_muted)

    def set_monitor(self, monitor) -> None:
        """Cambia en caliente el monitor que se está grabando (salta a la otra
        pantalla sin cortar el video)."""
        with self._monitor_lock:
            self.monitor = dict(monitor)
        self._monitor_changed.set()

    def audio_channels(self):
        """Pistas de audio capturadas (para transcribir tras parar)."""
        return [("me", self._tmp_dir / MIC_WAV),
                ("others", self._tmp_dir / SYS_WAV)]

    def _record_video(self):
        out = av.open(str(self._tmp_video), "w")
        stream = out.add_stream(config.VIDEO_CODEC, rate=self.fps)
        stream.width = self._out_w
        stream.height = self._out_h
        stream.pix_fmt = "yuv420p"
        # bf=0: sin B-frames -> DTS no negativo -> el remux (mux final) no falla
        # con "Cannot rebase to zero time". No afecta a la nitidez.
        stream.options = {"preset": config.VIDEO_PRESET, "crf": config.VIDEO_CRF, "bf": "0"}
        stream.codec_context.time_base = Fraction(1, self.fps)
        idx = 0
        try:
            # Bucle externo: se reabre la captura cuando se cambia de monitor en
            # caliente. El archivo de salida es uno solo y continuo.
            while self._running:
                with self._monitor_lock:
                    mon = dict(self.monitor)
                self._monitor_changed.clear()
                w = mon["width"] - (mon["width"] % 2)
                h = mon["height"] - (mon["height"] % 2)
                try:
                    inp = av.open("desktop", format="gdigrab", options={
                        "framerate": str(self.fps),
                        "offset_x": str(mon["left"]),
                        "offset_y": str(mon["top"]),
                        "video_size": f"{w}x{h}",
                        "draw_mouse": "1",
                    })
                except Exception as exc:  # noqa: BLE001
                    self._error = f"No se pudo iniciar la captura de pantalla: {exc}"
                    self._status("🎥 Error al iniciar la grabación")
                    break
                in_stream = inp.streams.video[0]
                try:
                    for frame in inp.decode(in_stream):
                        if not self._running or self._monitor_changed.is_set():
                            break  # parar, o saltar a otra pantalla (reabre arriba)
                        # Se escala al tamaño de salida fijo (por si el otro monitor
                        # tiene distinta resolución) y PTS incremental propio (CFR).
                        img = frame.reformat(width=self._out_w, height=self._out_h,
                                             format="yuv420p")
                        img.pts = idx
                        img.time_base = Fraction(1, self.fps)
                        idx += 1
                        for pkt in stream.encode(img):
                            out.mux(pkt)
                        self._frames += 1
                finally:
                    inp.close()
        finally:
            for pkt in stream.encode():   # vaciar el codificador
                out.mux(pkt)
            out.close()

    def _preview_loop(self):
        """Manda una miniatura del monitor a la UI ~3 veces/seg. Nunca rompe la grabación."""
        import time
        import base64
        import mss
        import mss.tools
        import numpy as np
        try:
            with mss.mss() as sct:
                while self._running:
                    with self._monitor_lock:
                        mon = dict(self.monitor)
                    region = {"left": mon["left"], "top": mon["top"],
                              "width": mon["width"], "height": mon["height"]}
                    img = sct.grab(region)
                    arr = np.frombuffer(img.rgb, dtype=np.uint8).reshape(img.height, img.width, 3)
                    step = max(1, img.width // 480)   # miniatura de ~480 px de ancho
                    small = arr[::step, ::step]
                    png = mss.tools.to_png(small.tobytes(), (small.shape[1], small.shape[0]))
                    if self.on_preview:
                        self.on_preview(base64.b64encode(png).decode())
                    time.sleep(0.3)
        except Exception:
            pass  # la vista previa nunca debe interrumpir la grabación

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=30)
        if self._preview_thread:
            self._preview_thread.join(timeout=5)
        if self._audio:
            self._audio.stop()

        if self._error:
            self._status(self._error)
            return {"ok": False, "error": self._error}
        if self._frames == 0 or not self._tmp_video.exists():
            self._status("🎥 No se grabó nada")
            self.cleanup()
            return {"ok": False, "error": "No se capturó ningún fotograma."}

        self._status("🎥 Guardando el video…")
        mixed = self._tmp_dir / MIXED_WAV
        has_audio = mix_wavs(self._tmp_dir / MIC_WAV,
                             self._tmp_dir / SYS_WAV,
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

        # NO se limpian las pistas aquí: el micrófono/sistema (me.wav, others.wav)
        # se conservan por si el usuario decide transcribir el video. La limpieza
        # la hace la capa de UI llamando a cleanup() tras la decisión.
        self._status("")
        return {"ok": True, "path": str(self.dest_path), "audio": has_audio}

    def _mux(self, audio_wav):
        self.dest_path.parent.mkdir(parents=True, exist_ok=True)
        vin = av.open(str(self._tmp_video))
        ain = av.open(str(audio_wav)) if audio_wav is not None else None
        out = av.open(str(self.dest_path), "w")
        try:
            in_v = vin.streams.video[0]
            # Se añaden TODAS las pistas antes de muxear nada (la cabecera del
            # mp4 se escribe en el primer mux y ya no admite pistas nuevas).
            out_v = out.add_stream(template=in_v)  # copia el video sin recodificar
            out_a = out.add_stream("aac", rate=config.VIDEO_AUDIO_RATE) if ain else None

            for pkt in vin.demux(in_v):   # video: copia directa
                if pkt.dts is None:
                    continue
                pkt.stream = out_v
                out.mux(pkt)

            if ain is not None:           # audio: recodifica a AAC
                for frame in ain.decode(ain.streams.audio[0]):
                    frame.pts = None
                    for pkt in out_a.encode(frame):
                        out.mux(pkt)
                for pkt in out_a.encode():
                    out.mux(pkt)
        finally:
            out.close()   # cerrar siempre: libera el archivo (evita bloqueos en Windows)
            vin.close()
            if ain is not None:
                ain.close()

    def cleanup(self):
        """Borra los temporales (video y pistas de audio). Llamar tras decidir
        si se transcribe o no."""
        for name in (TEMP_VIDEO, MIC_WAV, SYS_WAV, MIXED_WAV):
            p = self._tmp_dir / name
            try:
                if p.exists():
                    p.unlink()
            except Exception:
                pass
