"""Cada plan de Gumroad debe crear la licencia con su limite de dispositivos.

Regresion: el webhook creaba todas las licencias con max_devices=1, asi que un
comprador de Pro (2 equipos) o Team (5 equipos) solo podia activar uno.
"""
from helpmeet_licenses.config import settings
from helpmeet_licenses.models import Customer, License

HEADERS = {"X-Admin-Key": settings.admin_api_key}

# slug en Gumroad -> (plan interno, dispositivos vendidos)
PLANES = {
    "helpmeet_personal": ("personal", 1),
    "helpmeet_pro": ("pro", 2),
    "helpmeet_team": ("team", 5),
}


def _comprar(client, db, slug: str) -> License:
    email = f"{slug}@test.com"
    r = client.post("/api/gumroad/webhook", headers=HEADERS, json={
        "email": email, "sale_id": f"sale_{slug}", "product_id": slug,
    })
    assert r.status_code == 200 and r.json()["ok"] is True
    customer = db.query(Customer).filter(Customer.email == email).first()
    assert customer is not None, f"no se creo el cliente para {slug}"
    lic = db.query(License).filter(License.customer_id == customer.id).first()
    assert lic is not None, f"no se creo la licencia para {slug}"
    return lic


def test_slug_se_traduce_al_plan_correcto(client, db):
    for slug, (plan, _) in PLANES.items():
        assert _comprar(client, db, slug).plan == plan


def test_cada_plan_recibe_sus_dispositivos(client, db):
    for slug, (plan, dispositivos) in PLANES.items():
        lic = _comprar(client, db, slug)
        assert lic.max_devices == dispositivos, (
            f"{plan}: el cliente paga por {dispositivos} dispositivos "
            f"y la licencia le da {lic.max_devices}"
        )


def test_slug_desconocido_no_regala_plan_superior(client, db):
    """Un slug no reconocido debe caer al plan mas bajo, nunca a Pro/Team."""
    lic = _comprar(client, db, "helpmeet_inexistente")
    assert lic.plan == "personal"
    assert lic.max_devices == 1
