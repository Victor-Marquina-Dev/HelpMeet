"""
Script para generar GOOGLE_REFRESH_TOKEN.

Ejecutar UNA SOLA VEZ desde la terminal local:

    cd helpmeet-licenses
    python generate_refresh_token.py

Se abrira el navegador para autorizar a team@mimotech.vip
con el permiso gmail.send. El refresh token se imprimira
en la terminal para copiarlo al .env y a Fly secrets.
"""
import os
import sys


def _read_env(path=".env"):
    """Lee pares KEY=VAL de un .env ignorando comentarios y lineas vacias."""
    env = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, val = line.partition("=")
                    key = key.strip()
                    val = val.strip().strip("\"'")
                    env[key] = val
    except FileNotFoundError:
        pass
    return env


_env = _read_env()
os.environ.update({k: v for k, v in _env.items() if k not in os.environ})

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

CLIENT_CONFIG = {
    "installed": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost:8080"],
    }
}


def main():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        print("ERROR: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar en .env")
        print("Ejecuta desde helpmeet-licenses/ con el .env configurado.")
        sys.exit(1)

    CLIENT_CONFIG["installed"]["client_id"] = client_id
    CLIENT_CONFIG["installed"]["client_secret"] = client_secret

    print("Abriendo navegador para autorizar Gmail API...")
    print("Asegurate de iniciar sesion con team@mimotech.vip (Google Workspace)")
    print()
    print("Si el navegador no se abre, copia y pega esta URL:")
    print()

    flow = InstalledAppFlow.from_client_config(
        CLIENT_CONFIG, SCOPES,
        redirect_uri="http://localhost:8080"
    )
    auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    print(auth_url)
    print()
    print("Despues de autorizar, pega el codigo de la URL aqui:")
    code = input("> ").strip()
    flow.fetch_token(code=code)

    creds = flow.credentials

    print()
    print("=" * 60)
    print("GOOGLE_REFRESH_TOKEN generado:")
    print()
    print(f"  {creds.refresh_token}")
    print()
    print("=" * 60)
    print()
    print("Copialo en:")
    print("  1. helpmeet-licenses/.env → GOOGLE_REFRESH_TOKEN=...")
    print("  2. Fly secrets:")
    print("     fly secrets set GOOGLE_REFRESH_TOKEN=...")
    print("     fly deploy --ha=false")
    print()
    print("Luego elimina este archivo por seguridad.")


if __name__ == "__main__":
    main()
