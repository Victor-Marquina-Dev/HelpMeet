import os
import sys
import time
import wave
import subprocess
import webview
from pathlib import Path
from datetime import timedelta
from helpmeet.db.database import init_db, get_session
from helpmeet.db import repository as repo
from helpmeet.transcription.engine import TranscriptionEngine
from helpmeet.transcription.replicate_engine import ReplicateTranscriptionEngine
from helpmeet.session.recorder import MeetingRecorder
from helpmeet.export.exporter import export_meeting, export_initiative, meeting_export_dir
from helpmeet import config
from helpmeet import settings


def _wav_seconds(path) -> float:
    """Duración en segundos de un WAV (0 si falla)."""
    try:
        with wave.open(str(path), "rb") as wf:
            return wf.getnframes() / (wf.getframerate() or 1)
    except Exception:
        return 0.0


def _open_in_explorer(path: str) -> None:
    """Abre una carpeta/archivo en el explorador del sistema operativo."""
    p = str(path)
    try:
        if sys.platform.startswith("win"):
            os.startfile(p)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", p])
        else:
            subprocess.Popen(["xdg-open", p])
    except Exception:
        pass


def _reveal_in_explorer(path: str) -> None:
    """Abre la CARPETA que contiene el archivo, con el archivo seleccionado.

    En Windows `os.startfile` sobre un .mp4 lo reproduce; esto en cambio muestra
    la carpeta y resalta el archivo, para que el usuario lo encuentre.
    """
    p = str(path)
    try:
        if sys.platform.startswith("win"):
            subprocess.Popen(f'explorer /select,"{p}"')
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-R", p])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(p)])
    except Exception:
        pass


