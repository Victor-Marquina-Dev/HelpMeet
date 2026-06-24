import re
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from helpmeet.db.models import Meeting, Initiative
from helpmeet.glossary import glossary_from_meetings

SPEAKER_LABEL = {"me": "Yo", "others": "Los demás"}
MONTHS_ES = (
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
)


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


def _map_captures(meeting: Meeting, captures_dir: Path) -> dict:
    """Copia las capturas y las mapea: utterance_id -> [(nombre, momento)].

    El archivo se nombra con el código único de la captura (p. ej.
    `CAP-007Y.png`), así nunca choca con otras ni se confunde con un simple
    'captura 1'."""
    by_utt: dict[int | None, list[tuple[str, float]]] = {}
    for cap in meeting.captures:
        src = Path(cap.image_path)
        dest_name = f"{cap.code}{src.suffix or '.png'}"
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


def _render_meeting(meeting: Meeting, captures_dir: Path,
                    captures_ref: str = "capturas", video_ref: str | None = None) -> list[str]:
    """Devuelve las líneas markdown de UNA reunión y copia sus capturas.

    Cada captura se guarda con su código único (`CAP-XXXX.png`), así no chocan
    al juntar varias reuniones en una misma carpeta `capturas/`.
    """
    sorted_utts = sorted(meeting.utterances, key=lambda u: u.start_time)
    captures_by_utt = _map_captures(meeting, captures_dir)
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
            lines.append(f"- Video: [{video.name}]({video_ref or video.name})")
    lines.append("")

    for utt in sorted_utts:
        label = SPEAKER_LABEL.get(utt.speaker, utt.speaker)
        lines.append(f"[{_fmt_time(utt.start_time)}] {label}: {utt.text}")
        for name, offset in captures_by_utt.get(utt.id, []):
            lines.append(f"        [{_fmt_time(offset)}] 📷 (ver {captures_ref}/{name})")
        for text, offset in notes_by_utt.get(utt.id, []):
            lines.append(f"        [{_fmt_time(offset)}] 📝 Nota: {text}")

    # capturas y notas que no quedaron ligadas a ninguna frase, al final
    for name, offset in captures_by_utt.get(None, []):
        lines.append(f"[{_fmt_time(offset)}] 📷 (ver {captures_ref}/{name})")
    for text, offset in notes_by_utt.get(None, []):
        lines.append(f"[{_fmt_time(offset)}] 📝 Nota: {text}")

    return lines


def meeting_export_dir(meeting: Meeting, base_dir: Path) -> Path:
    """Carpeta mensual de una reunión dentro de su iniciativa."""
    return (Path(base_dir) / _slug(meeting.initiative.name) /
            month_folder_name(meeting.started_at))


def initiative_export_dir(initiative: Initiative, base_dir: Path) -> Path:
    """Carpeta de exportación de una iniciativa (la crea si no existe)."""
    out_dir = Path(base_dir) / _slug(initiative.name)
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def month_folder_name(when) -> str:
    """Nombre ordenable y legible: `2026-06 Junio`."""
    return f"{when:%Y-%m} {MONTHS_ES[when.month - 1]}"


def initiative_month_dir(initiative: Initiative, base_dir: Path, when) -> Path:
    out_dir = initiative_export_dir(initiative, base_dir) / month_folder_name(when)
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def _move_video_to_month(meeting: Meeting, month_dir: Path) -> None:
    """Reubica videos antiguos y sus pistas auxiliares en la carpeta mensual."""
    if not meeting.audio_path or not str(meeting.audio_path).lower().endswith(".mp4"):
        return
    source = Path(meeting.audio_path)
    if not source.exists() or source.parent == month_dir:
        return
    destination = month_dir / source.name
    if not destination.exists():
        shutil.move(str(source), str(destination))
    for suffix in (".mic.wav", ".system.wav"):
        sidecar = source.with_suffix(suffix)
        if sidecar.exists():
            target = destination.with_suffix(suffix)
            if not target.exists():
                shutil.move(str(sidecar), str(target))
    meeting.audio_path = str(destination)


