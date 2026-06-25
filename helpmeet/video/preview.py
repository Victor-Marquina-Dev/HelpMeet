"""Vista previa de pantalla EN ESPERA (sin grabar).

Cuando se abre el panel de grabación, el usuario ve la pantalla en vivo pero
todavía no se está grabando; pulsa "Iniciar grabación" cuando quiera empezar.

Durante la grabación la miniatura sale del propio pipeline de vídeo (P-08); esta
clase cubre el momento PREVIO, capturando con mss a pocos fps (ligero).
"""
import base64
import threading
import time

import numpy as np
import mss

from helpmeet.video.recorder import _jpeg_from_rgb

PREVIEW_WIDTH = 480


class ScreenPreview:
    """Manda miniaturas JPEG de un monitor a la UI, sin grabar nada."""

    def __init__(self, monitor, on_preview, fps=4):
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
                    with self._lock:
                        mon = dict(self.monitor)
                    region = {"left": mon["left"], "top": mon["top"],
                              "width": mon["width"], "height": mon["height"]}
                    img = sct.grab(region)
                    arr = np.frombuffer(img.rgb, dtype=np.uint8).reshape(
                        img.height, img.width, 3)
                    step = max(1, img.width // PREVIEW_WIDTH)
                    small = arr[::step, ::step]
                    h = small.shape[0] - small.shape[0] % 2
                    w = small.shape[1] - small.shape[1] % 2
                    rgb = np.ascontiguousarray(small[:h, :w])
                    jpeg = _jpeg_from_rgb(rgb, w, h)
                    if jpeg and self.on_preview:
                        self.on_preview(base64.b64encode(jpeg).decode())
                    time.sleep(interval)
        except Exception:
            pass  # la vista previa nunca debe romper nada
