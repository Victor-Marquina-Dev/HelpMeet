"""Metodos de gestion de reuniones, frases, participantes y capturas."""

import os
import base64
from pathlib import Path
from datetime import timedelta

from helpmeet import config
from helpmeet import settings
from helpmeet.db import repository as repo
from helpmeet.constants import MONTHS_ES
from helpmeet.utils import wav_seconds, human_size
from helpmeet.version import __version__


class MeetingApiMixin:
    """gestion de reuniones, frases, participantes y capturas.."""
    def _meeting_payload(self, m, frase_count: int, transcribing: set[int]) -> dict:
        """Construye el dict de una reunión para la UI. `frase_count` viene de un
        COUNT agregado (no de cargar todas las frases) y `transcribing` es el
        conjunto de reuniones en proceso."""
        total = int((m.ended_at - m.started_at).total_seconds()) if m.ended_at else 0
        mm, ss = divmod(max(0, total), 60)
        is_video = bool(m.audio_path and str(m.audio_path).lower().endswith(".mp4"))
        # Origen de la reunión para la UI: audio grabado, pantalla grabada o
        # vídeo importado. Las grabaciones de pantalla usan el nombre
        # "DD-MM-YY HH-MM-SS.mp4" (ver start_screen_record); los importados
        # conservan su nombre original.
        import re as _re
        stem = Path(m.audio_path).stem if m.audio_path else ""
        if not m.audio_path:
            source = ""
        elif not is_video:
            source = "audio"
        elif (_re.fullmatch(r"\d{2}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}", stem)
              or stem.lower().startswith("grabacion")   # nombre legacy de grabaciones
              or stem.lower().startswith("video_temp")):
            source = "screen"
        else:
            source = "import"
        if m.id in transcribing:
            status = "processing"   # transcribiéndose en segundo plano
        elif is_video and frase_count == 0:
            status = "pending"
        elif m.ended_at:
            status = "done"
        else:
            status = "pending"
        return {
            "id": m.id,
            "title": m.title,
            "date": m.started_at.strftime("%d/%m/%Y %H:%M"),
            "started_at": m.started_at.strftime("%Y-%m-%dT%H:%M:%S"),
            "time": _fmt_12h(m.started_at),
            "month_key": m.started_at.strftime("%Y-%m"),
            "month_label": _spanish_month(m.started_at),
            "status": status,
            "frases": frase_count,
            "dur": f"{mm:02d}:{ss:02d}" if m.ended_at else "—",
            "size": human_size(m.audio_path),
            "has_video": is_video,
            "source": source,
        }


    def _participants_payload(self, initiative_id: int) -> list[dict]:
        return [{"id": p.id, "name": p.name, "is_me": bool(p.is_me)}
                for p in repo.list_participants(self._session, int(initiative_id))]


    def _transcribing_ids(self) -> set[int]:
        """Reuniones que ahora mismo se están transcribiendo en segundo plano."""
        with self._jobs_lock:
            return {mid for mid, info in self._jobs_info.items()
                    if info.get("state") in ("queued", "running")}


    def add_meeting_note(self, meeting_id: int, text: str) -> dict:
        """Añade una entrada de "Contexto" a la transcripción de una reunión.
        Aparece arriba del todo y con la etiqueta Contexto."""
        text = (text or "").strip()
        if not text:
            return {"ok": False}
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        note = repo.add_note(self._session, int(meeting_id), text, is_context=True)
        return {"ok": True, "note": {
            "id": note.id, "kind": "context", "time": "", "offset": 0.0,
            "text": note.text,
        }}


    def add_note_post(self, meeting_id: int, text: str) -> dict:
        """Añade una nota normal a una reunión ya terminada (no es 'contexto')."""
        text = (text or "").strip()
        if not text:
            return {"ok": False}
        meeting = repo.get_meeting(self._session, int(meeting_id))
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        note = repo.add_note(self._session, int(meeting_id), text, is_context=False)
        offset = max(0.0, (note.created_at - meeting.started_at).total_seconds())
        def _stamp(s):
            m, sec = divmod(int(s), 60); h, m = divmod(m, 60)
            return f"{h:02d}:{m:02d}:{sec:02d}" if h else f"{m:02d}:{sec:02d}"
        return {"ok": True, "note": {
            "id": note.id, "kind": "note", "time": _stamp(offset),
            "wall_time": note.created_at.strftime("%H:%M"),
            "offset": offset, "text": note.text,
        }}


    def add_participants(self, initiative_id: int, names: str | list[str]) -> dict:
        """Da de alta participantes. `names` puede ser una lista o texto con un
        nombre por línea (para pegar varios de golpe)."""
        repo.add_participants(self._session, int(initiative_id), names)
        return {"ok": True, "participants": self._participants_payload(initiative_id)}


    def assign_utterance_participant(self, utterance_id: int, participant_id: int | None) -> dict:
        """Asigna una frase a un participante concreto (None = sin asignar)."""
        pid = int(participant_id) if participant_id not in (None, "") else None
        utt = repo.assign_utterance_participant(self._session, int(utterance_id), pid)
        if utt is None:
            return {"ok": False, "error": "La frase ya no existe."}
        return {"ok": True, "id": utt.id, "participant_id": utt.participant_id}


    def delete_participant(self, participant_id: int) -> dict:
        p = repo.get_participant(self._session, int(participant_id))
        initiative_id = p.initiative_id if p else None
        ok = repo.delete_participant(self._session, int(participant_id))
        payload = self._participants_payload(initiative_id) if initiative_id else []
        return {"ok": bool(ok), "participants": payload}


    def delete_utterance(self, utterance_id: int) -> dict:
        """Elimina una frase de la transcripción."""
        ok = repo.delete_utterance(self._session, int(utterance_id))
        return {"ok": bool(ok)}


    def get_bootstrap_state(self) -> dict:
        """P-06: un solo viaje al backend al arrancar.

        Antes la UI pedía las reuniones iniciativa por iniciativa (N+1) y además
        monitores, archivo, papelera y trabajos por separado. Aquí se devuelve
        todo de una vez, con las reuniones agrupadas en UNA consulta y los conteos
        de frases agregados."""
        self._session.expire_all()
        initiatives = [_initiative_payload(i)
                       for i in repo.list_initiatives(self._session)]
        grouped = repo.list_meetings_by_initiative(self._session)
        all_ids = [m.id for ms in grouped.values() for m in ms]
        counts = repo.utterance_counts(self._session, all_ids)
        transcribing = self._transcribing_ids()
        meetings_by_initiative = {
            str(iid): [self._meeting_payload(m, counts.get(m.id, 0), transcribing)
                       for m in ms]
            for iid, ms in grouped.items()
        }
        # Las iniciativas sin reuniones también deben figurar (lista vacía).
        for i in initiatives:
            meetings_by_initiative.setdefault(str(i["id"]), [])
        try:
            monitors = self.list_monitors()
        except Exception:
            monitors = []
        with self._jobs_lock:
            jobs = list(self._jobs_info.values())
        return {
            "version": __version__,
            "initiatives": initiatives,
            "meetings_by_initiative": meetings_by_initiative,
            "monitors": monitors,
            "library_counts": {
                "archive": len(repo.list_archived(self._session)),
                "trash": len(repo.list_trash(self._session)),
            },
            "background_jobs": jobs,
            "default_mic_muted": bool(settings.get_transcription_settings().get("default_mic_muted", False)),
            "screen_recording": self._screen_rec is not None,
            "screen_meeting_id": self._screen_meeting_id,
            "setup_done": settings.get_setup_done(),
        }


    def get_capture_image(self, capture_id: int) -> dict:
        """Devuelve la imagen de una captura como data URL base64.

        WebView2 bloquea la carga de `file://` como sub-recurso, así que las
        miniaturas no se ven con una ruta de archivo. Incrustarlas en base64
        (igual que la previsualización) evita ese bloqueo. Se cargan bajo
        demanda (una por tarjeta) para no inflar `get_transcript`."""
        cap = repo.get_capture(self._session, int(capture_id))
        if cap is None or not cap.image_path or not os.path.exists(cap.image_path):
            return {"ok": False, "data_url": ""}
        ext = os.path.splitext(cap.image_path)[1].lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(
            ext.lstrip("."), "application/octet-stream")
        with open(cap.image_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("ascii")
        return {"ok": True, "data_url": f"data:{mime};base64,{b64}"}


    def get_capture_thumbnail(self, capture_id: int) -> dict:
        """Miniatura JPEG pequeña de una captura para las tarjetas (P-09).

        Antes la tarjeta cargaba el PNG original completo (varios MB) solo para
        mostrarlo a tamaño reducido. Aquí se genera una vez una miniatura ligera
        (se cachea en `captures/thumbs`) y se reutiliza. El original solo se pide
        al ampliar (lupa). Si la miniatura no se pudiera crear, cae al original."""
        cap = repo.get_capture(self._session, int(capture_id))
        if cap is None or not cap.image_path or not os.path.exists(cap.image_path):
            return {"ok": False, "data_url": ""}
        from helpmeet.media import make_thumbnail
        thumbs_dir = config.CAPTURES_DIR / "thumbs"
        thumb = thumbs_dir / f"{int(capture_id)}.jpg"
        try:
            fresh = (thumb.exists() and
                     thumb.stat().st_mtime >= os.path.getmtime(cap.image_path))
        except OSError:
            fresh = False
        if not fresh:
            make_thumbnail(cap.image_path, str(thumb))
        if thumb.exists():
            with open(thumb, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode("ascii")
            return {"ok": True, "data_url": f"data:image/jpeg;base64,{b64}"}
        return self.get_capture_image(capture_id)  # fallback al original


    def get_transcript(self, meeting_id: int) -> dict:
        self._session.expire_all()  # ver frases añadidas en segundo plano
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"title": "", "context": "", "started_at": "", "utterances": [],
                    "assets": {"captures": [], "notes": [], "video": None, "audio": None},
                    "video_path": None}
        video = m.audio_path if (m.audio_path and str(m.audio_path).lower().endswith(".mp4")
                                 and os.path.exists(m.audio_path)) else None
        audio = m.audio_path if (m.audio_path and not str(m.audio_path).lower().endswith(".mp4")
                                 and os.path.exists(m.audio_path)) else None
        video_duration = ""
        audio_duration = ""
        if video:
            from helpmeet.media import media_duration
            secs = int(media_duration(video))
            if secs > 0:
                hours, rem = divmod(secs, 3600)
                mins, sec = divmod(rem, 60)
                video_duration = f"{hours}:{mins:02d}:{sec:02d}" if hours else f"{mins}:{sec:02d}"
        elif m.audio_path and os.path.exists(m.audio_path):
            try:
                from helpmeet.media import media_duration
                secs = int(media_duration(m.audio_path))
                if secs > 0:
                    hours, rem = divmod(secs, 3600)
                    mins, sec = divmod(rem, 60)
                    audio_duration = f"{hours}:{mins:02d}:{sec:02d}" if hours else f"{mins}:{sec:02d}"
            except Exception:
                pass

        def stamp(seconds):
            minutes, secs = divmod(max(0, int(seconds or 0)), 60)
            return f"{minutes:02d}:{secs:02d}"

        participants = repo.list_participants(self._session, m.initiative_id)
        timeline = []
        for u in m.utterances:
            timeline.append({
                "id": u.id, "kind": "utterance", "speaker": u.speaker,
                "text": u.text, "start": u.start_time, "end": u.end_time,
                "highlighted": bool(u.highlighted),
                "participant_id": u.participant_id,
                "language": getattr(u, 'language', '') or '',
                "display_name": repo.resolved_speaker_name(u, participants),
                "time": stamp(u.start_time), "_sort": float(u.start_time),
            })
        captures = []
        for cap in m.captures:
            offset = max(0.0, (cap.taken_at - m.started_at).total_seconds())
            item = {
                "id": cap.id, "kind": "capture", "time": stamp(offset),
                "clock": _fmt_12h(cap.taken_at) if cap.taken_at else "",
                "code": cap.code,
                "offset": offset, "path": cap.image_path, "note": cap.note or "",
                "_sort": offset,
            }
            captures.append({key: value for key, value in item.items() if key != "_sort"})
            timeline.append(item)
        notes = []
        for note in m.notes:
            if note.is_context:
                # Las entradas de Contexto van al timeline (arriba del todo,
                # más recientes primero) y sin marca de tiempo.
                item = {
                    "id": note.id, "kind": "context", "time": "",
                    "offset": 0.0, "text": note.text,
                    "_sort": -note.created_at.timestamp(),
                }
                notes.append({key: value for key, value in item.items() if key != "_sort"})
                timeline.append(item)
            else:
                # Las notas normales van a assets.notes (tab Notas) y también
                # al timeline para que no se pierdan al exportar/copiar contexto.
                if note.created_at and m.started_at:
                    offset = max(0.0, (note.created_at - m.started_at).total_seconds())
                    wall_time = note.created_at.strftime("%H:%M")
                else:
                    offset = 0.0
                    wall_time = ""
                item = {
                    "id": note.id, "kind": "note", "time": stamp(offset),
                    "wall_time": wall_time,
                    "offset": offset, "text": note.text,
                    "_sort": offset,
                }
                notes.append({key: value for key, value in item.items() if key != "_sort"})
                timeline.append(item)
        timeline.sort(key=lambda item: (item["_sort"], item["kind"] != "utterance"))
        for item in timeline:
            item.pop("_sort", None)

        # Idiomas disponibles en esta reunion
        lang_counts = {}
        for u in m.utterances:
            lang = getattr(u, 'language', '') or ''
            if lang:
                lang_counts[lang] = lang_counts.get(lang, 0) + 1
        available_languages = [{"code": code, "count": count}
                               for code, count in sorted(lang_counts.items())]

        return {
            "title": m.title,
            "context": m.context or "",
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "initiative_id": m.initiative_id,
            "participants": [{"id": p.id, "name": p.name, "is_me": bool(p.is_me)}
                             for p in participants],
            "utterances": timeline,
            "assets": {"captures": captures, "notes": notes, "video": video, "audio": audio},
            "video_path": video,
            "video_duration": video_duration,
            "audio_duration": audio_duration,
            "duration": audio_duration,
            "available_languages": available_languages,
        }


    def list_meetings(self, initiative_id: int) -> list[dict]:
        # Refrescar por si una transcripción en segundo plano (otra sesión)
        # acaba de añadir frases a alguna reunión.
        self._session.expire_all()
        meetings = repo.list_meetings(self._session, int(initiative_id))
        transcribing = self._transcribing_ids()
        counts = repo.utterance_counts(self._session, [m.id for m in meetings])
        return [self._meeting_payload(m, counts.get(m.id, 0), transcribing)
                for m in meetings]


    def list_participants(self, initiative_id: int) -> dict:
        """Participantes de una iniciativa (lista reutilizable en sus reuniones)."""
        return {"ok": True, "participants": self._participants_payload(initiative_id)}


    def move_meeting(self, meeting_id: int, initiative_id: int) -> dict:
        repo.move_meeting(self._session, int(meeting_id), int(initiative_id))
        return {"ok": True}


    def rename_meeting(self, meeting_id: int, title: str) -> dict:
        repo.rename_meeting(self._session, int(meeting_id), title)
        return {"ok": True}


    def rename_participant(self, participant_id: int, name: str) -> dict:
        p = repo.rename_participant(self._session, int(participant_id), name)
        if p is None:
            return {"ok": False, "error": "Nombre no válido o participante inexistente."}
        return {"ok": True, "participants": self._participants_payload(p.initiative_id)}


    def set_me_participant(self, initiative_id: int, participant_id: int | None) -> dict:
        """Marca quién eres tú (tu micrófono) en la iniciativa."""
        pid = int(participant_id) if participant_id not in (None, "") else None
        repo.set_me_participant(self._session, int(initiative_id), pid)
        return {"ok": True, "participants": self._participants_payload(initiative_id)}


    def set_meeting_context(self, meeting_id: int, context: str) -> dict:
        meeting = repo.set_meeting_context(self._session, int(meeting_id), context)
        if meeting is None:
            return {"ok": False, "error": "La reunión ya no existe."}
        return {"ok": True, "context": meeting.context or ""}


    def set_meeting_date(self, meeting_id: int, date_str: str) -> dict:
        """Cambia la fecha del calendario de una reunión (started_at).
        date_str: 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM'. Vacío = no cambiar."""
        from datetime import timezone
        date_str = (date_str or "").strip()
        if not date_str:
            return {"ok": False, "error": "Fecha vacía"}
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"ok": False, "error": "Reunión no encontrada"}
        try:
            if "T" in date_str:
                dt = datetime.strptime(date_str, "%Y-%m-%dT%H:%M")
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                dt = dt.replace(hour=m.started_at.hour, minute=m.started_at.minute)
            m.started_at = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            self._session.commit()
            return {"ok": True, "started_at": m.started_at.strftime("%Y-%m-%d %H:%M")}
        except ValueError:
            return {"ok": False, "error": "Formato de fecha inválido"}


    def toggle_utterance_highlight(self, utterance_id: int) -> dict:
        """Marca/desmarca una frase como importante (★). Devuelve el nuevo estado."""
        state = repo.toggle_utterance_highlight(self._session, int(utterance_id))
        if state is None:
            return {"ok": False, "error": "La frase ya no existe."}
        return {"ok": True, "id": int(utterance_id), "highlighted": bool(state)}


    def update_utterance(self, utterance_id: int, changes: dict) -> dict:
        """Edita una frase: texto y/o hablante. `changes` es un dict con
        opcionalmente `text` y/o `speaker` ("me"|"others")."""
        changes = changes or {}
        utt = repo.update_utterance(
            self._session, int(utterance_id),
            text=changes.get("text"), speaker=changes.get("speaker"),
        )
        if utt is None:
            return {"ok": False, "error": "La frase ya no existe."}
        return {"ok": True, "id": utt.id, "text": utt.text, "speaker": utt.speaker}

