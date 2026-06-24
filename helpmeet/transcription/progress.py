"""Progreso ponderado por duración para transcripciones de varias pistas.

Si las pistas se repartieran a partes iguales (50% y 50% con dos pistas), la
barra saltaría de golpe cuando una pista corta o casi en silencio termina al
instante. Ponderando por la duración real de cada pista, la barra avanza
proporcional al trabajo que queda y se mueve de forma continua.
"""
from __future__ import annotations

import wave
from pathlib import Path


def wav_seconds(path) -> float:
    """Duración en segundos de un WAV (0 si no se puede leer)."""
    try:
        with wave.open(str(path), "rb") as wf:
            return wf.getnframes() / (wf.getframerate() or 1)
    except Exception:
        return 0.0


class WeightedProgress:
    """Reparte la barra 0..1 entre varias pistas según su duración.

    Uso:
        wp = WeightedProgress([path1, path2])
        for i, path in enumerate(tracks):
            engine.transcribe_file(path, on_progress=lambda f, i=i: report(wp.at(i, f)))
    """

    def __init__(self, paths) -> None:
        # Piso de 1s por pista: evita que una pista vacía pese 0 y deje su tramo
        # sin avanzar, y previene la división por cero.
        self._durations = [max(wav_seconds(Path(p)), 1.0) for p in paths]
        self._total = sum(self._durations) or 1.0
        # Duración acumulada ANTES de cada pista (su punto de arranque en la barra).
        self._starts = []
        running = 0.0
        for d in self._durations:
            self._starts.append(running)
            running += d

    def at(self, index: int, fraction: float) -> float:
        """Progreso global (0..1) cuando la pista `index` va al `fraction` (0..1)."""
        start = self._starts[index]
        dur = self._durations[index]
        return min(1.0, (start + max(0.0, min(1.0, fraction)) * dur) / self._total)
