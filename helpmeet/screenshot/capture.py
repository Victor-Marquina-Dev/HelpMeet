from datetime import datetime
from pathlib import Path
import ctypes
import mss
import mss.tools


def make_thread_dpi_aware() -> None:
    """Este hilo pasa a ver píxeles físicos (per-monitor DPI aware v2).

    Sin esto, en monitores con escala de Windows (125%, 160%…) GDI entrega
    coordenadas lógicas (p. ej. 2400×1350 en una pantalla física de
    3840×2160) y la captura sale recortada a la esquina superior izquierda.
    Afecta solo al hilo que lo llama; la ventana de la app no cambia."""
    try:
        ctypes.windll.user32.SetThreadDpiAwarenessContext(ctypes.c_void_p(-4))
    except Exception:
        pass


def list_monitors() -> list[dict]:
    """Lista las pantallas disponibles (índice 1 = principal)."""
    make_thread_dpi_aware()
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
    make_thread_dpi_aware()
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
    make_thread_dpi_aware()
    with mss.mss() as sct:
        monitor = sct.monitors[monitor_index]
        img = sct.grab(monitor)
        mss.tools.to_png(img.rgb, img.size, output=str(dest))
    return str(dest)
