import urllib.request
import urllib.error
from helpmeet.media_server import MediaServer


def test_serves_range(tmp_path):
    f = tmp_path / "video.mp4"
    f.write_bytes(b"ABCDEFGHIJ")            # 10 bytes conocidos
    server = MediaServer(lambda mid: str(f) if mid == 7 else None)
    base = server.start()
    try:
        req = urllib.request.Request(f"{base}/media/7", headers={"Range": "bytes=0-3"})
        resp = urllib.request.urlopen(req, timeout=5)
        assert resp.status == 206
        assert resp.read() == b"ABCD"
        assert resp.headers["Content-Range"] == "bytes 0-3/10"
    finally:
        server.stop()


def test_unknown_meeting_returns_404(tmp_path):
    server = MediaServer(lambda mid: None)
    base = server.start()
    try:
        try:
            urllib.request.urlopen(f"{base}/media/999", timeout=5)
            assert False, "debería devolver 404"
        except urllib.error.HTTPError as e:
            assert e.code == 404
    finally:
        server.stop()
