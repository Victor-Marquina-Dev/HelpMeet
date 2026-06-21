from dataclasses import dataclass


@dataclass
class TranscribedSegment:
    text: str
    start: float
    end: float
