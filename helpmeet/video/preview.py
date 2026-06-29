"""Vista previa de pantalla EN ESPERA (sin grabar).

Cuando se abre el panel de grabación, el usuario ve la pantalla en vivo pero
todavía no se está grabando; pulsa "Iniciar grabación" cuando quiera empezar.

Durante la grabación la miniatura sale del propio pipeline de vídeo (P-08); esta
clase cubre el momento PREVIO, capturando con mss a pocos fps (ligero).
"""
import base64
import io
import threading
import time
from fractions import Fraction

import av
import numpy as np
import mss

PREVIEW_WIDTH = 1280   # resolución alta para preview nítido


class ScreenPreview:
    """Manda miniaturas JPEG de un monitor a la UI, sin grabar nada."""

    def __init__(self, monitor, on_preview, fps=10):
        self.monitor = dict(monitor)
        self.on_preview = on_preview
        self.fps = max(1, int(fps))
        self._running = False
        self._thread = None
        self._lock = threading.Lock()

    def set_monitor(self, monitor) -> None:
        with self._lock:
            self.monitor = dict(monitor)

    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)

    def _loop(self) -> None:
        interval = 1.0 / self.fps
        try:
            with mss.mss() as sct:
                while self._running:
                    t0 = time.monotonic()
                    with self._lock:
                        mon = dict(self.monitor)
                    region = {"left": mon["left"], "top": mon["top"],
                              "width": mon["width"], "height": mon["height"]}
                    img = sct.grab(region)
                    sw, sh = img.width, img.height
                    # Calcula tamaño destino manteniendo proporción exacta
                    if sw > PREVIEW_WIDTH:
                        tw = PREVIEW_WIDTH
                        th = int(sh * PREVIEW_WIDTH / sw)
                    else:
                        tw, th = sw, sh
                    tw -= tw % 2
                    th -= th % 2
                    # Escala con libswscale (Lanczos) via PyAV → calidad OBS
                    arr = np.frombuffer(img.rgb, dtype=np.uint8).reshape(sh, sw, 3)
                    frame = av.VideoFrame.from_ndarray(arr, format="rgb24")
                    scaled = frame.reformat(width=tw, height=th,
                                            format="yuvj420p",
                                            interpolation="LANCZOS")
                    jpeg = _encode_jpeg(scaled, tw, th)
                    if jpeg and self.on_preview:
                        self.on_preview(base64.b64encode(jpeg).decode())
                    elapsed = time.monotonic() - t0
                    sleep = max(0.0, interval - elapsed)
                    if sleep:
                        time.sleep(sleep)
        except Exception:
            pass  # la vista previa nunca debe romper nada


def _encode_jpeg(frame, width, height) -> bytes:
    """Codifica un VideoFrame YUV a JPEG de alta calidad con PyAV."""
    frame.pts = 0
    frame.time_base = Fraction(1, 1)
    buf = io.BytesIO()
    out = av.open(buf, mode="w", format="mjpeg")
    try:
        stream = out.add_stream("mjpeg", rate=1)
        stream.width, stream.height = width, height
        stream.pix_fmt = "yuvj420p"
        stream.time_base = Fraction(1, 1)
        stream.options = {"q:v": "2"}   # calidad máxima (1=mejor, 31=peor)
        for pkt in stream.encode(frame):
            out.mux(pkt)
        for pkt in stream.encode():
            out.mux(pkt)
    finally:
        out.close()
    return buf.getvalue()
