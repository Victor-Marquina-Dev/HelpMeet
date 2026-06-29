# Plan para habilitar Helpmeet en macOS

## Objetivo

Preparar Helpmeet para funcionar como aplicación de escritorio en macOS, distribuible fuera de la Mac App Store y vendible por Gumroad.

La meta no es solo “abrir la app en Mac”, sino dejarla lista para:

- grabar micrófono;
- capturar audio del sistema cuando sea posible;
- grabar pantalla;
- transcribir localmente;
- guardar datos en rutas correctas de macOS;
- empaquetar como `.app`;
- firmar;
- notarizar;
- distribuir como `.dmg` o `.pkg`;
- activar licencia/Product Key igual que en Windows.

---

## Conclusión rápida

Helpmeet sí puede llegar a macOS, pero no es una compilación directa del código actual.

Hay partes Windows-only que deben abstraerse o reemplazarse:

- `PyAudioWPatch` / WASAPI loopback.
- `gdigrab` de FFmpeg/PyAV.
- WebView2.
- Inno Setup.
- Windows Credential Manager.
- rutas `%LOCALAPPDATA%`.
- controles nativos de ventana estilo Windows.

El camino correcto es crear una arquitectura multiplataforma con adaptadores:

```text
helpmeet/platforms/
├── windows/
│   ├── audio.py
│   ├── screen.py
│   ├── secrets.py
│   └── packaging.md
└── macos/
    ├── audio.py
    ├── screen.py
    ├── secrets.py
    └── packaging.md
```

---

## Estado actual del proyecto frente a macOS

### Ya ayuda

- La UI está hecha en HTML/CSS/JS con `pywebview`.
- La lógica de base de datos y exportación es Python.
- La transcripción con `faster-whisper` puede funcionar en macOS si las dependencias están disponibles.
- Algunas funciones de abrir/revelar archivos ya contemplan `darwin`.
- El backend de licencias puede ser compartido entre Windows y Mac.

### Bloqueos actuales

| Área | Estado actual | Problema para macOS |
|---|---|---|
| Audio | `PyAudioWPatch` + WASAPI | WASAPI es Windows-only |
| Audio del sistema | loopback WASAPI | macOS requiere ScreenCaptureKit/Core Audio taps/driver virtual |
| Video pantalla | FFmpeg `gdigrab` | `gdigrab` es Windows-only |
| WebView | WebView2 | macOS usa WebKit/WKWebView |
| Instalador | Inno Setup | Windows-only |
| Secretos | Windows Credential Manager | macOS debe usar Keychain |
| Datos | `%LOCALAPPDATA%` | macOS usa `~/Library/Application Support` |
| Firma | Authenticode | macOS usa Developer ID + notarización |

---

## Decisión de distribución

Para Gumroad, lo recomendable es distribuir fuera de Mac App Store:

```text
Gumroad
  ↓
Descarga .dmg / .pkg
  ↓
Helpmeet.app firmada con Developer ID
  ↓
Notarizada por Apple
  ↓
Activación con Product Key
```

No recomiendo empezar con Mac App Store porque:

- la revisión puede ser más lenta;
- el sandbox complica captura de pantalla/audio;
- Gumroad no sería el canal principal de compra;
- la app necesita funciones sensibles: micrófono, pantalla, archivos locales.

---

## Fase 0 — Requisitos para desarrollar Mac

### Equipo necesario

- [ ] Mac real o Mac mini/CI macOS.
- [ ] macOS actualizado.
- [ ] Xcode o Xcode Command Line Tools.
- [ ] Python compatible con dependencias.
- [ ] Homebrew, recomendado.
- [ ] Apple Developer Program.

### Comandos base en Mac

```bash
xcode-select --install
python3 --version
xcrun notarytool --help
codesign --help
spctl --help
```

### Criterio de aceptación

- Se puede crear entorno virtual.
- Se pueden instalar dependencias Python.
- Se puede ejecutar una ventana mínima con `pywebview`.

---

## Fase 1 — Separar código multiplataforma

### Objetivo

Evitar condicionales sueltos por toda la app.

