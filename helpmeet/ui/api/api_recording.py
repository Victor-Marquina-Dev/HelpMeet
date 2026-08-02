"""Métodos de grabación de audio, pantalla, transcripción y jobs."""

import os
import json
import queue
import logging
import threading
import tempfile
import shutil
import time
import traceback
from pathlib import Path
from datetime import datetime, timedelta

import webview

from helpmeet import config
from helpmeet import settings
from helpmeet.db import repository as repo
from helpmeet.db.database import get_session
from helpmeet.constants import MONTHS_ES
from helpmeet.utils import wav_seconds, human_size
from helpmeet.version import __version__
from helpmeet.session.recorder import MeetingRecorder
from helpmeet.export.exporter import (
    export_meeting, export_initiative, meeting_export_dir,
    build_meeting_context, build_transcript_txt, transcript_filename,
    export_transcript_package, transcript_package_filename,
    organize_meeting_folder, initiative_export_dir,
)


class RecordingApiMixin:
    """grabación de audio, pantalla, transcripción y jobs.."""
    def _auto_export(self, meeting_id: int) -> None:
        """Al terminar de transcribir, organiza SOLO la carpeta de esta reunión
        (transcripción.md + capturas/ + vídeo) en la carpeta de exportación. Es
        más rápido que regenerar toda la iniciativa. Corre en el hilo worker, con
        su propia sesión, y nunca interrumpe la transcripción si algo falla."""
        try:
            from helpmeet.db.database import get_session
            s = get_session()
            try:
                organize_meeting_folder(s, int(meeting_id), settings.get_export_dir())
            finally:
                s.close()
        except Exception:
            pass


    def _enqueue_import_job(self, meeting_id: int, title: str, initiative_id: int, src: str) -> None:
        """Encola la transcripción de un archivo importado en segundo plano."""
        on_status = lambda text, _mid=meeting_id: self._job_event(_mid, stage=text)
        on_progress = lambda frac, _mid=meeting_id: self._job_event(_mid, progress=frac)

        def run():
            session = get_session()  # sesión propia del worker (otro hilo)
            try:
                self._transcribe_import(session, meeting_id, src, on_status, on_progress)
            finally:
                session.close()
        self._enqueue_job(meeting_id, title, initiative_id, run)


    def _enqueue_job(self, meeting_id: int, title: str, initiative_id: int, run) -> None:
        """Encola un trabajo de transcripción (grabación o video) en segundo plano.

        `run` es un invocable que hace la transcripción usando SU propia sesión
        de BD (no la del hilo principal)."""
        self._ensure_worker()
        with self._jobs_lock:
            self._jobs_info[meeting_id] = {
                "meeting_id": meeting_id, "title": title,
                "initiative_id": initiative_id,
                "state": "queued", "progress": 0.0, "stage": "En cola",
            }
        self._push_jobs()
        self._jobs.put((meeting_id, run))


    def _enqueue_video_job(self, meeting_id: int, title: str, initiative_id: int, force: bool, clip_segments=None) -> None:
        """Encola la transcripción del .mp4 de una reunión en segundo plano."""
        on_status = lambda text, _mid=meeting_id: self._job_event(_mid, stage=text)
        on_progress = lambda frac, _mid=meeting_id: self._job_event(_mid, progress=frac)

        def run():
            s = get_session()   # sesión propia del worker (otro hilo)
            try:
                self._transcribe_video(s, meeting_id, force, on_status, on_progress,
                                       clip_segments=clip_segments)
            finally:
                s.close()
        self._enqueue_job(meeting_id, title, initiative_id, run)


    def _ensure_worker(self) -> None:
        if not hasattr(self, "_cancel_jobs"):
            self._cancel_jobs = set()
        if self._jobs is None:
            self._jobs = queue.Queue()
            self._worker = threading.Thread(target=self._job_worker, daemon=True)
            self._worker.start()


    def _finish_job(self, mid: int) -> None:
        with self._jobs_lock:
            info = dict(self._jobs_info.get(mid, {}))
        ok = info.get("state") == "done"
        ini_id = info.get("initiative_id")
        if self._window:
            self._window.evaluate_js(
                f"window.onJobFinished && window.onJobFinished("
                f"{json.dumps(mid)}, {json.dumps(ini_id)}, {json.dumps(bool(ok))})"
            )

        def _drop():
            time.sleep(4)  # deja ver "Listo"/"Error" un momento
            with self._jobs_lock:
                self._jobs_info.pop(mid, None)
            self._push_jobs()
        threading.Thread(target=_drop, daemon=True).start()


    def _finish_meeting_info(self, meeting_id: int) -> dict:
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


    def _get_engine(self):
        model = settings.get_transcription_model()
        if (self._engine is None or self._engine_provider != "local"
                or self._engine_model != model):
            from helpmeet.transcription.engine import TranscriptionEngine
            self._engine = TranscriptionEngine(model)
            self._engine_provider = "local"
            self._engine_model = model
        return self._engine


    def _get_local_engine(self):
        model = settings.get_transcription_model()
        requested = getattr(self._local_engine, "requested_model_name", None)
        if self._local_engine is None or requested != model:
            from helpmeet.transcription.engine import TranscriptionEngine
            self._local_engine = TranscriptionEngine(model)
        return self._local_engine


    def _is_job_cancelled(self, meeting_id) -> bool:
        return int(meeting_id) in getattr(self, "_cancel_jobs", set())


    def _job_event(self, mid: int, **changes) -> None:
        with self._jobs_lock:
            info = self._jobs_info.get(mid)
            if info is None:
                return
            for key, value in changes.items():
                if value is not None:
                    info[key] = float(value) if key == "progress" else value
        self._push_jobs()


    def _job_worker(self) -> None:
        while True:
            meeting_id, run = self._jobs.get()
            cancelled = False
            try:
                if self._is_job_cancelled(meeting_id):
                    cancelled = True
                else:
                    self._job_event(meeting_id, state="running", stage="Transcribiendo…")
                    run()
                    if self._is_job_cancelled(meeting_id):
                        cancelled = True
                    else:
                        self._job_event(meeting_id, stage="Organizando exportación…")
                        self._auto_export(meeting_id)
                        self._job_event(meeting_id, state="done", progress=1.0, stage="Listo")
            except _JobCancelled:
                cancelled = True
            except Exception as exc:  # noqa: BLE001 - se informa al usuario
                _log.error("Job %s falló:\n%s", meeting_id, traceback.format_exc())
                self._job_event(meeting_id, state="error",
                                stage=f"Error [{type(exc).__name__}]: {exc}")
            finally:
                getattr(self, "_cancel_jobs", set()).discard(meeting_id)
                if cancelled:
                    self._job_event(meeting_id, state="done", progress=1.0, stage="Cancelado")
                self._jobs.task_done()
                self._finish_job(meeting_id)


    def _link_screen_captures(self, meeting_id: int, session=None) -> None:
        """Ancla cada captura a la frase de su momento (por tiempo)."""
        session = session or self._session
        m = repo.get_meeting(session, meeting_id)
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
        session.commit()


    def _notify_screen_saved(self, meeting_id: int, initiative_id: int, ok: bool, audio: bool) -> None:
        if self._window:
            self._window.evaluate_js(
                "window.onScreenVideoSaved && window.onScreenVideoSaved("
                f"{json.dumps(meeting_id)}, {json.dumps(initiative_id)}, "
                f"{json.dumps(bool(ok))}, {json.dumps(bool(audio))})"
            )


    def _pick_files(self) -> list[str]:
        """Abre el diálogo nativo para elegir MÚLTIPLES archivos de video/audio."""
        types = (
            "Video o audio (*.mp4;*.mkv;*.mov;*.avi;*.webm;*.mp3;*.m4a;*.wav;*.ogg)",
            "Todos los archivos (*.*)",
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=True, file_types=types
        )
        return list(result) if result else []


    def _push_jobs(self) -> None:
        if not self._window:
            return
        with self._jobs_lock:
            jobs = list(self._jobs_info.values())
        try:
            self._window.evaluate_js(
                f"window.onBackgroundJobs && window.onBackgroundJobs({json.dumps(jobs)})"
            )
        except Exception:
            pass


    def _push_preview(self, b64: str) -> None:
        # base64 estándar no lleva comillas ni \, es seguro interpolarlo.
        if self._window:
            self._window.evaluate_js(f"setPreview('{b64}')")


    def _push_progress(self, fraction: float) -> None:
        if self._window:
            self._window.evaluate_js(f"setProgress({max(0.0, min(1.0, float(fraction)))})")


    def _push_status(self, text: str) -> None:
        if self._window:
            self._window.evaluate_js(f"setStatus({json.dumps(text)})")


    def _push_utterance(self, utterance_id, speaker: str, text: str, start: float, end: float) -> None:
        if self._window:
            self._window.evaluate_js(
                f"addUtterance({json.dumps(utterance_id)}, {json.dumps(speaker)}, "
                f"{json.dumps(text)}, {float(start)}, {float(end)})"
            )


    def _push_partial(self, speaker: str, text: str) -> None:
        """Texto en vivo de Vosk que todavía puede cambiar (no está guardado
        en la base). `text` vacío apaga el indicador en pantalla."""
        if self._window:
            self._window.evaluate_js(
                f"window.setLivePartial && window.setLivePartial("
                f"{json.dumps(speaker)}, {json.dumps(text)})"
            )


    def _queue_transcription(self, recorder) -> None:
        """Encola una grabacion ya detenida para transcribirla por detras."""
        m = recorder.meeting
        mid = m.id
        recorder.on_utterance = None
        recorder.on_status = lambda text, _mid=mid: self._job_event(_mid, stage=text)
        recorder.on_progress = lambda frac, _mid=mid: self._job_event(_mid, progress=frac)
        self._enqueue_job(mid, m.title, m.initiative_id, recorder.transcribe)


    def _reset_screen_state(self) -> None:
        self._screen_rec = None
        self._screen_active = False
        self._screen_meeting_id = None


    def _save_screen_video_bg(self, rec, meeting_id: int, initiative_id: int, audio_channels: list) -> None:
        """Muxea el video y lo asocia a la reunion sin bloquear la interfaz.
        Usa su propia sesion de BD (corre en un hilo aparte)."""
        ok = False
        audio = True
        try:
            result = rec.stop()
            path = result.get("path")
            ok = bool(result.get("ok") and path)
            audio = result.get("audio", True)
            if ok:
                video_path = Path(path)
                from helpmeet.media_storage import store_track
                for label, source in audio_channels:
                    store_track(meeting_id, label, source)
            try:
                rec.cleanup()
            except Exception:
                pass
            fallback_title = None
            if meeting_id:
                from helpmeet.db.database import get_session
                session = get_session()
                try:
                    meeting = repo.get_meeting(session, meeting_id)
                    if meeting is not None and ok:
                        meeting.audio_path = path
                        session.commit()
                        organize_meeting_folder(
                            session, meeting_id, settings.get_export_dir()
                        )
                        # Red de seguridad: si la transcripción progresiva no
                        # produjo ninguna frase (falló por completo durante la
                        # grabación), se encola la transcripción del archivo
                        # completo — nunca debe quedar un video sin transcribir.
                        if audio and not getattr(rec, "transcript_produced", False):
                            fallback_title = meeting.title
                    repo.end_meeting(session, meeting_id)
                finally:
                    session.close()
            if fallback_title is not None:
                self._enqueue_video_job(meeting_id, fallback_title, initiative_id, False)
        except Exception:
            ok = False
        finally:
            self._screen_saving = False
            self._notify_screen_saved(meeting_id, initiative_id, ok, audio)


    def _transcribe_import(self, session, meeting_id: int, src: str, on_status, on_progress):
        """Extrae el audio del archivo importado y lo transcribe (en el worker)."""
        from helpmeet.media import extract_audio_to_wav
        meeting = repo.get_meeting(session, int(meeting_id))
        if meeting is None:
            return
        tmp_dir = config.DATA_DIR / "tmp_audio"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp = tempfile.NamedTemporaryFile(dir=tmp_dir, suffix=".wav", delete=False)
        wav = Path(tmp.name)
        tmp.close()
        try:
            if not os.path.exists(src):
                raise ValueError("El archivo seleccionado ya no está disponible.")
            # Guardar ruta del archivo original para que aparezca el panel de video
            meeting.audio_path = src
            session.commit()
            on_status("Extrayendo el audio del archivo…")
            extract_audio_to_wav(src, str(wav))
            if self._is_job_cancelled(meeting_id):
                raise _JobCancelled()
            audio_seconds = wav_seconds(wav)
            on_status("Preparando el modelo (la 1ª vez se descarga)…")
            try:
                engine = self._get_local_engine()
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError(_friendly_model_error(exc)) from exc

            on_status("Transcribiendo…")
            rows = []
            for seg in engine.transcribe_file(str(wav), on_progress=on_progress,
                                              no_speech_max=0.95, quality="accurate"):
                if self._is_job_cancelled(meeting_id):
                    raise _JobCancelled()
                if seg.text:
                    rows.append({"speaker": "others", "text": seg.text,
                                 "start_time": seg.start, "end_time": seg.end})
            if self._is_job_cancelled(meeting_id):
                raise _JobCancelled()
            if not rows:
                raise ValueError(
                    "No se detecto voz en el archivo. Comprueba que tenga audio audible."
                )
            current_lang = settings.get_transcription_language() or ""
            repo.add_utterances(session, meeting.id, [
                {**row, "language": current_lang} for row in rows
            ])
            repo.end_meeting(session, meeting.id)
            # La duración debe ser la del archivo, no lo que tardó en transcribir.
            if audio_seconds:
                meeting.ended_at = meeting.started_at + timedelta(seconds=int(audio_seconds))
                session.commit()
                # Registrar horas de video consumidas para el plan actual
                try:
                    settings.add_video_hours(int(audio_seconds))
                    self.report_video_usage(int(audio_seconds))
                except Exception:
                    pass
        except Exception:
            _log.error("_transcribe_import falló (src=%s):\n%s", src, traceback.format_exc())
            # Reunión vacía: se borra para no dejar una reunión sin contenido.
            try:
                session.delete(meeting)
                session.commit()
            except Exception:
                pass
            raise  # el worker marca el trabajo como error y muestra el mensaje
        finally:
            try:
                wav.unlink(missing_ok=True)
            except Exception:
                pass


    def _transcribe_video(self, session, meeting_id: int, force: bool = False,
                          on_status=None, on_progress=None, clip_segments=None) -> dict:
        """Transcribe el .mp4 de una reunión usando `session` (la del worker).

        Las grabaciones nuevas usan las pistas aisladas de micrófono/sistema.
        Para videos antiguos (solo mezcla MP4), se prioriza Replicate cuando hay
        token porque ofrece mejor precisión con una única petición."""
        from helpmeet.media import extract_audio_to_wav
        on_status = on_status or (lambda *_: None)
        on_progress = on_progress or (lambda *_: None)
        m = repo.get_meeting(session, int(meeting_id))
        if m is None or not m.audio_path or not os.path.exists(m.audio_path):
            return {"ok": False, "error": "No se encontró el video de esta reunión."}

        tmp_dir = config.DATA_DIR / "tmp_audio"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp = tempfile.NamedTemporaryFile(dir=tmp_dir, suffix=".wav", delete=False)
        wav = Path(tmp.name)
        tmp.close()
        # Recorte opcional: si el usuario marcó tramos, se transcribe solo eso.
        clip_norm = None
        if clip_segments:
            from helpmeet.media_segments import normalize_segments, map_local_to_global
            from helpmeet.media import extract_audio_segments_to_wav, media_duration
            from helpmeet.transcription.segment import TranscribedSegment
            duration = media_duration(m.audio_path)
            if duration <= 0:
                raise ValueError("No se pudo determinar la duración del vídeo.")
            clip_norm = normalize_segments(
                [(seg["start"], seg["end"]) for seg in clip_segments], duration)
            if not clip_norm:
                # El worker ignora el valor de retorno: los errores se informan al
                # usuario por excepción (los captura _job_worker y muestra el mensaje).
                raise ValueError("La selección de recorte no es válida.")

        from helpmeet.media_storage import available_tracks
        new_segments = []
        try:
            if clip_norm:
                on_status("Recortando el audio seleccionado…")
                extract_audio_segments_to_wav(m.audio_path, clip_norm, str(wav))
                tracks = [("others", wav)]
                on_status("Cargando el modelo de transcripción…")
            else:
                tracks = available_tracks(m.id, m.audio_path)
                if tracks:
                    on_status("Cargando el modelo de transcripción…")
                else:
                    on_status("Extrayendo el audio del video…")
                    extract_audio_to_wav(m.audio_path, str(wav))
                    tracks = [("others", wav)]
                    on_status("Cargando el modelo de transcripción…")
            try:
                engine = self._get_local_engine()
            except Exception as exc:
                raise RuntimeError(_friendly_model_error(exc)) from exc

            from helpmeet.transcription.progress import WeightedProgress
            weighted = WeightedProgress([path for _, path in tracks])
            for index, (speaker, audio_path) in enumerate(tracks):
                if self._is_job_cancelled(meeting_id):
                    raise _JobCancelled()
                on_status(f"Transcribiendo pista {index + 1} de {len(tracks)}…")
                if getattr(engine, "supports_progress", False):
                    def _progress(frac, track=index):
                        on_progress(weighted.at(track, frac))
                    segments = engine.transcribe_file(
                        str(audio_path), on_progress=_progress,
                        no_speech_max=1.0,   # no filtrar por prob. de silencio (videos con música)
                        quality="accurate"
                    )
                else:
                    segments = engine.transcribe_file(str(audio_path))
                for seg in segments:
                    if self._is_job_cancelled(meeting_id):
                        raise _JobCancelled()
                    if not seg.text:
                        continue
                    if clip_norm:
                        seg = TranscribedSegment(
                            seg.text,
                            map_local_to_global(seg.start, clip_norm),
                            map_local_to_global(seg.end, clip_norm),
                        )
                    new_segments.append((speaker, seg))

            if not new_segments:
                raise ValueError("No se detectó voz clara en el video.")

            if force:
                # Multi-idioma: solo borrar utterances del mismo idioma.
                # Asi el usuario puede tener transcripciones en varios idiomas.
                current_lang = settings.get_transcription_language() or ""
                for utterance in list(m.utterances):
                    if not current_lang or (getattr(utterance, 'language', '') or '') == current_lang:
                        session.delete(utterance)
                session.commit()
            # P-02: una sola transaccion para todas las frases del video.
            current_lang = settings.get_transcription_language() or ""
            repo.add_utterances(session, m.id, [
                {"speaker": speaker, "text": seg.text,
                 "start_time": seg.start, "end_time": seg.end,
                 "language": current_lang}
                for speaker, seg in new_segments
            ])
            self._link_screen_captures(m.id, session)
            # Registrar horas de video consumidas para el plan actual
            try:
                from helpmeet.media import media_duration
                video_seconds = media_duration(m.audio_path)
                if video_seconds > 0:
                    settings.add_video_hours(video_seconds)
                    self.report_video_usage(int(video_seconds))
            except Exception:
                pass
        finally:
            try:
                if wav.exists():
                    wav.unlink()
            except Exception:
                pass
        return {"ok": True, "meeting_id": m.id}


    def add_note(self, text: str) -> dict:
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


    def cancel_meeting_job(self, meeting_id: int) -> dict:
        """Solicita la cancelacion de la transcripcion de una reunion."""
        mid = int(meeting_id)
        if not hasattr(self, "_cancel_jobs"):
            self._cancel_jobs = set()
        self._cancel_jobs.add(mid)
        self._job_event(mid, stage="Cancelando...")
        return {"ok": True}


    def discard_recoverable_recording(self, work_dir_id: str) -> dict:
        """Descarta una grabación interrumpida: elimina los temporales y cierra la reunión en BD."""
        work_dir = Path(work_dir_id)
        info_file = work_dir / "_recovery_info.json"
        meeting_id = None
        if info_file.exists():
            try:
                info = json.loads(info_file.read_text(encoding="utf-8"))
                meeting_id = info.get("meeting_id")
            except Exception:
                pass
        if meeting_id:
            try:
                repo.end_meeting(self._session, meeting_id)
            except Exception:
                pass
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass
        return {"ok": True}


    def export(self) -> dict:
        meeting_id = (self._recorder.meeting.id if self._recorder and self._recorder.meeting
                      else self._last_meeting_id)
        if meeting_id:
            out = export_meeting(self._session, meeting_id, settings.get_export_dir())
            return {"path": str(out)}
        return {"path": None}

    # ─── Licencias → api_licenses.py ───


    def get_background_jobs(self) -> list[dict]:
        """Estado actual de las transcripciones en segundo plano (para la UI)."""
        with self._jobs_lock:
            return list(self._jobs_info.values())


    def get_monitor_thumbnails(self) -> list[dict]:
        """Devuelve una captura miniatura de cada monitor para el selector visual."""
        import base64
        import numpy as np
        import mss
        from helpmeet.video.preview import _encode_jpeg
        import av

        THUMB_H = 80
        monitors = self.list_monitors()
        result = []
        try:
            with mss.mss() as sct:
                for mon in monitors:
                    region = {
                        "left": mon["left"], "top": mon["top"],
                        "width": mon["width"], "height": mon["height"],
                    }
                    try:
                        img = sct.grab(region)
                        sw, sh = img.width, img.height
                        th = THUMB_H
                        tw = max(2, int(sw * THUMB_H / sh))
                        tw -= tw % 2
                        arr = np.frombuffer(img.rgb, dtype=np.uint8).reshape(sh, sw, 3)
                        frame = av.VideoFrame.from_ndarray(arr, format="rgb24")
                        scaled = frame.reformat(width=tw, height=th, format="yuvj420p",
                                                interpolation="LANCZOS")
                        jpeg = _encode_jpeg(scaled, tw, th)
                        b64 = base64.b64encode(jpeg).decode() if jpeg else ""
                    except Exception:
                        b64 = ""
                    result.append({**mon, "thumbnail": b64})
        except Exception:
            result = [{**m, "thumbnail": ""} for m in monitors]
        return result


    def get_video_thumbnails(self, meeting_id: int, count: int = 12) -> list[dict]:
        """Devuelve `count` miniaturas equiespaciadas del vídeo como JPEG base64.

        Cada elemento: {"t": segundos, "thumb": base64_o_vacío}. Se usa para
        dibujar la línea de tiempo del recortador."""
        import base64
        import av
        from helpmeet.media import media_duration
        from helpmeet.video.preview import _encode_jpeg
        m = repo.get_meeting(self._session, int(meeting_id))
        if not m or not m.audio_path or not os.path.exists(m.audio_path):
            return []
        path = m.audio_path
        duration = media_duration(path)
        if duration <= 0:
            return []
        count = max(1, min(int(count), 40))
        THUMB_H = 60
        result = []
        try:
            container = av.open(path)
        except Exception:
            return []
        try:
            if not container.streams.video:
                return []
            stream = container.streams.video[0]
            for i in range(count):
                t = duration * (i + 0.5) / count
                try:
                    if stream.time_base:
                        seek_pts = int(t / float(stream.time_base))
                    else:
                        seek_pts = int(t * 1_000_000)
                    container.seek(seek_pts, stream=stream, backward=True, any_frame=False)
                    frame = next(container.decode(video=0))
                    sw, sh = frame.width, frame.height
                    tw = max(2, int(sw * THUMB_H / sh))
                    tw -= tw % 2
                    scaled = frame.reformat(width=tw, height=THUMB_H,
                                            format="yuvj420p", interpolation="LANCZOS")
                    jpeg = _encode_jpeg(scaled, tw, THUMB_H)
                    b64 = base64.b64encode(jpeg).decode() if jpeg else ""
                except Exception:
                    b64 = ""
                result.append({"t": round(t, 2), "thumb": b64})
            return result
        finally:
            container.close()


    def import_media(self, initiative_id: int) -> dict:
        """Pide un vídeo/audio, lo mueve a la carpeta de la iniciativa y lo transcribe."""
        src = self._pick_file()
        if not src:
            return {"ok": False, "cancelled": True}
        src = self._move_to_initiative_folder(src, int(initiative_id))
        filename = Path(src).name
        title = Path(src).stem or "Vídeo importado"
        meeting = repo.start_meeting(self._session, int(initiative_id), title)
        self._enqueue_import_job(meeting.id, title, int(initiative_id), src)
        return {"ok": True, "queued": True, "meeting_id": meeting.id,
                "filename": filename}


    def import_media_multiple(self, initiative_id: int) -> dict:
        """Abre selector múltiple, mueve los archivos a la carpeta de la iniciativa y encola."""
        files = self._pick_files()
        if not files:
            return {"ok": False, "cancelled": True, "count": 0}
        imported = []
        for src in files:
            src = self._move_to_initiative_folder(src, int(initiative_id))
            filename = Path(src).name
            title = Path(src).stem or "Vídeo importado"
            meeting = repo.start_meeting(self._session, int(initiative_id), title)
            self._enqueue_import_job(meeting.id, title, int(initiative_id), src)
            imported.append({"filename": filename, "meeting_id": meeting.id})
        _log.info("Importando %d archivo(s) a iniciativa %s", len(imported), initiative_id)
        return {"ok": True, "count": len(imported), "files": imported}


    def import_video_for_meeting(self, meeting_id: int) -> dict:
        """Asocia un video externo a una reunión existente y encola su transcripción.

        Útil cuando la reunión ya tiene capturas con timestamps y el video se grabó
        por separado (p.ej. con OBS). La transcripción quedará alineada con las capturas."""
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None:
            return {"ok": False, "error": "La reunión no existe."}
        src = self._pick_file()
        if not src:
            return {"ok": False, "cancelled": True}
        force = bool(m.utterances)  # si ya tenía frases, forzar retranscripción
        m.audio_path = src
        self._session.commit()
        self._enqueue_video_job(m.id, m.title, m.initiative_id, force)
        return {"ok": True, "queued": True, "meeting_id": m.id,
                "filename": Path(src).name}


    def list_monitors(self) -> list[dict]:
        from helpmeet.screenshot.capture import list_monitors
        return list_monitors()


    def list_recoverable_recordings(self) -> list[dict]:
        """Busca carpetas temporales con video_temp.mp4 de sesiones anteriores
        que se cerraron antes de guardar. Excluye la grabación activa si la hay."""
        from helpmeet.video.recorder import TEMP_VIDEO, MIC_WAV, SYS_WAV
        tmp_root = config.DATA_DIR / "tmp_video"
        if not tmp_root.exists():
            return []
        active_dir = (str(self._screen_rec._tmp_dir)
                      if self._screen_rec is not None else None)
        result = []
        for subdir in sorted(tmp_root.iterdir()):
            if not subdir.is_dir():
                continue
            if active_dir and str(subdir) == active_dir:
                continue
            video_temp = subdir / TEMP_VIDEO
            if not video_temp.exists() or video_temp.stat().st_size == 0:
                continue
            info = {}
            info_file = subdir / "_recovery_info.json"
            if info_file.exists():
                try:
                    info = json.loads(info_file.read_text(encoding="utf-8"))
                except Exception:
                    pass
            started_at = info.get("started_at", "")
            date_str = ""
            if started_at:
                try:
                    from datetime import datetime as _dt
                    dt = _dt.fromisoformat(started_at)
                    date_str = f"{dt.day} de {MONTHS_ES[dt.month-1]} {dt.year} · {_fmt_12h(dt)}"
                except Exception:
                    date_str = started_at
            tracks = []
            if (subdir / MIC_WAV).exists() and (subdir / MIC_WAV).stat().st_size > 1000:
                tracks.append("mic")
            if (subdir / SYS_WAV).exists() and (subdir / SYS_WAV).stat().st_size > 1000:
                tracks.append("system")
            result.append({
                "id": str(subdir),
                "title": info.get("title", "Reunión sin título"),
                "date": date_str,
                "tracks": tracks,
                "meeting_id": info.get("meeting_id"),
                "initiative_id": info.get("initiative_id"),
                "dest_path": info.get("dest_path"),
            })
        return result


    def recover_recording(self, work_dir_id: str) -> dict:
        """Recupera el video de una grabación interrumpida y encola la transcripción."""
        from helpmeet.video.recorder import ScreenVideoRecorder
        work_dir = Path(work_dir_id)
        info = {}
        info_file = work_dir / "_recovery_info.json"
        if info_file.exists():
            try:
                info = json.loads(info_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        meeting_id = info.get("meeting_id")
        initiative_id = info.get("initiative_id")
        dest_path = info.get("dest_path")

        if not dest_path:
            from datetime import datetime as _dt
            now = _dt.now()
            recover_dir = Path(settings.get_export_dir()) / "Recuperados"
            recover_dir.mkdir(parents=True, exist_ok=True)
            dest_path = str(recover_dir / f"Grabacion_{now:%Y%m%d_%H%M%S}.mp4")

        dummy_monitor = {"left": 0, "top": 0, "width": 1920, "height": 1080}
        rec = ScreenVideoRecorder(dest_path, dummy_monitor, work_dir=str(work_dir))
        audio_channels = list(rec.audio_channels())

        result = rec.recover()
        if not result.get("ok"):
            return {"ok": False, "error": result.get("error", "No se pudo recuperar la grabación.")}

        path = result.get("path")

        if meeting_id:
            try:
                from helpmeet.db.database import get_session as _get_session
                from helpmeet.media_storage import store_track
                session = _get_session()
                try:
                    meeting = repo.get_meeting(session, meeting_id)
                    if meeting is not None and path:
                        meeting.audio_path = path
                        session.commit()
                        try:
                            organize_meeting_folder(session, meeting_id, settings.get_export_dir())
                        except Exception:
                            pass
                    repo.end_meeting(session, meeting_id)
                    for label, source in audio_channels:
                        if source.exists() and source.stat().st_size > 0:
                            store_track(meeting_id, label, source)
                finally:
                    session.close()
                m_ref = repo.get_meeting(self._session, meeting_id)
                title = m_ref.title if m_ref else "Grabación recuperada"
                if path:
                    self._enqueue_video_job(meeting_id, title, initiative_id, False)
            except Exception:
                _log.error("recover_recording BD:\n%s", traceback.format_exc())

        try:
            rec.cleanup()
        except Exception:
            pass

        return {"ok": True, "meeting_id": meeting_id, "initiative_id": initiative_id}


    def reveal_path(self, path: str) -> dict:
        """Abre el Explorador con el archivo seleccionado (no lo reproduce)."""
        if path:
            _reveal_in_explorer(path)
            return {"ok": True}
        return {"ok": False}


    def set_screen_monitor(self, monitor_index: int) -> dict:
        """Cambia en caliente la pantalla que se está grabando (1 o 2)."""
        if self._screen_rec is not None and self._screen_active:
            from helpmeet.screenshot.capture import monitor_geometry
            self._screen_rec.set_monitor(monitor_geometry(int(monitor_index)))
            return {"ok": True}
        return {"ok": False}


    def set_screen_preview_monitor(self, monitor_index: int) -> dict:
        """Cambia el monitor de la vista previa de espera."""
        from helpmeet.screenshot.capture import monitor_geometry
        safe_index = max(1, int(monitor_index))
        if self._screen_preview is not None:
            mon = monitor_geometry(safe_index)
            mon["index"] = safe_index
            self._screen_preview.set_monitor(mon)
        return {"ok": True}


    def set_screen_scale_mode(self, mode: str) -> dict:
        """Ajusta la pantalla al lienzo: fit, fill o stretch."""
        if self._screen_rec is not None and self._screen_active:
            self._screen_rec.set_scale_mode(str(mode))
            return {"ok": True, "mode": str(mode)}
        return {"ok": False}


    def set_screen_transform(self, x: float, y: float, w: float, h: float) -> dict:
        """Coloca la pantalla LIBRE en el lienzo (estilo OBS). Se guarda y, si ya se
        está grabando, se aplica al instante."""
        self._screen_transform = (float(x), float(y), float(w), float(h))
        if self._screen_rec is not None:
            self._screen_rec.set_transform(*self._screen_transform)
        return {"ok": True}


    def start_recording(self, initiative_id: int, title: str) -> dict:
        if not initiative_id:
            return {"ok": False, "error": "Selecciona una iniciativa antes de grabar."}
        if self._recorder is not None:
            return {"ok": False, "error": "Ya hay una grabación de reunión en curso."}
        if self._screen_rec is not None:
            return {"ok": False, "error": "Detén la grabación de pantalla antes de grabar una reunión."}
        # P-01: se pasa la factory `_get_engine` (no una instancia ya cargada),
        # así el botón Grabar no espera al motor — el modelo Vosk se carga en
        # segundo plano en cuanto arranca la transcripción en vivo.
        title = (title or "").strip() or "Reunión"
        prefs = settings.get_transcription_settings()
        provider = prefs["provider"]
        if provider == "auto":
            provider = "local"
        # Ambos proveedores graban de forma continua (sin huecos de audio) y se
        # van transcribiendo EN VIVO con Vosk mientras grabas (ver
        # VoskLiveTranscriber); al detener solo falta cerrar la última frase.
        live = False
        mic_muted = prefs["default_mic_muted"]
        self._recorder = MeetingRecorder(
            int(initiative_id), title, self._get_engine,  # factory: carga perezosa
            live=live,
            chunk_seconds=config.CHUNK_SECONDS,
            on_utterance=self._push_utterance,
            on_status=self._push_status,
            mic_muted=mic_muted,
            on_progress=self._push_progress,
            on_partial=self._push_partial,
        )
        self._recorder.start()
        m = self._recorder.meeting
        self._last_meeting_id = m.id
        return {
            "ok": True,
            "meeting_id": m.id,
            "title": m.title,
            "started_at": m.started_at.strftime("%Y-%m-%d %H:%M"),
            "live": live,
            "provider": provider,
            "mic_muted": mic_muted,
        }


    def start_screen_preview(self, monitor_index: int = 1) -> dict:
        """Abre la vista previa EN ESPERA: muestra la pantalla en vivo sin grabar,
        para que el usuario la acomode y pulse "Iniciar grabación" cuando quiera."""
        from helpmeet.screenshot.capture import monitor_geometry
        from helpmeet.video.preview import ScreenPreview
        if self._screen_rec is not None:
            return {"ok": True, "recording": True, "meeting_id": self._screen_meeting_id}
        # mss.monitors[0] es la pantalla virtual combinada; usar al menos 1
        safe_index = max(1, int(monitor_index))
        if self._screen_preview is None:
            mon = monitor_geometry(safe_index)
            mon["index"] = safe_index
            self._screen_preview = ScreenPreview(mon, self._push_preview)
            self._screen_preview.start()
        return {"ok": True}


    def start_screen_recording(self, initiative_id: int, monitor_index: int = 1) -> dict:
        """Graba la pantalla a .mp4 (en la carpeta de la iniciativa) y crea una
        reunión para anclar capturas/notas y, opcionalmente al terminar, la
        transcripción."""
        from datetime import datetime
        from helpmeet.db.models import Initiative
        from helpmeet.video.recorder import ScreenVideoRecorder
        from helpmeet.screenshot.capture import monitor_geometry

        if self._screen_rec is not None:
            return {"ok": False, "error": "Ya hay una grabación de pantalla en curso."}
        # Ya NO se bloquea por un guardado anterior: cada grabación usa su propia
        # carpeta temporal, así que la nueva puede empezar mientras la anterior se
        # mezcla en segundo plano.
        if self._recorder is not None:
            return {"ok": False,
                    "error": "Termina la grabación de reunión antes de grabar pantalla."}
        ini = self._session.get(Initiative, int(initiative_id))
        if ini is None:
            return {"ok": False, "error": "Selecciona una iniciativa primero."}

        mon = monitor_geometry(int(monitor_index))
        now = datetime.now()
        short_date = f"{now.day:02d}/{now.month:02d}/{str(now.year)[-2:]}"
        safe_stamp = f"{now.day:02d}-{now.month:02d}-{str(now.year)[-2:]} {now.hour:02d}-{now.minute:02d}-{now.second:02d}"
        meeting = repo.start_meeting(self._session, ini.id, short_date)
        folder = meeting_export_dir(meeting, settings.get_export_dir())
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / f"{safe_stamp}.mp4"
        # Carpeta temporal propia de ESTA grabación: evita choques con un vídeo
        # anterior que aún se esté guardando en segundo plano.
        work_dir = config.DATA_DIR / "tmp_video" / f"{now:%Y%m%d_%H%M%S_%f}"
        rec = ScreenVideoRecorder(dest, mon, on_status=self._push_status,
                                  on_preview=self._push_preview, work_dir=work_dir,
                                  profile=settings.get_video_profile(),
                                  # Transcripción en vivo con Vosk: al parar,
                                  # casi todo el video ya está transcrito
                                  # (ver VoskLiveTranscriber).
                                  meeting_id=meeting.id,
                                  language=settings.get_transcription_language() or "",
                                  on_transcript_utterance=self._push_utterance,
                                  on_transcript_partial=self._push_partial)
        mic_muted = settings.get_transcription_settings()["default_mic_muted"]
        rec.set_mic_muted(mic_muted)
        # Aplica la colocación libre (OBS) si el usuario la acomodó en la vista previa.
        if self._screen_transform is not None:
            rec.set_transform(*self._screen_transform)
        self.stop_screen_preview()  # la vista previa de espera deja paso al grabador
        try:
            rec.start()
        except Exception as exc:  # noqa: BLE001
            repo.end_meeting(self._session, meeting.id)
            return {"ok": False, "error": str(exc)}
        try:
            (work_dir / "_recovery_info.json").write_text(
                json.dumps({
                    "meeting_id": meeting.id, "initiative_id": ini.id,
                    "dest_path": str(dest), "started_at": now.isoformat(),
                    "title": meeting.title,
                }, ensure_ascii=False), encoding="utf-8"
            )
        except Exception:
            pass
        self._screen_rec = rec
        self._screen_active = True
        self._screen_meeting_id = meeting.id
        self._push_status("🎥 Grabando pantalla…")
        return {"ok": True, "meeting_id": meeting.id, "mic_muted": mic_muted}


    def stop_recording(self) -> dict:
        if not self._recorder:
            return {"ok": False, "duration": ""}
        recorder = self._recorder
        # 1) Detener SOLO la captura (rápido) y liberar el carril al instante:
        #    capturas/notas dejan de apuntar a esta reunión y ya puedes empezar
        #    otra grabación enseguida.
        recorder.stop_capture()
        self._recorder = None
        m = recorder.meeting
        duration = self._meeting_duration(m)
        # 2) La transcripción se hace en segundo plano (cola serie).
        self._queue_transcription(recorder)
        return {"ok": True, "meeting_id": m.id, "duration": duration,
                "queued": True, "utterances": []}


    def stop_screen_preview(self) -> dict:
        """Detiene la vista previa de espera (al cerrar el panel o al empezar a grabar)."""
        if self._screen_preview is not None:
            self._screen_preview.stop()
            self._screen_preview = None
        return {"ok": True}


    def stop_screen_recording(self) -> dict:
        """Detiene la grabación y devuelve enseguida: el muxeo del .mp4 (que puede
        tardar varios segundos) se hace en SEGUNDO PLANO, para no bloquear la app.
        Al terminar avisa a la UI con `window.onScreenVideoSaved`."""
        rec = self._screen_rec
        if rec is None:
            return {"ok": False, "error": "No hay grabación de pantalla en curso."}
        self._screen_active = False
        meeting_id = self._screen_meeting_id
        initiative_id = None
        if meeting_id:
            m = repo.get_meeting(self._session, meeting_id)
            initiative_id = m.initiative_id if m is not None else None
        audio_channels = list(rec.audio_channels())
        # Libera el estado de grabación; el guardado va aparte. Bloqueamos solo
        # una NUEVA grabación de pantalla hasta que termine de muxearse esta.
        self._reset_screen_state()
        self._screen_saving = True
        threading.Thread(
            target=self._save_screen_video_bg,
            args=(rec, meeting_id, initiative_id, audio_channels),
            daemon=True,
        ).start()
        return {"ok": True, "meeting_id": meeting_id, "saving": True}


    def take_capture(self, monitor_index: int = 1) -> dict:
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


    def toggle_meeting_mic_mute(self, muted: bool) -> dict:
        """Silencia/reactiva el micrófono de una grabación de reunión normal."""
        if self._recorder is None:
            return {"ok": False, "error": "No hay una reunión grabándose."}
        self._recorder.set_mic_muted(bool(muted))
        return {"ok": True, "muted": bool(muted)}


    def toggle_screen_mic_mute(self, muted: bool) -> dict:
        """Silencia/activa el micrófono durante la grabación de pantalla."""
        if self._screen_rec is not None:
            self._screen_rec.set_mic_muted(bool(muted))
            return {"ok": True, "muted": bool(muted)}
        return {"ok": False}


    def transcribe_meeting_video(self, meeting_id: int, force: bool = False, clip_segments: list[dict] | None = None) -> dict:
        """Encola la transcripción del vídeo en SEGUNDO PLANO y vuelve enseguida.

        `clip_segments`: lista opcional de {"start": seg, "end": seg}. Si viene,
        solo se transcribe ese/esos tramos del vídeo."""
        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None or not m.audio_path or not os.path.exists(m.audio_path):
            return {"ok": False, "error": "No se encontró el video de esta reunión."}
        if m.utterances and not force:
            return {"ok": True, "already": True, "meeting_id": m.id}
        self._enqueue_video_job(m.id, m.title, m.initiative_id, bool(force), clip_segments)
        return {"ok": True, "queued": True, "meeting_id": m.id}

    def export_meeting_clips(self, meeting_id: int, segments: list[dict] | None = None,
                             delete_original: bool = False) -> dict:
        """Corta el vídeo de la reunión en un archivo .mp4 por tramo.

        Copia los flujos sin recomprimir, así que tarda segundos y no pierde
        calidad; a cambio cada clip empieza en el fotograma clave anterior al
        punto marcado (ver `cut_video_segments`).

        Con `delete_original`, el vídeo entero se manda a la **papelera del
        sistema** —recuperable, no borrado a secas— y la reunión pasa a apuntar
        al primer clip, para no quedarse sin nada que reproducir.
        """
        from helpmeet.media import cut_video_segments, cut_audio_segments, media_duration
        from helpmeet.media_segments import normalize_segments

        m = repo.get_meeting(self._session, int(meeting_id))
        if m is None or not m.audio_path or not os.path.exists(m.audio_path):
            return {"ok": False, "error": "No se encontró la grabación de esta reunión."}
        src = str(m.audio_path)
        # Con vídeo se copian los flujos sin recomprimir; con solo audio se corta
        # exacto, porque no hay fotogramas clave que respetar.
        es_video = src.lower().endswith(".mp4")
        cortar = cut_video_segments if es_video else cut_audio_segments

        try:
            duracion = media_duration(src)
        except Exception:
            duracion = 0.0
        if duracion <= 0:
            return {"ok": False, "error": "No se pudo leer la duración del vídeo."}

        pedidos = [(float(s.get("start", 0)), float(s.get("end", 0)))
                   for s in (segments or [])]
        tramos = normalize_segments(pedidos, duracion)
        if not tramos:
            return {"ok": False, "error": "No se marcó ningún tramo válido."}

        destino = Path(src).parent / "clips"
        try:
            clips = cortar(src, tramos, str(destino), stem=Path(src).stem)
        except Exception as exc:
            logging.exception("No se pudieron cortar los clips")
            return {"ok": False, "error": f"No se pudo cortar el vídeo: {exc}"}

        borrado = False
        if delete_original:
            try:
                from send2trash import send2trash
                send2trash(src)
                # Sin esto la reunión apuntaría a un archivo que ya no está y el
                # reproductor quedaría en negro.
                m.audio_path = clips[0]["path"]
                self._session.commit()
                borrado = True
            except Exception as exc:
                logging.exception("No se pudo enviar el original a la papelera")
                return {"ok": True, "clips": clips, "folder": str(destino),
                        "deleted_original": False,
                        "warning": f"Los clips se crearon, pero el original sigue ahí: {exc}"}

        return {"ok": True, "clips": clips, "folder": str(destino),
                "deleted_original": borrado}

