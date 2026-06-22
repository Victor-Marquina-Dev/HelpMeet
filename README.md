# Helpmeet

App de escritorio que transcribe reuniones de Google Meet, las organiza por *iniciativa*, permite tomar capturas de pantalla y notas ligadas al momento exacto, y exporta todo el contexto en Markdown para Claude Code.

> Estado: **Fase 1 funcionando** + mejoras. Ver `docs/superpowers/specs/` (diseño) y `docs/superpowers/plans/` (planes).

## Características

- Transcripción del audio del sistema ("Los demás") y del micrófono ("Yo"), con **Whisper en la nube (Replicate)** o local (faster-whisper).
- Organización: Iniciativa → Reunión → Frases + Capturas + Notas, ancladas al minuto exacto.
- Búsqueda global en todas las reuniones; renombrar/mover con clic derecho.
- Exportación a Markdown (`contexto.md` + capturas), por reunión o iniciativa completa.
- Panel de ajustes ⚙️ para la API key y la carpeta de exportación.

## Requisitos

- Windows 10/11
- Python 3.12 (no usar la versión de Microsoft Store)

## Configuración

La transcripción en la nube usa [Replicate](https://replicate.com). Crea un archivo `.env`
en la raíz del proyecto con tu token (este archivo **no se sube al repositorio**):

```
REPLICATE_API_TOKEN=tu_token_aqui
```

También puedes pegar el token desde el panel de **Ajustes ⚙️** dentro de la app.

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
