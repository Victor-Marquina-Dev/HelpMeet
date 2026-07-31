"""Utilidades compartidas del proyecto Helpmeet."""

import wave
from pathlib import Path


def wav_seconds(path) -> float:
    """Duración en segundos de un WAV (0 si no se puede leer)."""
    try:
        with wave.open(str(path), "rb") as wf:
            return wf.getnframes() / (wf.getframerate() or 1)
    except Exception:
        return 0.0


def fmt_time(seconds: float) -> str:
    """Convierte segundos a formato MM:SS."""
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


def fmt_duration_seconds(total_seconds: int) -> str:
    """Duracion en formato legible (X min Y s)."""
    mm, ss = divmod(max(0, total_seconds), 60)
    return f"{mm} min {ss} s"


def human_size(path) -> str:
    """Tamaño legible de archivo (KB/MB/GB). Vacio si no existe."""
    import os
    try:
        if not path:
            return ""
        n = os.path.getsize(path)
    except OSError:
        return ""
    units = ("B", "KB", "MB", "GB", "TB")
    size = float(n)
    i = 0
    while size >= 1024 and i < len(units) - 1:
        size /= 1024
        i += 1
    if i == 0:
        return f"{int(size)} {units[i]}"
    return f"{size:.1f} {units[i]}"