### Crear interfaces

```python
class AudioRecorder:
    def start(self): ...
    def stop(self): ...
    def set_mic_muted(self, muted: bool): ...

class ScreenRecorder:
    def start(self): ...
    def stop(self): ...
    def set_monitor(self, monitor): ...

class SecretStore:
    def get_secret(self, key: str) -> str: ...
    def set_secret(self, key: str, value: str) -> None: ...
    def delete_secret(self, key: str) -> None: ...
```

### Tareas

- [ ] Crear `helpmeet/platforms/__init__.py`.
- [ ] Mover implementación Windows a `helpmeet/platforms/windows/`.
- [ ] Crear stubs macOS en `helpmeet/platforms/macos/`.
- [ ] Reemplazar imports directos de `pyaudiowpatch`.
- [ ] Reemplazar uso directo de `gdigrab`.
- [ ] Centralizar rutas de datos por plataforma.
- [ ] Centralizar secret store por plataforma.

### Criterio de aceptación

- Windows sigue funcionando igual.
- macOS puede importar el proyecto sin fallar por `pyaudiowpatch`.
- Las dependencias Windows-only no se importan al arrancar en Mac.

---

## Fase 2 — Rutas correctas de macOS

### Objetivo

Usar convenciones nativas para datos, logs, caché y exportaciones.

### Rutas recomendadas

```text
~/Library/Application Support/Helpmeet/
├── helpmeet.sqlite
├── settings.json
├── captures/
├── recovery/
├── tmp_audio/
└── tmp_video/

~/Library/Logs/Helpmeet/
└── helpmeet.log

~/Library/Caches/Helpmeet/
└── models/
```

### Tareas

- [ ] Detectar `sys.platform == "darwin"`.
- [ ] Cambiar `DATA_DIR` en Mac a `~/Library/Application Support/Helpmeet`.
- [ ] Cambiar logs a `~/Library/Logs/Helpmeet`.
- [ ] Cambiar caché de modelos a una ruta controlada.
- [ ] Verificar migración desde rutas antiguas si aplica.

### Criterio de aceptación

- La app no crea carpetas tipo `AppData` en Mac.
- La app conserva reuniones entre cierres.
- La desinstalación manual no mezcla datos con el bundle `.app`.

---

## Fase 3 — WebView en Mac

### Objetivo

Que la UI cargue con `pywebview` usando WebKit/WKWebView.

### Diferencias frente a Windows

- No hay WebView2.
- No se debe mostrar diagnóstico de WebView2.
- Los controles de ventana estilo Windows deben adaptarse u ocultarse.
- La barra de título puede comportarse distinto.

### Tareas

- [ ] Probar `pywebview` en Mac.
- [ ] Detectar plataforma en bootstrap.
- [ ] Ocultar controles Windows:
  - minimizar;
  - maximizar;
  - cerrar custom;
  - resize custom si no aplica.
- [ ] Usar comportamiento nativo de ventana en Mac.
- [ ] Cambiar diagnóstico:
  - en Windows: WebView2;
  - en Mac: WebKit/pywebview.
- [ ] Revisar reproducción de video local en WebKit.

### Criterio de aceptación

- La UI abre en Mac sin mocks.
- Los botones no llaman métodos Windows-only.
- La app no muestra textos de WebView2.

---

## Fase 4 — Micrófono en macOS

### Objetivo

Grabar micrófono de forma nativa y pedir permiso correctamente.

### Opciones técnicas

#### Opción A — `sounddevice` / PortAudio

Ventajas:

- Python friendly.
- Multiplataforma.
- Puede reemplazar parte de PyAudio.

Desventajas:

- Hay que probar empaquetado.
- No resuelve por sí solo audio del sistema.

#### Opción B — PyAudio/CoreAudio

Ventajas:

- Similar al flujo actual.

Desventajas:

- Instalación en macOS puede ser más delicada.
- Audio del sistema sigue sin estar resuelto.

#### Opción C — AVFoundation / AVAudioEngine vía PyObjC

Ventajas:

- Nativo Apple.
- Mejor integración con permisos.

