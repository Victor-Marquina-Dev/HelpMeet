from datetime import datetime
from pathlib import Path
import mss
import mss.tools


def list_monitors() -> list[dict]:
    """Lista las pantallas disponibles (índice 1 = principal)."""
    with mss.mss() as sct:
        mons = sct.monitors  # [0] = todas juntas; [1..] = cada pantalla
    out = []
    for i in range(1, len(mons)):
        m = mons[i]
        out.append({
            "index": i, "left": m["left"], "top": m["top"],
            "width": m["width"], "height": m["height"],
        })
    return out


def monitor_geometry(monitor_index: int = 1) -> dict:
    """Geometría (left, top, width, height) del monitor indicado."""
    with mss.mss() as sct:
        m = sct.monitors[monitor_index]
    return {"left": m["left"], "top": m["top"],
            "width": m["width"], "height": m["height"]}


def take_screenshot(dest_dir, monitor_index: int = 1) -> str:
    """Captura el monitor indicado (1 = principal) y devuelve la ruta del PNG."""
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"capture_{datetime.now():%Y%m%d_%H%M%S_%f}.png"
    dest = dest_dir / filename
    with mss.mss() as sct:
        monitor = sct.monitors[monitor_index]
        img = sct.grab(monitor)
        mss.tools.to_png(img.rgb, img.size, output=str(dest))
    return str(dest)
