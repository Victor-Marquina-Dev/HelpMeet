"""
Helpmeet — Servidor de desarrollo local unificado.

Sirve:
  /                  → Landing page  (landing/index.html)
  /admin-poderoso    → Admin panel   (index.html)

Levanta en http://localhost:8095

Uso:
    python serve.py
"""
import http.server
import os
import socketserver

PORT = 8095
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0]
        print(f"[helpmeet] DEBUG path={repr(path)}")

        # Landing page at root
        if path == "/" or path == "":
            self.path = "/landing/index.html"
        # Admin panel at /admin-poderoso
        elif path == "/admin-poderoso" or path == "/admin-poderoso/":
            self.path = "/admin.html"
            print(f"[helpmeet] DEBUG → serving admin.html")
        # /admin-poderoso/* redirects to /*
        elif path.startswith("/admin-poderoso/"):
            self.path = path[16:]  # strip /admin-poderoso prefix
            print(f"[helpmeet] DEBUG → stripped to {self.path}")

        print(f"[helpmeet] DEBUG final path={repr(self.path)}")
        return super().do_GET()

    def log_message(self, format, *args):
        print(f"[helpmeet] {args[0]}")

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Helpmeet unificado → http://localhost:{PORT}")
        print(f"  Landing : http://localhost:{PORT}/")
        print(f"  Admin   : http://localhost:{PORT}/admin-poderoso")
        print(f"Admin Key: HM-2WH4-HQWS-V3A7-VXRX-LOCAL-DEV-2026")
        print("Ctrl+C para detener")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDetenido.")
