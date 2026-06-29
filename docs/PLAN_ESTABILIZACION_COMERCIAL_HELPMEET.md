# Plan de estabilización comercial de Helpmeet

## Objetivo

Dejar Helpmeet estable, ordenado y preparado para comercializarse como aplicación de escritorio para Windows.

El foco de este plan es:

- Tener una versión local confiable.
- Preparar el sistema de licencias/Product Keys.
- Dejar el backend listo para conectarse con Gumroad.
- Preparar la compilación e instalación.
- Reducir riesgos antes de vender.
- Evitar que el producto dependa de pasos manuales frágiles.

Este documento no asume publicación inmediata en internet. La meta inicial es que todo funcione correctamente en local y quede listo para pasar a Gumroad/producción.

---

## Estado actual resumido

### Confirmado

- La app principal tiene pruebas automáticas pasando cuando se ejecutan separadas.
- El backend de licencias existe en `helpmeet-licenses/`.
- El backend permite:
  - Crear clientes.
  - Crear licencias.
  - Activar licencia.
  - Validar licencia.
  - Revocar licencia.
- La app ya tiene pantalla de activación.
- La app ya llama a Python para activar/verificar licencia.
- Existe documentación previa de despliegue, rendimiento, licencias y Gumroad.
- Hay instalador/configuración PyInstaller/Inno Setup en progreso.

### Pendiente importante

- El sistema de licencias aún no está listo para producción.
- Falta integración real con Gumroad.
- Falta control de límite de dispositivos.
- Falta panel admin usable.
- Falta limpiar archivos temporales y ordenar pruebas.
- Falta validar build en Windows limpio.
- Falta prueba completa de instalación/actualización.
- Falta firma digital.

---

## Principio de implementación

No avanzar a venta hasta cumplir esta regla:

> La app debe poder instalarse, activarse con Product Key, funcionar offline por un tiempo limitado, recuperar datos ante cierre inesperado y exportar/transcribir sin depender del entorno de desarrollo.

---

## Fase 0 — Congelar una base estable local

### Objetivo

Dejar el repositorio limpio antes de implementar licencias comerciales.

### Tareas

- [ ] Revisar `git status` y separar cambios terminados de cambios experimentales.
- [ ] Eliminar o ignorar archivos temporales:
  - `helpmeet-licenses/test.db`
  - `helpmeet-licenses/cli_debug.txt`
  - `helpmeet-licenses/cli_error.txt`
  - `helpmeet-licenses/inspect_output.txt`
  - `helpmeet-licenses/test_typer4_output.txt`
- [ ] Actualizar `.gitignore` para excluir:
  - `*.db`
  - `*.log`
  - `*_debug.txt`
  - `*_error.txt`
  - `*_output.txt`
  - archivos temporales de pruebas
- [ ] Separar claramente:
  - código de la app principal;
  - backend de licencias;
  - documentos de diseño;
  - documentos de despliegue;
  - pruebas.
- [ ] Crear un commit base llamado, por ejemplo:
  - `chore: stabilize local baseline`

### Criterio de aceptación

- `git status` no debe mostrar archivos temporales accidentales.
- La app principal debe correr sus tests.
- El backend de licencias debe correr sus tests.
- No debe existir información sensible en archivos versionados.

---

## Fase 1 — Ordenar pruebas y validación local

### Problema actual

Al ejecutar toda la suite junta puede aparecer conflicto entre:

- `tests/conftest.py`
- `helpmeet-licenses/tests/conftest.py`

Esto no significa que la app esté rota, pero sí afecta CI/build.

### Tareas

