# Scripts

Herramientas de build, validacion y utilidades del proyecto Helpmeet.

## Build y release

- `build_dev.ps1` — Build rapido de desarrollo: solo PyInstaller, copia el .exe a `recursos/v{version}/`. Para pruebas locales sin esperar el pipeline completo.
- `build_release.ps1` — Pipeline completo: validacion + PyInstaller + Inno Setup + checksums. Usar antes de publicar una nueva version.
- `generate_checksums.ps1` — Genera archivo SHA256SUMS.txt con los hashes de todos los artefactos en `dist/`.

## Validacion

- `check_all.ps1` — Validacion completa: tests app + tests licencias + sintaxis JS + compilacion Python. Ejecutar antes de compilar.

## Utilidades

- `benchmark.py` — Benchmark de transcripcion. Mide velocidad de Whisper con diferentes modelos y configuraciones.
