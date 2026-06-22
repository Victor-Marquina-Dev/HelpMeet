from faster_whisper import WhisperModel
from helpmeet import config
from helpmeet.transcription.cleanup import clean_text, is_hallucination
from helpmeet.transcription.segment import TranscribedSegment


class TranscriptionEngine:
    """Envoltorio de faster-whisper. Carga el modelo una vez y transcribe audio."""

    def __init__(self):
        self._model = WhisperModel(
            config.WHISPER_MODEL,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
        )

    def transcribe_file(self, audio_path: str, on_progress=None,
                        no_speech_max: float = 0.9) -> list[TranscribedSegment]:
        """Transcribe un archivo. `on_progress(fraccion 0..1)` se llama según avanza
        (faster-whisper entrega los tramos con su marca de tiempo, así que se puede
        calcular el porcentaje real). `no_speech_max`: descarta tramos con probabilidad
        de "no hay voz" mayor que esto (1.0 = no descartar nada)."""
        segments, info = self._model.transcribe(
            audio_path,
            language=config.WHISPER_LANGUAGE,
            vad_filter=True,
            beam_size=1,                       # decodificación rápida (greedy)
            condition_on_previous_text=False,  # más rápido y evita bucles de repetición
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
