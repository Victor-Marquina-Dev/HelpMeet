# Helpmeet

App de escritorio Windows que transcribe reuniones, las organiza por iniciativa,
permite capturas y notas ligadas al momento exacto, y exporta contexto en
Markdown para Claude Code.

> **Version:** 2.5.0 | **Calidad:** 9.0/10 (auditoria 2026-07-18)

## Estructura del proyecto

| Carpeta | Responsabilidad |
|---|---|
| `helpmeet/` | App Python principal (UI, DB, audio, transcripcion, export) |
| `helpmeet-licenses/` | Backend FastAPI para gestion de licencias |
| `admin-panel/` | Panel web de administracion de licencias |
| `installer/` | Script Inno Setup para generar instalador Windows (.exe) |
| `scripts/` | Build, checksums, benchmark (`build_release.ps1` genera el .exe) |
| `tests/` | Tests pytest (27 archivos) |
| `docs/` | Docs esenciales: manual, specs historicas, legal, ventas |
| `licenses/` | Licencias de terceros |
| `recursos/` | Builds de desarrollo por version (`vX.Y.Z/Helpmeet.exe`) |
| `assets/` | Recursos estaticos (test) |

## Requisitos

- Windows 10/11
- Python 3.12

## Puesta en marcha

```bash
# PowerShell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1

# Git Bash / WSL
# py -3.12 -m venv .venv
# source .venv/Scripts/activate
```

Con el entorno activado:

```bash
pip install -r requirements.txt
python -m helpmeet.main
```

## Modo desarrollo (levantar sin compilar)

Todo local. Cero dependencias externas. 3 pasos.

### 1. Instalar (solo la primera vez)

```bash
source .venv/Scripts/activate
pip install -r requirements.txt
cd helpmeet-licenses
pip install -r requirements.txt
alembic upgrade head
python seed_dev.py
cd ..
```

`seed_dev.py` imprime dos claves. Guardalas:

```
Product Key: HM-DEV-XXXXXXXX   <-- para activar la app (escritorio)
Admin Key:  HM-2WH4-...XXXX   <-- para el panel web (localhost:8095)
```

### 2. Levantar los 3 servicios

Tres terminales distintas, en este orden:

**Terminal 1 — Backend de licencias**
```bash
source .venv/Scripts/activate
cd helpmeet-licenses
uvicorn helpmeet_licenses.main:app --reload --port 8001
```

**Terminal 2 — Panel de administracion**
```bash
source .venv/Scripts/activate
cd admin-panel
python serve.py
```

**Terminal 3 — App Helpmeet**
```bash
source .venv/Scripts/activate
python -m helpmeet.main
```

### 3. Activar

1. En la ventana de Helpmeet, pega la **Product Key** (ej: `HM-DEV-EF7E81CCC9B5E5D4`).
2. Para entrar al panel web (`http://localhost:8095`), usa la **Admin Key**.

> No confundas: la Product Key activa la app. La Admin Key desbloquea el panel web.

## Generar ejecutable de prueba (desarrollo rapido)

```powershell
# Solo PyInstaller, sin tests ni instalador. El .exe queda en recursos/v2.5.0/
.\scripts\build_dev.ps1
```

El ejecutable se copia a `recursos/v{version}/Helpmeet.exe` listo para probar.

## Generar instalador (.exe)

```powershell
# Requiere Inno Setup 6 instalado. Pipeline completo: tests + build + firma + instalador
.\scripts\build_release.ps1 -Version "2.5.0"
```

El .exe se genera con PyInstaller (`Helpmeet.spec`) y se empaqueta con Inno Setup
(`installer/Helpmeet.iss`).

## Sistema de licencias

Backend FastAPI en `helpmeet-licenses/`. Dos opciones de base de datos:

**SQLite** (desarrollo rapido, cero configuracion):
```bash
cd helpmeet-licenses
cp .env.example .env            # SQLite por defecto
alembic upgrade head
python seed_dev.py
uvicorn helpmeet_licenses.main:app --reload --port 8001
```

**PostgreSQL en Docker** (desarrollo completo):
```bash
cd helpmeet-licenses
docker compose up -d             # puerto 5436
# Cambiar .env: DATABASE_URL=postgresql://helpmeet:helpmeet_dev_2026@localhost:5436/helpmeet_licenses
alembic upgrade head
python seed_dev.py
uvicorn helpmeet_licenses.main:app --reload --port 8001
```

Panel de administracion en `admin-panel/` (puerto 8095).

## Pruebas

```powershell
pip install -r requirements-dev.txt
pytest -v --cov=helpmeet
```

## Transcripcion

La app usa **faster-whisper local** (offline, gratuito). La transcripcion cloud
(Replicate) esta deshabilitada en produccion. El modelo se descarga
automaticamente la primera vez (~500 MB).

## Licencia

Ver `LICENSE` y `licenses/THIRD_PARTY_LICENSES.md`.
