# Backend de Licencias Helpmeet — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un servicio FastAPI que gestione licencias de Helpmeet: activación con JWT, validación periódica y administración manual de clientes y licencias.

**Architecture:** FastAPI + SQLAlchemy + PostgreSQL + Alembic para migraciones. El servicio vive en `helpmeet-licenses/` dentro del repo de Helpmeet. Los endpoints públicos (`/api/license/*`) los usa la app de escritorio; los admin (`/api/admin/*`) los usa el CLI y el operador.

**Tech Stack:** Python 3.11+, FastAPI 0.111+, SQLAlchemy 2.x, Alembic, python-jose (JWT), psycopg2-binary, python-dotenv, typer (CLI), pytest + httpx (tests).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `helpmeet-licenses/config.py` | Leer `.env` (DATABASE_URL, JWT_SECRET, ADMIN_API_KEY) |
| `helpmeet-licenses/database.py` | Engine SQLAlchemy, SessionLocal, `get_db()` |
| `helpmeet-licenses/models.py` | ORM: Customer, License, Activation, LicenseEvent |
| `helpmeet-licenses/schemas.py` | Pydantic request/response bodies |
| `helpmeet-licenses/auth.py` | `create_activation_token()`, `verify_activation_token()` |
| `helpmeet-licenses/routers/licenses.py` | Endpoints públicos: activate, validate, deactivate |
| `helpmeet-licenses/routers/admin.py` | Endpoints admin: customers, licenses, revoke |
| `helpmeet-licenses/main.py` | App FastAPI, lifespan, routers montados |
| `helpmeet-licenses/cli.py` | CLI Typer: create-customer, create-license, list, revoke |
| `helpmeet-licenses/tests/conftest.py` | Fixtures: app cliente, DB en memoria |
| `helpmeet-licenses/tests/test_licenses.py` | Tests endpoints públicos |
| `helpmeet-licenses/tests/test_admin.py` | Tests endpoints admin |
| `helpmeet-licenses/tests/test_auth.py` | Tests JWT |
| `helpmeet-licenses/tests/test_cli.py` | Tests CLI |

---

## Tarea 1: Scaffold y configuración

**Archivos:**
- Crear: `helpmeet-licenses/requirements.txt`
- Crear: `helpmeet-licenses/.env.example`
- Crear: `helpmeet-licenses/config.py`

- [ ] **Crear la carpeta base**

```bash
mkdir helpmeet-licenses
mkdir helpmeet-licenses/routers
mkdir helpmeet-licenses/tests
touch helpmeet-licenses/routers/__init__.py
touch helpmeet-licenses/tests/__init__.py
```

- [ ] **Crear `helpmeet-licenses/requirements.txt`**

```text
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
python-dotenv==1.0.1
typer==0.12.3
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
```

- [ ] **Crear `helpmeet-licenses/.env.example`**

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/helpmeet_licenses
JWT_SECRET=secreto-aleatorio-de-minimo-32-caracteres-generado-con-openssl-rand
ADMIN_API_KEY=otra-clave-aleatoria-de-minimo-32-caracteres
```

- [ ] **Crear `helpmeet-licenses/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    admin_api_key: str

    class Config:
        env_file = ".env"

settings = Settings()
```

> Nota: `pydantic-settings` viene incluido con `pydantic v2`. Si el entorno usa pydantic v1, cambia por `from pydantic import BaseSettings`.

- [ ] **Instalar dependencias**

```bash
cd helpmeet-licenses
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

- [ ] **Commit**

```bash
git add helpmeet-licenses/
git commit -m "feat(licenses): scaffold inicial y configuración"
```

---

## Tarea 2: Modelos de base de datos

**Archivos:**
- Crear: `helpmeet-licenses/database.py`
- Crear: `helpmeet-licenses/models.py`