Desventajas:

- Más código específico macOS.
- Curva de aprendizaje mayor.

### Tareas

- [ ] Elegir implementación inicial de micrófono.
- [ ] Añadir `NSMicrophoneUsageDescription` al `Info.plist`.
- [ ] Solicitar permiso antes de grabar.
- [ ] Manejar caso “permiso denegado”.
- [ ] Mostrar botón para abrir configuración de privacidad.
- [ ] Probar micrófono interno, USB y Bluetooth.

### Criterio de aceptación

- macOS pide permiso de micrófono con texto claro.
- Si el permiso está denegado, Helpmeet lo explica.
- Se genera `me.wav` válido.

---

## Fase 5 — Audio del sistema en macOS

### Objetivo

Capturar “Los demás” en reuniones, equivalente al loopback WASAPI de Windows.

### Realidad técnica

En Windows el audio del sistema se captura con WASAPI loopback.

En macOS hay tres caminos:

#### Opción A — ScreenCaptureKit

Apple recomienda ScreenCaptureKit para captura de pantalla de alto rendimiento y audio en macOS.

Ventajas:

- Nativo.
- No requiere instalar drivers virtuales.
- Puede capturar pantalla y audio asociado.

Desventajas:

- Requiere permisos de grabación de pantalla.
- La integración desde Python puede requerir PyObjC o módulo nativo auxiliar.
- Hay que probar versiones de macOS.

#### Opción B — Core Audio Taps

Apple tiene APIs modernas para capturar audio del sistema con taps.

Ventajas:

- Enfoque más directo para audio.
- Puede servir para audio sin video.

Desventajas:

- Requiere macOS moderno.
- Requiere `NSAudioCaptureUsageDescription`.
- Probablemente conviene escribir un helper nativo Swift/Objective-C.

#### Opción C — Driver virtual como BlackHole

Ventajas:

- Más fácil técnicamente.
- Funciona con muchas apps de audio.

Desventajas:

- Mala experiencia comercial.
- Obliga al usuario a instalar/configurar otro componente.
- Más fricción para Gumroad.

### Recomendación

Para una versión comercial Mac:

1. MVP: micrófono + importación de video/audio.
2. Luego: grabación de pantalla con ScreenCaptureKit.
3. Después: audio del sistema con ScreenCaptureKit o Core Audio Taps.
4. Evitar depender de BlackHole salvo como modo avanzado temporal.

### Tareas

- [ ] Crear investigación técnica con prototipo aislado.
- [ ] Probar ScreenCaptureKit con audio del sistema.
- [ ] Probar Core Audio Taps si se necesita audio sin pantalla.
- [ ] Definir versión mínima de macOS.
- [ ] Añadir `NSAudioCaptureUsageDescription` si se usan Core Audio taps.
- [ ] Mostrar permisos requeridos antes de grabar.
- [ ] Si no hay audio del sistema, permitir grabar solo micrófono.

### Criterio de aceptación

- Helpmeet graba micrófono en Mac.
- Helpmeet informa claramente si el audio del sistema no está disponible.
- No se rompe la reunión si solo hay micrófono.

---

## Fase 6 — Grabación de pantalla en macOS

### Objetivo

Reemplazar `gdigrab` por una solución nativa Mac.

### Estado actual

La grabación de pantalla usa:

```text
av.open("desktop", format="gdigrab")
```

Eso es Windows-only.

### Opciones

#### Opción A — ScreenCaptureKit + helper nativo

Recomendado.

Crear un helper Swift/Objective-C que:

- liste pantallas/ventanas;
- capture pantalla;
- opcionalmente capture audio;
- escriba `.mp4`;
- comunique progreso a Python.

#### Opción B — FFmpeg `avfoundation`

Puede ser útil para prototipo.

Problemas:

- permisos;
- manejo de pantallas;
- audio del sistema limitado;
- experiencia menos controlada.

#### Opción C — `mss` para frames + PyAV para encoder

Puede servir para screenshots/preview.

Problemas:

- rendimiento inferior para video largo;
- permisos de pantalla;
- sincronización con audio.