class Api:
    def __init__(self):
        init_db()
        settings.apply_env()  # vuelca el token guardado a la variable de entorno
        self._session = get_session()
        self._engine = None
        self._local_engine = None
        self._recorder = None
        self._screen_rec = None
        self._screen_active = False     # True mientras se graba pantalla
        self._screen_meeting_id = None  # reunión asociada a la grabación de pantalla
        self._window = None

    def set_window(self, window):
        self._window = window

    def list_initiatives(self):
        return [{"id": i.id, "name": i.name} for i in repo.list_initiatives(self._session)]

    def list_library(self, view):
        """Lista el archivo o la papelera en un formato listo para la UI."""
        rows = repo.list_archived(self._session) if view == "archive" else repo.list_trash(self._session)
        result = []
        for row in rows:
            item = row["item"]
            kind = row["kind"]
            stamp = item.archived_at if view == "archive" else item.deleted_at
            result.append({
                "kind": kind,
                "id": item.id,
                "title": item.name if kind == "initiative" else item.title,
                "initiative": "" if kind == "initiative" else item.initiative.name,
                "date": stamp.strftime("%d/%m/%Y %H:%M") if stamp else "",
                "meeting_count": len(item.meetings) if kind == "initiative" else 0,
            })
        return result

    def archive_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de archivar este elemento."}
        return {"ok": repo.archive_item(self._session, kind, int(item_id))}

    def trash_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de mover este elemento."}
        return {"ok": repo.trash_item(self._session, kind, int(item_id))}

    def restore_item(self, kind, item_id):
        return {"ok": repo.restore_item(self._session, kind, int(item_id))}

    def permanently_delete_item(self, kind, item_id):
        if self._item_in_use(kind, int(item_id)):
            return {"ok": False, "error": "Detén la grabación antes de eliminar este elemento."}
        return {"ok": repo.permanently_delete_item(self._session, kind, int(item_id))}

    def _item_in_use(self, kind, item_id):
        meeting_ids = set()
        if self._recorder and self._recorder.meeting:
            meeting_ids.add(self._recorder.meeting.id)
        if self._screen_meeting_id:
            meeting_ids.add(self._screen_meeting_id)
        if kind == "meeting":
            return item_id in meeting_ids
        if kind == "initiative":
            return any((repo.get_meeting(self._session, mid) and
                        repo.get_meeting(self._session, mid).initiative_id == item_id)
                       for mid in meeting_ids)
        return False

    def create_initiative(self, name):
        i = repo.create_initiative(self._session, name)
        return {"id": i.id, "name": i.name}

    def rename_initiative(self, initiative_id, name):
        repo.rename_initiative(self._session, int(initiative_id), name)
        return {"ok": True}

    def rename_meeting(self, meeting_id, title):
        repo.rename_meeting(self._session, int(meeting_id), title)
        return {"ok": True}

    def move_meeting(self, meeting_id, initiative_id):
        repo.move_meeting(self._session, int(meeting_id), int(initiative_id))
        return {"ok": True}

    def get_glossary(self, initiative_id):
        from helpmeet.glossary import build_glossary
        glos = build_glossary(self._session, int(initiative_id))
        return [{"term": t, "count": c} for t, c in glos]

    def list_meetings(self, initiative_id):
        meetings = repo.list_meetings(self._session, int(initiative_id))
        return [
            {"id": m.id, "title": m.title, "date": m.started_at.strftime("%d/%m/%Y %H:%M")}
            for m in meetings
        ]

    def search(self, query):
        out = []
        for r in repo.search(self._session, query):
            m = r["meeting"]
            out.append({
                "meeting_id": m.id,
                "meeting_title": m.title,
                "initiative": m.initiative.name,
                "date": m.started_at.strftime("%d/%m/%Y %H:%M"),
                "kind": r["kind"],
                "speaker": r["speaker"],
                "text": r["text"],
            })
        return out

    def get_transcript(self, meeting_id):
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"title": "", "started_at": "", "utterances": [], "video_path": None}
        video = m.audio_path if (m.audio_path and str(m.audio_path).lower().endswith(".mp4")
                                 and os.path.exists(m.audio_path)) else None
        return {
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "utterances": [
                {"speaker": u.speaker, "text": u.text}
                for u in sorted(m.utterances, key=lambda u: u.start_time)
            ],
            "video_path": video,
        }

    def export_meeting_by_id(self, meeting_id):
        out = export_meeting(self._session, int(meeting_id), settings.get_export_dir())
        return {"path": str(out)}

    def export_initiative_by_id(self, initiative_id):
        out = export_initiative(self._session, int(initiative_id), settings.get_export_dir())
        return {"path": str(out)}

    def open_path(self, path):
        """Abre en el Explorador la carpeta indicada (la de una exportación)."""
        if path:
            _open_in_explorer(path)
            return {"ok": True}
        return {"ok": False}

    def open_meeting_folder(self, meeting_id):
        """Abre en el Explorador la carpeta de una reunión.

        Si todavía no se había exportado, la exporta primero para que siempre
        haya algo que abrir.
        """
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"ok": False}
        exports = settings.get_export_dir()
        folder = meeting_export_dir(m, exports)
        if not folder.exists():
            export_meeting(self._session, m.id, exports)
        _open_in_explorer(folder)
        return {"ok": True, "path": str(folder)}

    def _get_engine(self):
        if self._engine is None:
            self._engine = (ReplicateTranscriptionEngine() if config.USE_REPLICATE
                            else TranscriptionEngine())
        return self._engine

    def _get_local_engine(self):
        """Motor LOCAL (faster-whisper) para videos subidos: gratis, sin límites."""
        if self._local_engine is None:
            self._local_engine = TranscriptionEngine()
        return self._local_engine

    def start_recording(self, initiative_id, title):
        self._get_engine()
        title = (title or "").strip() or "Reunión"
        live = not config.USE_REPLICATE
        self._recorder = MeetingRecorder(
            int(initiative_id), title, self._engine,
            live=live,
            chunk_seconds=config.CHUNK_SECONDS,
            on_utterance=self._push_utterance,
            on_status=self._push_status,
        )
        self._recorder.start()
        m = self._recorder.meeting
        return {
            "meeting_id": m.id,
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "live": live,
        }

    def _push_utterance(self, speaker, text, start, end):
        if self._window:
            safe = text.replace("\\", "\\\\").replace("'", "\\'")
            self._window.evaluate_js(f"addUtterance('{speaker}', '{safe}')")

    def _push_status(self, text):
        if self._window:
            safe = text.replace("\\", "\\\\").replace("'", "\\'")
            self._window.evaluate_js(f"setStatus('{safe}')")

    def _push_preview(self, b64):
        # base64 estándar no lleva comillas ni \, es seguro interpolarlo.
        if self._window:
            self._window.evaluate_js(f"setPreview('{b64}')")

    def list_monitors(self):
        from helpmeet.screenshot.capture import list_monitors
        return list_monitors()

    def take_capture(self, monitor_index=1):
        # Durante una grabación de pantalla, las capturas van a SU reunión.
        if self._screen_active and self._screen_meeting_id:
            from helpmeet.screenshot.capture import take_screenshot
            path = take_screenshot(config.CAPTURES_DIR, int(monitor_index))
            repo.add_capture(self._session, self._screen_meeting_id, path)
            return {"ok": True}
        if self._recorder:
            self._recorder.capture_screenshot(int(monitor_index))
            return {"ok": True}
        return {"ok": False}

    def add_note(self, text):
        text = (text or "").strip()
        if not text:
            return {"ok": False}
        if self._screen_active and self._screen_meeting_id:
            repo.add_note(self._session, self._screen_meeting_id, text)
            return {"ok": True}
        if self._recorder:
            self._recorder.add_note(text)
            return {"ok": True}
        return {"ok": False}

    # ---------- Grabación de pantalla (video) ----------
    def start_screen_recording(self, initiative_id, monitor_index=1):
        """Graba la pantalla a .mp4 (en la carpeta de la iniciativa) y crea una
        reunión para anclar capturas/notas y, opcionalmente al terminar, la
        transcripción."""
        from datetime import datetime
        from helpmeet.db.models import Initiative
        from helpmeet.video.recorder import ScreenVideoRecorder
        from helpmeet.screenshot.capture import monitor_geometry
        from helpmeet.export.exporter import initiative_export_dir

        if self._screen_rec is not None:
            return {"ok": False, "error": "Ya hay una grabación de pantalla en curso."}
        if self._recorder is not None:
            return {"ok": False,
                    "error": "Termina la grabación de reunión antes de grabar pantalla."}
        ini = self._session.get(Initiative, int(initiative_id))
        if ini is None:
            return {"ok": False, "error": "Selecciona una iniciativa primero."}

        mon = monitor_geometry(int(monitor_index))
        folder = initiative_export_dir(ini, settings.get_export_dir())
        dest = folder / f"{datetime.now():%Y-%m-%d_%H-%M-%S}_grabacion.mp4"
        meeting = repo.start_meeting(self._session, ini.id, "Grabación de pantalla")
        rec = ScreenVideoRecorder(dest, mon, on_status=self._push_status,
                                  on_preview=self._push_preview)
        try:
            rec.start()
        except Exception as exc:  # noqa: BLE001
            repo.end_meeting(self._session, meeting.id)
            return {"ok": False, "error": str(exc)}
        self._screen_rec = rec
        self._screen_active = True
        self._screen_meeting_id = meeting.id
        self._push_status("🎥 Grabando pantalla…")
        return {"ok": True, "meeting_id": meeting.id}

    def toggle_screen_mic_mute(self, muted):
        """Silencia/activa el micrófono durante la grabación de pantalla."""
        if self._screen_rec is not None:
            self._screen_rec.set_mic_muted(bool(muted))
            return {"ok": True, "muted": bool(muted)}
        return {"ok": False}

    def set_screen_monitor(self, monitor_index):
        """Cambia en caliente la pantalla que se está grabando (1 o 2)."""
        if self._screen_rec is not None and self._screen_active:
            from helpmeet.screenshot.capture import monitor_geometry
            self._screen_rec.set_monitor(monitor_geometry(int(monitor_index)))
            return {"ok": True}
        return {"ok": False}

    def stop_screen_recording(self):
        """Detiene la grabación, muxea el .mp4, lo guarda en la reunión y la
        finaliza. La transcripción es aparte (transcribe_meeting_video), así que
        puede pedirse ahora o más tarde al abrir la reunión."""
        rec = self._screen_rec
        if rec is None:
            return {"ok": False, "error": "No hay grabación de pantalla en curso."}
        self._screen_active = False
        meeting_id = self._screen_meeting_id
        result = rec.stop()
        rec.cleanup()                 # ya no hacen falta las pistas sueltas
        self._reset_screen_state()    # no queda nada pendiente
        if meeting_id:
            path = result.get("path")
            if result.get("ok") and path:
                m = repo.get_meeting(self._session, meeting_id)
                if m is not None:
                    m.audio_path = path   # ruta del video, para transcribir luego
                    self._session.commit()
            repo.end_meeting(self._session, meeting_id)  # duración = tiempo real
            result["folder"] = str(Path(path).parent) if path else None
            result["meeting_id"] = meeting_id
        return result

    def _finish_meeting_info(self, meeting_id):
        m = repo.get_meeting(self._session, meeting_id)
        if m is None:
            return {"meeting_id": meeting_id, "title": "", "started_at": "", "utterances": []}
        return {
            "meeting_id": meeting_id,
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "utterances": [{"speaker": u.speaker, "text": u.text}
                           for u in sorted(m.utterances, key=lambda u: u.start_time)],
        }

    def transcribe_meeting_video(self, meeting_id):
        """Transcribe en local el .mp4 de una reunión de grabación de pantalla.
        Funciona en cualquier momento: justo al grabar o al abrir la reunión."""
        from helpmeet.media import extract_audio_to_wav
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None or not m.audio_path or not os.path.exists(m.audio_path):
            return {"ok": False, "error": "No se encontró el video de esta reunión."}
        if m.utterances:  # ya estaba transcrita
            return {"ok": True, "already": True, **self._finish_meeting_info(m.id)}

        tmp_dir = config.DATA_DIR / "tmp_audio"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        wav = tmp_dir / "video_transcribe.wav"
        try:
            self._push_status("📝 Extrayendo el audio del video…")
            extract_audio_to_wav(m.audio_path, str(wav))
            engine = self._get_local_engine()

            def _progress(frac):
                self._push_status(f"📝 Transcribiendo… {int(frac * 100)}%")
                if self._window:
                    self._window.evaluate_js(f"setProgress({frac})")

            # no_speech_max=1.0: el VAD ya salta silencios (y el micro muteado).
            for seg in engine.transcribe_file(str(wav), on_progress=_progress,
                                              no_speech_max=1.0):
                if seg.text:
                    repo.add_utterance(self._session, m.id, "others",
                                       seg.text, seg.start, seg.end)
            self._link_screen_captures(m.id)
        except Exception as exc:  # noqa: BLE001 - se informa al usuario
            self._push_status("")
            return {"ok": False, "error": str(exc)}
        finally:
            try:
                if wav.exists():
                    wav.unlink()
            except Exception:
                pass
        self._push_status("")
        return {"ok": True, **self._finish_meeting_info(m.id)}

    def _link_screen_captures(self, meeting_id):
        """Ancla cada captura a la frase de su momento (por tiempo)."""
        m = repo.get_meeting(self._session, meeting_id)
        utts = sorted(m.utterances, key=lambda u: u.start_time)
        if not utts:
            return
        for cap in m.captures:
            if cap.near_utterance_id is not None:
                continue
            offset = (cap.taken_at - m.started_at).total_seconds()
            best = utts[0]
            for u in utts:
                if u.start_time <= offset:
                    best = u
                else:
                    break
            cap.near_utterance_id = best.id
        self._session.commit()

    def _reset_screen_state(self):
        self._screen_rec = None
        self._screen_active = False
        self._screen_meeting_id = None

    def reveal_path(self, path):
        """Abre el Explorador con el archivo seleccionado (no lo reproduce)."""
        if path:
            _reveal_in_explorer(path)
            return {"ok": True}
        return {"ok": False}

    def stop_recording(self):
        if not self._recorder:
            return {"ok": False, "duration": ""}
        self._recorder.stop()
        m = self._recorder.meeting
        if m.ended_at and m.started_at:
            total = int((m.ended_at - m.started_at).total_seconds())
            mm, ss = divmod(total, 60)
            duration = f"{mm} min {ss} s"
        else:
            duration = ""
        utterances = [
            {"speaker": u.speaker, "text": u.text}
            for u in sorted(m.utterances, key=lambda u: u.start_time)
        ]
        return {"ok": True, "duration": duration, "utterances": utterances}

    def export(self):
        if self._recorder and self._recorder.meeting:
            out = export_meeting(self._session, self._recorder.meeting.id,
                                 settings.get_export_dir())
            return {"path": str(out)}
        return {"path": None}

    # ---------- Ajustes ----------
    def get_settings(self):
        token = settings.get_api_token()
        return {
            "export_dir": str(settings.get_export_dir()),
            "has_token": bool(token),
            "token_hint": ("…" + token[-4:]) if token else "",
        }

    def set_api_token(self, token):
        settings.set_api_token(token)
        self._engine = None  # forzar recrear el motor con el token nuevo
        return {"ok": True}

    def _pick_folder(self):
        """Abre el diálogo nativo para elegir una carpeta. Devuelve la ruta o None."""
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None

    def _pick_file(self):
        """Abre el diálogo nativo para elegir un archivo de video/audio."""
        types = (
            "Video o audio (*.mp4;*.mkv;*.mov;*.avi;*.webm;*.mp3;*.m4a;*.wav;*.ogg)",
            "Todos los archivos (*.*)",
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=types
        )
        if result:
            return result[0] if isinstance(result, (list, tuple)) else result
        return None

    def import_media(self, initiative_id):
        """Pide un video/audio, le saca el audio, lo transcribe (LOCAL) y lo guarda.

        Los videos subidos se transcriben en el PC (faster-whisper): gratis, sin
        límite de tiempo ni de saldo, ideal para archivos grandes.
        """
        from helpmeet.media import extract_audio_to_wav
        src = self._pick_file()
        if not src:
            return {"ok": False}

        title = Path(src).stem or "Video importado"
        meeting = repo.start_meeting(self._session, int(initiative_id), title)
        tmp_dir = config.DATA_DIR / "tmp_audio"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        wav = tmp_dir / "import.wav"
        try:
            self._push_status("📹 Extrayendo el audio del video…")
            extract_audio_to_wav(src, str(wav))
            audio_seconds = _wav_seconds(wav)
            self._push_status("📹 Preparando el modelo (la 1ª vez se descarga)…")
            engine = self._get_local_engine()

            start = time.time()

            def _progress(frac):
                pct = int(frac * 100)
                eta = ""
                if frac > 0.02:
                    rem = (time.time() - start) / frac * (1 - frac)
                    if rem > 3:
                        eta = f" · ~{int(rem // 60)} min {int(rem % 60)} s restantes"
                self._push_status(f"📹 Transcribiendo… {pct}%{eta}")
                if self._window:
                    self._window.evaluate_js(f"setProgress({frac})")

            utterances = []
            # no_speech_max=1.0: en videos subidos NO descartamos por silencio
            # (el VAD ya salta los silencios); así no se pierde nada de voz.
            for seg in engine.transcribe_file(str(wav), on_progress=_progress,
                                              no_speech_max=1.0):
                if not seg.text:
                    continue
                repo.add_utterance(self._session, meeting.id, "others",
                                   seg.text, seg.start, seg.end)
                utterances.append({"speaker": "others", "text": seg.text})
        except Exception as exc:  # noqa: BLE001 - se informa al usuario
            repo.end_meeting(self._session, meeting.id)
            self._push_status("")
            return {"ok": False, "error": str(exc)}

        repo.end_meeting(self._session, meeting.id)
        # La duración debe ser la del video, no el rato que tardó en importar.
        if audio_seconds:
            meeting.ended_at = meeting.started_at + timedelta(seconds=int(audio_seconds))
            self._session.commit()
        self._push_status("")
        return {
            "ok": True,
            "meeting_id": meeting.id,
            "title": title,
            "started_at": meeting.started_at.strftime("%Y-%m-%d %H:%M"),
            "utterances": utterances,
        }

    def choose_export_dir(self):
        path = self._pick_folder()
        if path:
            settings.set_export_dir(path)
            return {"ok": True, "path": str(path)}
        return {"ok": False}

    def export_meeting_to(self, meeting_id):
        """Exporta UNA reunión a una carpeta elegida en el momento (no la de ajustes)."""
        folder = self._pick_folder()
        if not folder:
            return {"ok": False}
        out = export_meeting(self._session, int(meeting_id), folder)
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}

    def export_initiative_to(self, initiative_id):
        """Exporta la iniciativa completa a una carpeta elegida en el momento."""
        folder = self._pick_folder()
        if not folder:
            return {"ok": False}
        out = export_initiative(self._session, int(initiative_id), folder)
        _open_in_explorer(out)
        return {"ok": True, "path": str(out)}


def run():
    api = Api()
    web_dir = Path(__file__).parent / "web"
    window = webview.create_window(
        "Helpmeet", str(web_dir / "index.html"),
        js_api=api, width=1100, height=720,
    )
    api.set_window(window)
    webview.start()