- [ ] Configurar ejecución separada de pruebas:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
cd helpmeet-licenses
.\.venv\Scripts\python.exe -m pytest -q
```

- [ ] Crear script único de validación:

```powershell
scripts\check_all.ps1
```

Debe ejecutar:

- tests app principal;
- tests backend licencias;
- `py_compile` de módulos clave;
- `node --check helpmeet/ui/web/app.js`;
- revisión básica de archivos temporales.

- [ ] Evitar que `pytest` raíz recoja tests de `helpmeet-licenses` accidentalmente.
- [ ] Documentar comandos de validación local.

### Criterio de aceptación

- Un solo comando local valida app + licencias.
- No hay errores por estructura de tests.
- El script puede ejecutarse antes de compilar.

---

## Fase 2 — Endurecer licencias en la app de escritorio

### Objetivo

Que Helpmeet pueda activarse con Product Key de forma estable y segura desde la app.

### Estado actual

La app ya tiene métodos Python para:

- `activate_license`
- `check_license`
- `get_license_info`
- `deactivate_license`

Esto es correcto porque evita que el frontend JS hable directamente con el servidor.

### Tareas

- [ ] Reemplazar el socket manual por un cliente HTTP claro y mantenible.
- [ ] Hacer configurable la URL del servidor de licencias.

Ejemplo local:

```txt
http://127.0.0.1:8765
```

Ejemplo futuro producción:

```txt
https://api.helpmeet.app
```

- [ ] Guardar el token de licencia en Windows Credential Manager.
- [ ] Dejar de guardar el token de licencia en `settings.json`.
- [ ] Agregar `last_license_check_at`.
- [ ] Agregar uso offline limitado:
  - recomendado: 7 a 14 días;
  - si se supera el límite, pedir reconexión.
- [ ] Mostrar estados claros:
  - sin licencia;
  - activada;
  - sin conexión;
  - revocada;
  - reembolsada;
  - límite de dispositivos alcanzado;
  - servidor no disponible.
- [ ] Evitar que un error temporal del servidor bloquee inmediatamente al usuario.
- [ ] Registrar versión real de la app al activar.

### Criterio de aceptación

- La app se activa con una licencia local.
- Si se cierra y abre, mantiene la licencia.
- Si el servidor local no está activo, permite entrar solo dentro del periodo offline.
- Si la licencia se revoca, la app lo detecta al volver a validar.
- El token no queda visible en texto plano.

---

## Fase 3 — Completar backend de licencias local

### Objetivo

Tener un backend local sólido antes de conectarlo a Gumroad.

### Modelo de datos faltante

Agregar a `licenses`:

- [ ] `max_devices`
- [ ] `gumroad_sale_id`
- [ ] `gumroad_product_id`
- [ ] `purchase_email`
- [ ] `source`
- [ ] `refunded_at`
- [ ] `expires_at` si se decide manejar suscripción o licencia temporal

Agregar a `activations`:

- [ ] restricción única por `license_id + device_id_hash`
- [ ] `ip_address` opcional
- [ ] `last_app_version`

Agregar a `license_events`:

- [ ] eventos de compra;
- [ ] eventos de reembolso;
- [ ] eventos de límite alcanzado;
- [ ] eventos de reset de dispositivos.

### Endpoints faltantes

- [ ] Resetear dispositivos:

```txt
POST /api/admin/licenses/{id}/reset-devices
```

- [ ] Cambiar plan:

```txt
POST /api/admin/licenses/{id}/change-plan
```

- [ ] Extender updates:

```txt
POST /api/admin/licenses/{id}/extend-updates
```

- [ ] Bloquear/reactivar licencia:

```txt
POST /api/admin/licenses/{id}/revoke
POST /api/admin/licenses/{id}/reactivate
```

- [ ] Ver eventos:

```txt
GET /api/admin/licenses/{id}/events
```

### Seguridad

- [ ] Usar hash/HMAC para Product Keys.
- [ ] No devolver la Product Key completa después de crearla.
- [ ] Mostrar solo últimos 4 caracteres.
- [ ] Validar intentos repetidos de activación.
- [ ] Rate limiting en endpoints públicos.
- [ ] Logs sin keys completas.
- [ ] Admin key fuera del repositorio.

### Criterio de aceptación

- Una licencia permite solo la cantidad de dispositivos definida.
- Se puede resetear dispositivos desde admin.
- Una licencia revocada deja de validar.
- Una licencia reactivada vuelve a validar.
- Los eventos quedan auditados.

---

## Fase 4 — Panel admin local mínimo

### Objetivo

Poder operar licencias sin usar CLI.

### Pantallas mínimas

#### Login admin

- [ ] Clave admin local.
- [ ] Sesión con expiración.
- [ ] Mensaje claro si la clave es incorrecta.

#### Dashboard

- [ ] Licencias activas.
- [ ] Licencias revocadas.
- [ ] Activaciones hoy.
- [ ] Dispositivos activos.

#### Lista de licencias

- [ ] Buscar por email.
- [ ] Buscar por últimos 4 caracteres.
- [ ] Filtrar por estado.
- [ ] Filtrar por plan.
- [ ] Ver fecha de creación.

#### Detalle de licencia

- [ ] Cliente.
- [ ] Plan.
- [ ] Estado.
- [ ] Dispositivos activados.
- [ ] Última validación.
- [ ] Historial de eventos.

#### Acciones

- [ ] Revocar.
- [ ] Reactivar.
- [ ] Resetear dispositivos.
- [ ] Cambiar plan.
- [ ] Extender updates.

### Criterio de aceptación

- Se puede operar soporte básico sin tocar la base de datos manualmente.
- Se puede resolver el caso típico: “cambié de PC, necesito activar otra vez”.

---

## Fase 5 — Preparar integración con Gumroad

### Enfoque recomendado

Usar Gumroad como checkout y entrega comercial, pero mantener el control real en tu backend.

No depender únicamente de la validación directa de Gumroad desde la app.

Flujo recomendado:

```text
Cliente compra en Gumroad
        ↓
