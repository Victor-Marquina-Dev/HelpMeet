from pathlib import Path
from helpmeet.screenshot.capture import take_screenshot


def test_take_screenshot_creates_png(tmp_path):
    path = take_screenshot(tmp_path)
    p = Path(path)
    assert p.exists()
    assert p.suffix == ".png"
    assert p.stat().st_size > 0
