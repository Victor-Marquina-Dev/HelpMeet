"""Casos que la revision del PR #1 encontro rotos en to_16k_mono.

Los dos fallaban en silencio o casi: el primero devolvia bytes validos con el
audio deformado, y el segundo lanzaba ValueError dentro de un except que solo
lo registraba. Ninguno tumbaba la app, que es justamente por lo que hacian
falta pruebas.
"""
import numpy as np
import pytest

from helpmeet.audio.resample import to_16k_mono, TARGET_RATE


def _muestras(pcm: bytes) -> int:
    return len(pcm) // 2


@pytest.mark.parametrize("sampwidth,dtype", [(1, np.uint8), (2, np.int16), (4, np.int32)])
def test_conserva_la_cantidad_de_muestras_sea_cual_sea_la_profundidad(sampwidth, dtype):
    """1000 muestras entran, 1000 salen. Antes: 500 con 8 bits, 2000 con 32."""
    data = np.zeros(1000, dtype=dtype).tobytes()
    assert _muestras(to_16k_mono(data, TARGET_RATE, 1, sampwidth)) == 1000


def test_ocho_bits_sin_signo_se_centra_en_cero():
    """El WAV de 8 bits no tiene signo: su silencio es 128, no 0. Sin corregir
    el offset, un tramo mudo entraba a Vosk como continua al tope."""
    silencio = np.full(64, 128, dtype=np.uint8).tobytes()
    salida = np.frombuffer(to_16k_mono(silencio, TARGET_RATE, 1, 1), dtype=np.int16)
    assert np.all(salida == 0)


def test_estereo_con_numero_impar_de_muestras_no_revienta():
    """drain() no garantiza caer en frontera de frame. Antes: ValueError
    'cannot reshape array of size 999 into shape (2)' cada 0,3 s."""
    data = np.zeros(999, dtype=np.int16).tobytes()
    salida = to_16k_mono(data, TARGET_RATE, 2, 2)
    assert _muestras(salida) == 499          # 998/2, la muestra suelta se descarta


def test_estereo_promedia_los_dos_canales():
    entrelazado = np.array([1000, 3000, 1000, 3000], dtype=np.int16).tobytes()
    salida = np.frombuffer(to_16k_mono(entrelazado, TARGET_RATE, 2, 2), dtype=np.int16)
    assert list(salida) == [2000, 2000]


def test_treintaidos_bits_al_tope_no_da_la_vuelta():
    """Sin clip, el maximo de int32 desborda al convertir y sale negativo: un
    chasquido en lugar de un pico."""
    data = np.full(8, np.iinfo(np.int32).max, dtype=np.int32).tobytes()
    salida = np.frombuffer(to_16k_mono(data, TARGET_RATE, 1, 4), dtype=np.int16)
    assert np.all(salida > 0)


def test_remuestrea_a_16k():
    data = np.zeros(48000, dtype=np.int16).tobytes()
    assert _muestras(to_16k_mono(data, 48000, 1, 2)) == 16000


def test_vacio_devuelve_vacio():
    assert to_16k_mono(b"", TARGET_RATE, 1, 2) == b""
    assert to_16k_mono(np.zeros(1, dtype=np.int16).tobytes(), TARGET_RATE, 2, 2) == b""
