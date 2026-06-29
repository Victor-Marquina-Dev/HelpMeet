# Backend de Licencias Helpmeet — Spec de diseño

## Objetivo

Crear un servicio FastAPI local que gestione licencias de Helpmeet: activación por device, validación periódica y administración manual de clientes y licencias.

## Alcance del MVP

- Crear clientes y licencias manualmente (CLI + endpoint admin)
- Activar una licencia desde Helpmeet (genera JWT)
- Validar la licencia periódicamente desde Helpmeet
- Revocar licencias desde el admin
- Sin límite de dispositivos por ahora
- Sin integración Gumroad por ahora (pendiente Fase 2)

---

## Estructura de archivos

```
helpmeet-licenses/
├── main.py               # App FastAPI + lifespan (init DB)
├── config.py             # Settings desde .env (DATABASE_URL, JWT_SECRET, ADMIN_API_KEY)
├── database.py           # Engine SQLAlchemy + SessionLocal + get_db()
├── models.py             # ORM: Customer, License, Activation, LicenseEvent
├── schemas.py            # Pydantic: ActivateRequest, ValidateRequest, responses
├── auth.py               # create_activation_token() + verify_activation_token()
├── routers/
│   ├── licenses.py       # /api/license/activate, /validate, /deactivate
│   └── admin.py          # /api/admin/* protegido con ADMIN_API_KEY
├── cli.py                # python cli.py create-license --email ... --plan ...
├── requirements.txt
├── alembic/              # Migraciones de DB
│   └── ...
├── .env.example
└── README.md
```

---

## Base de datos

### Tabla `customers`
```sql
id            SERIAL PRIMARY KEY
email         VARCHAR(255) UNIQUE NOT NULL
name          VARCHAR(255)
gumroad_id    VARCHAR(255)          -- nullable, para Fase 2
created_at    TIMESTAMP DEFAULT now()
```

### Tabla `licenses`
```sql
id              SERIAL PRIMARY KEY
customer_id     INTEGER REFERENCES customers(id)
key_hash        VARCHAR(64) NOT NULL UNIQUE   -- SHA-256 de la key
key_last4       VARCHAR(4) NOT NULL
plan            VARCHAR(50) DEFAULT 'personal'
status          VARCHAR(30) DEFAULT 'active'
                -- active | revoked | refunded | expired_updates | blocked
updates_until   DATE
created_at      TIMESTAMP DEFAULT now()
revoked_at      TIMESTAMP
```

### Tabla `activations`
```sql
id                  SERIAL PRIMARY KEY
license_id          INTEGER REFERENCES licenses(id)
device_id_hash      VARCHAR(64) NOT NULL
device_name         VARCHAR(255)
os                  VARCHAR(100)
app_version         VARCHAR(30)
status              VARCHAR(30) DEFAULT 'active'
                    -- active | deactivated | blocked
first_activated_at  TIMESTAMP DEFAULT now()
last_seen_at        TIMESTAMP DEFAULT now()
deactivated_at      TIMESTAMP
```

### Tabla `license_events`
```sql
id            SERIAL PRIMARY KEY
license_id    INTEGER REFERENCES licenses(id)
event_type    VARCHAR(50)
              -- created | activated | validated | deactivated | revoked | failed
metadata      JSONB
created_at    TIMESTAMP DEFAULT now()
```

---

## Endpoints

### Públicos (usados por Helpmeet)

#### `POST /api/license/activate`
Request:
```json
{
  "license_key": "HM-XXXX-XXXX-XXXX-XXXX",
  "device_id": "uuid-generado-localmente",
  "device_name": "PC-Victor",
  "app_version": "1.2.7",
  "os": "Windows 11"
}
```
Lógica:
1. Hashear `license_key` con SHA-256
2. Buscar en `licenses` por `key_hash`
3. Verificar `status == 'active'`
4. Crear o actualizar registro en `activations`
5. Registrar evento `activated` en `license_events`
6. Retornar JWT firmado

Response exitosa:
```json
{
  "ok": true,
  "activation_token": "<jwt>",
  "plan": "personal",
  "updates_until": "2027-06-28"
}
```
Errores:
```json
{ "ok": false, "error": "license_not_found" }
{ "ok": false, "error": "license_revoked" }
```

#### `POST /api/license/validate`
Request:
```json
{
  "activation_token": "<jwt>",
  "device_id": "uuid-generado-localmente",
  "app_version": "1.2.7"
}
```
Lógica:
1. Verificar firma JWT
2. Buscar licencia por `license_id` del payload
3. Verificar `status == 'active'`
4. Actualizar `last_seen_at` en `activations`
5. Registrar evento `validated`

Response:
```json
{ "ok": true, "status": "active", "plan": "personal" }
```
```json
{ "ok": false, "error": "license_revoked" }
```

#### `POST /api/license/deactivate`
Request:
```json
{ "activation_token": "<jwt>", "device_id": "..." }
```
Marca la activación como `deactivated`. Permite reusar la licencia en otro equipo.

---

### Admin (requieren header `X-Admin-Key: <ADMIN_API_KEY>`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/admin/customers` | Crear cliente |
| `GET`  | `/api/admin/customers` | Listar clientes |
| `POST` | `/api/admin/licenses` | Crear licencia para un cliente |
| `GET`  | `/api/admin/licenses` | Listar licencias (filtros: plan, status) |
| `GET`  | `/api/admin/licenses/{id}` | Detalle + activaciones + eventos |
| `POST` | `/api/admin/licenses/{id}/revoke` | Revocar licencia |

---

## Token JWT

Payload:
```json
{
  "license_id": 42,
  "device_id_hash": "sha256(device_id)",
  "plan": "personal",
  "updates_until": "2027-06-28",
  "iat": 1719532800,
  "exp": 1751068800
}
```
- Algoritmo: `HS256`
- Expiración: 1 año (renovable al revalidar)
- Secret: `JWT_SECRET` en `.env`

**Almacenamiento en Helpmeet:** `%LOCALAPPDATA%\Helpmeet\activation.json`

---

## Uso offline

Helpmeet revalida el token cada **7 días**. Si el backend no responde, acepta el token local por hasta **14 días**. Después exige conexión para revalidar.

---

## CLI para crear licencias

```bash
# Crear cliente
python cli.py create-customer --email victor@ejemplo.com --name "Víctor"

# Crear licencia
python cli.py create-license --customer-id 1 --plan personal --updates-until 2027-06-28

# Listar licencias
python cli.py list-licenses

# Revocar licencia
python cli.py revoke-license --license-id 3
```

La CLI genera la product key en formato `HM-XXXX-XXXX-XXXX-XXXX`, muestra la key completa una sola vez y guarda el hash en DB.

---

## Variables de entorno (`.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/helpmeet_licenses
JWT_SECRET=secreto-aleatorio-de-minimo-32-caracteres-generado-con-openssl-rand
ADMIN_API_KEY=otra-clave-aleatoria-de-minimo-32-caracteres
```

---

## Fuera de alcance (Fase 2+)

- Webhook Gumroad (`/api/gumroad/webhook`)
- Límite de dispositivos por licencia (`max_devices`)
- Panel admin web
- Deploy en producción
- Rate limiting
- Portal de cliente

Ver: `docs/PENDIENTES_LICENCIAS.md`
