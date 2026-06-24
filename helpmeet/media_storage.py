"""Almacenamiento interno de pistas auxiliares de una grabación de pantalla.

El usuario ve únicamente el vídeo final, la transcripción y las capturas. Las
pistas separadas se conservan aquí porque mejoran mucho una retranscripción,
pero son archivos técnicos y no deben ensuciar la carpeta de exportación.
"""

import shutil
from pathlib import Path

from helpmeet import config


TRACK_FILENAMES = {"me": "microfono.wav", "others": "sistema.wav"}
LEGACY_SUFFIXES = {"me": ".mic.wav", "others": ".system.wav"}


def meeting_media_dir(meeting_id: int) -> Path:
    return config.MEDIA_DIR / str(int(meeting_id))


def track_path(meeting_id: int, speaker: str) -> Path:
    return meeting_media_dir(meeting_id) / TRACK_FILENAMES[speaker]


def store_track(meeting_id: int, speaker: str, source) -> Path | None:
    """Mueve una pista terminada al área interna y devuelve su nueva ruta."""
    source = Path(source)
    if speaker not in TRACK_FILENAMES or not source.exists() or source.stat().st_size == 0:
        return None
    destination = track_path(meeting_id, speaker)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() == destination.resolve():
        return destination
    temporary = destination.with_suffix(".wav.tmp")
    temporary.unlink(missing_ok=True)
    shutil.move(str(source), str(temporary))
    destination.unlink(missing_ok=True)
    temporary.replace(destination)
    return destination


def legacy_track_path(video_path, speaker: str) -> Path:
    return Path(video_path).with_suffix(LEGACY_SUFFIXES[speaker])


def migrate_legacy_tracks(meeting_id: int, video_path) -> list[tuple[str, Path]]:
    """Oculta pistas antiguas que estaban junto al MP4 y conserva su contenido."""
    if not video_path:
        return []
    migrated = []
    for speaker in TRACK_FILENAMES:
        source = legacy_track_path(video_path, speaker)
        if source.exists():
            stored = store_track(meeting_id, speaker, source)
            if stored:
                migrated.append((speaker, stored))
    return migrated


def available_tracks(meeting_id: int, video_path=None) -> list[tuple[str, Path]]:
    """Pistas para Whisper; acepta almacenamiento nuevo y formato antiguo."""
    tracks = []
    for speaker in TRACK_FILENAMES:
        internal = track_path(meeting_id, speaker)
        legacy = legacy_track_path(video_path, speaker) if video_path else None
        if internal.exists() and internal.stat().st_size > 0:
            tracks.append((speaker, internal))
        elif legacy and legacy.exists() and legacy.stat().st_size > 0:
            tracks.append((speaker, legacy))
    return tracks
