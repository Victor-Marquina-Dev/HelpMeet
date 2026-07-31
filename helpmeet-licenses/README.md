# Helpmeet License Server

Backend FastAPI para gestionar licencias de Helpmeet.

## Setup rapido (desarrollo local con SQLite)

```bash
cd helpmeet-licenses
pip install -r requirements.txt
cp .env.example .env          # ya configurado para SQLite local
alembic upgrade head           # crea helpmeet_licenses.db
python seed_dev.py             # genera product key de prueba
```

## Setup produccion (PostgreSQL)

Cambiar `.env`:
```
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/helpmeet_licenses
```

```bash
psql -U postgres -c "CREATE DATABASE helpmeet_licenses;"
alembic upgrade head
```

## Arrancar el servidor

```bash
uvicorn helpmeet_licenses.main:app --reload --port 8001
```

Documentacion: http://localhost:8001/docs

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

| Variable | Descripcion |
|---|---|
| `DATABASE_URL` | SQLite (`sqlite:///./helpmeet_licenses.db`) o PostgreSQL |
| `JWT_SECRET` | Secreto para firmar JWT (minimo 32 chars) |
| `ADMIN_API_KEY` | Clave para endpoints admin (header X-Admin-Key) |

## Endpoints publicos

| Endpoint | Metodo | Descripcion |
|---|---|---|
| `/api/license/activate` | POST | Activa una licencia con una product key |
| `/api/license/validate` | POST | Valida un token de activacion |
| `/api/license/deactivate` | POST | Desactiva un dispositivo |
| `/health` | GET | Health check |

## Endpoints admin (requieren X-Admin-Key)

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/admin/customers` | POST | Crear cliente |
| `/api/admin/customers` | GET | Listar clientes |
| `/api/admin/licenses` | POST | Crear licencia (muestra key una sola vez) |
| `/api/admin/licenses` | GET | Listar licencias |
| `/api/admin/licenses/{id}` | GET | Detalle de licencia |
| `/api/admin/licenses/{id}/revoke` | POST | Revocar licencia |
