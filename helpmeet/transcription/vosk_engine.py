"""Carga de modelos Vosk (motor de transcripcion de Helpmeet).

Vosk es un motor de streaming: no se le pasa un archivo entero de una vez
como a un motor por lotes, se le va alimentando audio en trozos pequenos
(ver `session/vosk_live_transcriber.py` para el camino en vivo, y este mismo
modulo mas abajo para el camino de archivo completo via `TranscriptionEngine`
en `transcription/engine.py`). Este archivo solo se encarga de conseguir el
`vosk.Model` correcto (descarga + cache), que despues se comparte entre todos
los reconocedores (uno por pista/llamada) sin bloqueos: el modelo es de solo
lectura una vez cargado, el estado que no se puede compartir entre hilos vive
en cada `KaldiRecognizer`, no en el modelo — por eso dos pistas pueden
transcribir a la vez de verdad, sin el lock que necesitaba CTranslate2.

IMPORTANTE sobre el orden de imports: el paquete `vosk` lee la variable de
entorno VOSK_MODEL_PATH UNA sola vez, en el momento en que se hace
`import vosk` por primera vez en todo el proceso (construye su lista
`MODEL_DIRS` a nivel de modulo). Fijarla DESPUES del import no tiene ningun
efecto — quedó comprobado: sin este orden, el modelo se descargaba a
~/.cache/vosk en vez de a la carpeta de Helpmeet. Por eso aqui se fija la
variable ANTES de importar `vosk`, a nivel de modulo, para que baste con
importar este archivo (aunque sea indirectamente, por importar
`get_vosk_model`) para que quede bien configurado en todo el proceso.
"""
import logging
import os
import threading
from pathlib import Path

from helpmeet import config

_MODEL_DIR = config.DATA_DIR / "models" / "vosk"
_MODEL_DIR.mkdir(parents=True, exist_ok=True)
os.environ["VOSK_MODEL_PATH"] = str(_MODEL_DIR)

import vosk  # noqa: E402 - después de fijar VOSK_MODEL_PATH a propósito
vosk.SetLogLevel(-1)  # silencia el log muy verboso de Kaldi en stderr

log = logging.getLogger("helpmeet")

_lock = threading.Lock()
_cache: dict[str, vosk.Model] = {}  # model_name -> Model, evita recargar por pista/llamada

# Un archivo de acústica que siempre viene en cualquier modelo Vosk bien
# descomprimido: sirve para distinguir "ya está" de "carpeta a medio bajar".
_MARKER_REL_PATH = Path("am") / "final.mdl"


def model_dir_for(model_name: str) -> Path:
    # Recalcula desde config.DATA_DIR en cada llamada (NO usa el _MODEL_DIR
    # congelado de arriba) para que los tests puedan aislar con monkeypatch de
    # config.DATA_DIR. En la app real da exactamente la misma ruta: DATA_DIR
    # no cambia en caliente durante una sesión.
    return config.DATA_DIR / "models" / "vosk" / model_name


def model_is_downloaded(model_name: str) -> bool:
    marker = model_dir_for(model_name) / _MARKER_REL_PATH
    return marker.is_file() and marker.stat().st_size > 0


def _friendly_error(exc: Exception, model_name: str) -> RuntimeError:
    msg = str(exc).lower()
    if any(k in msg for k in ("connection", "network", "timeout", "resolve", "unreachable", "ssl", "refused")):
        return RuntimeError(
            f"El modelo de transcripción «{model_name}» no está disponible. "
            f"La primera vez necesita internet para descargarlo. "
            f"Conéctate a internet y vuelve a intentarlo."
        )
    return RuntimeError(f"No se pudo cargar el modelo de transcripción «{model_name}»: {exc}")


def get_vosk_model(model_name: str) -> vosk.Model:
    """Devuelve el `vosk.Model` cacheado para el nombre de modelo pedido
    (nombre exacto del catálogo, ej. "vosk-model-small-es-0.42"),
    descargándolo la primera vez. Lanza RuntimeError con mensaje claro si
    falla (nunca deja que el error crudo de la librería llegue a la UI)."""
    with _lock:
        if model_name in _cache:
            return _cache[model_name]
        try:
            log.info("Cargando modelo Vosk '%s' (se descarga si falta)...", model_name)
            model = vosk.Model(model_name=model_name)
            log.info("Modelo Vosk '%s' listo", model_name)
        except Exception as exc:  # noqa: BLE001
            log.exception("Fallo cargando modelo Vosk '%s'", model_name)
            raise _friendly_error(exc, model_name) from exc
        _cache[model_name] = model
        return model
