from pathlib import Path
from helpmeet.screenshot.capture import take_screenshot


def test_take_screenshot_creates_png(tmp_path):
    path = take_screenshot(tmp_path)
    p = Path(path)
    assert p.exists()
    assert p.suffix == ".png"
    assert p.stat().st_size > 0


def test_list_monitors_includes_geometry():
    from helpmeet.screenshot.capture import list_monitors
    mons = list_monitors()
    assert mons  # al menos un monitor
    for key in ("index", "left", "top", "width", "height"):
        assert key in mons[0]
    assert mons[0]["width"] > 0 and mons[0]["height"] > 0


def test_monitor_geometry_returns_box():
    from helpmeet.screenshot.capture import monitor_geometry
    g = monitor_geometry(1)
    assert set(g) == {"left", "top", "width", "height"}
    assert g["width"] > 0 and g["height"] > 0
