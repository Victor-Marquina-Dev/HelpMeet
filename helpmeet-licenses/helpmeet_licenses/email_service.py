"""
Email Service — Gmail API + OAuth 2.0

Envia correos como HelpMeet <helpmeet@mimotech.vip> autenticandose
con la cuenta de Google Workspace team@mimotech.vip.

Flujo:
  team@mimotech.vip (autenticación OAuth)
    → envia como HelpMeet <helpmeet@mimotech.vip>
    → Reply-To: helpmeet@mimotech.vip

Requisito: GOOGLE_REFRESH_TOKEN en variables de entorno.
Para obtenerlo, ejecutar el script generate_refresh_token.py una vez.
"""
import base64
import logging
from email.mime.text import MIMEText
from typing import Optional

from helpmeet_licenses.config import settings

logger = logging.getLogger(__name__)


def _build_gmail_service():
    """Construye el cliente de Gmail API autenticado con OAuth."""
    if not settings.google_client_id or not settings.google_refresh_token:
        logger.warning("Gmail API no configurada: falta client_id o refresh_token")
        return None

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=settings.google_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            scopes=["https://www.googleapis.com/auth/gmail.send"],
        )

        return build("gmail", "v1", credentials=creds)
    except ImportError:
        logger.warning("google-api-python-client no instalado")
        return None
    except Exception as exc:
        logger.error(f"Error al construir cliente Gmail: {exc}")
        return None


def send_email(
    to: str,
    subject: str,
    body_html: str,
    reply_to: Optional[str] = None,
) -> bool:
    """
    Envia un email via Gmail API como HelpMeet <helpmeet@mimotech.vip>.

    Returns True si se envió correctamente, False en caso de error.
    """
    service = _build_gmail_service()
    if not service:
        return False

    sender = f"{settings.google_sender_name} <{settings.google_sender_email}>"
    reply_to = reply_to or settings.google_sender_email

    message = MIMEText(body_html, "html", "utf-8")
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message["Reply-To"] = reply_to
    message["MIME-Version"] = "1.0"

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

    try:
        service.users().messages().send(
            userId="me",
            body={"raw": raw},
        ).execute()
        logger.info(f"Email enviado a {to}: {subject}")
        return True
    except Exception as exc:
        logger.error(f"Error al enviar email a {to}: {exc}")
        return False


def send_license_key_email(to_email: str, license_key: str, plan: str) -> bool:
    """Envia la Product Key al comprador."""
    plan_label = {"personal": "Personal", "pro": "Pro", "team": "Team"}.get(plan, plan)

    return send_email(
        to=to_email,
        subject="Tu Product Key de Helpmeet",
        body_html=f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#1a1a1a">
  <h1 style="color:#0f766e;font-size:24px;margin-bottom:8px">HelpMeet</h1>
  <p style="font-size:16px;line-height:1.6;margin-bottom:24px">
    Gracias por adquirir Helpmeet. Aqui esta tu Product Key:
  </p>

  <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
    <code style="font-size:22px;letter-spacing:3px;color:#0f766e;font-weight:700">{license_key}</code>
    <p style="color:#64748b;font-size:13px;margin-top:8px">Plan {plan_label}</p>
  </div>

  <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px">
    <p style="font-weight:600;margin-bottom:12px">Como activar:</p>
    <ol style="margin:0;padding-left:20px;line-height:2">
      <li>Descarga e instala Helpmeet desde <a href="https://helpmeet.mimotech.vip" style="color:#0f766e">helpmeet.mimotech.vip</a></li>
      <li>Abre la aplicación</li>
      <li>Introduce tu Product Key cuando se solicite</li>
      <li>Listo</li>
    </ol>
  </div>

  <p style="color:#94a3b8;font-size:13px;line-height:1.6">
    Plan: {plan_label} &middot; 1 dispositivo<br>
    Cambiaste de PC? Responde este email y lo resolvemos.
  </p>

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">

  <p style="color:#94a3b8;font-size:12px">
    HelpMeet &middot; Graba, Transcribe y Entiende tus Reuniones<br>
    <a href="https://helpmeet.mimotech.vip" style="color:#0f766e">helpmeet.mimotech.vip</a>
  </p>
</div>
""",
    )


def send_admin_notify(
    customer_email: str,
    license_key: str,
    plan: str,
    license_id: int,
) -> bool:
    """Notifica al admin sobre una nueva licencia generada."""
    plan_label = {"personal": "Personal", "pro": "Pro", "team": "Team"}.get(plan, plan)

    return send_email(
        to=settings.admin_notify_email,
        subject=f"Nueva licencia Helpmeet — {customer_email}",
        body_html=f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <h2 style="color:#2dd4bf;margin-bottom:4px">Nueva licencia generada</h2>
  <p style="color:#94a3b8;margin-bottom:24px">Plan {plan_label} &middot; Licencia #{license_id}</p>

  <div style="background:#1e293b;border-radius:10px;padding:16px;margin-bottom:16px">
    <div style="font-size:11px;color:#64748b;text-transform:uppercase">Cliente</div>
    <div style="font-size:16px;margin-top:4px">{customer_email}</div>
  </div>

  <div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:10px">Product Key</div>
    <code style="font-size:22px;letter-spacing:3px;color:#2dd4bf;font-weight:bold">{license_key}</code>
  </div>

  <a href="https://helpmeet.mimotech.vip/admin-poderoso" style="display:block;text-align:center;background:#2dd4bf;color:#0f172a;text-decoration:none;font-weight:bold;font-size:14px;padding:12px;border-radius:8px">
    Abrir panel admin
  </a>
</div>
""",
    )
