import io
import shutil
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

PREVIEW_WIDTH = 480       # ancho de la miniatura de vista previa


def _jpeg_from_rgb(rgb, width, height) -> bytes:
    """Codifica un ndarray RGB (rgb24) a JPEG en memoria con PyAV (sin Pillow)."""
    frame = av.VideoFrame.from_ndarray(rgb, format="rgb24")
    small = frame.reformat(format="yuvj420p")
    small.pts = 0
    small.time_base = Fraction(1, 1)
    buffer = io.BytesIO()
    out = av.open(buffer, mode="w", format="mjpeg")
    try:
        stream = out.add_stream("mjpeg", rate=1)
        stream.width, stream.height = width, height
        stream.pix_fmt = "yuvj420p"
        stream.time_base = Fraction(1, 1)
        for packet in stream.encode(small):
            out.mux(packet)
        for packet in stream.encode():
            out.mux(packet)
    finally:
        out.close()
    return buffer.getvalue()


class ScreenVideoRecorder:
    """Graba un monitor a .mp4 con sonido (sistema + micrófono).

    El video se captura con gdigrab y se codifica a H.264 en un temporal
    mientras se graba; el audio se captura aparte (WASAPI) y se une al final.
    """

    def __init__(self, dest_path, monitor, fps=None, on_status=None, on_preview=None,
                 work_dir=None, profile=None):
        self.dest_path = Path(dest_path)
        self.monitor = dict(monitor)  # monitor actual (puede cambiarse en caliente)
        # Perfil de calidad (P-12): fija fps, CRF y resolución máxima de salida.
        prof = config.video_profile(profile) if profile else None
        self.fps = fps or (prof["fps"] if prof else config.VIDEO_FPS)
        self._crf = prof["crf"] if prof else config.VIDEO_CRF
        self._max_w = prof["max_w"] if prof else 0
        self._max_h = prof["max_h"] if prof else 0
        self.on_status = on_status
        self.on_preview = on_preview
        self._running = False
        self._thread = None
        self._preview_thread = None
        self._monitor_lock = threading.Lock()
        self._monitor_changed = threading.Event()
        # Vista previa derivada del pipeline (P-08): el hilo de captura deja el
        # último fotograma reducido en un hueco de tamaño 1 y el hilo de preview
        # lo codifica a JPEG. Así no se recaptura la pantalla por separado.
        self._preview_lock = threading.Lock()
        self._preview_event = threading.Event()
        self._preview_slot = None
        self._preview_every = max(1, int((fps or config.VIDEO_FPS) // 2))  # ~2 fps
        # Tamaño de salida fijo = el del primer monitor (pares para yuv420p),
        # acotado por la resolución máxima del perfil. Si luego se cambia a un
        # monitor de otra resolución, se escala a este tamaño.
        out_w, out_h = monitor["width"], monitor["height"]
        if self._max_w and self._max_h and (out_w > self._max_w or out_h > self._max_h):
            ratio = min(self._max_w / out_w, self._max_h / out_h)
            out_w, out_h = int(out_w * ratio), int(out_h * ratio)
        self._out_w = out_w - out_w % 2
        self._out_h = out_h - out_h % 2
        self._tmp_dir = Path(work_dir) if work_dir else config.DATA_DIR / "tmp_video"
        # Carpeta propia (work_dir dedicado): se puede borrar entera al limpiar, lo
        # que permite que varias grabaciones convivan sin pisarse los temporales
        # (una guardándose en 2.º plano mientras empieza otra).
        self._dedicated_dir = work_dir is not None
        self._tmp_video = self._tmp_dir / TEMP_VIDEO
        self._audio = None
        self._mic_muted = False
        self._scale_mode = "fit"
        # Transformación libre estilo OBS: (x, y, w, h) normalizados 0..1 sobre el
        # lienzo. None = usar el modo de encuadre (fit/fill/stretch).
        self._transform = None
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

    def set_scale_mode(self, mode: str) -> None:
        """Ajusta la fuente al lienzo fijo como OBS: fit, fill o stretch."""
        mode = mode if mode in {"fit", "fill", "stretch"} else "fit"
        with self._monitor_lock:
            self._scale_mode = mode
            self._transform = None  # un modo de encuadre anula la transformación libre
        self._monitor_changed.set()

    def set_transform(self, x, y, w, h) -> None:
        """Coloca la pantalla LIBRE dentro del lienzo (estilo OBS): posición (x, y)
        y tamaño (w, h), todo normalizado 0..1 respecto al lienzo de salida."""
        with self._monitor_lock:
            self._transform = (float(x), float(y), float(w), float(h))
            self._scale_mode = "transform"
        self._monitor_changed.set()

    def _transform_pixels(self):
        """Convierte la transformación normalizada a píxeles pares y acotados al lienzo."""
        x, y, w, h = self._transform
        tw = max(2, int(round(self._out_w * w)));  tw -= tw % 2
        th = max(2, int(round(self._out_h * h)));  th -= th % 2
        tw = min(tw, self._out_w);  th = min(th, self._out_h)
        tx = max(0, min(int(round(self._out_w * x)), self._out_w - tw))
        ty = max(0, min(int(round(self._out_h * y)), self._out_h - th))
        return tw, th, tx, ty

    def _scale_filter(self, template, mode):
        """Crea filtros FFmpeg nativos para conservar proporción sin usar NumPy."""
        graph = av.filter.Graph()
        source = graph.add_buffer(template=template)
        if mode == "transform" and self._transform:
            # Escala la fuente al tamaño elegido y la pega en su posición sobre
            # un lienzo negro (el resto queda en negro), como una fuente en OBS.
            tw, th, tx, ty = self._transform_pixels()
            scale = graph.add("scale", f"{tw}:{th}")
            framing = graph.add("pad", f"{self._out_w}:{self._out_h}:{tx}:{ty}:black")
        elif mode == "fill":
            scale = graph.add(
                "scale", f"{self._out_w}:{self._out_h}:force_original_aspect_ratio=increase"
            )
            framing = graph.add(
                "crop", f"{self._out_w}:{self._out_h}:(iw-ow)/2:(ih-oh)/2"
            )
        else:
            scale = graph.add(
                "scale", f"{self._out_w}:{self._out_h}:force_original_aspect_ratio=decrease"
            )
            framing = graph.add(
                "pad", f"{self._out_w}:{self._out_h}:(ow-iw)/2:(oh-ih)/2:black"
            )
        pixel_format = graph.add("format", "pix_fmts=yuv420p")
        sink = graph.add("buffersink")
        source.link_to(scale)
        scale.link_to(framing)
        framing.link_to(pixel_format)
        pixel_format.link_to(sink)
        graph.configure()
        return graph, source, sink

    def audio_channels(self):
        """Pistas de audio capturadas (para transcribir tras parar)."""
        return [("me", self._tmp_dir / MIC_WAV),
                ("others", self._tmp_dir / SYS_WAV)]

    def _record_video(self):
        # MP4 fragmentado: escribe cabeceras reproducibles desde el inicio. Así
        # el archivo temporal sigue siendo recuperable aunque el proceso no
        # alcance `out.close()` por un apagado o cierre forzado.
        out = av.open(str(self._tmp_video), "w", options={
            "movflags": "frag_keyframe+empty_moov+default_base_moof",
        })
        stream = out.add_stream(config.VIDEO_CODEC, rate=self.fps)
        stream.width = self._out_w
        stream.height = self._out_h
        stream.pix_fmt = "yuv420p"
        # bf=0: sin B-frames -> DTS no negativo -> el remux (mux final) no falla
        # con "Cannot rebase to zero time". No afecta a la nitidez.
        stream.options = {"preset": config.VIDEO_PRESET, "crf": self._crf, "bf": "0"}
        stream.codec_context.time_base = Fraction(1, self.fps)
        idx = 0
        try:
            # Bucle externo: se reabre la captura cuando se cambia de monitor en
            # caliente. El archivo de salida es uno solo y continuo.
            while self._running:
                with self._monitor_lock:
                    mon = dict(self.monitor)
                    scale_mode = self._scale_mode
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
                scale_filter = None
                try:
                    for frame in inp.decode(in_stream):
                        if not self._running or self._monitor_changed.is_set():
                            break  # parar, o saltar a otra pantalla (reabre arriba)
                        # Lienzo fijo + transformación de fuente estilo OBS.
                        if scale_mode == "stretch":
                            img = frame.reformat(width=self._out_w, height=self._out_h,
                                                 format="yuv420p")
                        else:
                            if scale_filter is None:
                                scale_filter = self._scale_filter(frame, scale_mode)
                            _, source, sink = scale_filter
                            source.push(frame)
                            img = sink.pull()
                        img.pts = idx
                        img.time_base = Fraction(1, self.fps)
                        # P-08: cada ~medio segundo, deja una copia reducida e
                        # independiente del fotograma para la vista previa. Es
                        # mucho más barato que recapturar la pantalla entera.
                        if self.on_preview and idx % self._preview_every == 0:
                            self._offer_preview(img)
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

    def _preview_size(self):
        """Tamaño (par) de la miniatura, conservando la proporción del lienzo."""
        if self._out_w <= PREVIEW_WIDTH:
            new_w, new_h = self._out_w, self._out_h
        else:
            new_w = PREVIEW_WIDTH
            new_h = max(2, int(round(self._out_h * (PREVIEW_WIDTH / self._out_w))))
        return new_w - new_w % 2, new_h - new_h % 2

    def _offer_preview(self, frame):
        """Deja en el hueco (tamaño 1) una copia RGB reducida e independiente del
        fotograma. Se ejecuta en el hilo de captura; debe ser barato y no romper
        nunca la grabación."""
        try:
            new_w, new_h = self._preview_size()
            rgb = frame.reformat(width=new_w, height=new_h, format="rgb24").to_ndarray()
            with self._preview_lock:
                self._preview_slot = (rgb, new_w, new_h)
            self._preview_event.set()
        except Exception:
            pass

    def _preview_loop(self):
        """Codifica a JPEG el último fotograma ofrecido y lo manda a la UI.

        No recaptura la pantalla (P-08): consume lo que deja el hilo de captura y
        descarta fotogramas viejos. Nunca interrumpe la grabación."""
        import base64
        while self._running:
            if not self._preview_event.wait(timeout=0.5):
                continue
            self._preview_event.clear()
            with self._preview_lock:
                slot = self._preview_slot
                self._preview_slot = None
            if not slot:
                continue
            rgb, new_w, new_h = slot
            try:
                jpeg = _jpeg_from_rgb(rgb, new_w, new_h)
                if jpeg and self.on_preview:
                    self.on_preview(base64.b64encode(jpeg).decode())
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

    def recover(self):
        """Finaliza una captura fragmentada conservada tras un cierre abrupto."""
        from helpmeet.recovery import repair_wav

        for _, audio_path in self.audio_channels():
            repair_wav(audio_path)
        if not self._tmp_video.exists() or self._tmp_video.stat().st_size == 0:
            return {"ok": False, "error": "No se encontró video recuperable."}

        self._status("Recuperando el video…")
        mixed = self._tmp_dir / MIXED_WAV
        has_audio = mix_wavs(self._tmp_dir / MIC_WAV,
                             self._tmp_dir / SYS_WAV,
                             mixed, rate=config.VIDEO_AUDIO_RATE)
        try:
            self._mux(mixed if has_audio else None)
        except Exception as exc:  # conservar al menos el fragmento de video
            try:
                self.dest_path.parent.mkdir(parents=True, exist_ok=True)
                if self.dest_path.exists():
                    self.dest_path.unlink()
                self._tmp_video.replace(self.dest_path)
            except Exception:
                return {"ok": False, "error": f"No se pudo recuperar el video: {exc}"}
            return {"ok": True, "path": str(self.dest_path), "audio": False,
                    "warning": str(exc)}
        return {"ok": True, "path": str(self.dest_path), "audio": has_audio}

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
        # Si esta grabación tenía su propia carpeta, se elimina entera (incluido
        # cualquier residuo), dejando limpio el directorio de temporales.
        if self._dedicated_dir:
            shutil.rmtree(self._tmp_dir, ignore_errors=True)