Gumroad envía evento/ping/webhook
        ↓
Backend Helpmeet crea cliente + licencia
        ↓
Cliente recibe Product Key
        ↓
Helpmeet activa contra tu backend
```

### Decisión importante

Gumroad puede ofrecer funciones de license keys dependiendo del tipo/configuración del producto. Aun así, para Helpmeet conviene que la Product Key final sea controlada por tu backend.

Esto permite:

- limitar dispositivos;
- revocar licencias;
- manejar reembolsos;
- crear panel admin;
- no exponer lógica comercial dentro de la app;
- migrar de Gumroad a otro checkout en el futuro.

### Tareas

- [ ] Definir producto en Gumroad.
- [ ] Definir planes:
  - Personal;
  - Pro;
  - Team, opcional.
- [ ] Definir qué recibe el cliente:
  - instalador;
  - Product Key;
  - guía rápida;
  - política de soporte;
  - política de reembolso.
- [ ] Implementar endpoint local:

```txt
POST /api/gumroad/webhook
```

- [ ] Validar que la llamada venga de Gumroad.
- [ ] Crear cliente si no existe.
- [ ] Crear licencia si no existe.
- [ ] Guardar `gumroad_sale_id`.
- [ ] Guardar `gumroad_product_id`.
- [ ] Manejar compra repetida.
- [ ] Manejar reembolso.
- [ ] Manejar disputa/cancelación si aplica.
- [ ] Crear tests con payloads simulados.

### Simulación local

Antes de publicar, probar con payloads locales:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8765/api/gumroad/webhook `
  -ContentType "application/json" `
  -Body '{"email":"cliente@test.com","sale_id":"demo_001","product_id":"helpmeet_demo"}'
```

### Criterio de aceptación

- Una compra simulada crea cliente + licencia.
- Un reembolso simulado marca la licencia como `refunded`.
- Una licencia reembolsada no valida en la app.
- El sistema no crea licencias duplicadas para el mismo `sale_id`.

---

## Fase 6 — Preparar empaquetado local

### Objetivo

Que Helpmeet pueda generarse como ejecutable/instalador sin depender del entorno de desarrollo.

### Tareas

- [ ] Ejecutar build portátil:

```powershell
.\scripts\build_windows.ps1
```

- [ ] Ejecutar instalador:

```powershell
.\scripts\build_installer.ps1
```

- [ ] Confirmar que el build incluye:
  - iconos;
  - assets web;
  - WebView2 handling;
  - FFmpeg/PyAV necesario;
  - modelos no embebidos si se descargan luego;
  - documentos legales necesarios.

- [ ] Validar que `%LOCALAPPDATA%\Helpmeet` conserve datos.
- [ ] Validar que una actualización no borre reuniones.
- [ ] Validar que desinstalar no borre datos sin confirmación.

### Criterio de aceptación

- El `.exe` abre sin Python instalado.
- El instalador instala por usuario.
- La app puede grabar, transcribir, exportar y reabrir datos.
- La activación de licencia funciona en el build instalado.

---

## Fase 7 — Pruebas manuales obligatorias

### Sistemas

- [ ] Windows 10 x64.
- [ ] Windows 11 x64.
- [ ] Máquina limpia sin Python.
- [ ] Usuario sin permisos de administrador.

### Audio

- [ ] Micrófono integrado.
- [ ] Micrófono USB.
- [ ] Micrófono Bluetooth.
- [ ] Audio del sistema con WASAPI.
- [ ] Equipo sin loopback disponible.

### Pantalla