def _context_header(ini: Initiative) -> list[str]:
    """Cabecera para la IA externa: instrucciones (rol/qué se espera) + objetivo
    de la iniciativa. Orienta a Claude desde la primera línea del documento."""
    from helpmeet import settings as _settings
    lines: list[str] = []
    instructions = _settings.get_ai_instructions()
    if instructions:
        lines += ["# Instrucciones para la IA", "", instructions, ""]
    lines.append(f"# Iniciativa: {ini.name}")
    if ini.description:
        lines += ["", "## Objetivo de esta iniciativa", "", ini.description]
    return lines


def build_meeting_context(session: Session, meeting_id: int) -> str:
    """Texto markdown de UNA reunión, con la cabecera para la IA, listo para copiar.

    No altera la carpeta de exportación: renderiza en una carpeta temporal que se
    descarta (solo necesita un destino para las capturas, que aquí no se usan)."""
    import tempfile
    meeting: Meeting = session.get(Meeting, meeting_id)
    if meeting is None:
        return ""
    header = _context_header(meeting.initiative)
    with tempfile.TemporaryDirectory() as tmp:
        captures_dir = Path(tmp) / "capturas"
        captures_dir.mkdir(parents=True, exist_ok=True)
        video_ref = Path(meeting.audio_path).name if meeting.audio_path else None
        lines = _render_meeting(meeting, captures_dir, captures_ref="capturas",
                                video_ref=video_ref)
    return "\n".join(header + [""] + lines) + "\n"


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

    # Cada exportación mensual se regenera desde la base de datos para evitar
    # archivos duplicados después de renombrar una reunión.
    for month in {month_folder_name(m.started_at) for m in meetings}:
        month_dir = out_dir / month
        if month_dir.exists():
            for old_md in month_dir.glob("*.md"):
                old_md.unlink()
    total_utts = sum(len(m.utterances) for m in meetings)
    periodo = (
        f"{meetings[0].started_at:%Y-%m-%d} – {meetings[-1].started_at:%Y-%m-%d}"
        if meetings else "—"
    )

    combined: list[str] = _context_header(ini)
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

    for meeting in meetings:
        month_name = month_folder_name(meeting.started_at)
        month_dir = initiative_month_dir(ini, base_dir, meeting.started_at)
        captures_dir = month_dir / "capturas"
        captures_dir.mkdir(parents=True, exist_ok=True)
        _move_video_to_month(meeting, month_dir)

        combined_lines = _render_meeting(
            meeting, captures_dir,
            captures_ref=f"{month_name}/capturas",
            video_ref=(f"{month_name}/{Path(meeting.audio_path).name}"
                       if meeting.audio_path else None),
        )

        combined.append("---")
        combined.append("")
        combined += combined_lines
        combined.append("")

        meeting_lines = _render_meeting(
            meeting, captures_dir,
            captures_ref="capturas", video_ref=Path(meeting.audio_path).name
            if meeting.audio_path else None,
        )
        per = [f"# Iniciativa: {ini.name}", ""] + meeting_lines
        fname = f"{meeting.started_at:%Y-%m-%d_%H-%M-%S}_{_slug(meeting.title)}.md"
        (month_dir / fname).write_text("\n".join(per) + "\n", encoding="utf-8")

    # Limpiar la estructura antigua una vez que las copias mensuales existen.
    for old_md in out_dir.glob("*.md"):
        if old_md.name != "contexto.md":
            old_md.unlink()
    legacy_captures = out_dir / "capturas"
    if legacy_captures.exists():
        shutil.rmtree(legacy_captures)

    (out_dir / "contexto.md").write_text("\n".join(combined) + "\n", encoding="utf-8")
    return out_dir


def export_meeting(session: Session, meeting_id: int, base_dir: Path) -> Path:
    """Exporta la grabación (y refresca toda la carpeta de su iniciativa)."""
    meeting: Meeting = session.get(Meeting, meeting_id)
    out = _export_initiative_folder(meeting.initiative, base_dir)
    session.commit()
    return out


def export_initiative(session: Session, initiative_id: int, base_dir: Path) -> Path:
    """Exporta TODA la iniciativa a su carpeta `<iniciativa>/`."""
    ini: Initiative = session.get(Initiative, initiative_id)
    out = _export_initiative_folder(ini, base_dir)
    session.commit()
    return out
