"""Persistencia de grabaciones que pueden sobrevivir a un cierre inesperado."""

from __future__ import annotations

import json
import shutil
import struct
import uuid
import wave
from datetime import datetime
from pathlib import Path

from helpmeet import config


MANIFEST = "recovery.json"


def recovery_dir() -> Path:
    """Se calcula al usarlo para respetar DATA_DIR configurado en ejecución."""
    return config.DATA_DIR / "recovery"


def create_session(kind: str, meeting, **extra) -> Path:
    """Crea una carpeta única y escribe el manifiesto antes de capturar datos."""
    work_dir = recovery_dir() / uuid.uuid4().hex
    work_dir.mkdir(parents=True, exist_ok=False)
    data = {
        "version": 1,
        "id": work_dir.name,
        "kind": kind,
        "meeting_id": meeting.id,
        "initiative_id": meeting.initiative_id,
        "title": meeting.title,
        "started_at": meeting.started_at.isoformat(),
        "state": "recording",
    }
    data.update(extra)
    write_manifest(work_dir, data)
    return work_dir


def write_manifest(work_dir: Path, data: dict) -> None:
    """Escritura atómica: nunca deja un JSON a medias si el proceso muere."""
    work_dir = Path(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    target = work_dir / MANIFEST
    temporary = work_dir / f"{MANIFEST}.tmp"
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(target)


def update_session(work_dir: Path, **changes) -> dict:
    data = read_manifest(Path(work_dir))
    data.update(changes)
    write_manifest(Path(work_dir), data)
    return data


def read_manifest(work_dir: Path) -> dict:
    path = Path(work_dir) / MANIFEST
    data = json.loads(path.read_text(encoding="utf-8"))
    data["work_dir"] = str(path.parent)
    return data


def get_session(recovery_id: str) -> dict | None:
    work_dir = _safe_session_dir(recovery_id)
    try:
        return read_manifest(work_dir)
    except (OSError, ValueError, json.JSONDecodeError):
        return None


def list_sessions() -> list[dict]:
    """Devuelve solo sesiones con material real que todavía se puede recuperar."""
    root = recovery_dir()
    if not root.exists():
        return []
    result = []
    for work_dir in root.iterdir():
        if not work_dir.is_dir():
            continue
        try:
            data = read_manifest(work_dir)
        except (OSError, ValueError, json.JSONDecodeError):
            continue
        tracks = []
        durations = []
        for label, filename in (("mic", "me.wav"), ("system", "others.wav")):
            path = work_dir / filename
            if path.exists() and path.stat().st_size > 44:
                repair_wav(path)
                tracks.append(label)
                durations.append(wav_seconds(path))
        video = work_dir / "video_temp.mp4"
        if video.exists() and video.stat().st_size > 0:
            tracks.append("video")
        if not tracks:
            continue
        seconds = max(durations, default=_elapsed_seconds(data.get("started_at")))
        started = _parse_datetime(data.get("started_at"))
        result.append({
            **data,
            "date": started.strftime("%d/%m/%Y · %H:%M") if started else "",
            "duration": _format_duration(seconds),
            "duration_seconds": round(seconds, 1),
            "tracks": tracks,
            "has_video": "video" in tracks,
        })
    result.sort(key=lambda item: item.get("started_at", ""), reverse=True)
    return result


def discard_session(recovery_id: str) -> bool:
    work_dir = _safe_session_dir(recovery_id)
    if not work_dir.exists():
        return False
    shutil.rmtree(work_dir)
    return True


def repair_wav(path: Path) -> bool:
    """Repara tamaños RIFF/data que `wave` no alcanzó a cerrar tras un apagado."""
    path = Path(path)
    try:
        size = path.stat().st_size
        if size < 44:
            return False
        with path.open("r+b") as fh:
            if fh.read(4) != b"RIFF":
                return False
            fh.seek(12)
            data_size_offset = None
            data_start = None
            while fh.tell() + 8 <= size:
                chunk_id = fh.read(4)
                raw_size = fh.read(4)
                if len(raw_size) != 4:
                    break
                chunk_size = struct.unpack("<I", raw_size)[0]
                if chunk_id == b"data":
                    data_size_offset = fh.tell() - 4
                    data_start = fh.tell()
                    break
                fh.seek(min(size, fh.tell() + chunk_size + (chunk_size % 2)))
            if data_start is None:
                return False
            fh.seek(4)
            fh.write(struct.pack("<I", min(size - 8, 0xFFFFFFFF)))
            fh.seek(data_size_offset)
            fh.write(struct.pack("<I", min(size - data_start, 0xFFFFFFFF)))
        return True
    except OSError:
        return False


def wav_seconds(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as wav:
            return wav.getnframes() / (wav.getframerate() or 1)
    except (OSError, wave.Error):
        return 0.0


def _safe_session_dir(recovery_id: str) -> Path:
    if not recovery_id or Path(str(recovery_id)).name != str(recovery_id):
        raise ValueError("Identificador de recuperación inválido.")
    root = recovery_dir().resolve()
    candidate = (root / str(recovery_id)).resolve()
    if candidate.parent != root:
        raise ValueError("Identificador de recuperación inválido.")
    return candidate


def _parse_datetime(value) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _elapsed_seconds(value) -> float:
    started = _parse_datetime(value)
    return max(0.0, (datetime.now() - started).total_seconds()) if started else 0.0


def _format_duration(seconds: float) -> str:
    total = max(0, int(seconds))
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes}:{secs:02d}"
