# Helpmeet

App de escritorio que transcribe reuniones de Google Meet en vivo, las organiza por *iniciativa*, permite tomar capturas de pantalla ligadas a la transcripción, y exporta todo el contexto para Claude Code.

> Estado: **Fase 1** en construcción. Ver `docs/superpowers/specs/` (diseño) y `docs/superpowers/plans/` (plan de implementación).

## Requisitos

- Windows 10/11
- Python 3.12 (no usar la versión de Microsoft Store)

## Puesta en marcha

```powershell
# 1. Crear el entorno virtual (una sola vez)
py -3.12 -m venv .venv

# 2. Activar el entorno
.\.venv\Scripts\Activate.ps1

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Ejecutar la app
python -m helpmeet.main
```

## Pruebas

```powershell
pytest -v
```

## Cómo se organiza el código

| Carpeta | Responsabilidad |
|---|---|
| `helpmeet/db/` | Base de datos: modelos, conexión y operaciones (guardar/leer). |
| `helpmeet/transcription/` | Convierte audio en texto con faster-whisper. |
| `helpmeet/audio/` | Graba micrófono ("Yo") y audio del sistema ("Los demás"). |
| `helpmeet/screenshot/` | Captura de pantalla y atajo de teclado global. |
| `helpmeet/session/` | Orquesta una reunión: graba, transcribe y guarda. |
| `helpmeet/export/` | Genera la carpeta `.md` + imágenes para Claude Code. |
| `helpmeet/ui/` | La ventana de la app (pywebview). |