### Tareas

- [ ] Definir implementación de screen recorder Mac.
- [ ] Listar pantallas.
- [ ] Seleccionar pantalla.
- [ ] Solicitar permiso de Screen Recording.
- [ ] Mostrar instrucciones si está denegado.
- [ ] Escribir `.mp4` recuperable.
- [ ] Probar grabación larga.
- [ ] Probar monitores Retina.
- [ ] Probar escalado/resolución.

### Criterio de aceptación

- Se graba pantalla en Mac.
- Se conserva audio si está disponible.
- Si falta permiso, la app lo explica.
- El MP4 se reproduce en QuickTime.

---

## Fase 7 — Permisos de macOS

### Permisos esperados

Helpmeet puede requerir:

- Micrófono.
- Screen Recording.
- Files and Folders, si el usuario elige carpetas externas.
- Accessibility, solo si en el futuro se capturan atajos globales o control de eventos.

### `Info.plist` mínimo

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Helpmeet usa el micrófono para grabar tus reuniones cuando tú lo solicitas.</string>

<key>NSAudioCaptureUsageDescription</key>
<string>Helpmeet captura audio del sistema para transcribir lo que escuchas durante una reunión.</string>
```

Nota:

- `NSAudioCaptureUsageDescription` aplica si se usan APIs modernas de captura de audio del sistema.
- La captura de pantalla requiere que el usuario habilite Screen Recording en Ajustes del Sistema.

### Tareas

- [ ] Crear `Info.plist` para macOS.
- [ ] Añadir textos claros de permisos.
- [ ] Mostrar diagnóstico de permisos.
- [ ] Agregar botones/instrucciones:
  - abrir Ajustes del Sistema;
  - reintentar comprobación.
- [ ] Documentar permisos en la guía de instalación Mac.

### Criterio de aceptación

- La app no crashea por falta de usage descriptions.
- Los permisos se explican antes de pedirlos.
- El diagnóstico identifica permisos faltantes.

---

## Fase 8 — Secretos y licencias en macOS

### Objetivo

Guardar Product Key/token de licencia de forma segura.

### Estado actual

Windows usa Credential Manager.

macOS debe usar Keychain.

### Opciones

- Usar librería `keyring`.
- Implementar wrapper con `security` CLI.
- Implementar wrapper con Keychain APIs vía PyObjC.

### Recomendación

Para MVP:

- usar `keyring` si empaqueta bien;
- si falla, wrapper con `/usr/bin/security`.

### Tareas

- [ ] Crear `helpmeet/platforms/macos/secrets.py`.
- [ ] Guardar token de licencia en Keychain.
- [ ] Guardar API keys en Keychain.
- [ ] Mantener fallback controlado solo para desarrollo.
- [ ] Migrar desde `settings.json` si existiera.

### Criterio de aceptación

- El token no queda en texto plano.
- La app recuerda licencia tras reiniciar.
- La desactivación borra el token del Keychain.

---

## Fase 9 — Dependencias macOS

### Problemas esperados

Algunas dependencias actuales pueden no instalar igual en Mac:

- `PyAudioWPatch` no aplica.
- `av` puede requerir wheels compatibles.
- `ctranslate2` debe probarse en Apple Silicon.
- `faster-whisper` debe probarse en arm64.
- `pynput` puede requerir permisos de Accessibility.

### Separar requirements

Crear:

```text
requirements/base.txt
requirements/windows.txt
requirements/macos.txt
requirements/build-windows.txt
requirements/build-macos.txt
```

Ejemplo:

```text
base:
  faster-whisper
  SQLAlchemy
  pywebview
  numpy
  av

windows:
  PyAudioWPatch

macos:
  pyobjc
  keyring
  sounddevice
