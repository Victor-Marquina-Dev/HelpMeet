from dataclasses import dataclass
from faster_whisper import WhisperModel
from helpmeet import config


@dataclass
class TranscribedSegment:
    text: str
    start: float
    end: float


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
            audio_path, language=config.WHISPER_LANGUAGE, vad_filter=True
        )
        return [TranscribedSegment(s.text.strip(), s.start, s.end) for s in segments]