- [ ] **Crear `helpmeet-licenses/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from helpmeet_licenses.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Crear `helpmeet-licenses/models.py`**

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from helpmeet_licenses.database import Base

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255))
    gumroad_id = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    licenses = relationship("License", back_populates="customer")

class License(Base):
    __tablename__ = "licenses"
    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    key_hash = Column(String(64), unique=True, nullable=False)
    key_last4 = Column(String(4), nullable=False)
    plan = Column(String(50), default="personal")
    status = Column(String(30), default="active")
    updates_until = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)
    customer = relationship("Customer", back_populates="licenses")
    activations = relationship("Activation", back_populates="license")
    events = relationship("LicenseEvent", back_populates="license")

class Activation(Base):
    __tablename__ = "activations"
    id = Column(Integer, primary_key=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=False)
    device_id_hash = Column(String(64), nullable=False)
    device_name = Column(String(255))
    os = Column(String(100))
    app_version = Column(String(30))
    status = Column(String(30), default="active")
    first_activated_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    deactivated_at = Column(DateTime)
    license = relationship("License", back_populates="activations")

class LicenseEvent(Base):
    __tablename__ = "license_events"
    id = Column(Integer, primary_key=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    license = relationship("License", back_populates="events")
```

- [ ] **Crear la base de datos PostgreSQL local**

```bash
psql -U postgres -c "CREATE DATABASE helpmeet_licenses;"
```

- [ ] **Inicializar Alembic**

```bash
cd helpmeet-licenses
alembic init alembic
```

- [ ] **Editar `helpmeet-licenses/alembic/env.py`** — reemplazar las líneas de `target_metadata`:

```python
# Añadir al inicio del archivo:
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from helpmeet_licenses.database import Base
from helpmeet_licenses import models  # noqa: F401 — registra tablas

# En la función run_migrations_online, cambiar:
target_metadata = Base.metadata

# Y reemplazar la línea de connectable:
from helpmeet_licenses.config import settings
connectable = create_engine(settings.database_url)
```

- [ ] **Generar y aplicar migración inicial**

```bash
alembic revision --autogenerate -m "init tables"
alembic upgrade head
```

Verificar que las 4 tablas existen:
```bash
psql -U postgres -d helpmeet_licenses -c "\dt"
```
Resultado esperado: `customers`, `licenses`, `activations`, `license_events`.

- [ ] **Commit**

```bash
git add helpmeet-licenses/
git commit -m "feat(licenses): modelos SQLAlchemy y migración inicial"
```

---

## Tarea 3: Auth JWT

**Archivos:**
- Crear: `helpmeet-licenses/auth.py`
- Crear: `helpmeet-licenses/tests/test_auth.py`

- [ ] **Escribir el test que falla** — `helpmeet-licenses/tests/test_auth.py`

```python
import pytest
from datetime import date
from helpmeet_licenses.auth import create_activation_token, verify_activation_token

def test_create_and_verify_token():
    token = create_activation_token(
        license_id=1,
        device_id="my-device-123",
        plan="personal",
        updates_until=date(2027, 6, 28),
    )
    assert isinstance(token, str)
    payload = verify_activation_token(token)
    assert payload["license_id"] == 1
    assert payload["plan"] == "personal"
    assert "device_id_hash" in payload

def test_invalid_token_raises():
    with pytest.raises(ValueError, match="invalid_token"):
        verify_activation_token("not-a-valid-token")
```

- [ ] **Ejecutar el test para verificar que falla**

```bash
cd helpmeet-licenses
pytest tests/test_auth.py -v
```
Resultado esperado: `ImportError` o `ModuleNotFoundError`.

- [ ] **Crear `helpmeet-licenses/auth.py`**

```python
import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Any
from jose import jwt, JWTError
from helpmeet_licenses.config import settings

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 365

def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

def create_activation_token(
    license_id: int,
    device_id: str,
    plan: str,
    updates_until: date | None,
) -> str:
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "license_id": license_id,
        "device_id_hash": _hash(device_id),
        "plan": plan,
        "updates_until": updates_until.isoformat() if updates_until else None,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=TOKEN_EXPIRE_DAYS)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)

def verify_activation_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        raise ValueError("invalid_token")

def hash_key(key: str) -> str:
    return _hash(key)
```

- [ ] **Ejecutar los tests para verificar que pasan**

