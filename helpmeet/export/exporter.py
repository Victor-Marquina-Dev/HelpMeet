import re
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from helpmeet.db.models import Meeting

SPEAKER_LABEL = {"me": "Yo", "others": "Los demás"}


def _slug(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    return re.sub(r"[\s_-]+", "-", text)


def _fmt_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


def export_meeting(session: Session, meeting_id: int, base_dir: Path) -> Path:
    meeting: Meeting = session.get(Meeting, meeting_id)
    ini = meeting.initiative

    folder_name = f"{_slug(ini.name)}_{meeting.started_at:%Y-%m-%d}"
    out_dir = Path(base_dir) / folder_name
    captures_dir = out_dir / "capturas"
    out_dir.mkdir(parents=True, exist_ok=True)
    captures_dir.mkdir(parents=True, exist_ok=True)

    # copiar capturas y mapear utterance_id -> [(nombre, momento)]
    captures_by_utt: dict[int | None, list[tuple[str, float]]] = {}
    for idx, cap in enumerate(meeting.captures, start=1):
        src = Path(cap.image_path)
        dest_name = f"captura-{idx:02d}{src.suffix or '.png'}"
        if src.exists():
            shutil.copy(src, captures_dir / dest_name)
        if cap.taken_at and meeting.started_at:
            offset = (cap.taken_at - meeting.started_at).total_seconds()
        else:
            offset = 0.0
        captures_by_utt.setdefault(cap.near_utterance_id, []).append((dest_name, offset))

    lines: list[str] = []
    lines.append(f"# Iniciativa: {ini.name}")
    end = f"{meeting.ended_at:%H:%M}" if meeting.ended_at else "en curso"
    lines.append(
        f"## Reunión: {meeting.title} — {meeting.started_at:%Y-%m-%d} "
        f"({meeting.started_at:%H:%M}–{end})"
    )
    lines.append("")

    for utt in sorted(meeting.utterances, key=lambda u: u.start_time):
        label = SPEAKER_LABEL.get(utt.speaker, utt.speaker)
        lines.append(f"[{_fmt_time(utt.start_time)}] {label}: {utt.text}")
        for name, offset in captures_by_utt.get(utt.id, []):
            lines.append(f"        [{_fmt_time(offset)}] 📷 (ver capturas/{name})")

    # capturas que no quedaron ligadas a ninguna frase, al final
    for name, offset in captures_by_utt.get(None, []):
        lines.append(f"[{_fmt_time(offset)}] 📷 (ver capturas/{name})")

    (out_dir / "contexto.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_dir
