from faster_whisper import WhisperModel
from helpmeet import config
from helpmeet.transcription.cleanup import clean_text
from helpmeet.transcription.segment import TranscribedSegment


class TranscriptionEngine:
    """Envoltorio de faster-whisper. Carga el modelo una vez y transcribe audio."""

    def __init__(self):
        self._model = WhisperModel(
            config.WHISPER_MODEL,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
        )

    def transcribe_file(self, audio_path: str) -> list[TranscribedSegment]:
        segments, _ = self._model.transcribe(
            audio_path,
            language=config.WHISPER_LANGUAGE,
            vad_filter=True,
            beam_size=1,                       # decodificación rápida (greedy)
            condition_on_previous_text=False,  # más rápido y evita bucles de repetición
            initial_prompt=config.WHISPER_INITIAL_PROMPT,
        )
        result = []
        for s in segments:
            text = clean_text(s.text)
            if text:
                result.append(TranscribedSegment(text, s.start, s.end))
        return result
