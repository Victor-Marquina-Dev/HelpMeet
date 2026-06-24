# Plan de despliegue de Helpmeet para Windows

## Objetivo

Publicar Helpmeet como una aplicación instalable para Windows 10 y 11, sin exigir Python al usuario, sin perder reuniones durante actualizaciones y sin guardar secretos en texto plano.

Artefactos finales esperados:

- `Helpmeet.exe` dentro de una distribución portátil `onedir`.
- `Helpmeet-Setup-x64.exe` con instalador y desinstalador.
- Firma digital del ejecutable y del instalador.
- Actualizaciones que conserven `%LOCALAPPDATA%\Helpmeet`.
- Notas de versión, checksum y pruebas en un Windows limpio.

## Estado actual

### Fase 1 — Base instalable

- [x] Separar recursos del programa y datos persistentes.
- [x] Usar `%LOCALAPPDATA%\Helpmeet` para SQLite, ajustes, capturas y recuperación.
- [x] Migrar automáticamente la base y ajustes de la carpeta antigua.
- [x] Evitar duplicar exportaciones y temporales históricos de varios GB.
- [x] Guardar la API key en Credenciales de Windows.
- [x] Migrar y eliminar `api_token` de `settings.json`.
- [x] Añadir versión inicial `0.1.0`.
- [x] Añadir configuración inicial `Helpmeet.spec` para PyInstaller `onedir`.
- [x] Añadir script de compilación con pruebas previas.
- [x] Generar y validar el arranque del primer build portátil local (258.9 MB).
- [ ] Validar ese build en una máquina Windows limpia.

### Fase 2 — Primera ejecución

- [ ] Crear una pantalla de bienvenida y diagnóstico.
- [ ] Detectar WebView2 Runtime y ofrecer instalación si falta.
- [ ] Comprobar micrófono, WASAPI loopback y permisos.
- [ ] Mostrar espacio libre disponible antes de grabar.
- [ ] Descargar Whisper con progreso, reintento y cancelación.
- [ ] Permitir empezar con Replicate sin esperar la descarga local.
- [ ] Elegir carpeta de exportación inicial.
- [ ] Mostrar claramente cuándo el audio se procesa localmente o se envía a la nube.

### Fase 3 — Instalador

- [ ] Crear instalador con Inno Setup o MSIX.
- [ ] Instalar por usuario sin requerir privilegios de administrador.
- [ ] Crear accesos en Inicio y, opcionalmente, en el escritorio.
- [ ] Registrar el icono de Helpmeet y el identificador de aplicación.
- [ ] Incluir desinstalador.
- [ ] No eliminar los datos del usuario al desinstalar sin confirmación explícita.
- [ ] Añadir detección/instalación de WebView2 Evergreen Runtime.
- [ ] Probar actualización sobre una versión anterior.

### Fase 4 — Seguridad y privacidad

- [x] Retirar el token de Replicate del JSON.
- [ ] Añadir política de privacidad.
- [ ] Añadir aviso de consentimiento para grabaciones.
- [ ] Documentar qué información se envía a Replicate.
- [ ] Añadir opción para borrar todos los datos locales.
- [ ] Añadir exportación/copia de seguridad de la base.
- [ ] Revisar licencias de PyAV, FFmpeg, faster-whisper, CTranslate2 y demás dependencias.
- [ ] Evitar que logs o informes de error incluyan tokens o transcripciones.

### Fase 5 — Calidad de distribución

- [ ] Probar Windows 10 x64 y Windows 11 x64.
- [ ] Probar sin Python, Git ni herramientas de desarrollo instaladas.
- [ ] Probar micrófonos USB, Bluetooth y dispositivos sin loopback.
- [ ] Probar uno y varios monitores con escalado DPI diferente.
- [ ] Probar grabaciones largas y recuperación tras cierre forzado.
- [ ] Probar funcionamiento sin internet.
- [ ] Probar rutas con espacios, acentos y usuarios sin permisos administrativos.
- [ ] Medir tiempo de inicio, RAM, CPU y espacio en disco.

### Fase 6 — Publicación

- [ ] Elegir nombre del editor: `MimoTech`.
- [ ] Comprar certificado de firma de código.
- [ ] Firmar `Helpmeet.exe` y el instalador.
- [ ] Crear `CHANGELOG.md`, `LICENSE` y notas de versión.
- [ ] Generar SHA-256 de cada descarga.
- [ ] Crear una página oficial de descarga.
- [ ] Preparar canal estable y, si se necesita, canal beta.
- [ ] Implementar comprobación de actualizaciones firmadas.
- [ ] Configurar CI para compilar una versión desde cada tag.

## Estructura de datos después de la migración

```text
%LOCALAPPDATA%\Helpmeet\
├── helpmeet.sqlite
├── settings.json
├── captures\
├── recovery\
├── tmp_audio\
└── tmp_video\
```

Las exportaciones siguen la carpeta elegida por el usuario. En la migración inicial no se copian `exports/`, `captures/` ni temporales antiguos para evitar duplicar varios gigabytes. Las rutas históricas guardadas en SQLite continúan apuntando a sus archivos originales.

## Construir la versión portátil

```powershell
# Instalar herramientas de build una sola vez
.\.venv\Scripts\python.exe -m pip install -r requirements-build.txt

# Ejecutar pruebas y construir
.\scripts\build_windows.ps1
```

Salida prevista:

```text
dist\Helpmeet\Helpmeet.exe
```

No distribuir todavía esa carpeta sin completar la prueba en un Windows limpio. El primer build sirve para encontrar DLL o recursos que PyInstaller no haya incluido.

## Prueba de aceptación del build portátil

1. Copiar `dist\Helpmeet` a un equipo o máquina virtual limpia.
2. Confirmar que abre sin Python instalado.
3. Crear una iniciativa.
4. Grabar micrófono y audio del sistema durante al menos dos minutos.
5. Tomar una captura y una nota.
6. Detener y comprobar la transcripción.
7. Grabar pantalla y reproducir el MP4 resultante.
8. Cerrar forzosamente durante otra grabación y comprobar la recuperación.
9. Reiniciar Windows y comprobar persistencia de ajustes y reuniones.
10. Actualizar a un segundo build y confirmar que los datos permanecen intactos.

## Criterio para versión 1.0

Helpmeet estará lista para publicación cuando el instalador firmado pase toda la prueba de aceptación en Windows 10 y 11, preserve los datos al actualizar, no almacene secretos en texto plano y explique claramente el tratamiento local o remoto del audio.
