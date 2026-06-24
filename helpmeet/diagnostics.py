"""Chequeos de "primera ejecución": comprueban que el equipo está listo para
grabar y transcribir. Cada función es independiente y nunca lanza: ante un fallo
devuelve un estado degradado, para que la pantalla de diagnóstico siempre cargue.

`status` de cada chequeo: "ok" | "warn" | "error".
"""

from __future__ import annotations

import shutil
from pathlib import Path

# Por debajo de esto avisamos: una grabación larga + su vídeo pueden ocupar varios GB.
_DISK_WARN_GB = 5.0


def _gb(num_bytes: float) -> float:
    return round(num_bytes / (1024 ** 3), 1)


def disk_space(path) -> dict:
    """Espacio libre en la unidad donde se guardan los datos."""
    try:
        target = Path(path)
        # Sube hasta el primer directorio existente (la carpeta de datos puede no
        # existir aún en una instalación nueva).
        while not target.exists() and target != target.parent:
            target = target.parent
        usage = shutil.disk_usage(str(target))
        free = _gb(usage.free)
        status = "ok" if free >= _DISK_WARN_GB else "warn"
        return {"status": status, "free_gb": free, "total_gb": _gb(usage.total),
                "label": f"{free} GB libres de {_gb(usage.total)} GB"}
    except OSError as exc:
        return {"status": "error", "free_gb": 0, "total_gb": 0,
                "label": f"No se pudo leer el disco ({exc})"}


def whisper_model_status(model_name: str) -> dict:
    """Comprueba si el modelo Whisper local ya está descargado (caché de Hugging
    Face). Si no, la primera transcripción tendrá que descargarlo."""
    repo = f"Systran/faster-whisper-{model_name}"
    try:
        try:
            from huggingface_hub import constants
            cache = Path(constants.HF_HUB_CACHE)
        except Exception:
            cache = Path.home() / ".cache" / "huggingface" / "hub"
        folder = cache / ("models--" + repo.replace("/", "--"))
        downloaded = folder.exists() and any(folder.glob("snapshots/*/"))
        if downloaded:
            return {"status": "ok", "model": model_name, "downloaded": True,
                    "label": f"Modelo «{model_name}» descargado"}
        return {"status": "warn", "model": model_name, "downloaded": False,
                "label": f"Modelo «{model_name}» se descargará en la 1.ª transcripción"}
    except Exception as exc:  # noqa: BLE001 - el diagnóstico nunca debe romper
        return {"status": "warn", "model": model_name, "downloaded": False,
                "label": f"No se pudo comprobar el modelo ({exc})"}


def audio_devices() -> dict:
    """Micrófono por defecto y loopback del sistema (WASAPI), vía PyAudio."""
    try:
        import pyaudiowpatch as pyaudio
    except Exception as exc:  # noqa: BLE001
        return {"mic": {"status": "warn", "label": f"Audio no disponible ({exc})"},
                "loopback": {"status": "warn", "label": "Audio del sistema no comprobado"}}
    pa = None
    try:
        pa = pyaudio.PyAudio()
        try:
            mic = pa.get_device_info_by_index(pa.get_default_input_device_info()["index"])
            mic_res = {"status": "ok", "name": mic["name"], "label": mic["name"]}
        except Exception:
            mic_res = {"status": "error", "name": "", "label": "Sin micrófono detectado"}
        try:
            wasapi = pa.get_host_api_info_by_type(pyaudio.paWASAPI)
            out = pa.get_device_info_by_index(wasapi["defaultOutputDevice"])
            loop = None
            for i in range(pa.get_device_count()):
                dev = pa.get_device_info_by_index(i)
                if dev.get("isLoopbackDevice") and out["name"] in dev["name"]:
                    loop = dev
                    break
            if loop:
                loop_res = {"status": "ok", "name": loop["name"],
                            "label": f"Audio del sistema: {out['name']}"}
            else:
                loop_res = {"status": "warn", "name": "",
                            "label": "Loopback del sistema no encontrado"}
        except Exception:
            loop_res = {"status": "warn", "name": "", "label": "Audio del sistema no comprobado"}
        return {"mic": mic_res, "loopback": loop_res}
    finally:
        if pa is not None:
            pa.terminate()


def webview2_status() -> dict:
    """Versión del runtime de WebView2 (registro de Windows). Si la app se está
    mostrando, está presente; el registro solo aporta la versión."""
    try:
        import winreg
        guid = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
        # Per-machine registra bajo WOW6432Node (64 bits); per-user, sin él.
        candidates = (
            (winreg.HKEY_LOCAL_MACHINE, rf"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{guid}"),
            (winreg.HKEY_LOCAL_MACHINE, rf"SOFTWARE\Microsoft\EdgeUpdate\Clients\{guid}"),
            (winreg.HKEY_CURRENT_USER, rf"SOFTWARE\Microsoft\EdgeUpdate\Clients\{guid}"),
        )
        for root, key_path in candidates:
            try:
                with winreg.OpenKey(root, key_path) as key:
                    version, _ = winreg.QueryValueEx(key, "pv")
                    if version and version != "0.0.0.0":
                        return {"status": "ok", "label": f"WebView2 {version}"}
            except OSError:
                continue
        # No está en el registro pero la app corre: damos por presente.
        return {"status": "ok", "label": "WebView2 presente"}
    except Exception:  # noqa: BLE001
        return {"status": "ok", "label": "WebView2 presente"}


def run_diagnostics(data_dir, export_dir, model_name: str) -> dict:
    """Reúne todos los chequeos en un único informe para la UI."""
    audio = audio_devices()
    export = Path(export_dir)
    return {
        "webview2": webview2_status(),
        "disk": disk_space(data_dir),
        "whisper": whisper_model_status(model_name),
        "mic": audio["mic"],
        "loopback": audio["loopback"],
        "export_dir": {"status": "ok", "path": str(export_dir),
                       "label": str(export_dir),
                       "exists": export.exists()},
        # La nube está deshabilitada: el audio siempre se procesa en el equipo.
        "processing": {"status": "ok", "label": "El audio se procesa en tu equipo (local)",
                       "detail": "La transcripción en la nube está deshabilitada."},
    }