```bash
pytest tests/test_auth.py -v
```
Resultado esperado: 2 tests PASS.

- [ ] **Commit**

```bash
git add helpmeet-licenses/auth.py helpmeet-licenses/tests/test_auth.py
git commit -m "feat(licenses): módulo JWT auth"
```

---

## Tarea 4: Schemas Pydantic

**Archivos:**
- Crear: `helpmeet-licenses/schemas.py`

- [ ] **Crear `helpmeet-licenses/schemas.py`**

```python
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

# ── Requests ──────────────────────────────────────────────

class ActivateRequest(BaseModel):
    license_key: str
    device_id: str
    device_name: Optional[str] = None
    app_version: Optional[str] = None
    os: Optional[str] = None

class ValidateRequest(BaseModel):
    activation_token: str
    device_id: str
    app_version: Optional[str] = None

class DeactivateRequest(BaseModel):
    activation_token: str
    device_id: str

class CreateCustomerRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None

class CreateLicenseRequest(BaseModel):
    customer_id: int
    plan: str = "personal"
    updates_until: Optional[date] = None

# ── Responses ─────────────────────────────────────────────

class ActivateResponse(BaseModel):
    ok: bool
    activation_token: Optional[str] = None
    plan: Optional[str] = None
    updates_until: Optional[date] = None
    error: Optional[str] = None

class ValidateResponse(BaseModel):
    ok: bool
    status: Optional[str] = None
    plan: Optional[str] = None
    error: Optional[str] = None

class OkResponse(BaseModel):
    ok: bool
    error: Optional[str] = None

class CustomerOut(BaseModel):
    id: int
    email: str
    name: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class ActivationOut(BaseModel):
    id: int
    device_name: Optional[str]
    os: Optional[str]
    app_version: Optional[str]
    status: str
    first_activated_at: datetime
    last_seen_at: datetime
    model_config = {"from_attributes": True}

class LicenseOut(BaseModel):
    id: int
    key_last4: str
    plan: str
    status: str
    updates_until: Optional[date]
    created_at: datetime
    customer: CustomerOut
    activations: list[ActivationOut] = []
    model_config = {"from_attributes": True}
```

- [ ] **Verificar que no hay errores de importación**

```bash
python -c "from helpmeet_licenses.schemas import ActivateRequest, LicenseOut; print('OK')"
```
Resultado esperado: `OK`.

- [ ] **Commit**

```bash
git add helpmeet-licenses/schemas.py
git commit -m "feat(licenses): schemas Pydantic"
```

---

## Tarea 5: Endpoints públicos (activate, validate, deactivate)

**Archivos:**
- Crear: `helpmeet-licenses/routers/licenses.py`
- Crear: `helpmeet-licenses/tests/conftest.py`
- Crear: `helpmeet-licenses/tests/test_licenses.py`

- [ ] **Crear `helpmeet-licenses/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from helpmeet_licenses.database import Base, get_db
from helpmeet_licenses.main import app

TEST_DB = "sqlite:///./test.db"
engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db):
    def override_get_db():
        yield db
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def a_license(db):
    """Crea un customer + licencia activa en la DB de test."""
    from helpmeet_licenses.models import Customer, License
    from helpmeet_licenses.auth import hash_key
    from datetime import date
    key = "HM-TEST-1234-ABCD-5678"
    customer = Customer(email="test@test.com", name="Test User")
    db.add(customer)
    db.flush()
    lic = License(
        customer_id=customer.id,
        key_hash=hash_key(key),
        key_last4=key[-4:],
        plan="personal",
        status="active",
        updates_until=date(2027, 6, 28),
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return {"license": lic, "key": key}
```

- [ ] **Escribir los tests que fallan** — `helpmeet-licenses/tests/test_licenses.py`

