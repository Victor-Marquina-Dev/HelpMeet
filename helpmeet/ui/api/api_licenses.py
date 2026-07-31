"""Metodos de gestion de licencias.

Extraido de la clase Api en app.py."""

from datetime import datetime, timezone
from helpmeet import settings
from helpmeet.version import __version__


class LicenseApiMixin:
    """Activación, validación y desactivación de licencias."""

    def _get_device_id(self) -> str:
        import hashlib, socket, platform
        raw = f"{socket.gethostname()}-{platform.machine()}-{platform.node()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def _license_socket(self, path: str, body: dict) -> dict:
        import urllib.parse, urllib.request, json as _j
        try:
            base_url = self._LICENSE_SERVER.rstrip("/")
            parsed = urllib.parse.urlparse(base_url)
            if parsed.scheme != "https" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
                return {"_error": "license_server_requires_https"}
            b = _j.dumps(body).encode()
            req = urllib.request.Request(
                base_url + path,
                data=b,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(req, timeout=8) as resp:
                return _j.loads(resp.read())
        except Exception as exc:
            return {"_error": str(exc)}

    def check_license(self) -> dict:
        import os
        if os.environ.get("HELPMEET_DEV_SKIP_LICENSE") == "1":
            # Atajo SOLO para `python -m helpmeet.main` en desarrollo local: no
            # toca la licencia real guardada ni llama al servidor. Nunca se
            # activa en el .exe instalado (nadie define esta variable ahí).
            return {"ok": True, "plan": "dev", "offline": True}
        from datetime import timedelta
        token = settings.get_license_token()
        if not token:
            return {"ok": False, "reason": "no_license"}
        last_ver = settings.get_last_activated_version()
        if last_ver:
            if last_ver.split(".")[0] != __version__.split(".")[0]:
                return {"ok": False, "reason": "new_version"}
        r = self._license_socket("/api/license/validate", {
            "activation_token": token, "device_id": self._get_device_id(),
        })
        if "_error" not in r:
            settings.set_last_license_check(datetime.now(timezone.utc).isoformat())
            return {"ok": bool(r.get("ok")), "plan": r.get("plan")}
        last_check = settings.get_last_license_check()
        if last_check:
            try:
                ts = last_check.replace("+00:00", "").replace("Z", "")
                last_dt = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
                if (datetime.now(timezone.utc) - last_dt) < timedelta(days=7):
                    return {"ok": True, "plan": "offline", "offline": True}
            except Exception:
                pass
        return {"ok": False, "reason": "offline_expired"}

    def get_license_info(self) -> dict:
        token = settings.get_license_token()
        if not token:
            return {"active": False}
        try:
            import base64, json as _j
            parts = token.split(".")
            pad = parts[1] + "=" * (4 - len(parts[1]) % 4)
            payload = _j.loads(base64.urlsafe_b64decode(pad))
            return {"active": True, "plan": payload.get("plan", "personal")}
        except Exception:
            return {"active": True, "plan": "personal"}

    _PLAN_FEATURES = {
        "personal": {
            "plan": "personal",
            "label": "Personal",
            "devices": 1,
            "video_unlimited": False,
            "video_hours": 10,
            "zip_export": False,
            "participants": False,
            "glossary": False,
            "recovery": False,
            "priority_support": False,
        },
        "pro": {
            "plan": "pro",
            "label": "Pro",
            "devices": 2,
            "video_unlimited": True,
            "video_hours": -1,
            "zip_export": True,
            "participants": True,
            "glossary": True,
            "recovery": True,
            "priority_support": False,
        },
        "team": {
            "plan": "team",
            "label": "Team",
            "devices": 5,
            "video_unlimited": True,
            "video_hours": -1,
            "zip_export": True,
            "participants": True,
            "glossary": True,
            "recovery": True,
            "priority_support": True,
        },
    }

    def get_plan_features(self) -> dict:
        """Features habilitadas segun el plan de la licencia activa."""
        token = settings.get_license_token()
        plan = "personal"
        if token:
            try:
                import base64, json as _j
                parts = token.split(".")
                pad = parts[1] + "=" * (4 - len(parts[1]) % 4)
                payload = _j.loads(base64.urlsafe_b64decode(pad))
                plan = payload.get("plan", "personal")
            except Exception:
                pass
        base = dict(self._PLAN_FEATURES.get(plan, self._PLAN_FEATURES["personal"]))
        # Video hours used (from settings)
        base["video_hours_used"] = settings.get_video_hours_used()
        return base

    def deactivate_license(self) -> dict:
        token = settings.get_license_token()
        if token:
            self._license_socket("/api/license/deactivate", {
                "activation_token": token,
                "device_id": self._get_device_id(),
            })
        settings.set_license_token("")
        return {"ok": True}

    def report_video_usage(self, seconds: int) -> dict:
        """Reporta segundos de video procesados al servidor de licencias."""
        token = settings.get_license_token()
        if not token or seconds <= 0:
            return {"ok": False}
        r = self._license_socket("/api/license/report-usage", {
            "activation_token": token,
            "seconds": seconds,
        })
        return {"ok": r.get("ok", False)}

    def activate_license(self, key: str) -> dict:
        import socket, platform
        r = self._license_socket("/api/license/activate", {
            "license_key": (key or "").strip().upper(),
            "device_id": self._get_device_id(),
            "device_name": socket.gethostname(),
            "os": f"{platform.system()} {platform.release()}",
            "app_version": __version__,
        })
        if "_error" in r:
            return {"ok": False, "error": "No se pudo conectar al servidor."}
        if r.get("ok"):
            settings.set_license_token(r["activation_token"])
            settings.set_last_license_check(datetime.now(timezone.utc).isoformat())
            settings.set_last_activated_version(__version__)
            settings.set_setup_done(False)
            return {"ok": True, "plan": r.get("plan")}
        _em = {"not_found": "Key no encontrada.", "revoked": "Licencia revocada."}
        err = r.get("error", "unknown")
        return {"ok": False, "error": _em.get(err, f"Error: {err}")}