```

### Tareas

- [ ] Separar dependencias por plataforma.
- [ ] Validar instalación en Mac Intel.
- [ ] Validar instalación en Apple Silicon.
- [ ] Decidir si se entrega universal2 o builds separados.

### Criterio de aceptación

- `pip install` funciona en Mac.
- La app arranca sin instalar dependencias Windows.

---

## Fase 10 — Empaquetado `.app`

### Objetivo

Crear `Helpmeet.app`.

### Opciones

#### Opción A — PyInstaller

Ventajas:

- Ya se usa en Windows.
- Permite mantener stack actual.

Desventajas:

- Firma/notarización puede requerir ajustes por librerías embebidas.

#### Opción B — py2app

Ventajas:

- Históricamente usado para `.app`.

Desventajas:

- Puede requerir más trabajo con dependencias modernas.

### Recomendación

Empezar con PyInstaller en Mac y ajustar firma/notarización.

### Crear spec Mac

```text
Helpmeet-macos.spec
```

Debe incluir:

- assets web;
- icono `.icns`;
- `Info.plist`;
- dependencias Python;
- exclusiones de Windows;
- bundle identifier:

```text
com.mimotech.helpmeet
```

### Criterio de aceptación

- `dist/Helpmeet.app` abre desde Finder.
- La app muestra icono correcto.
- La app conserva datos.
- La app puede activar licencia.

---

## Fase 11 — Firma, Hardened Runtime y notarización

### Objetivo

Que macOS permita abrir Helpmeet sin bloquearlo por Gatekeeper.

### Requisitos

- Apple Developer Program.
- Certificado `Developer ID Application`.
- Xcode Command Line Tools.
- Firma con Hardened Runtime.
- Notarización con `notarytool`.
- Stapling con `stapler`.

### Flujo esperado

```bash
codesign --deep --force --options runtime \
  --sign "Developer ID Application: MimoTech (...)" \
  dist/Helpmeet.app

ditto -c -k --keepParent dist/Helpmeet.app Helpmeet.zip

xcrun notarytool submit Helpmeet.zip \
  --keychain-profile helpmeet-notary \
  --wait

xcrun stapler staple dist/Helpmeet.app

