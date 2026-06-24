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


def _load_model(model_name: str) -> WhisperModel:
    """Carga el modelo. Si la caché quedó corrupta de una descarga interrumpida
    (error «Unable to open file model.bin»), borra la carpeta y la vuelve a
    descargar una vez. Así la app se repara sola en lugar de atascarse."""
    try:
        return WhisperModel(
            model_name,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
        )
    except Exception as exc:  # noqa: BLE001
        if not _is_corrupt_model_error(exc):
            raise
        folder = _model_cache_dir(model_name)
        if folder and folder.exists():
            shutil.rmtree(folder, ignore_errors=True)
        # Segundo intento: la caché está limpia, fuerza una descarga completa.
        return WhisperModel(
            model_name,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
        )


class TranscriptionEngine:
    """Envoltorio de faster-whisper. Carga el modelo una vez y transcribe audio."""

    supports_progress = True

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or config.WHISPER_MODEL
        self._model = _load_model(self.model_name)

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
        segments, info = self._model.transcribe(
            audio_path,
            language=_resolve_language(language),
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
            beam_size=5 if accurate else 1,
            condition_on_previous_text=accurate,
            initial_prompt=config.WHISPER_INITIAL_PROMPT,
        )
        total = getattr(info, "duration", 0.0) or 0.0  # duración total del audio (s)
        result = []
        for s in segments:
            if on_progress and total:
                on_progress(min(1.0, s.end / total))
            if getattr(s, "no_speech_prob", 0.0) > no_speech_max:  # silencio claro
                continue
            if is_hallucination(s.text):
                continue
            text = clean_text(s.text)
            if text:
                result.append(TranscribedSegment(text, s.start, s.end))
        if on_progress:
            on_progress(1.0)
        return result
