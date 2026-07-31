# Helpmeet — Despliegue Rapido

## Frontend (Vercel)

```bash
cd admin-panel
vercel --prod --yes
```

URL: `https://helpmeet.mimotech.vip`
Admin: `https://helpmeet.mimotech.vip/admin-poderoso`

## Backend (Fly.io)

```bash
cd helpmeet-licenses
fly deploy --ha=false
```

URL: `https://helpmeet-licenses.fly.dev`

### Migraciones (solo si hay cambios en modelos)

```bash
fly ssh console --app helpmeet-licenses --command "sh -c 'cd /app && alembic upgrade head'"
```

### Email (Gmail API — configurar una sola vez)

```bash
# 1. Generar refresh token (abre navegador, inicia sesión con team@mimotech.vip)
cd helpmeet-licenses
python generate_refresh_token.py

# 2. Copiar el token a Fly secrets y re-desplegar
fly secrets set GOOGLE_REFRESH_TOKEN=1//xxx...
fly deploy --ha=false
```

## Verificar

```bash
# Backend salud
curl -k https://helpmeet-licenses.fly.dev/health

# API licencias
curl -k https://helpmeet-licenses.fly.dev/api/admin/licenses \
  -H "X-Admin-Key: HM-2WH4-HQWS-V3A7-VXRX-FLY-PROD-2026"
```

## Desarrollo local

```bash
# Terminal 1: Backend
cd helpmeet-licenses
uvicorn helpmeet_licenses.main:app --reload --port 8001

# Terminal 2: Frontend
cd admin-panel
python serve.py
# → http://localhost:8095                (landing)
# → http://localhost:8095/admin-poderoso (admin panel)
```

BD local: SQLite (`helpmeet_licenses.db`), se crea automáticamente.
