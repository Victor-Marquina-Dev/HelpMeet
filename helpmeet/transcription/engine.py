import shutil
from pathlib import Path

from faster_whisper import WhisperModel
from helpmeet import config
from helpmeet.transcription.cleanup import clean_text, is_hallucination
from helpmeet.transcription.segment import TranscribedSegment


def _model_cache_dir(model_name: str) -> Path | None:
    """Carpeta de la caché de Hugging Face donde vive el modelo descargado.
    Devuelve None si no se puede determinar."""
    repo = f"Systran/faster-whisper-{model_name}"
    try:
        from huggingface_hub import constants
        cache = Path(constants.HF_HUB_CACHE)
    except Exception:
        cache = Path.home() / ".cache" / "huggingface" / "hub"
    return cache / ("models--" + repo.replace("/", "--"))


def _is_corrupt_model_error(exc: Exception) -> bool:
    """¿El fallo es por un modelo descargado a medias (model.bin roto/incompleto)?"""
    msg = str(exc).lower()
    return "model.bin" in msg or "unable to open file" in msg


def _is_compute_type_error(exc: Exception) -> bool:
    """Errores típicos por cuantización/int8 no soportada por el runtime local."""
    msg = str(exc).lower()
    return any(k in msg for k in (
        "avx", "avx2", "int8", "compute_type", "unsupported",
        "not supported", "instruction",
    ))


def _fallback_models(model_name: str) -> list[str]:
    """Modelos más livianos que conviene probar si el seleccionado falla.

    No mezcla idiomas: si el usuario eligió un modelo ".en", el fallback se
    mantiene en modelos ingleses. `large-v3` es multilingüe, así que cae a la
    cadena multilingüe por defecto.
    """
    chains = [
        ["large-v3", "medium", "small", "base"],
        ["medium", "small", "base"],
        ["small", "base"],
        ["medium.en", "small.en", "base.en"],
        ["small.en", "base.en"],
    ]
    for chain in chains:
        if model_name in chain:
            return chain[chain.index(model_name) + 1:]
    return []


def _resolve_language(language: str | None):
    """Idioma para Whisper: código fijo ("es"/"en") o None para autodetectar.
    Si no se pasa, se lee de los ajustes del usuario."""
    if language is None:
        try:
            from helpmeet import settings
            language = settings.get_transcription_language()
        except Exception:
            language = config.WHISPER_LANGUAGE
    return None if language == "auto" else language


def _is_network_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in ("connection", "network", "timeout", "resolve",
                                  "unreachable", "httperror", "ssl", "refused"))


def _load_single_model(model_name: str) -> WhisperModel:
    """Carga el modelo con manejo robusto de errores.

    Estrategia de fallback (en orden):
    1. Intento normal con compute_type del config.
    2. Si falla por AVX2/CPU incompatible → reintenta con float32 (universal).
    3. Si sigue fallando → borra caché y re-descarga + float32.
    """
    import logging
    log = logging.getLogger("helpmeet")
    _sizes = {'base': 150, 'small': 460, 'medium': 1500, 'large-v3': 3000}

    def _create(compute_type: str | None = None):
        ct = compute_type or config.WHISPER_COMPUTE_TYPE
        return WhisperModel(
            model_name,
            device=config.WHISPER_DEVICE,
            compute_type=ct,
        )

    def _no_internet_error(exc) -> RuntimeError:
        size_mb = _sizes.get(model_name, 500)
        return RuntimeError(
            f"El modelo «{model_name}» no está disponible. "
            f"La primera vez necesita internet para descargarlo (~{size_mb} MB). "
            f"Conéctate a internet y vuelve a intentarlo. Detalle: {exc}"
        )

    # Intento 1: configuración normal
    log.debug("Cargando modelo Whisper '%s' (compute_type=%s)", model_name, config.WHISPER_COMPUTE_TYPE)
    try:
        model = _create()
        log.info("Modelo '%s' cargado correctamente", model_name)
        return model
    except Exception as exc:  # noqa: BLE001
        if _is_network_error(exc):
            log.exception("Error de red al descargar modelo '%s'", model_name)
            raise _no_internet_error(exc) from exc
        if _is_corrupt_model_error(exc):
            log.warning(
                "Modelo '%s': caché incompleta/corrupta (%s). Se limpiará y se "
                "descargará nuevamente.",
                model_name, exc,
            )
        elif _is_compute_type_error(exc):
            log.warning(
                "Modelo '%s': compute_type='%s' no disponible en este equipo. "
                "Reintentando con float32.",
                model_name, config.WHISPER_COMPUTE_TYPE,
            )
            try:
                model = _create("float32")
                log.info("Modelo '%s' cargado correctamente con float32 (fallback)", model_name)
                return model
            except Exception as exc2:  # noqa: BLE001
                if _is_network_error(exc2):
                    log.exception("Error de red al descargar modelo '%s'", model_name)
                    raise _no_internet_error(exc2) from exc2
                if not _is_corrupt_model_error(exc2):
                    log.exception("Fallo con float32 en modelo '%s'", model_name)
                    raise
                log.warning("Modelo '%s': caché corrupta también con float32.", model_name)
        else:
            log.exception("Error inesperado al cargar modelo '%s'", model_name)
            raise

    # Caché corrupta → borrar y re-descargar con float32
    folder = _model_cache_dir(model_name)
    log.warning(
        "Modelo '%s': caché corrupta. Borrando '%s' y re-descargando…",
        model_name, folder,
    )
    if folder and folder.exists():
        shutil.rmtree(folder, ignore_errors=True)
    try:
        model = _create("float32")
        log.info("Modelo '%s' re-descargado y cargado con float32", model_name)
        return model
    except Exception as exc3:  # noqa: BLE001
        log.exception("Fallo definitivo al cargar modelo '%s'", model_name)
        raise _no_internet_error(exc3) from exc3


