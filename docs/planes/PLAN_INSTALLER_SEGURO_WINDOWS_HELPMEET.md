# Plan para que el instalador de Helpmeet se vea seguro en Windows

## Objetivo

Preparar Helpmeet para que el instalador y la aplicación transmitan confianza al usuario final y reduzcan al máximo advertencias de Windows, navegador, antivirus y SmartScreen.

Importante:

> No existe un botón para que Windows diga “completamente seguro” desde el primer día.  
> Lo que sí se puede lograr es: firma digital válida, editor visible, instalador limpio, hash verificable, baja tasa de falsos positivos, permisos mínimos, documentación clara y reputación acumulada con el tiempo.

---

## Estado actual de Helpmeet

### Ya está bien encaminado

- El instalador usa Inno Setup.
- El instalador define editor como `MimoTech`.
- La instalación es por usuario y no requiere administrador por defecto.
- Los datos del usuario se guardan fuera de la carpeta del programa.
- La desinstalación no borra datos sin confirmación.
- Se detecta/instala WebView2 Evergreen Runtime si falta.
- Existe política de privacidad.
- Existe documentación de licencias de terceros.
- Existe script para generar SHA-256.
- La app ya evita guardar la API key de Replicate en texto plano.

### Falta para verse profesional/confiable

- Firma digital del `.exe`.
- Firma digital del instalador.
- Timestamp de firma.
- Certificado de firma de código.
- Metadatos completos del ejecutable.
- Prueba del instalador en Windows limpio.
- Validación con Microsoft Defender/SmartScreen.
- Publicación desde una fuente oficial HTTPS.
- Licencias de terceros incluidas dentro del instalador.
- Checklist de privacidad y permisos antes de vender.

---

## Qué ve Windows cuando un instalador no está listo

Si el instalador no está firmado o no tiene reputación, Windows puede mostrar:

- “Editor desconocido”.
- “Windows protegió su PC”.
- “Esta aplicación no se descarga comúnmente”.
- Advertencias del navegador.
- Alertas de antivirus por empaquetado con PyInstaller.

Eso no significa automáticamente que Helpmeet sea malware. Pero para un cliente, visualmente se siente inseguro.

---

## Meta visual para el usuario

Cuando el usuario instale Helpmeet, debería ver:

- Editor: `MimoTech`.
- Archivo firmado digitalmente.
- Instalador descargado desde una página oficial.
- Hash SHA-256 publicado.
- Guía de instalación clara.
- Política de privacidad clara.
- Permisos explicados:
  - micrófono;
  - audio del sistema;
  - pantalla;
  - almacenamiento local.

---

## Fase 1 — Firma digital

### Objetivo

Que Windows pueda verificar que el instalador realmente viene de MimoTech y que no fue modificado.

### Opciones

#### Opción A — Microsoft Trusted Signing / Artifact Signing

Ventajas:

- Servicio moderno de Microsoft.
- Integrable con CI/CD.
- No requiere manejar token físico.
- Costo mensual relativamente bajo.

Desventajas:

- Requiere validación de identidad.
- Aun con firma, SmartScreen puede tardar en generar reputación.

#### Opción B — Certificado OV Code Signing

Ventajas:

- Opción clásica.
- Muestra editor verificado.
- Sirve para firmar `.exe` e instalador.

Desventajas:

- SmartScreen puede seguir mostrando advertencia al inicio.
- Requiere construir reputación.

#### Opción C — Certificado EV Code Signing

Ventajas:

- Históricamente ayudaba más con SmartScreen.
- Mayor confianza empresarial.

Desventajas:

- Más caro.
- Validación más estricta.
- Hoy no garantiza eliminar SmartScreen de inmediato; la reputación sigue siendo un factor separado.

### Tareas

- [ ] Elegir proveedor de firma.
- [ ] Validar identidad de MimoTech.
- [ ] Obtener certificado o servicio de firma.
- [ ] Instalar Windows SDK para usar `signtool`.
- [ ] Firmar `Helpmeet.exe`.
- [ ] Firmar `Helpmeet-Setup-x64.exe`.
- [ ] Agregar timestamp.
- [ ] Verificar firma después de firmar.