```python
def test_activate_valid_key(client, a_license):
    resp = client.post("/api/license/activate", json={
        "license_key": a_license["key"],
        "device_id": "device-abc",
        "device_name": "PC Test",
        "app_version": "1.2.7",
        "os": "Windows 11",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "activation_token" in data
    assert data["plan"] == "personal"

def test_activate_unknown_key(client):
    resp = client.post("/api/license/activate", json={
        "license_key": "HM-0000-0000-0000-0000",
        "device_id": "device-abc",
    })
    assert resp.status_code == 200
    assert resp.json()["ok"] is False
    assert resp.json()["error"] == "license_not_found"

def test_activate_revoked_key(client, a_license, db):
    from helpmeet_licenses.models import License
    lic = db.get(License, a_license["license"].id)
    lic.status = "revoked"
    db.commit()
    resp = client.post("/api/license/activate", json={
        "license_key": a_license["key"],
        "device_id": "device-abc",
    })
    assert resp.json()["error"] == "license_revoked"

def test_validate_valid_token(client, a_license):
    activate = client.post("/api/license/activate", json={
        "license_key": a_license["key"],
        "device_id": "device-abc",
    }).json()
    resp = client.post("/api/license/validate", json={
        "activation_token": activate["activation_token"],
        "device_id": "device-abc",
    })
    assert resp.json()["ok"] is True
    assert resp.json()["status"] == "active"

def test_validate_bad_token(client):
    resp = client.post("/api/license/validate", json={
        "activation_token": "not-a-jwt",
        "device_id": "device-abc",
    })
    assert resp.json()["error"] == "invalid_token"

def test_deactivate(client, a_license):
    token = client.post("/api/license/activate", json={
        "license_key": a_license["key"],
        "device_id": "device-abc",
    }).json()["activation_token"]
    resp = client.post("/api/license/deactivate", json={
        "activation_token": token,
        "device_id": "device-abc",
    })
    assert resp.json()["ok"] is True
```

- [ ] **Ejecutar tests para verificar que fallan**

```bash
pytest tests/test_licenses.py -v
```
Resultado esperado: errores de importación (router no existe aún).

- [ ] **Crear `helpmeet-licenses/routers/licenses.py`**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from helpmeet_licenses.database import get_db
from helpmeet_licenses.models import License, Activation, LicenseEvent
from helpmeet_licenses.schemas import (
    ActivateRequest, ActivateResponse,
    ValidateRequest, ValidateResponse,
    DeactivateRequest, OkResponse,
)
from helpmeet_licenses.auth import hash_key, create_activation_token, verify_activation_token

router = APIRouter(prefix="/api/license")

def _log_event(db: Session, license_id: int, event_type: str, metadata: dict = None):
    db.add(LicenseEvent(license_id=license_id, event_type=event_type, metadata=metadata or {}))

@router.post("/activate", response_model=ActivateResponse)
def activate(req: ActivateRequest, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.key_hash == hash_key(req.license_key)).first()
    if not lic:
        return ActivateResponse(ok=False, error="license_not_found")
    if lic.status != "active":
        return ActivateResponse(ok=False, error="license_revoked")

    device_hash = hash_key(req.device_id)
    activation = db.query(Activation).filter(
        Activation.license_id == lic.id,
        Activation.device_id_hash == device_hash,
    ).first()
    now = datetime.now(tz=timezone.utc)
    if activation:
        activation.last_seen_at = now
        activation.status = "active"
        if req.app_version:
            activation.app_version = req.app_version
    else:
        activation = Activation(
            license_id=lic.id,
            device_id_hash=device_hash,
            device_name=req.device_name,
            os=req.os,
            app_version=req.app_version,
        )
        db.add(activation)

    _log_event(db, lic.id, "activated", {"device_id_hash": device_hash})
    db.commit()

    token = create_activation_token(
        license_id=lic.id,
        device_id=req.device_id,
        plan=lic.plan,
        updates_until=lic.updates_until,
    )
    return ActivateResponse(
        ok=True,
        activation_token=token,
        plan=lic.plan,
        updates_until=lic.updates_until,
    )

