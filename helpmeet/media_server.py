"""Mini-servidor HTTP local para reproducir vídeos de reuniones dentro de la app.

WebView2 carga la UI desde file://, y desde ahí no puede reproducir otro archivo
local en un <video>. Este servidor sirve el mp4 por http://127.0.0.1 con soporte
de Range (peticiones parciales), que es lo que el <video> necesita para hacer
seek. Solo escucha en localhost y solo resuelve rutas por meeting_id válido.
"""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class MediaServer:
    def __init__(self, resolve_path):
        """`resolve_path(meeting_id) -> ruta_str | None`."""
        self._resolve_path = resolve_path
        self._httpd = None
        self._thread = None
        self.base_url = ""

    def start(self):
        if self._httpd:
            return self.base_url
        resolve = self._resolve_path

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass  # sin ruido en consola

            def do_GET(self):
                parts = self.path.strip("/").split("/")
                if len(parts) != 2 or parts[0] != "media":
                    self.send_error(404)
                    return
                try:
                    mid = int(parts[1])
                except ValueError:
                    self.send_error(404)
                    return
                path = resolve(mid)
                if not path or not Path(path).exists():
                    self.send_error(404)
                    return
                self._serve(Path(path))

            def _serve(self, path):
                size = path.stat().st_size
                rng = self.headers.get("Range")
                start, end, status = 0, size - 1, 200
                if rng and rng.startswith("bytes="):
                    status = 206
                    spec = rng[len("bytes="):].split("-")
                    if spec[0]:
                        start = int(spec[0])
                    if len(spec) > 1 and spec[1]:
                        end = int(spec[1])
                    end = min(end, size - 1)
                    if start >= size:
                        self.send_response(416)
                        self.send_header("Content-Range", f"bytes */{size}")
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return
                length = max(0, end - start + 1)
                self.send_response(status)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(length))
                if status == 206:
                    self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.end_headers()
                with open(path, "rb") as fh:
                    fh.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = fh.read(min(65536, remaining))
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                            break
                        remaining -= len(chunk)

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        port = self._httpd.server_address[1]
        self.base_url = f"http://127.0.0.1:{port}"
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return self.base_url

    def url_for(self, meeting_id):
        return f"{self.base_url}/media/{int(meeting_id)}"

    def stop(self):
        if self._httpd:
            self._httpd.shutdown()
            self._httpd = None
            self._thread = None
            self.base_url = ""
