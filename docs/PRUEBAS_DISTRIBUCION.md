# Pruebas de distribución — Helpmeet (Fase 5)

Esta fase es **control de calidad**. Una parte está cubierta por pruebas
automáticas; el resto requiere **probar a mano en máquinas reales** y con
hardware variado, y no puede automatizarse desde el repositorio.

## Mediciones (build actual)

_Medido el 2026-06-24 en el equipo de desarrollo. El `.exe` empaquetado es
anterior a la optimización de arranque; recompílalo (`scripts\build_windows.ps1`)
para reflejarla y vuelve a medir en la máquina objetivo._

| Métrica | Valor |
|---|---|
| Tamaño en disco del build (`dist\Helpmeet`) | **261 MB** (862 archivos) |
| RAM en reposo (proceso principal) | **~129 MB** |
| Arranque — carga del código (fuente) | **~0,47 s** |
| Modelo Whisper (no incluido) | se descarga la 1.ª vez (~480 MB para `small`) |

> CPU: en reposo es prácticamente 0 %; durante la transcripción usa varios
> núcleos (CTranslate2). Medir en la máquina objetivo durante una transcripción
> real.

## Cubierto por pruebas automáticas ✅

- **Funcionamiento sin internet** — `tests/test_offline.py` (bloquea la red y
  verifica grabar→guardar→exportar y el diagnóstico).
- **Rutas con espacios y acentos** — `tests/test_paths_robustness.py` (exportar y
  borrar datos en carpetas con `áéíóú ñ` y espacios).
- **Recuperación tras cierre forzado** — `tests/test_recovery.py`.

## Pendiente: pruebas MANUALES (en máquinas reales)

Marca cada una al probarla:

### Sistemas
- [ ] Windows 10 x64.
- [ ] Windows 11 x64.
- [ ] Máquina **limpia**: sin Python, sin Git, sin herramientas de desarrollo.
- [ ] Usuario **sin permisos de administrador**.

### Audio
- [ ] Micrófono integrado.
- [ ] Micrófono **USB**.
- [ ] Micrófono **Bluetooth**.
- [ ] Dispositivo **sin loopback** (comprobar que avisa y graba al menos el micro).

### Pantalla
- [ ] Un solo monitor.
- [ ] Varios monitores.
- [ ] Monitores con **escalado DPI distinto** (100 % / 150 % / 200 %).

### Robustez
- [ ] **Grabación larga** (p. ej. 1–2 h): estabilidad, memoria y tamaño del archivo.
- [ ] Cierre forzado a mitad de grabación → recuperar al reabrir.
- [ ] Ruta de usuario con **espacios y acentos** (carpeta de exportación incluida).

### Rendimiento
- [ ] Tiempo de inicio del `.exe` (recompilado) en la máquina objetivo.
- [ ] RAM y CPU durante una transcripción real.
- [ ] Espacio en disco tras varias grabaciones.

## Cómo probar el build limpio

1. Genera el build: `scripts\build_windows.ps1`.
2. (Opcional) Genera el instalador: `scripts\build_installer.ps1`.
3. Copia `dist\Helpmeet\` o el instalador a una máquina **sin** Python.
4. Ejecútalo y recorre el diagnóstico (Bienvenida → Diagnóstico) para validar
   audio, disco, modelo y WebView2 antes de grabar.