@router.post("/validate", response_model=ValidateResponse)
def validate(req: ValidateRequest, db: Session = Depends(get_db)):
    try:
        payload = verify_activation_token(req.activation_token)
    except ValueError:
        return ValidateResponse(ok=False, error="invalid_token")

    lic = db.get(License, payload["license_id"])
    if not lic or lic.status != "active":
        return ValidateResponse(ok=False, error="license_revoked")

    device_hash = hash_key(req.device_id)
    activation = db.query(Activation).filter(
        Activation.license_id == lic.id,
        Activation.device_id_hash == device_hash,
        Activation.status == "active",
    ).first()
    if activation:
        activation.last_seen_at = datetime.now(tz=timezone.utc)
        if req.app_version:
            activation.app_version = req.app_version
    _log_event(db, lic.id, "validated", {"device_id_hash": device_hash})
    db.commit()
    return ValidateResponse(ok=True, status="active", plan=lic.plan)

@router.post("/deactivate", response_model=OkResponse)
def deactivate(req: DeactivateRequest, db: Session = Depends(get_db)):
    try:
        payload = verify_activation_token(req.activation_token)
    except ValueError:
        return OkResponse(ok=False, error="invalid_token")

    device_hash = hash_key(req.device_id)
    activation = db.query(Activation).filter(
        Activation.license_id == payload["license_id"],
        Activation.device_id_hash == device_hash,
        Activation.status == "active",
    ).first()
    if activation:
        activation.status = "deactivated"
        activation.deactivated_at = datetime.now(tz=timezone.utc)
        _log_event(db, payload["license_id"], "deactivated", {"device_id_hash": device_hash})
        db.commit()
    return OkResponse(ok=True)
```

- [ ] **Ejecutar tests para verificar que pasan**

```bash
pytest tests/test_licenses.py -v
```
Resultado esperado: 6 tests PASS.

- [ ] **Commit**

```bash
git add helpmeet-licenses/routers/licenses.py helpmeet-licenses/tests/
git commit -m "feat(licenses): endpoints activate/validate/deactivate"
```

---

## Tarea 6: Endpoints admin

**Archivos:**
- Crear: `helpmeet-licenses/routers/admin.py`
- Crear: `helpmeet-licenses/tests/test_admin.py`

- [ ] **Escribir tests que fallan** — `helpmeet-licenses/tests/test_admin.py`

```python
import pytest
from helpmeet_licenses.config import settings

HEADERS = {"X-Admin-Key": settings.admin_api_key}