spctl --assess --type execute --verbose dist/Helpmeet.app
```

### Entitlements posibles

Crear:

```text
entitlements.plist
```

Con lo mínimo necesario.

Ejemplos a evaluar:

```xml
<key>com.apple.security.device.audio-input</key>
<true/>
```

Solo añadir excepciones de Hardened Runtime si notarización o runtime lo exige.

No abrir permisos de más sin necesidad.

### Criterio de aceptación

- `codesign --verify` pasa.
- `notarytool` devuelve Accepted.
- `stapler` aplica ticket.
- `spctl` acepta la app.
- La app abre en otro Mac sin advertencia grave.

---

## Fase 12 — Crear `.dmg` o `.pkg`

### Opción recomendada para Gumroad

Usar `.dmg`:

```text
Helpmeet-1.2.7-mac-arm64.dmg
Helpmeet-1.2.7-mac-universal.dmg
```

Ventajas:

- Familiar para usuarios Mac.
- Arrastrar a Applications.
- Fácil de subir a Gumroad.

### Alternativa

Usar `.pkg` si se necesita:

- instalar helpers;
- instalar componentes adicionales;
- configurar servicios.

Para el MVP, evitar `.pkg` salvo que sea necesario.

### Tareas

- [ ] Crear `.icns`.
- [ ] Crear DMG con fondo simple.
- [ ] Incluir enlace a Applications.
- [ ] Firmar DMG si aplica.
- [ ] Notarizar DMG.
- [ ] Generar SHA-256.

### Criterio de aceptación

- El usuario abre DMG.
- Arrastra Helpmeet a Applications.
- Helpmeet abre correctamente.
- Gatekeeper no bloquea la app notarizada.

---

## Fase 13 — Licencias/Product Keys en Mac

### Objetivo

Que la licencia de Gumroad funcione igual en Mac y Windows.

### Tareas

- [ ] Enviar `os: "macOS"` al activar licencia.
- [ ] Generar device ID estable en Mac.
- [ ] Evitar usar solo hostname.
- [ ] Guardar activación en Keychain.
- [ ] Validar offline limitado.
- [ ] Mostrar estado de licencia en Ajustes.

### Device ID recomendado

Generar un UUID local al primer arranque y guardarlo en Keychain/Application Support.

No depender únicamente de hardware real porque Apple puede limitar acceso a identificadores.

### Criterio de aceptación

- Una licencia activa en Mac se ve en el panel admin.
- Se puede revocar.
- Se puede resetear dispositivo.
- El límite de dispositivos cuenta Mac y Windows.

---

## Fase 14 — Diagnóstico Mac

### Objetivo

Reemplazar el diagnóstico Windows por uno multiplataforma.

### Diagnóstico en Mac

Debe mostrar:

- versión macOS;
- arquitectura: arm64/x86_64;
- espacio en disco;
- carpeta de datos;
- modelo de transcripción;
- permiso de micrófono;
- permiso de screen recording;
- estado de Keychain;
- estado de licencia;
- versión de pywebview/WebKit si es posible.

### Criterio de aceptación

- El usuario entiende qué falta para grabar.
- La app no muestra “WebView2” en Mac.
- La app puede guiar al usuario a permisos.

---

## Fase 15 — Pruebas obligatorias en Mac

### Hardware

- [ ] Mac Apple Silicon.
- [ ] Mac Intel, si se va a soportar.
- [ ] Micrófono interno.
- [ ] Micrófono USB.
- [ ] AirPods/Bluetooth.
- [ ] Monitor externo.
- [ ] Retina scaling.

### Sistema

- [ ] macOS versión mínima definida.
- [ ] macOS actual.
- [ ] Usuario sin herramientas de desarrollo.
- [ ] App descargada desde navegador.

### Funcionalidad

- [ ] Crear iniciativa.
- [ ] Grabar micrófono.
- [ ] Importar video.
- [ ] Transcribir video.
- [ ] Exportar `.md`.
- [ ] Abrir carpeta.
- [ ] Activar licencia.
- [ ] Revocar licencia.
- [ ] Offline limitado.
- [ ] Recuperación tras cierre inesperado.

### Pantalla/audio

- [ ] Grabar pantalla.
- [ ] Grabar pantalla con permiso denegado.
- [ ] Grabar pantalla con permiso concedido.
- [ ] Audio sistema disponible.
- [ ] Audio sistema no disponible.

### Distribución

- [ ] Abrir `.app` desde Finder.
- [ ] Abrir `.app` desde Applications.
- [ ] Abrir desde DMG.
- [ ] `spctl` acepta la app.
- [ ] App notarizada abre en Mac limpio.

---

## Fase 16 — Orden recomendado de implementación

### Bloque 1 — Preparar arquitectura

1. Separar dependencias por plataforma.
2. Crear capa `platforms`.
3. Mover Windows sin romperlo.
4. Crear stubs Mac.

### Bloque 2 — Arranque Mac

5. Crear rutas macOS.
6. Crear Keychain store.
7. Hacer que pywebview abra la UI en Mac.
8. Ocultar controles Windows-only.

### Bloque 3 — Funciones base

9. Activación de licencia en Mac.
10. Importar video/audio.
11. Transcripción local.
12. Exportar `.md`.

### Bloque 4 — Grabación

13. Micrófono Mac.
14. Diagnóstico de permisos.
15. Grabación de pantalla Mac.
16. Audio del sistema Mac.

### Bloque 5 — Distribución

17. Crear `.app`.
18. Firmar.
19. Notarizar.
20. Crear `.dmg`.
21. Probar en Mac limpio.
22. Subir a Gumroad.

---

## MVP Mac recomendado

Para sacar una primera versión Mac sin atascarse:

### Incluir

- Abrir app.
- Crear iniciativas/reuniones.
- Importar audio/video.
- Transcribir localmente.
- Exportar contexto.
- Activar licencia.
- Guardar token en Keychain.
- Micrófono, si se logra estable.

### Dejar para fase 2

- Audio del sistema nativo.
- Grabación de pantalla avanzada.
- Ajuste tipo OBS.
- Multi-monitor avanzado.
- Hotkeys globales.

### Por qué

Audio del sistema y pantalla en macOS son las partes más delicadas por permisos y APIs nativas. Conviene entregar primero una versión útil y estable antes de prometer paridad total con Windows.

---

## Definición de “Helpmeet habilitado para Mac”

La versión Mac estará lista cuando:

- [ ] La app abre como `.app`.
- [ ] Usa rutas correctas de macOS.
- [ ] Guarda secretos en Keychain.
- [ ] Activa licencias.
- [ ] Importa y transcribe videos.
- [ ] Exporta contexto.
- [ ] Pide permisos correctamente.
- [ ] Maneja permiso denegado sin romperse.
- [ ] Está firmada con Developer ID.
- [ ] Está notarizada por Apple.
- [ ] Se distribuye como `.dmg`.
- [ ] Abre en Mac limpio.
- [ ] Tiene guía de instalación Mac.
- [ ] Gumroad entrega instalador Mac y Product Key.

---

## Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---:|---|
| Audio del sistema no equivalente a WASAPI | Alto | Prototipo ScreenCaptureKit/Core Audio taps antes de prometer función |
| PyInstaller + notarización falla por binarios sin firmar | Alto | Firmar todos los binarios embebidos y revisar log de notarytool |
| Dependencias no tienen wheels arm64 | Alto | Probar Apple Silicon temprano |
| Permisos de micrófono/pantalla confunden al usuario | Alto | Diagnóstico guiado y documentación |
| App crashea por falta de Info.plist | Alto | Añadir usage descriptions desde el primer build |
| Gumroad entrega binario no notarizado | Alto | Subir solo DMG final firmado/notarizado |
| Mantener Windows y Mac duplica lógica | Medio | Adaptadores por plataforma |

---

## Archivos nuevos sugeridos

```text
requirements/
├── base.txt
├── windows.txt
├── macos.txt
├── build-windows.txt
└── build-macos.txt

