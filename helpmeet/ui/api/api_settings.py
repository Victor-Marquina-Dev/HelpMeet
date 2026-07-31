"""Métodos de ajustes, diagnóstico y configuración.

Extraido de la clase Api en app.py."""

import json
import logging
import os
import shutil
import threading
from pathlib import Path

from helpmeet import config
from helpmeet import settings
from helpmeet.version import __version__

_log = logging.getLogger("helpmeet")

# Tamaño aproximado de descarga por modelo Vosk (ver settings.VOSK_TIERS).
_VOSK_MODEL_SIZES_MB = {
    "vosk-model-small-es-0.42": 40, "vosk-model-es-0.42": 1500,
    "vosk-model-small-en-us-0.15": 40, "vosk-model-en-us-0.22": 1900,
}


class SettingsApiMixin:
    """Ajustes, diagnóstico, configuración, backup, wipe, setup."""

    def check_for_update(self) -> dict:
        import urllib.request
        try:
            req = urllib.request.Request(
                f"{self._LICENSE_SERVER}/api/version",
                headers={"User-Agent": f"Helpmeet/{__version__}"},
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return {"available": False, "current": __version__}

        def _tuple(v):
            try:
                return tuple(int(x) for x in str(v).split("."))
            except Exception:
                return (0,)

        latest = str(data.get("version") or "").strip()
        url = str(data.get("url") or "").strip()
        if latest and url and _tuple(latest) > _tuple(__version__):
            return {"available": True, "version": latest, "url": url,
                    "current": __version__}
        return {"available": False, "current": __version__}

    def open_url(self, url: str) -> dict:
        import webbrowser
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            webbrowser.open(url)
            return {"ok": True}
        return {"ok": False}

    def get_diagnostics(self) -> dict:
        from helpmeet import diagnostics
        return diagnostics.run_diagnostics(
            config.DATA_DIR, settings.get_export_dir(),
            settings.get_transcription_model(),
        )

    def run_setup(self) -> dict:
        if self._setup_running:
            return {"ok": True, "already_running": True}
        self._setup_running = True
        threading.Thread(target=self._run_setup_worker, daemon=True).start()
        return {"ok": True}

    def _push_setup_progress(self, payload: dict) -> None:
        if self._window:
            try:
                self._window.evaluate_js(
                    f"window.onSetupProgress && window.onSetupProgress({json.dumps(payload)})"
                )
            except Exception:
                pass

    def _poll_vosk_download(self, model: str, expected_mb: int, stop: threading.Event) -> None:
        # Vosk descarga primero a "<carpeta>.zip" y recién al terminar lo
        # extrae y borra el zip: el tamaño de ESE archivo es lo único que
        # crece de forma continua durante la descarga.
        from helpmeet.transcription.vosk_engine import model_dir_for
        zip_path = Path(str(model_dir_for(model)) + ".zip")
        while not stop.wait(0.8):
            try:
                if zip_path.exists():
                    size = zip_path.stat().st_size
                    pct = min(0.78, size / (expected_mb * 1024 * 1024))
                    self._push_setup_progress({"stage": "downloading", "pct": max(0.04, pct)})
            except Exception:
                pass

    def _download_and_load_engine(self, model: str, expected_mb: int):
        self._push_setup_progress({"stage": "downloading", "pct": 0.02, "model": model,
                                   "size_label": f"~{expected_mb} MB"})
        stop = threading.Event()
        poll_t = threading.Thread(
            target=self._poll_vosk_download, args=(model, expected_mb, stop), daemon=True
        )
        poll_t.start()
        try:
            return self._get_engine()  # descarga (si falta) + carga, síncrono
        finally:
            stop.set()
            poll_t.join(timeout=2)

    def _run_setup_worker(self) -> None:
        try:
            model = settings.get_transcription_model()
            expected_mb = _VOSK_MODEL_SIZES_MB.get(model, 40)
            from helpmeet import diagnostics as _diag

            already = _diag.vosk_model_status(model).get("downloaded", False)
            if already:
                self._push_setup_progress({"stage": "loading", "pct": 0.85, "model": model})
                engine = self._get_engine()
            else:
                engine = self._download_and_load_engine(model, expected_mb)

            settings.set_setup_done(True)
            self._push_setup_progress(
                {"stage": "done", "pct": 1.0, "model": getattr(engine, "model_name", model)}
            )
        except Exception as exc:
            self._push_setup_progress({"stage": "error", "pct": 0.0, "error": str(exc)})
        finally:
            self._setup_running = False

    def clear_vosk_cache(self) -> dict:
        removed = []
        local_models = Path(config.DATA_DIR) / "models" / "vosk"
        if local_models.exists():
            for d in local_models.iterdir():
                try:
                    if d.is_dir():
                        shutil.rmtree(d)
                    else:
                        d.unlink()  # restos de un .zip a medio bajar
                    removed.append(d.name)
                except Exception as exc:
                    _log.warning("No se pudo eliminar %s: %s", d, exc)
        self._engine = None
        self._local_engine = None
        self._setup_running = False
        return {"ok": True, "removed": removed}

    def get_recording_preflight(self, kind: str, monitor_index: int = 1) -> dict:
        from helpmeet import diagnostics
        monitor = None
        if kind == "screen":
            try:
                from helpmeet.screenshot.capture import monitor_geometry
                monitor = monitor_geometry(int(monitor_index))
                monitor["index"] = int(monitor_index)
            except Exception:
                monitor = None
        return diagnostics.recording_preflight(
            str(kind), config.DATA_DIR, settings.get_export_dir(),
            settings.get_transcription_model(), monitor=monitor,
            fps=config.VIDEO_FPS,
        )

    def backup_database(self) -> dict:
        dest = self._pick_folder()
        if not dest:
            return {"ok": False, "cancelled": True}
        from datetime import datetime as _dt
        stamp = _dt.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_dir = Path(dest) / f"helpmeet-backup-{stamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        try:
            self._session.commit()
        except Exception:
            pass
        copied = []
        for name in ("helpmeet.sqlite", "settings.json"):
            src = config.DATA_DIR / name
            if src.exists():
                shutil.copy2(src, backup_dir / name)
                copied.append(name)
        return {"ok": bool(copied), "path": str(backup_dir)}

    def wipe_all_data(self) -> dict:
        from helpmeet.db import database
        from helpmeet.db.database import init_db, get_session
        try:
            self._session.close()
        except Exception:
            pass
        database.dispose_engine()
        config.wipe_data_dir()
        settings.invalidate_cache()
        try:
            from helpmeet import secret_store
            secret_store.delete_secret()
        except Exception:
            pass
        init_db()
        self._session = get_session()
        self._engine = None
        self._local_engine = None
        self._engine_provider = None
        self._engine_model = None
        return {"ok": True}

    def get_settings(self) -> dict:
        token = settings.get_api_token()
        try:
            tx = settings.get_transcription_settings()
        except Exception:
            tx = {}
        return {
            "export_dir": str(settings.get_export_dir()),
            "has_token": bool(token),
            "token_hint": ("..." + token[-4:]) if token else "",
            "ai_instructions": settings.get_ai_instructions(),
            "consent_seen": settings.get_consent_seen(),
            "ui_language": settings.get_ui_language(),
            **tx,
        }

    def get_ui_language(self) -> dict:
        return {"language": settings.get_ui_language()}

    def set_ui_language(self, lang: str) -> dict:
        settings.set_ui_language(lang)
        return {"ok": True, "language": lang}

    def mark_consent_seen(self) -> dict:
        settings.set_consent_seen(True)
        return {"ok": True}

    def set_ai_instructions(self, text: str) -> dict:
        settings.set_ai_instructions(text or "")
        return {"ok": True, "text": settings.get_ai_instructions()}

    def set_api_token(self, token: str) -> dict:
        settings.set_api_token(token)
        self._engine = None
        self._engine_provider = None
        return {"ok": True}

    def get_transcription_settings(self) -> dict:
        return settings.get_transcription_settings()

    def set_transcription_settings(self, values: dict) -> dict:
        result = settings.set_transcription_settings(values or {})
        self._engine = None
        self._engine_provider = None
        self._engine_model = None
        return {"ok": True, **result}
