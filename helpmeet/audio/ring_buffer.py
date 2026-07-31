import threading


class AudioRingBuffer:
    """Buffer en memoria con hasta `seconds` de audio PCM16 pendiente de leer.

    Un hilo (captura de audio) escribe con `append()` mientras otro (vista
    previa en vivo) vacía con `drain()`, que devuelve todo lo acumulado desde
    la última lectura y lo borra: así cada lectura es audio nuevo, sin repetir
    lo que ya se transcribió. `seconds` es solo una cota de seguridad por si
    la vista previa se atrasa (evita crecer sin límite), no una ventana fija.
    """

    def __init__(self, seconds: float, rate: int, channels: int, sampwidth: int = 2):
        self.rate = rate
        self.channels = channels
        self.sampwidth = sampwidth
        self._max_bytes = max(1, int(seconds * rate * channels * sampwidth))
        self._buf = bytearray()
        self._lock = threading.Lock()

    def append(self, data: bytes) -> None:
        with self._lock:
            self._buf.extend(data)
            excess = len(self._buf) - self._max_bytes
            if excess > 0:
                del self._buf[:excess]

    def snapshot(self) -> bytes:
        with self._lock:
            return bytes(self._buf)

    def drain(self) -> bytes:
        with self._lock:
            data = bytes(self._buf)
            self._buf.clear()
            return data

    def seconds_available(self) -> float:
        with self._lock:
            n = len(self._buf)
        return n / (self.rate * self.channels * self.sampwidth)
