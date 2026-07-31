"""Resampleo simple de audio PCM crudo, compartido por todo lo que alimenta
a Vosk (necesita 16kHz mono PCM16): la transcripcion en vivo, el motor de
archivo completo y el demo aislado.

Resampleo ingenuo por trozo (interpolacion lineal, sin estado de filtro entre
llamadas): suficiente para voz, no para audio de calidad de produccion. Mismo
criterio ya usado en `audio/mixing.py`.
"""
import numpy as np

TARGET_RATE = 16000

# Profundidad de muestra -> (dtype con el que interpretar los bytes, cero de la
# escala, factor para llevarla al rango de int16). El WAV de 8 bits es el raro:
# es el unico SIN signo, con el silencio en 128 en vez de en 0.
_FORMATOS = {
    1: (np.uint8, 128.0, 256.0),
    2: (np.int16, 0.0, 1.0),
    4: (np.int32, 0.0, 1.0 / 65536.0),
}


def to_16k_mono(data: bytes, src_rate: int, channels: int, sampwidth: int = 2) -> bytes:
    """Convierte un bloque PCM a 16 kHz, mono y 16 bits.

    `sampwidth` es en BYTES por muestra (1, 2 o 4), tal como lo devuelve
    `wave.Wave_read.getsampwidth()`.

    Antes esta funcion daba por hecho que todo entraba en 16 bits y hacia
    `np.frombuffer(data, dtype=np.int16)` sin mirar nada mas. Con 8 bits salia
    la mitad de las muestras y con 32 bits el doble: audio irreconocible y
    marcas de tiempo al doble o a la mitad. Y no fallaba — devolvia bytes
    validos, asi que transcribia basura en silencio, que es peor que caerse.
    El llamador ya conocia el `sampwidth` (engine.py lo lee del WAV para contar
    frames) y lo dejaba caer justo antes de llegar aca.
    """
    if not data:
        return b""

    dtype, cero, escala = _FORMATOS.get(sampwidth, _FORMATOS[2])
    arr = np.frombuffer(data, dtype=dtype).astype(np.float32)
    if sampwidth in (1, 4):   # 16 bits ya esta en la escala de destino
        arr = (arr - cero) * escala

    if channels > 1:
        # Recorte al multiplo de canales antes del reshape. drain() del ring
        # buffer devuelve lo que haya acumulado y no garantiza caer en frontera
        # de frame: con estereo, un numero impar de muestras es perfectamente
        # posible y el reshape lanzaba ValueError. La excepcion la atrapaba el
        # except de _drain_once, asi que la grabacion seguia — pero ese trozo de
        # audio se perdia y se registraba un traceback cada 0,3 s mientras
        # durara la condicion. La muestra sobrante se descarta: es media
        # milesima de segundo y el alternativa (arrastrarla al siguiente bloque)
        # obliga a esta funcion a llevar estado entre llamadas.
        usable = (arr.size // channels) * channels
        if usable == 0:
            return b""
        arr = arr[:usable].reshape(-1, channels).mean(axis=1)

    if src_rate != TARGET_RATE and arr.size:
        n_out = max(1, int(arr.size * TARGET_RATE / src_rate))
        arr = np.interp(
            np.linspace(0, 1, n_out, endpoint=False),
            np.linspace(0, 1, arr.size, endpoint=False),
            arr,
        )

    # clip antes de convertir: sin el, una muestra de 32 bits al tope se
    # desborda y da la vuelta a negativo (un chasquido en vez de un pico).
    return np.clip(arr, -32768, 32767).astype(np.int16).tobytes()