### Comandos base

Firmar:

```powershell
signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /a "dist\Helpmeet\Helpmeet.exe"
signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /a "dist\installer\Helpmeet-Setup-1.2.7.exe"
```

Verificar:

```powershell
signtool verify /pa /v "dist\Helpmeet\Helpmeet.exe"
signtool verify /pa /v "dist\installer\Helpmeet-Setup-1.2.7.exe"
```

### Criterio de aceptación

- Windows muestra editor/publisher válido.
- `signtool verify` pasa correctamente.
- La firma incluye timestamp.
- El instalador no aparece como “Editor desconocido”.

---

## Fase 2 — Timestamp obligatorio

### Objetivo

Que la firma siga siendo válida incluso cuando el certificado expire.

### Por qué importa

Sin timestamp, cuando el certificado expire, Windows puede dejar de considerar válida la firma antigua.

Con timestamp, se demuestra que el archivo fue firmado cuando el certificado todavía era válido.

### Tareas

- [ ] Usar siempre `/tr` y `/td SHA256`.
- [ ] Verificar que la firma incluya timestamp.
- [ ] Documentar el servidor TSA usado.

### Criterio de aceptación

- `signtool verify /pa /v` muestra firma válida.
- La firma no depende únicamente de la vigencia futura del certificado.

---

## Fase 3 — Firmar desde Inno Setup

### Objetivo

Automatizar la firma del instalador para no olvidar firmar builds.

### Cambios recomendados en `installer/Helpmeet.iss`

Agregar configuración de firma:

```ini
[Setup]
SignTool=helpmeet_sign $f
SignedUninstaller=yes
```

Y compilar Inno Setup con una herramienta de firma configurada.

Ejemplo conceptual:

```powershell
iscc `
  /DMyAppVersion=1.2.7 `
  /Shelpmeet_sign="signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /a $f" `
  installer\Helpmeet.iss