def test_create_customer(client):
    resp = client.post("/api/admin/customers",
        json={"email": "victor@test.com", "name": "Víctor"},
        headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "victor@test.com"
    assert "id" in data

def test_create_customer_unauthorized(client):
    resp = client.post("/api/admin/customers",
        json={"email": "x@test.com"},
        headers={"X-Admin-Key": "wrong"})
    assert resp.status_code == 403

def test_create_license(client):
    cust = client.post("/api/admin/customers",
        json={"email": "lic@test.com"}, headers=HEADERS).json()
    resp = client.post("/api/admin/licenses",
        json={"customer_id": cust["id"], "plan": "personal", "updates_until": "2027-06-28"},
        headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert "license_key" in data
    assert data["license_key"].startswith("HM-")
    assert "key_last4" in data

def test_list_licenses(client, a_license):
    resp = client.get("/api/admin/licenses", headers=HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

def test_get_license_detail(client, a_license):
    lic_id = a_license["license"].id
    resp = client.get(f"/api/admin/licenses/{lic_id}", headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == lic_id
    assert "activations" in data

def test_revoke_license(client, a_license):
    lic_id = a_license["license"].id
    resp = client.post(f"/api/admin/licenses/{lic_id}/revoke", headers=HEADERS)
    assert resp.json()["ok"] is True
    detail = client.get(f"/api/admin/licenses/{lic_id}", headers=HEADERS).json()
    assert detail["status"] == "revoked"
```

- [ ] **Crear `helpmeet-licenses/routers/admin.py`**

```python
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from helpmeet_licenses.config import settings
from helpmeet_licenses.database import get_db
from helpmeet_licenses.models import Customer, License, LicenseEvent
from helpmeet_licenses.schemas import (
    CreateCustomerRequest, CustomerOut,
    CreateLicenseRequest, LicenseOut, OkResponse,
)
from helpmeet_licenses.auth import hash_key

router = APIRouter(prefix="/api/admin")

def _require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Forbidden")

def _generate_key() -> str:
    def segment(n=4):
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=n))
    return f"HM-{segment()}-{segment()}-{segment()}-{segment()}"

def _log_event(db: Session, license_id: int, event_type: str):
    db.add(LicenseEvent(license_id=license_id, event_type=event_type, metadata={}))

@router.post("/customers", response_model=CustomerOut)
def create_customer(req: CreateCustomerRequest, db: Session = Depends(get_db),
                    _=Depends(_require_admin)):
    customer = Customer(email=req.email, name=req.name)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer

@router.get("/customers", response_model=list[CustomerOut])
def list_customers(db: Session = Depends(get_db), _=Depends(_require_admin)):
    return db.query(Customer).all()

@router.post("/licenses")
def create_license(req: CreateLicenseRequest, db: Session = Depends(get_db),
                   _=Depends(_require_admin)):
    key = _generate_key()
    lic = License(
        customer_id=req.customer_id,
        key_hash=hash_key(key),
        key_last4=key[-4:],
        plan=req.plan,
        updates_until=req.updates_until,
    )
    db.add(lic)
    db.flush()
    _log_event(db, lic.id, "created")
    db.commit()
    db.refresh(lic)
    # La key se muestra UNA SOLA VEZ aquí. No se puede recuperar después.
    return {"id": lic.id, "license_key": key, "key_last4": key[-4:], "plan": lic.plan}

@router.get("/licenses", response_model=list[LicenseOut])
def list_licenses(plan: str = None, status: str = None,
                  db: Session = Depends(get_db), _=Depends(_require_admin)):
    q = db.query(License)
    if plan:
        q = q.filter(License.plan == plan)
    if status:
        q = q.filter(License.status == status)
    return q.all()

@router.get("/licenses/{license_id}", response_model=LicenseOut)
def get_license(license_id: int, db: Session = Depends(get_db), _=Depends(_require_admin)):
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    return lic

@router.post("/licenses/{license_id}/revoke", response_model=OkResponse)
def revoke_license(license_id: int, db: Session = Depends(get_db), _=Depends(_require_admin)):
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    lic.status = "revoked"
    lic.revoked_at = datetime.now(tz=timezone.utc)
    _log_event(db, lic.id, "revoked")
    db.commit()
    return OkResponse(ok=True)
```

- [ ] **Ejecutar tests**

```bash
pytest tests/test_admin.py -v
```
Resultado esperado: 6 tests PASS.

- [ ] **Commit**

```bash
git add helpmeet-licenses/routers/admin.py helpmeet-licenses/tests/test_admin.py
git commit -m "feat(licenses): endpoints admin (customers, licenses, revoke)"
```

---

## Tarea 7: App principal FastAPI

**Archivos:**
- Crear: `helpmeet-licenses/main.py`

- [ ] **Crear `helpmeet-licenses/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from helpmeet_licenses.database import engine
from helpmeet_licenses.models import Base  # noqa: F401 — registra tablas
from helpmeet_licenses import models  # noqa: F401
from helpmeet_licenses.routers import licenses, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # En producción usar Alembic; aquí solo para dev sin migración previa.
    # Base.metadata.create_all(bind=engine)  # descomentar si no usas Alembic
    yield

app = FastAPI(title="Helpmeet License Server", version="1.0.0", lifespan=lifespan)
app.include_router(licenses.router)
app.include_router(admin.router)

@app.get("/health")
def health():
    return {"ok": True}
```

- [ ] **Verificar que el servidor arranca**

```bash
cd helpmeet-licenses
uvicorn helpmeet_licenses.main:app --reload --port 8765
```
Abrir en browser: `http://localhost:8765/docs` — debe mostrar la documentación FastAPI con todos los endpoints.

- [ ] **Ejecutar todos los tests juntos**

```bash
pytest -v
```
Resultado esperado: todos los tests PASS (no debe haber tests rojos).

- [ ] **Commit**

```bash
git add helpmeet-licenses/main.py
git commit -m "feat(licenses): app FastAPI principal"
```

---

## Tarea 8: CLI para gestión manual de licencias

**Archivos:**
- Crear: `helpmeet-licenses/cli.py`
- Crear: `helpmeet-licenses/tests/test_cli.py`

- [ ] **Escribir tests del CLI** — `helpmeet-licenses/tests/test_cli.py`

```python
from typer.testing import CliRunner
from helpmeet_licenses.cli import app as cli_app

runner = CliRunner()

def test_create_customer_and_license(setup_db):
    result = runner.invoke(cli_app, [
        "create-customer", "--email", "cli@test.com", "--name", "CLI User"
    ])
    assert result.exit_code == 0
    assert "Creado" in result.output
    assert "cli@test.com" in result.output

    result2 = runner.invoke(cli_app, [
        "create-license", "--customer-id", "1", "--plan", "personal"
    ])
    assert result2.exit_code == 0
    assert "HM-" in result2.output
    assert "COPIA ESTA KEY" in result2.output

def test_list_licenses(setup_db):
    result = runner.invoke(cli_app, ["list-licenses"])
    assert result.exit_code == 0
```

- [ ] **Crear `helpmeet-licenses/cli.py`**

```python
import typer
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from helpmeet_licenses.database import SessionLocal
from helpmeet_licenses.models import Customer, License
from helpmeet_licenses.auth import hash_key
from helpmeet_licenses.routers.admin import _generate_key

app = typer.Typer(help="Gestión de licencias Helpmeet")

def _db() -> Session:
    return SessionLocal()

@app.command("create-customer")
def create_customer(
    email: str = typer.Option(..., help="Email del cliente"),
    name: Optional[str] = typer.Option(None, help="Nombre"),
):
    """Crea un nuevo cliente."""
    db = _db()
    try:
        customer = Customer(email=email, name=name)
        db.add(customer)
        db.commit()
        db.refresh(customer)
        typer.echo(f"✅ Creado: ID={customer.id} email={customer.email}")
    finally:
        db.close()

@app.command("create-license")
def create_license(
    customer_id: int = typer.Option(..., help="ID del cliente"),
    plan: str = typer.Option("personal", help="Plan: personal | pro | team"),
    updates_until: Optional[str] = typer.Option(None, help="Fecha YYYY-MM-DD"),
):
    """Crea una licencia y muestra la product key (solo una vez)."""
    db = _db()
    try:
        customer = db.get(Customer, customer_id)
        if not customer:
            typer.echo(f"❌ Cliente {customer_id} no encontrado", err=True)
            raise typer.Exit(1)
        key = _generate_key()
        until = date.fromisoformat(updates_until) if updates_until else None
        lic = License(
            customer_id=customer_id,
            key_hash=hash_key(key),
            key_last4=key[-4:],
            plan=plan,
            updates_until=until,
        )
        db.add(lic)
        db.commit()
        db.refresh(lic)
        typer.echo(f"\n{'='*50}")
        typer.echo(f"⚠️  COPIA ESTA KEY — no se puede recuperar después")
        typer.echo(f"{'='*50}")
        typer.echo(f"  {key}")
        typer.echo(f"{'='*50}\n")
        typer.echo(f"Licencia ID={lic.id} | Plan={plan} | Cliente={customer.email}")
    finally:
        db.close()

@app.command("list-licenses")
def list_licenses(status: Optional[str] = typer.Option(None)):
    """Lista todas las licencias."""
    db = _db()
    try:
        q = db.query(License)
        if status:
            q = q.filter(License.status == status)
        licenses = q.all()
        if not licenses:
            typer.echo("Sin licencias.")
            return
        for lic in licenses:
            typer.echo(
                f"ID={lic.id} | ...{lic.key_last4} | {lic.plan} | {lic.status} "
                f"| {lic.customer.email if lic.customer else '?'}"
            )
    finally:
        db.close()

@app.command("revoke-license")
def revoke_license(license_id: int = typer.Option(...)):
    """Revoca una licencia."""
    from datetime import datetime, timezone
    db = _db()
    try:
        lic = db.get(License, license_id)
        if not lic:
            typer.echo(f"❌ Licencia {license_id} no encontrada", err=True)
            raise typer.Exit(1)
        lic.status = "revoked"
        lic.revoked_at = datetime.now(tz=timezone.utc)
        db.commit()
        typer.echo(f"✅ Licencia {license_id} revocada.")
    finally:
        db.close()

if __name__ == "__main__":
    app()
```

- [ ] **Ejecutar tests del CLI**

```bash
pytest tests/test_cli.py -v
```
Resultado esperado: PASS.

- [ ] **Probar CLI manualmente**

```bash
python cli.py create-customer --email victor@mimotech.com --name "Víctor"
python cli.py create-license --customer-id 1 --plan personal --updates-until 2027-06-28
python cli.py list-licenses
```

- [ ] **Commit**

```bash
git add helpmeet-licenses/cli.py helpmeet-licenses/tests/test_cli.py
git commit -m "feat(licenses): CLI para gestión manual de licencias"
```

---

## Tarea 9: README

**Archivos:**
- Crear: `helpmeet-licenses/README.md`

- [ ] **Crear `helpmeet-licenses/README.md`**

```markdown
# Helpmeet License Server

Backend FastAPI para gestionar licencias de Helpmeet.

## Setup rápido

```bash
cd helpmeet-licenses
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # editar con tus valores
```

## Base de datos

```bash
psql -U postgres -c "CREATE DATABASE helpmeet_licenses;"
alembic upgrade head
```

## Arrancar el servidor

```bash
uvicorn helpmeet_licenses.main:app --reload --port 8765
```

Documentación: http://localhost:8765/docs

## Crear una licencia (CLI)

```bash
python cli.py create-customer --email cliente@email.com --name "Nombre"
python cli.py create-license --customer-id 1 --plan personal --updates-until 2027-06-28
python cli.py list-licenses
python cli.py revoke-license --license-id 3
```

## Tests

```bash
pytest -v
```

## Variables de entorno (.env)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL PostgreSQL |
| `JWT_SECRET` | Secreto para firmar JWT (mínimo 32 chars) |
| `ADMIN_API_KEY` | Clave para endpoints admin |
```

- [ ] **Commit final**

```bash
git add helpmeet-licenses/README.md
git commit -m "docs(licenses): README del backend de licencias"
```

---

## Verificación final

- [ ] **Ejecutar suite completa**

```bash
cd helpmeet-licenses
pytest -v --tb=short
```
Resultado esperado: todos los tests PASS, sin warnings críticos.

- [ ] **Smoke test manual del flujo completo**

```bash
# 1. Arrancar servidor
uvicorn helpmeet_licenses.main:app --port 8765 &

# 2. Crear cliente y licencia
python cli.py create-customer --email smoke@test.com --name "Smoke"
# → anota el ID del cliente (ej: 1)
python cli.py create-license --customer-id 1 --plan personal
# → anota la KEY completa (ej: HM-AB12-CD34-EF56-GH78)

# 3. Activar desde curl
curl -s -X POST http://localhost:8765/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{"license_key":"HM-AB12-CD34-EF56-GH78","device_id":"my-pc-001"}'
# → debe retornar {"ok":true,"activation_token":"eyJ..."}

# 4. Validar
TOKEN="eyJ..."
curl -s -X POST http://localhost:8765/api/license/validate \
  -H "Content-Type: application/json" \
  -d "{\"activation_token\":\"$TOKEN\",\"device_id\":\"my-pc-001\"}"
# → {"ok":true,"status":"active","plan":"personal"}

# 5. Revocar y verificar que falla
python cli.py revoke-license --license-id 1
curl -s -X POST http://localhost:8765/api/license/validate \
  -H "Content-Type: application/json" \
  -d "{\"activation_token\":\"$TOKEN\",\"device_id\":\"my-pc-001\"}"
# → {"ok":false,"error":"license_revoked"}
```
