# Guia de Despliegue — Helpmeet

## Arquitectura

```
helpmeet.mimotech.vip (Vercel)
  |-- /                 → Landing page (ventas)
  |-- /admin-poderoso   → Admin panel (licencias)

api.helpmeet.mimotech.vip (Fly.io)
  |-- FastAPI       → Servidor de licencias (helpmeet-licenses)
  |-- SQLite        → Base de datos (archivo en volumen persistente)
```

## 1. Frontend: Vercel (gratis)

### Estructura del proyecto

Todo el frontend unificado esta en `admin-panel/`:

```
admin-panel/
├── index.html          → Admin panel
├── css/style.css
├── js/app.js
├── js/config.js
├── assets/
├── landing/            → Landing page
│   ├── index.html
│   ├── landing.css
│   ├── landing.js
│   └── favicon.png
├── serve.py            → Servidor local unificado
└── .env.example
```

### Configurar Vercel

1. Instalar Vercel CLI:
```bash
npm i -g vercel
```

2. Crear `admin-panel/vercel.json`:
```json
{
  "rewrites": [
    { "source": "/admin", "destination": "/index.html" },
    { "source": "/admin/(.*)", "destination": "/$1" },
    { "source": "/(.*)", "destination": "/landing/$1" }
  ]
}
```

3. Desplegar:
```bash
cd admin-panel
vercel --prod
```

4. Configurar dominio en Vercel Dashboard:
   - Settings → Domains → `helpmeet.mimotech.vip`
   - DNS: agregar registro CNAME `helpmeet` → `cname.vercel-dns.com`

### Variables de entorno en Vercel

```bash
vercel env add ADMIN_API_KEY production  # HM-2WH4-HQWS-V3A7-VXRX-FLY-PROD-2026
vercel env add API_URL production        # https://helpmeet-licenses.fly.dev
```

## 2. Backend: Fly.io (gratis)

### Requisitos previos

```bash
# Instalar Fly CLI
powershell -c "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login
```

### Configurar proyecto

```bash
cd helpmeet-licenses
fly launch
```

### `fly.toml` (generado por `fly launch`, ajustar):

```toml
app = "helpmeet-licenses"
primary_region = "gru"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256

[mounts]
  source = "helpmeet_data"
  destination = "/data"
```

### `Dockerfile`:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
RUN mkdir -p /data
EXPOSE 8080
CMD ["uvicorn", "helpmeet_licenses.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### `requirements.txt`:

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
python-jose[cryptography]==3.3.0
pydantic-settings==2.2.1
pydantic[email]==2.7.1
httpx==0.27.0
resend==2.2.0
python-dotenv==1.0.1
```

### Desplegar:

```bash
fly deploy --ha=false
fly volumes create helpmeet_data --region gru --size 1 --yes
fly secrets set \
  ADMIN_API_KEY="HM-2WH4-HQWS-V3A7-VXRX-FLY-PROD-2026" \
  JWT_SECRET="helpmeet-jwt-secret-key-mínimo-32-caracteres-2026-prod" \
  DATABASE_URL="sqlite:////data/helpmeet_licenses.db" \
  CORS_ORIGINS="*"
# Ejecutar migraciones despues del primer deploy:
fly ssh console --app helpmeet-licenses --command "sh -c 'cd /app && alembic upgrade head'"
```

### Configurar dominio:

```bash
fly certs create api.helpmeet.mimotech.vip
```

DNS: agregar registro CNAME `api.helpmeet` → `helpmeet-licenses.fly.dev`

## 3. Variables de entorno

### Backend (Fly.io secrets)

```bash
fly secrets set \
  ADMIN_API_KEY="HM-..." \
  JWT_SECRET="..." \
  DATABASE_URL="sqlite:////data/helpmeet_licenses.db"
```

### Frontend (config.js auto-detecta produccion)

El archivo `admin-panel/js/config.js` detecta automáticamente si esta en localhost o produccion:
- `localhost` → `API_URL: http://localhost:8001`
- Produccion → `API_URL: https://helpmeet-licenses.fly.dev`

## 4. Base de datos

SQLite vive en el volumen persistente de Fly.io (`/data/helpmeet_licenses.db`).

- **No requiere servidor de BD** (PostgreSQL, MySQL, etc.)
- **Backup manual** (descargar el volumen):
  ```bash
  fly ssh console
  cp /data/helpmeet_licenses.db /data/backup-$(date +%Y%m%d).db
  ```
- **Volumen gratis**: 1 GB en plan free de Fly.io

## 5. Costos mensuales estimados

| Servicio | Plan | Costo |
|---|---|---|
| Vercel (frontend) | Hobby | **$0** |
| Fly.io (backend) | Free (3 VMs compartidas) | **$0** |
| Dominio mimotech.vip | Ya lo tienes | **$0** |
| **TOTAL** | | **$0/mes** |

Si el trafico crece:
- Fly.io: ~$1.94/mes por VM adicional (256MB)
- Vercel: $20/mes Pro (mas bandwidth, analytics, protección)

## 6. Despliegue local (desarrollo)

```bash
# Terminal 1: Licencias
cd helpmeet-licenses
uvicorn helpmeet_licenses.main:app --reload --port 8001

# Terminal 2: Frontend unificado
cd admin-panel
python serve.py
# → http://localhost:8095       (landing)
# → http://localhost:8095/admin (admin panel)

# Terminal 3: App escritorio
cd helpmeet
python -m helpmeet.main
```

## 7. DNS

### Cloudflare (nameservers: kristina.ns.cloudflare.com, camilo.ns.cloudflare.com)

```
helpmeet.mimotech.vip     CNAME → baa616e7541d7c86.vercel-dns-017.com  (Proxy: Disabled)
api.helpmeet.mimotech.vip CNAME → helpmeet-licenses.fly.dev             (Proxy: Disabled)
```

### URLs reales del despliegue

| Componente | URL |
|---|---|
| Landing + Admin (Vercel) | `https://helpmeet.mimotech.vip` |
| API Licencias (Fly) | `https://helpmeet-licenses.fly.dev` |
| Vercel directo | `https://admin-panel-azure.vercel.app` |
| Vercel Dashboard | https://vercel.com/milagrosjulisamm-gmailcoms-projects/admin-panel |
| Fly Dashboard | https://fly.io/apps/helpmeet-licenses |

## 8. Claves y secretos

| Variable | Valor | Donde |
|---|---|---|
| `ADMIN_API_KEY` | `HM-2WH4-HQWS-V3A7-VXRX-FLY-PROD-2026` | Vercel env + Fly secrets |
| `JWT_SECRET` | `helpmeet-jwt-secret-key-mínimo-32-caracteres-2026-prod` | Fly secrets |
| `DATABASE_URL` | `sqlite:////data/helpmeet_licenses.db` | Fly secrets |
| `API_URL` | `https://helpmeet-licenses.fly.dev` | Vercel env |

## 9. Post-despliegue

Despues de cada `fly deploy`, ejecutar migraciones:

```bash
fly ssh console --app helpmeet-licenses --command "sh -c 'cd /app && alembic upgrade head'"
```

## 10. Comandos rapidos

```bash
# Re-desplegar frontend
cd admin-panel && vercel --prod --yes

# Re-desplegar backend
cd helpmeet-licenses && fly deploy --ha=false

# Ver logs
fly logs --app helpmeet-licenses

# Health check
curl -k https://helpmeet-licenses.fly.dev/health

# Test API
curl -k https://helpmeet-licenses.fly.dev/api/admin/licenses \
  -H "X-Admin-Key: HM-2WH4-HQWS-V3A7-VXRX-FLY-PROD-2026"
```