```

### Tareas

- [ ] Firmar instalador automáticamente.
- [ ] Firmar desinstalador generado por Inno.
- [ ] Validar que el archivo final conserva la firma.

### Criterio de aceptación

- El instalador final queda firmado sin paso manual adicional.
- El desinstalador también queda firmado.

---

## Fase 4 — Metadatos profesionales del ejecutable

### Problema

El instalador tiene `AppPublisher=MimoTech`, pero el `.exe` generado por PyInstaller también debe tener metadatos propios.

### Agregar al ejecutable

- ProductName: `Helpmeet`
- CompanyName: `MimoTech`
- FileDescription: `Helpmeet`
- FileVersion: versión real
- ProductVersion: versión real
- LegalCopyright
- OriginalFilename: `Helpmeet.exe`

### Tareas

- [ ] Crear archivo de versión para PyInstaller.
- [ ] Conectar ese archivo en `Helpmeet.spec`.
- [ ] Confirmar en propiedades del `.exe`:
  - Detalles;
  - Firma digital;
  - Nombre del producto;
  - Editor.

### Criterio de aceptación

Al hacer clic derecho sobre `Helpmeet.exe` → Propiedades:

- aparece MimoTech;
- aparece versión correcta;
- aparece firma digital;
- no se ve como ejecutable genérico.

---

## Fase 5 — Reducir falsos positivos de antivirus

### Riesgo

Las apps empaquetadas con PyInstaller pueden disparar falsos positivos, especialmente si:

- están comprimidas con UPX;
- incluyen binarios grandes;
- crean procesos ocultos;
- descargan componentes;
- acceden a micrófono/pantalla;
- no están firmadas.

### Recomendaciones

- [ ] Evaluar desactivar UPX si genera falsos positivos.
- [ ] Firmar todos los `.exe` principales.
- [ ] Evitar scripts temporales extraños.
- [ ] No escribir archivos ejecutables en carpetas temporales salvo que sea necesario.
- [ ] No descargar binarios propios sin firma.
- [ ] Mantener WebView2 usando URL oficial de Microsoft.
- [ ] No ofuscar el código.
- [ ] No empaquetar dependencias innecesarias.
- [ ] Mantener logs limpios, sin secretos.
- [ ] Evitar comportamiento de “auto-update” sin firma.

### Archivos a revisar

- `Helpmeet.spec`
- `installer/Helpmeet.iss`
- scripts de build
- carpetas temporales generadas

### Criterio de aceptación

- Microsoft Defender no detecta amenazas.
- El instalador firmado no es bloqueado por comportamiento sospechoso.
- Si aparece alerta, se puede explicar técnicamente y corregir.

---

## Fase 6 — Reputación SmartScreen

### Punto clave

SmartScreen no solo mira si el archivo está firmado. También evalúa reputación del archivo, certificado, editor y comportamiento de descarga.

Un instalador nuevo puede mostrar advertencia aunque esté firmado.

### Qué ayuda

- Firma digital válida.
- Publisher consistente.
- Descarga desde dominio oficial HTTPS.
- Mismo certificado usado en cada release.
- Builds reproducibles y sin cambios innecesarios.
- Usuarios reales instalando sin reportes negativos.
- No cambiar de certificado innecesariamente.

### Qué no garantiza solución inmediata

- Firmar una vez.
- Subir a Gumroad sin reputación previa.
- Cambiar el nombre del archivo en cada prueba.
- Distribuir por enlaces raros o temporales.

### Tareas

- [ ] Firmar desde el primer release público.
- [ ] Mantener nombre de instalador consistente:

```txt
Helpmeet-Setup-1.2.7.exe
```

- [ ] Publicar desde URL oficial.
- [ ] Evitar builds públicos sin firma.
- [ ] Mantener certificado estable.
- [ ] Pedir a primeros usuarios descargar desde la página oficial, no reenviar instaladores por WhatsApp/Drive sin contexto.

### Criterio de aceptación

- El archivo firmado muestra editor correcto.
- Si aparece SmartScreen, el mensaje ya no dice “Editor desconocido”.
- Con descargas limpias, la reputación mejora progresivamente.

---

## Fase 7 — Página de descarga confiable

### Objetivo

Que el usuario no descargue Helpmeet desde un enlace sospechoso.

### Recomendado

Crear una página simple:

```txt
https://helpmeet.app/download
```

Debe incluir:

- Nombre del producto.
- Editor: MimoTech.
- Versión actual.
- Botón de descarga.
- SHA-256.
- Fecha de publicación.
- Changelog.
- Guía de instalación.
- Política de privacidad.
- Contacto de soporte.

### Para Gumroad

Gumroad puede vender el producto, pero conviene que la página de descarga o documentación oficial también exista.

El comprador debe poder verificar:

- qué archivo descargó;
- quién lo publicó;
- cómo se activa;
- qué permisos usa.

### Criterio de aceptación

- El usuario tiene una fuente oficial clara.
- El hash publicado coincide con el archivo descargado.
- No parece un instalador suelto sin contexto.

---

## Fase 8 — Checksums y verificación

### Objetivo

Permitir que un usuario técnico o empresa pueda verificar que el instalador no fue alterado.

### Tareas

- [ ] Generar SHA-256 después de firmar.
- [ ] Publicar `SHA256SUMS.txt`.
- [ ] Incluir comando de verificación:

```powershell
Get-FileHash .\Helpmeet-Setup-1.2.7.exe -Algorithm SHA256
```

- [ ] No cambiar el archivo después de publicar el hash.

### Criterio de aceptación

- El hash publicado coincide con el instalador firmado.
- El archivo no se modifica después de generar checksum.

---

## Fase 9 — Privacidad y permisos

### Objetivo

Que Helpmeet no parezca invasivo.

Como Helpmeet graba audio, pantalla y transcribe reuniones, debe explicar muy bien qué hace.

### Ya existe

- Política de privacidad.
- Consentimiento de grabación.
- Procesamiento local documentado.

### Falta revisar

- [ ] Que el primer uso explique:
  - qué se graba;
  - dónde se guarda;
  - que la transcripción es local;
  - que el usuario controla la carpeta de exportación.
- [ ] Que la app no suba transcripciones sin permiso.
- [ ] Que el backend de licencias no reciba transcripciones.
- [ ] Que los logs no incluyan audio, transcripciones ni Product Keys completas.
- [ ] Que la app permita borrar datos locales.
- [ ] Que la app permita hacer copia de seguridad.

### Criterio de aceptación

Un usuario puede responder:

- qué datos guarda Helpmeet;
- dónde se guardan;
- qué sale del equipo;
- cómo borrar sus datos.

---

## Fase 10 — Licencias de terceros

### Objetivo

Evitar problemas legales y mejorar confianza.

### Pendiente actual importante

El documento de licencias indica que antes de publicar se deben incluir los textos completos de licencias, especialmente:

- FFmpeg/PyAV;
- faster-whisper;
- CTranslate2;
- pywebview;
- PyInstaller;
- dependencias relevantes.

### Tareas

- [ ] Generar reporte de licencias:

```powershell
pip install pip-licenses
pip-licenses --format=markdown --with-urls --order=license
```

- [ ] Crear carpeta:

```txt
licenses/
```

- [ ] Incluir textos completos.
- [ ] Confirmar si FFmpeg/PyAV está bajo LGPL o GPL según build usado.
- [ ] Incluir acceso a licencias desde Ajustes o carpeta instalada.

### Criterio de aceptación

- El instalador incluye licencias requeridas.
- No hay dependencia GPL inesperada que obligue a cambiar distribución.
- El usuario/empresa puede auditar dependencias.

---

## Fase 11 — Actualizaciones seguras

### Objetivo

Evitar que una futura actualización se convierta en vector de riesgo.

### Reglas

- No descargar actualizaciones sin firma.
- No ejecutar binarios descargados sin verificar firma.
- No reemplazar archivos críticos si la firma no es válida.
- Mantener datos del usuario en `%LOCALAPPDATA%\Helpmeet`.

### Tareas

- [ ] No implementar auto-update hasta tener firma.
- [ ] Si se implementa actualización:
  - validar firma;
  - validar hash;
  - descargar solo por HTTPS;
  - permitir rollback;
  - conservar datos.

### Criterio de aceptación

- Una actualización no puede instalar binarios no firmados.
- Una actualización fallida no borra datos.

---

## Fase 12 — Pruebas de seguridad del instalador

### Pruebas locales

- [ ] Instalar en Windows 10 limpio.
- [ ] Instalar en Windows 11 limpio.
- [ ] Instalar sin Python.
- [ ] Instalar sin Git.
- [ ] Instalar como usuario sin admin.
- [ ] Desinstalar y confirmar que pregunta antes de borrar datos.
- [ ] Reinstalar y confirmar que conserva datos.
- [ ] Actualizar de una versión anterior.

### Pruebas de firma

- [ ] Verificar firma del `.exe`.
- [ ] Verificar firma del instalador.
- [ ] Verificar firma del desinstalador.
- [ ] Verificar timestamp.

### Pruebas de antivirus

- [ ] Microsoft Defender.
- [ ] Windows Security Smart App Control si aplica.
- [ ] VirusTotal solo como referencia, no como garantía.
- [ ] Si aparece falso positivo, revisar:
  - UPX;
  - archivos temporales;
  - dependencias empaquetadas;
  - falta de firma;
  - comportamiento de descarga.

### Criterio de aceptación

- Instalación limpia.
- Sin alertas graves de Defender.
- Firma válida.
- Datos preservados.
- Permisos explicados.

---

## Fase 13 — Cambios concretos recomendados en Helpmeet

### En `Helpmeet.spec`

- [ ] Agregar recurso de versión.
- [ ] Evaluar `upx=False` si causa falsos positivos.
- [ ] Excluir dependencias innecesarias.
- [ ] Confirmar que no se empaquetan tests ni archivos de desarrollo.

### En `installer/Helpmeet.iss`

- [ ] Agregar firma automática.
- [ ] Agregar `SignedUninstaller=yes`.
- [ ] Verificar nombre/versionado del instalador.
- [ ] Incluir licencias de terceros.
- [ ] Incluir enlaces oficiales de soporte/privacidad si se desea.

### En scripts

- [ ] Script `build_release.ps1`:
  1. limpiar build;
  2. ejecutar tests;
  3. compilar;
  4. firmar exe;
  5. crear instalador;
  6. firmar instalador;
  7. verificar firmas;
  8. generar SHA-256;
  9. crear carpeta release.

### En la app

- [ ] Mostrar versión real.
- [ ] Mostrar estado de licencia.
- [ ] Mostrar privacidad/resumen de datos.
- [ ] Confirmar que no hay secretos en logs.
- [ ] Confirmar que el token de licencia no queda en texto plano.
- [ ] Confirmar que el borrado de datos requiere confirmación.

---

## Orden recomendado de implementación

1. Agregar metadatos profesionales al `.exe`.
2. Preparar firma digital.
3. Automatizar firma de `.exe` e instalador.
4. Incluir timestamp.
5. Firmar desinstalador.
6. Generar hash después de firmar.
7. Incluir licencias de terceros.
8. Probar Windows limpio.
9. Revisar falsos positivos.
10. Publicar desde fuente oficial/Gumroad.

---

## Checklist de “instalador confiable”

Antes de vender, todo esto debe estar marcado:

- [ ] `Helpmeet.exe` firmado.
- [ ] Instalador firmado.
- [ ] Desinstalador firmado.
- [ ] Firma con timestamp.
- [ ] Publisher visible como `MimoTech`.
- [ ] Metadatos del `.exe` completos.
- [ ] Instalador no pide admin por defecto.
- [ ] Instalador conserva datos al actualizar.
- [ ] Desinstalador pregunta antes de borrar datos.
- [ ] SHA-256 generado después de firmar.
- [ ] Guía de instalación disponible.
- [ ] Política de privacidad disponible.
- [ ] Licencias de terceros incluidas.
- [ ] WebView2 instalado desde fuente oficial.
- [ ] Probado en Windows 10 limpio.
- [ ] Probado en Windows 11 limpio.
- [ ] Probado sin Python instalado.
- [ ] Microsoft Defender no detecta amenaza.
- [ ] SmartScreen muestra publisher si aparece advertencia.
- [ ] Archivo distribuido desde página/Gumroad oficial.

---

## Qué falta específicamente en Helpmeet

### Crítico

- Firma digital.
- Timestamp.
- Certificado/servicio de firma.
- Metadatos profesionales del `.exe`.
- Prueba en Windows limpio.
- Licencias completas de terceros dentro del instalador.

### Alto

- Firma automática en pipeline de build.
- Desactivar/evaluar UPX si genera falsos positivos.
- Verificación de firma después de compilar.
- Página oficial de descarga.
- Hash publicado.
- Documentación clara para Gumroad.

### Medio

- SBOM o reporte de dependencias.
- Automatizar release.
- Prueba con antivirus externos.
- Canal beta/estable.
- Actualizador firmado.

---

## Resultado esperado

Después de aplicar este plan, Helpmeet debería:

- instalarse sin parecer software desconocido improvisado;
- mostrar `MimoTech` como editor;
- conservar datos del usuario;
- explicar claramente permisos de grabación;
- reducir falsos positivos;
- estar listo para venderse por Gumroad con mayor confianza.

---

## Fuentes de referencia

- Microsoft Learn — SmartScreen reputation for Windows app developers: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Microsoft Learn — SignTool.exe: https://learn.microsoft.com/en-us/dotnet/framework/tools/signtool-exe
- Microsoft Learn — Time Stamping Authenticode Signatures: https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures

Notas clave de esas referencias:

- SignTool permite firmar, verificar y aplicar timestamp.
- El timestamp ayuda a que una firma siga verificándose después de que expire el certificado.
- SmartScreen usa reputación; una app nueva puede mostrar advertencia aunque esté firmada.

---

## Estado de implementación — actualizado 2026-06-29

### ✅ Implementado (sin costo)

| Fase | Qué se hizo |
|---|---|
| **Fase 4 — Metadatos del exe** | Creado `installer/version_info.txt` con ProductName, CompanyName, FileDescription, FileVersion, LegalCopyright, OriginalFilename para MimoTech. Creado `installer/gen_version.py` para regenerar automáticamente al cambiar la versión. Actualizado `Helpmeet.spec` para usar `version_file=installer/version_info.txt`. |
| **Fase 8 — Checksums** | Creado `scripts/generate_sha256.ps1` que genera `SHA256SUMS.txt` automáticamente después de crear el instalador. |
| **Fase 10 — Licencias de terceros** | Generado `licenses/THIRD_PARTY_LICENSES.md` con todas las dependencias de Python (MIT, BSD, Apache, LGPL, MPL). Incluye nota sobre PyAV/FFmpeg (LGPL) y PyInstaller (GPL, solo herramienta de build). `Helpmeet.iss` actualizado para incluir la carpeta `licenses/` dentro del instalador. |
| **Fase 13 — Scripts** | Creado `scripts/build_release.ps1`: pipeline completo con tests → versión → clean → PyInstaller → firma (opcional con -Sign) → Inno Setup → firma instalador → SHA-256. |

**Archivos creados:**
- `installer/version_info.txt` — recurso de versión para PyInstaller
- `installer/gen_version.py` — regenera version_info.txt desde helpmeet/version.py
- `licenses/THIRD_PARTY_LICENSES.md` — licencias de todas las dependencias
- `scripts/generate_sha256.ps1` — genera SHA256SUMS.txt del instalador
- `scripts/build_release.ps1` — pipeline completo de build

**Archivos modificados:**
- `Helpmeet.spec` — añadido `version_file`
- `installer/Helpmeet.iss` — incluye `licenses/` en el instalador

---

### ❌ Pendiente (requiere certificado de pago)

| Fase | Qué falta | Por qué no se hizo |
|---|---|---|
| **Fase 1 — Firma digital** | Obtener certificado (OV o EV) o contratar Microsoft Trusted Signing (~9 USD/mes). Firmar `Helpmeet.exe` e instalador con `signtool`. | Requiere pago y validación de identidad de MimoTech. |
| **Fase 2 — Timestamp** | Añadir `/tr http://timestamp.acs.microsoft.com /td SHA256` al firmar. | Depende de tener el certificado primero. |
| **Fase 3 — Firma automática en Inno Setup** | `SignTool=helpmeet_sign $f` en Helpmeet.iss. | Depende del certificado. El script `build_release.ps1` ya está listo para ejecutarlo con `-Sign`. |
| **Fase 5 — Falsos positivos** | Evaluar `upx=False` en `Helpmeet.spec` si antivirus detecta falsos positivos. Probar en VirusTotal después de la primera build firmada. | Requiere build completo y prueba manual. |
| **Fase 6 — Reputación SmartScreen** | Se acumula automáticamente con descargas desde Gumroad/dominio oficial. Usar siempre el mismo certificado. | Se construye con el tiempo. |
| **Fase 7 — Página de descarga** | Crear `https://helpmeet.app/download` con hash, changelog, guía de instalación, política de privacidad. | Requiere dominio y hosting web. |
| **Fase 9 — Privacidad** | Revisar que el primer uso explique permisos de micrófono, pantalla y audio del sistema. Confirmar que logs no contienen transcripciones ni keys completas. | Requiere revisión y prueba manual. |
| **Fase 11 — Actualizaciones** | No implementar auto-update hasta tener firma. Si se implementa: validar firma y hash antes de ejecutar cualquier binario descargado. | Funcionalidad futura. |
| **Fase 12 — Pruebas manuales** | Probar instalador en Windows 10 y 11 limpios, sin Python. Probar instalación como usuario sin admin. Probar desinstalación y conservación de datos. | Requiere máquina virtual limpia. |

---

### Próximo paso recomendado

1. Contratar **Microsoft Trusted Signing** en Azure (~9 USD/mes) o comprar certificado OV (~70-150 USD/año).
2. Configurar `signtool` con el certificado.
3. Ejecutar: `.\scripts\build_release.ps1 -Sign -Version 1.2.7`
4. Verificar firma con: `signtool verify /pa /v dist\installer\Helpmeet-Setup-1.2.7.exe`
5. Subir instalador firmado + `SHA256SUMS.txt` a Gumroad.