helpmeet/platforms/
├── __init__.py
├── windows/
│   ├── audio.py
│   ├── screen.py
│   └── secrets.py
└── macos/
    ├── audio.py
    ├── screen.py
    └── secrets.py

packaging/macos/
├── Helpmeet-macos.spec
├── Info.plist
├── entitlements.plist
├── build_macos.sh
├── sign_macos.sh
├── notarize_macos.sh
└── create_dmg.sh

docs/
└── GUIA_INSTALACION_MACOS.md
```

---

## Comandos esperados de release Mac

```bash
# build
./packaging/macos/build_macos.sh

# firma
./packaging/macos/sign_macos.sh

# notarización
./packaging/macos/notarize_macos.sh

# dmg
./packaging/macos/create_dmg.sh

# verificación
spctl --assess --type execute --verbose dist/Helpmeet.app
codesign --verify --deep --strict --verbose=2 dist/Helpmeet.app
```

---

## Fuentes técnicas oficiales

- Apple Developer — Notarizing macOS software before distribution: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple Developer — Hardened Runtime: https://developer.apple.com/documentation/security/hardened-runtime
- Apple Developer — ScreenCaptureKit: https://developer.apple.com/documentation/screencapturekit/
- Apple Developer — Capturing screen content in macOS: https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos
- Apple Developer — Requesting authorization to capture and save media: https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media
- Apple Developer — NSMicrophoneUsageDescription: https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription
- Apple Developer — Capturing system audio with Core Audio taps: https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps
- Xcode man page — notarytool: https://keith.github.io/xcode-man-pages/notarytool.1.html
- Xcode man page — codesign: https://keith.github.io/xcode-man-pages/codesign.1.html
- Xcode man page — spctl: https://keith.github.io/xcode-man-pages/spctl.8.html

---

## Recomendación final

No intentes hacer Mac al final como “build extra”.

Para que salga bien, Helpmeet debe volverse multiplataforma desde la arquitectura:

1. separar plataforma;
2. dejar Windows funcionando;
3. arrancar UI en Mac;
4. resolver rutas/Keychain/licencia;
5. luego audio/pantalla;
6. finalmente firma/notarización/DMG.

La versión Mac puede venderse por Gumroad, pero solo cuando el `.dmg` esté firmado, notarizado y probado en un Mac limpio.