- [ ] Un monitor.
- [ ] Varios monitores.
- [ ] Monitores con escalado DPI diferente.
- [ ] Grabación de pantalla de 5 minutos.
- [ ] Grabación de pantalla de 30 minutos.

### Robustez

- [ ] Cierre forzado durante grabación.
- [ ] Recuperación al abrir.
- [ ] Transcripción posterior de video recuperado.
- [ ] Carpeta de exportación con espacios.
- [ ] Carpeta de exportación con acentos.

### Licencias

- [ ] Activar licencia válida.
- [ ] Intentar activar licencia inválida.
- [ ] Revocar licencia y validar bloqueo.
- [ ] Activar máximo de dispositivos.
- [ ] Superar límite de dispositivos.
- [ ] Resetear dispositivos.
- [ ] Probar offline dentro del periodo permitido.
- [ ] Probar offline vencido.

### Criterio de aceptación

- No hay pérdida de grabaciones.
- No hay bloqueo sin mensaje claro.
- No hay datos sensibles expuestos.
- La app funciona como producto instalable.

---

## Fase 8 — Optimización antes de vender

### Objetivo

Evitar que los primeros usuarios sientan la app pesada o lenta.

### Prioridades

- [ ] No cargar Whisper antes de empezar a grabar.
- [ ] Cargar modelo solo al transcribir.
- [ ] Guardar frases en lote.
- [ ] Evitar commits por cada frase.
- [ ] Usar WAL e índices en SQLite.
- [ ] Procesar audio largo por streaming.
- [ ] Reducir peso del MP4 con perfiles de grabación.
- [ ] Agregar perfil de video:
  - calidad alta;
  - equilibrado;
  - liviano.
- [ ] Mostrar tamaño estimado antes de grabar pantalla.
- [ ] Mantener UI fluida con muchas reuniones.

### Criterio de aceptación

- Grabar inicia rápido.
- Transcribir muestra progreso claro.
- Videos de pantalla no pesan excesivamente.
- La app no se siente bloqueada durante procesos largos.

---

## Fase 9 — Documentación comercial

### Archivos necesarios

- [ ] README comercial corto.
- [ ] Guía de instalación.
- [ ] Guía de activación.
- [ ] Preguntas frecuentes.
- [ ] Política de privacidad.
- [ ] Política de soporte.
- [ ] Política de reembolso.
- [ ] Changelog.
- [ ] Licencias de terceros.

### Para Gumroad

Preparar:

- [ ] Título del producto.
- [ ] Descripción corta.
- [ ] Descripción larga.
- [ ] Capturas.
- [ ] Video demo corto.
- [ ] Instalador.
- [ ] Instrucciones de activación.
- [ ] Contacto de soporte.
- [ ] Advertencia clara:
  - Windows 10/11;
  - transcripción local;
  - uso de espacio en disco;
  - requiere micrófono/audio si se desea grabar reuniones.

### Texto corto sugerido

```txt
Helpmeet es una app de escritorio para grabar reuniones, capturar pantalla, transcribir audio/video y exportar contexto listo para trabajar con IA.
```

### Criterio de aceptación

- Un comprador entiende qué compra.
- Un comprador sabe cómo instalar.
- Un comprador sabe cómo activar.
- Un comprador sabe dónde pedir soporte.

---

## Fase 10 — Preparación para producción

Esta fase se hace después de validar todo local.

### Backend

- [ ] Elegir hosting:
  - Railway;
  - Render;
  - VPS;
  - Fly.io;
  - otro.
- [ ] PostgreSQL gestionado.
- [ ] HTTPS.
- [ ] Dominio propio.
- [ ] Variables de entorno seguras.
- [ ] Backups.
- [ ] Logs.
- [ ] Monitoreo.

### Seguridad

- [ ] Rate limiting.
- [ ] Protección contra brute force de Product Keys.
- [ ] Rotación de `ADMIN_API_KEY`.
- [ ] Rotación de `JWT_SECRET` planificada.
- [ ] Separar entorno local/staging/producción.

### App

- [ ] URL de licencias producción.
- [ ] Firma digital del ejecutable.
- [ ] Firma digital del instalador.
- [ ] Checksums.
- [ ] Prueba de actualización.

### Criterio de aceptación

- El backend responde desde internet.
- La app instalada activa licencias reales.
- Se puede revocar una licencia desde admin.
- Gumroad puede crear licencias automáticamente.

---

## Orden recomendado de implementación

### Bloque 1 — Estabilidad local