def _load_model(model_name: str) -> tuple[WhisperModel, str]:
    """Carga el modelo solicitado; si falla, prueba alternativas más livianas.

    Esto evita que una configuración en "max" (large-v3) deje inutilizable la
    transcripción cuando la descarga pesa varios GB, queda incompleta o el equipo
    no puede cargarla. El usuario conserva su ajuste, pero la sesión actual usa
    el primer modelo disponible.
    """
    import logging
    log = logging.getLogger("helpmeet")
    errors: list[str] = []
    for candidate in [model_name, *_fallback_models(model_name)]:
        try:
            if candidate != model_name:
                log.warning(
                    "No se pudo usar el modelo '%s'. Probando fallback más liviano: '%s'.",
                    model_name, candidate,
                )
            return _load_single_model(candidate), candidate
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{candidate}: {exc}")
            continue
    raise RuntimeError(
        "No se pudo preparar ningún modelo de transcripción local. "
        "Revisa la conexión a internet o limpia la caché de Hugging Face. "
        "Detalle: " + " | ".join(errors[-3:])
    )


class TranscriptionEngine:
    """Envoltorio de faster-whisper. Carga el modelo una vez y transcribe audio."""

    supports_progress = True

    def __init__(self, model_name: str | None = None):
        self.requested_model_name = model_name or config.WHISPER_MODEL
        self._model, self.model_name = _load_model(self.requested_model_name)

    def transcribe_file(self, audio_path: str, on_progress=None,
                        no_speech_max: float = 0.9,
                        quality: str = "fast",
                        language: str | None = None) -> list[TranscribedSegment]:
        """Transcribe un archivo. `on_progress(fraccion 0..1)` se llama según avanza
        (faster-whisper entrega los tramos con su marca de tiempo, así que se puede
        calcular el porcentaje real). `no_speech_max`: descarta tramos con probabilidad
        de "no hay voz" mayor que esto (1.0 = no descartar nada). `language`: código
        ("es"/"en") o None para tomar el idioma elegido en los ajustes ("auto" =
        autodetección)."""
        accurate = quality == "accurate"
        # VAD permisivo: detects speech even with background music.
        # speech_threshold bajo (0.3) y silencio mínimo alto (800ms) para no
        # cortar segmentos donde la voz compite con música.
        segments, info = self._model.transcribe(
            audio_path,
            language=_resolve_language(language),
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 800,
                "speech_pad_ms": 400,
                "threshold": 0.3,          # más sensible (def. 0.5) → capta voz con música
            },
            beam_size=5 if accurate else 1,
            condition_on_previous_text=accurate,
            initial_prompt=config.WHISPER_INITIAL_PROMPT,
            compression_ratio_threshold=2.4,   # evita alucinaciones en silencio prolongado
            log_prob_threshold=-1.0,           # permisivo: no descarta por incertidumbre
        )
        total = getattr(info, "duration", 0.0) or 0.0
        result = []
        for s in segments:
            if on_progress and total:
                on_progress(min(1.0, s.end / total))
            if getattr(s, "no_speech_prob", 0.0) > no_speech_max:
                continue
            if is_hallucination(s.text):
                continue
            text = clean_text(s.text)
            if text:
                result.append(TranscribedSegment(text, s.start, s.end))
        if on_progress:
            on_progress(1.0)
        return result
