import re
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from helpmeet.db.models import Meeting, Initiative
from helpmeet.glossary import glossary_from_meetings

SPEAKER_LABEL = {"me": "Yo", "others": "Los demás"}


def _slug(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    return re.sub(r"[\s_-]+", "-", text)


def _fmt_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


def _fmt_duration(meeting: Meeting) -> str:
    if meeting.ended_at and meeting.started_at:
        total = int((meeting.ended_at - meeting.started_at).total_seconds())
        mm, ss = divmod(total, 60)
        return f"{mm} min {ss} s"
    return "en curso"


def _speakers_present(meeting: Meeting) -> str:
    seen: list[str] = []
    for u in meeting.utterances:
        label = SPEAKER_LABEL.get(u.speaker, u.speaker)
        if label not in seen:
            seen.append(label)
    return ", ".join(seen) if seen else "—"


def _offset(when, started_at) -> float:
    """Segundos transcurridos desde el inicio de la reunión (0 si falta el dato)."""
    if when and started_at:
        return (when - started_at).total_seconds()
    return 0.0


def _map_captures(meeting: Meeting, captures_dir: Path, prefix: str) -> dict:
    """Copia las capturas y las mapea: utterance_id -> [(nombre, momento)]."""
    by_utt: dict[int | None, list[tuple[str, float]]] = {}
    for idx, cap in enumerate(meeting.captures, start=1):
        src = Path(cap.image_path)
        dest_name = f"{prefix}captura-{idx:02d}{src.suffix or '.png'}"
        if src.exists():
            shutil.copy(src, captures_dir / dest_name)
        by_utt.setdefault(cap.near_utterance_id, []).append(
            (dest_name, _offset(cap.taken_at, meeting.started_at))
        )
    return by_utt


def _map_notes(meeting: Meeting, sorted_utts: list) -> dict:
    """Mapea las notas a la frase de su momento: utterance_id -> [(texto, momento)]."""
    by_utt: dict[int | None, list[tuple[str, float]]] = {}
    for note in meeting.notes:
        offset = _offset(note.created_at, meeting.started_at)
        target = None
        for u in sorted_utts:
            if u.start_time <= offset:
                target = u.id
            else:
                break
        by_utt.setdefault(target, []).append((note.text, offset))
    return by_utt


def _render_meeting(meeting: Meeting, captures_dir: Path, prefix: str = "") -> list[str]:
    """Devuelve las líneas markdown de UNA reunión y copia sus capturas.

    `prefix` se antepone al nombre de archivo de cada captura para que no
    choquen al juntar varias reuniones en una misma carpeta `capturas/`.
    """
    sorted_utts = sorted(meeting.utterances, key=lambda u: u.start_time)
    captures_by_utt = _map_captures(meeting, captures_dir, prefix)
    notes_by_utt = _map_notes(meeting, sorted_utts)

    end = f"{meeting.ended_at:%H:%M}" if meeting.ended_at else "en curso"
    # Encabezado enriquecido: datos que ayudan a Claude a situar la reunión.
    lines: list[str] = [
        f"## Reunión: {meeting.title} — {meeting.started_at:%Y-%m-%d} "
        f"({meeting.started_at:%H:%M}–{end})",
        f"- Duración: {_fmt_duration(meeting)}",
        f"- Frases: {len(meeting.utterances)}",
        f"- Hablantes: {_speakers_present(meeting)}",
    ]
    if meeting.captures:
        lines.append(f"- Capturas: {len(meeting.captures)}")
    if meeting.notes:
        lines.append(f"- Notas: {len(meeting.notes)}")
    if meeting.audio_path and str(meeting.audio_path).lower().endswith(".mp4"):
        video = Path(meeting.audio_path)
        if video.exists():
            lines.append(f"- Video: [{video.name}]({video.name})")
    lines.append("")

    for utt in sorted_utts:
        label = SPEAKER_LABEL.get(utt.speaker, utt.speaker)
        lines.append(f"[{_fmt_time(utt.start_time)}] {label}: {utt.text}")
        for name, offset in captures_by_utt.get(utt.id, []):
            lines.append(f"        [{_fmt_time(offset)}] 📷 (ver capturas/{name})")
        for text, offset in notes_by_utt.get(utt.id, []):
            lines.append(f"        [{_fmt_time(offset)}] 📝 Nota: {text}")

    # capturas y notas que no quedaron ligadas a ninguna frase, al final
    for name, offset in captures_by_utt.get(None, []):
        lines.append(f"[{_fmt_time(offset)}] 📷 (ver capturas/{name})")
    for text, offset in notes_by_utt.get(None, []):
        lines.append(f"[{_fmt_time(offset)}] 📝 Nota: {text}")

    return lines


def meeting_export_dir(meeting: Meeting, base_dir: Path) -> Path:
    """Carpeta de exportación de una reunión: la de SU iniciativa (sin crearla)."""
    return Path(base_dir) / _slug(meeting.initiative.name)


def initiative_export_dir(initiative: Initiative, base_dir: Path) -> Path:
    """Carpeta de exportación de una iniciativa (la crea si no existe)."""
    out_dir = Path(base_dir) / _slug(initiative.name)
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def _export_initiative_folder(ini: Initiative, base_dir: Path) -> Path:
    """Exporta TODA una iniciativa a una sola carpeta `<iniciativa>/`.

    Dentro deja:
    - `contexto.md`: documento combinado (todas las reuniones + glosario), el
      contexto completo para Claude.
    - `<fecha>_<hora>_<titulo>.md`: un archivo por cada grabación.
    - `capturas/`: compartida (nombres con prefijo `rNN-` para no pisarse).
    """
    meetings = sorted(
        (m for m in ini.meetings if m.archived_at is None and m.deleted_at is None),
        key=lambda m: m.started_at,
    )
    out_dir = initiative_export_dir(ini, base_dir)
    captures_dir = out_dir / "capturas"
    captures_dir.mkdir(parents=True, exist_ok=True)

    total_utts = sum(len(m.utterances) for m in meetings)
    periodo = (
        f"{meetings[0].started_at:%Y-%m-%d} – {meetings[-1].started_at:%Y-%m-%d}"
        if meetings else "—"
    )

    combined: list[str] = [f"# Iniciativa: {ini.name}"]
    if ini.description:
        combined += ["", ini.description]
    combined.append("")
    combined.append(
        f"Reuniones: {len(meetings)} · Frases totales: {total_utts} · Periodo: {periodo}"
    )

    # Glosario: términos frecuentes del proyecto (vocabulario para Claude).
    glossary = glossary_from_meetings(meetings)
    if glossary:
        combined.append("")
        combined.append("## Glosario (términos frecuentes)")
        for term, count in glossary:
            combined.append(f"- {term} ({count})")
    combined.append("")

    for i, meeting in enumerate(meetings, start=1):
        # Se renderiza UNA vez (copia sus capturas) y se reutiliza para el
        # documento combinado y para el .md individual de la grabación.
        meeting_lines = _render_meeting(meeting, captures_dir, prefix=f"r{i:02d}-")

        combined.append("---")
        combined.append("")
        combined += meeting_lines
        combined.append("")

        per = [f"# Iniciativa: {ini.name}", ""] + meeting_lines
        fname = f"{meeting.started_at:%Y-%m-%d_%H-%M-%S}_{_slug(meeting.title)}.md"
        (out_dir / fname).write_text("\n".join(per) + "\n", encoding="utf-8")

    (out_dir / "contexto.md").write_text("\n".join(combined) + "\n", encoding="utf-8")
    return out_dir


def export_meeting(session: Session, meeting_id: int, base_dir: Path) -> Path:
    """Exporta la grabación (y refresca toda la carpeta de su iniciativa)."""
    meeting: Meeting = session.get(Meeting, meeting_id)
    return _export_initiative_folder(meeting.initiative, base_dir)


def export_initiative(session: Session, initiative_id: int, base_dir: Path) -> Path:
    """Exporta TODA la iniciativa a su carpeta `<iniciativa>/`."""
    ini: Initiative = session.get(Initiative, initiative_id)
    return _export_initiative_folder(ini, base_dir)