1. Limpiar repo.
2. Arreglar ejecución de tests separada.
3. Crear script `check_all.ps1`.
4. Validar app + backend.

### Bloque 2 — Licencias serias

5. Configurar cliente HTTP de licencias en Python.
6. Guardar token en Credential Manager.
7. Agregar offline limitado.
8. Agregar `max_devices`.
9. Agregar reset de dispositivos.
10. Mejorar errores de activación.

### Bloque 3 — Operación comercial

11. Panel admin local mínimo.
12. Webhook Gumroad local.
13. Tests de compra/reembolso.
14. Documentación de activación.

### Bloque 4 — Build vendible

15. Build portátil.
16. Instalador.
17. Prueba en Windows limpio.
18. Validación de recuperación/grabación/transcripción/export.
19. Checklist de Gumroad.

### Bloque 5 — Producción

20. Deploy backend.
21. Dominio + HTTPS.
22. Firma digital.
23. Subida a Gumroad.
24. Prueba de compra real.

---

## No hacer todavía

Para evitar perder tiempo, no conviene hacer esto antes de cerrar licencias/build:

- Rediseño visual completo desde cero.
- Panel admin demasiado grande.
- Portal de cliente avanzado.
- Sistema de suscripciones complejo.
- Actualizaciones automáticas.
- Marketplace propio.
- Funciones Pro extensas.

Primero se debe vender una versión estable, instalable y activable.

---

## Definición de “listo para Gumroad”

Helpmeet estará listo para Gumroad cuando se cumpla todo esto:

- [ ] Existe instalador probado.
- [ ] Existe Product Key funcional.
- [ ] Existe backend local validado.
- [ ] Existe mecanismo para generar licencias.
- [ ] Existe mecanismo para revocar licencias.
- [ ] Existe límite de dispositivos.
- [ ] Existe guía de instalación.
- [ ] Existe guía de activación.
- [ ] Existe política de privacidad.
- [ ] Existe soporte definido.
- [ ] La app funciona en Windows limpio.
- [ ] La app no depende de Python instalado.
- [ ] La app conserva datos al actualizar.
- [ ] La app recupera grabaciones tras cierre inesperado.
- [ ] La app puede funcionar offline de forma limitada.
- [ ] Se probó el flujo compra simulada → licencia → activación.

---

## Entregables locales antes de pasar a producción

```text
Helpmeet/
├── dist/
│   ├── Helpmeet/
│   │   └── Helpmeet.exe
│   └── installer/
│       └── Helpmeet-Setup-x64.exe
├── helpmeet-licenses/
│   ├── backend local funcionando
│   ├── migraciones
│   └── tests
├── docs/
│   ├── GUIA_INSTALACION.md
│   ├── PRIVACIDAD.md
│   ├── LICENCIAS_TERCEROS.md
│   └── PRUEBAS_DISTRIBUCION.md
└── PLAN_ESTABILIZACION_COMERCIAL_HELPMEET.md
```

---

## Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---:|---|
| Licencias sin límite de dispositivos | Alto | Implementar `max_devices` antes de vender |
| Token en texto plano | Alto | Mover a Credential Manager |
| Build no probado en Windows limpio | Alto | Prueba manual obligatoria |
| Gumroad no sincroniza reembolsos | Alto | Webhook/ping + estado `refunded` |
| Videos demasiado pesados | Medio | Perfiles de grabación |
| SmartScreen bloquea instalador | Medio/alto | Firma digital |
| Falta soporte admin | Medio | Panel mínimo local |
| Tests mezclados fallan | Medio | Separar suites |

---

## Fuentes externas a validar antes de producción

- Gumroad — License keys: https://gumroad.com/help/article/76-license-keys
- Gumroad — documentación/API/webhooks disponibles en la cuenta de Gumroad al configurar el producto.

Nota: antes de publicar, validar directamente en la cuenta real de Gumroad qué eventos/pings están disponibles para el tipo de producto elegido. No diseñar el backend dependiendo de una función que no esté habilitada en tu producto.

---

## Recomendación final

El camino correcto no es “subir el instalador a Gumroad” todavía.

El camino correcto es:

1. estabilizar local;
2. cerrar licencias;
3. simular compra Gumroad;
4. validar instalador;
5. probar Windows limpio;
6. recién ahí conectar Gumroad real.

Con eso Helpmeet pasa de ser una app funcional a un producto vendible.
