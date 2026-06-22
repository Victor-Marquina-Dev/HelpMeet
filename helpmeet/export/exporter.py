import re
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from helpmeet.db.models import Meeting, Initiative

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
    """Ruta de la carpeta de exportación de una reunión (sin crearla)."""
    folder_name = f"{_slug(meeting.initiative.name)}_{meeting.started_at:%Y-%m-%d}"
    return Path(base_dir) / folder_name


def export_meeting(session: Session, meeting_id: int, base_dir: Path) -> Path:
    """Exporta UNA grabación a `<slug>_<fecha>/`.

    Escribe DOS archivos con el mismo contenido:
    - `contexto.md`: la grabación actual (cómodo de abrir siempre igual).
    - `<fecha>_<hora>_<titulo>.md`: un archivo por grabación; al llevar la hora,
      varias grabaciones del mismo día NO se sobreescriben.
    Las capturas se prefijan con la hora por el mismo motivo.
    """
    meeting: Meeting = session.get(Meeting, meeting_id)
    ini = meeting.initiative

    out_dir = meeting_export_dir(meeting, base_dir)
    captures_dir = out_dir / "capturas"
    out_dir.mkdir(parents=True, exist_ok=True)
    captures_dir.mkdir(parents=True, exist_ok=True)

    stamp = f"{meeting.started_at:%H-%M-%S}-"
    lines: list[str] = [f"# Iniciativa: {ini.name}", ""]
    lines += _render_meeting(meeting, captures_dir, prefix=stamp)
    content = "\n".join(lines) + "\n"

    dated_name = f"{meeting.started_at:%Y-%m-%d_%H-%M-%S}_{_slug(meeting.title)}.md"
    (out_dir / dated_name).write_text(content, encoding="utf-8")
    (out_dir / "contexto.md").write_text(content, encoding="utf-8")
    return out_dir


def export_initiative(session: Session, initiative_id: int, base_dir: Path) -> Path:
    """Junta TODAS las reuniones de una iniciativa en un solo `contexto.md`.

    Las reuniones se ordenan cronológicamente y comparten una única carpeta
    `capturas/` (los nombres llevan prefijo `rNN-` para no pisarse). Así Claude
    recibe el contexto completo de la iniciativa de principio a fin.
    """
    ini: Initiative = session.get(Initiative, initiative_id)
    meetings = sorted(ini.meetings, key=lambda m: m.started_at)

    folder_name = f"{_slug(ini.name)}_completa"
    out_dir = Path(base_dir) / folder_name
    captures_dir = out_dir / "capturas"
    out_dir.mkdir(parents=True, exist_ok=True)
    captures_dir.mkdir(parents=True, exist_ok=True)

    total_utts = sum(len(m.utterances) for m in meetings)
    if meetings:
        periodo = (
            f"{meetings[0].started_at:%Y-%m-%d} – {meetings[-1].started_at:%Y-%m-%d}"
        )
    else:
        periodo = "—"

    lines: list[str] = [f"# Iniciativa: {ini.name}"]
    if ini.description:
        lines += ["", ini.description]
    lines.append("")
    lines.append(
        f"Reuniones: {len(meetings)} · Frases totales: {total_utts} · Periodo: {periodo}"
    )
    lines.append("")

    for i, meeting in enumerate(meetings, start=1):
        # Se renderiza UNA vez (esto copia sus capturas a la carpeta compartida)
        # y se reutiliza para el documento combinado y para el individual.
        meeting_lines = _render_meeting(meeting, captures_dir, prefix=f"r{i:02d}-")

        # 1) Añadir al documento combinado (1 para todo).
        lines.append("---")
        lines.append("")
        lines += meeting_lines
        lines.append("")

        # 2) Escribir un .md propio de la reunión, con fecha y hora en el nombre.
        per = [f"# Iniciativa: {ini.name}", ""] + meeting_lines
        fname = f"{meeting.started_at:%Y-%m-%d_%H-%M-%S}_{_slug(meeting.title)}.md"
        (out_dir / fname).write_text("\n".join(per) + "\n", encoding="utf-8")

    (out_dir / "contexto.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_dir
