# Plan para vender Helpmeet por internet con Gumroad + Product Keys

## Objetivo

Definir una estrategia clara para vender Helpmeet online sin que sea solo “descargar la aplicación”.

La idea recomendada es:

1. Usar Gumroad como página de venta y checkout.
2. Entregar una licencia/Product Key por compra.
3. Activar Helpmeet desde la app usando esa licencia.
4. Tener un panel propio para controlar licencias, activaciones, clientes y dispositivos.
5. Poder monitorear uso básico, bloquear claves abusadas y gestionar soporte.

## Idea base

Gumroad puede encargarse de:

- Página de producto.
- Pago.
- Impuestos/comprobante según su plataforma.
- Entrega inicial.
- Generación/verificación básica de license keys.

Pero para una app como Helpmeet conviene tener un backend propio porque:

- Gumroad no debería ser el único control de acceso.
- Una clave se puede compartir.
- Necesitas limitar dispositivos.
- Necesitas ver quién activó qué.
- Necesitas desactivar licencias.
- Necesitas controlar versiones, updates y soporte.

## Flujo recomendado

```text
Usuario compra en Gumroad
        ↓
Gumroad entrega licencia / Product Key
        ↓
Usuario instala Helpmeet
        ↓
Helpmeet pide activar licencia
        ↓
Helpmeet llama a tu backend
        ↓
Tu backend valida con Gumroad y con tu base de datos
        ↓
Si todo está correcto, activa el dispositivo
        ↓
La app queda desbloqueada
```

## Arquitectura recomendada

### 1. Gumroad

Uso:

- Página pública de venta.
- Checkout.
- License key inicial.
- Webhooks/pings de compra.
- Validación inicial de compra.

### 2. Backend propio de licencias

Responsable de:

- Validar product keys.
- Crear clientes.
- Registrar dispositivos.
- Controlar límite de activaciones.
- Guardar estado de licencia.
- Permitir bloquear, pausar o resetear activaciones.
- Servir configuración remota de la app.
- Registrar versión instalada.

### 3. Panel administrativo

Responsable de:

- Ver clientes.
- Ver licencias.
- Ver dispositivos activados.
- Ver última actividad.
- Bloquear licencias.
- Resetear activaciones.
- Cambiar plan.
- Ver ventas importadas desde Gumroad.

### 4. Aplicación Helpmeet

Responsable de:

- Mostrar pantalla de activación.
- Enviar license key al backend.
- Guardar token local de activación.
- Verificar licencia cada cierto tiempo.
- Permitir uso offline limitado.
- Bloquear funciones Pro si la licencia no es válida.

## No vender solo la aplicación

Para que Helpmeet tenga más valor, venderlo como un producto completo:

- App de escritorio.
- Transcripción local.
- Organización por iniciativas.
- Exportación a Markdown.
- Contexto listo para IA.
- Recuperación de grabaciones.
- Actualizaciones.
- Soporte.
- Plantillas para usar con Claude/ChatGPT.
- Guías rápidas de uso.

Esto ayuda a justificar mejor el precio.

## Propuesta de producto en Gumroad

### Nombre posible

```text
Helpmeet — Captura reuniones, transcribe y convierte todo en contexto para IA
```

### Subtítulo

```text
Una app de escritorio para grabar reuniones, capturar pantalla, transcribir audio/video y exportar contexto listo para Claude o ChatGPT.
```

### Qué recibe el comprador

- Instalador de Helpmeet para Windows.
- Product Key personal.
- Guía de instalación.
- Guía rápida de uso.
- Acceso a actualizaciones.
- Soporte básico por correo.

### Mensaje clave

Helpmeet no es solo una grabadora. Es una herramienta para convertir reuniones, videos y capturas en conocimiento reutilizable.

## Planes sugeridos

### Plan Personal

Para freelancers o uso individual.

- 1 usuario.
- 1 o 2 dispositivos.
- Actualizaciones menores.
- Exportación Markdown.
- Transcripción local.

### Plan Pro

Para consultores, analistas o desarrolladores.

- 1 usuario.
- Hasta 3 dispositivos.
- Exportación avanzada.
- Plantillas para IA.
- Prioridad en soporte.
- Actualizaciones por 1 año.

### Plan Team

Para equipos pequeños.

- 3 a 10 usuarios.
- Panel de licencias.
- Más dispositivos.
- Soporte prioritario.
- Facturación/manual invoice si aplica.

## Modelo de licencia

### Opción recomendada para empezar

Licencia perpetua con 1 año de actualizaciones.

Ejemplo:

```text
Compras Helpmeet una vez.
Puedes usar esa versión para siempre.
Incluye actualizaciones durante 12 meses.
Después puedes renovar actualizaciones con descuento.
```

Ventaja:

- Fácil de vender en Gumroad.
- Menos fricción que una suscripción.
- Mejor para empezar.

### Opción futura

Suscripción mensual/anual.

Usarla si más adelante agregas:

- Sync en la nube.
- Panel web.
- IA integrada.
- Backups.
- Equipos.
- Funciones colaborativas.

## Product Key

La Product Key debe ser única por compra.

Formato recomendado:

```text
HM-XXXX-XXXX-XXXX-XXXX
```

Ejemplo:

```text
HM-7K2Q-LP9A-4M8C-ZT31
```

Reglas:

- No guardar la key en texto plano en tu base.
- Guardar hash de la key.
- Mostrar solo últimos 4 caracteres en el panel.
- Permitir regenerar una key si hubo soporte.

## Activación por dispositivo

Cuando el usuario activa Helpmeet:

La app envía:

- Product Key.
- Versión de Helpmeet.
- Sistema operativo.
- Nombre opcional del equipo.
- Device fingerprint.

El backend responde:

- Licencia válida o inválida.
- Plan.
- Fecha de expiración de updates.
- Límite de dispositivos.
- Token de activación.

## Device fingerprint

Debe ser estable, pero no invasivo.

Usar una combinación como:

- ID generado localmente en primera instalación.
- Hash del usuario/sistema.
- No guardar información sensible directa.

Recomendación:

No depender solo del hardware real porque puede cambiar. Mejor generar un `device_id` local y asociarlo a la licencia.

## Uso offline

La app debe funcionar offline por un tiempo razonable.

Propuesta:

```text
Validación online obligatoria al activar.
Luego puede funcionar offline 7 a 14 días.
Después debe reconectar para revalidar.
```

Esto evita bloquear usuarios legítimos, pero reduce abuso.

## Backend de licencias

### Endpoints mínimos

```text
POST /api/license/activate
POST /api/license/validate
POST /api/license/deactivate-device
POST /api/gumroad/webhook
GET  /api/admin/licenses
GET  /api/admin/customers
GET  /api/admin/devices
```

### Activar licencia

Request:

```json
{
  "license_key": "HM-XXXX-XXXX-XXXX-XXXX",
  "device_id": "abc123",
  "app_version": "1.2.7",
  "os": "Windows 11"
}
```

Response:

```json
{
  "ok": true,
  "activation_token": "signed-token",
  "plan": "pro",
  "max_devices": 3,
  "updates_until": "2027-06-28"
}
```

### Validar licencia

Request:

```json
{
  "activation_token": "signed-token",
  "device_id": "abc123",
  "app_version": "1.2.7"
}
```

Response:

```json
{
  "ok": true,
  "status": "active",
  "plan": "pro"
}
```

## Base de datos sugerida

### Tabla customers

```text
id
email
name
gumroad_customer_id
created_at
```

### Tabla licenses

```text
id
customer_id
license_key_hash
license_key_last4
gumroad_sale_id
product_id
plan
status
max_devices
updates_until
created_at
revoked_at
```

Estados:

```text
active
revoked
refunded
expired_updates
blocked
```

### Tabla activations

```text
id
license_id
device_id_hash
device_name
os
app_version
status
first_activated_at
last_seen_at
deactivated_at
```

Estados:

```text
active
deactivated
blocked
```

### Tabla license_events

```text
id
license_id
event_type
metadata_json
created_at
```

Eventos:

```text
created
activated
validated
deactivated
blocked
refunded
failed_activation
device_limit_reached
```

## Panel administrativo

### Vistas necesarias

#### Dashboard

Mostrar:

- Ventas totales.
- Licencias activas.
- Activaciones hoy.
- Licencias bloqueadas.
- Usuarios con límite alcanzado.

#### Licencias

Columnas:

- Cliente.
- Email.
- Plan.
- Estado.
- Dispositivos usados.
- Última actividad.
- Fecha de compra.

Acciones:

- Ver detalle.
- Bloquear licencia.
- Resetear dispositivos.
- Cambiar plan.
- Extender updates.
- Agregar nota interna.

#### Detalle de licencia

Mostrar:

- Datos del comprador.
- Product Key enmascarada.
- Plan.
- Gumroad sale ID.
- Dispositivos activos.
- Historial de eventos.

Acciones:

- Desactivar dispositivo.
- Bloquear dispositivo.
- Resetear activaciones.
- Revocar licencia.

#### Dispositivos

Mostrar:

- Device name.
- OS.
- App version.
- Última validación.
- IP aproximada si decides guardarla.

Recomendación:

Guardar IP solo si realmente la necesitas y explicarlo en política de privacidad.

## Monitoreo recomendado

Monitorear:

- Activaciones por día.
- Validaciones por día.
- Licencias que superan intentos fallidos.
- Product Keys usadas en muchos dispositivos.
- Versiones antiguas activas.
- Errores de activación.
- País/region solo si es necesario.

Alertas:

- Misma licencia usada en demasiados equipos.
- Muchos intentos fallidos de activación.
- License key bloqueada intentando validar.
- Versión antigua con errores críticos.

## Seguridad básica

### No validar solo contra Gumroad desde la app

No recomendado:

```text
Helpmeet → Gumroad API
```

Problema:

- Expones lógica de validación en el cliente.
- Es más fácil de manipular.
- No puedes controlar dispositivos correctamente.

Recomendado:

```text
Helpmeet → Tu backend → Gumroad
```

Tu backend decide si activa o no.

### Token de activación

Después de activar:

- Guardar un token firmado localmente.
- Validarlo con backend cada cierto tiempo.
- Invalidarlo si la licencia se bloquea.

### Rate limiting

Aplicar límites a:

- Activación.
- Validación.
- Webhooks.
- Login admin.

### Panel admin

Proteger con:

- Login.
- 2FA si es posible.
- Roles.
- Logs de acciones.

## Gumroad: uso recomendado

### En Gumroad activar license keys

La documentación oficial de Gumroad indica que se pueden usar license keys para productos de software y verificarlas por API.

Punto importante:

- Para productos creados desde el 9 de enero de 2023, Gumroad indica que la verificación usa `product_id` en lugar de `product_permalink`.

### Cuidado con el contador de usos

Gumroad advierte que verificar una licencia puede incrementar el contador de uso si no se configura el parámetro correspondiente.

Por eso:

- Tu backend debe controlar cuándo incrementa uso.
- La app no debe verificar Gumroad directamente en cada arranque.

## Webhooks / pings de Gumroad

Usar webhooks para:

- Crear licencia cuando hay compra.
- Marcar licencia como reembolsada.
- Actualizar email del cliente.
- Registrar producto comprado.

Flujo:

```text
Gumroad compra
        ↓
Webhook a tu backend
        ↓
Backend crea/actualiza customer
        ↓
Backend crea licencia
        ↓
Usuario activa en Helpmeet
```

## Qué entregar en Gumroad

En Gumroad puedes entregar:

- Instalador `.exe`.
- Guía de instalación PDF/MD.
- Archivo `README`.
- Link a documentación.
- Product Key.
- Link a soporte.

Pero lo ideal es que la app siempre pida activación para desbloquear funciones Pro.

## Funciones gratis vs Pro

### Gratis / trial

Permitir probar:

- Crear 1 iniciativa.
- Importar o grabar pocos minutos.
- Exportar con marca “trial”.
- Transcribir hasta cierto límite.

### Pro

Desbloquear:

- Iniciativas ilimitadas.
- Grabaciones largas.
- Exportación completa.
- Recuperación avanzada.
- Plantillas IA.
- Actualizaciones.

## Trial recomendado

Opción simple:

```text
7 días de prueba local
sin tarjeta
```

Opción más controlada:

```text
Trial con email + activación desde backend
```

Para empezar, puedes lanzar sin trial y ofrecer garantía/reembolso.

## Página de Gumroad: estructura sugerida

### 1. Hero

```text
Helpmeet
Convierte tus reuniones, videos y capturas en contexto listo para IA.
```

### 2. Problema

```text
Las reuniones se pierden en audios, videos y notas sueltas.
Helpmeet organiza todo por iniciativa y genera contexto listo para Claude o ChatGPT.
```

### 3. Beneficios

- Graba reuniones y pantalla.
- Transcribe audio/video.
- Organiza por iniciativas.
- Agrega notas y capturas.
- Exporta Markdown listo para IA.
- Recupera grabaciones si la app se cierra.

### 4. Para quién es

- Consultores.
- Analistas funcionales.
- Desarrolladores.
- Product managers.
- Equipos técnicos.
- Personas que trabajan con clientes y reuniones frecuentes.

### 5. Qué incluye

- App Windows.
- Product Key.
- Actualizaciones.
- Guía de uso.
- Soporte básico.

### 6. Demo corta

Video recomendado:

```text
De reunión desordenada → contexto profesional para IA en menos de 1 minuto.
```

### 7. Precio

Empezar simple:

```text
Personal License
Pago único
1 usuario
2 dispositivos
1 año de updates
```

## MVP recomendado para vender rápido

### Fase 1

- Gumroad con license keys.
- Pantalla de activación en Helpmeet.
- Backend pequeño para validar licencias.
- Tabla de licencias y activaciones.
- Panel admin simple.

### Fase 2

- Webhook de Gumroad.
- Reset de dispositivos.
- Bloquear/revocar licencias.
- Ver última actividad.

### Fase 3

- Trial.
- Updates automáticos.
- Planes Pro/Team.
- Métricas de uso.
- Portal de cliente.

## Stack recomendado para backend/panel

### Opción rápida

```text
FastAPI + SQLite/PostgreSQL + simple admin web
```

Ventaja:

- Encaja con tu app Python.
- Fácil de mantener.
- Puedes desplegar barato.

### Opción web moderna

```text
Next.js + Supabase/Postgres
```

Ventaja:

- Panel admin rápido.
- Auth lista.
- Base de datos gestionada.

### Opción recomendada para Helpmeet

```text
FastAPI + PostgreSQL + panel simple
```

Porque Helpmeet ya está en Python y sería más natural integrar la lógica.

## Checklist antes de vender

- Instalador firmado o al menos confiable.
- Página de descarga clara.
- Product Key funcional.
- Política de privacidad.
- Términos de uso.
- Política de reembolso.
- Email de soporte.
- Versión visible en la app.
- Logs de errores.
- Sistema para bloquear licencias.
- Sistema para resetear dispositivos.

## Riesgos

### Riesgo 1: claves compartidas

Mitigación:

- Límite de dispositivos.
- Panel para detectar abuso.
- Reset manual bajo soporte.

### Riesgo 2: app crackeada

Mitigación:

- Validación backend.
- Token firmado.
- Checks periódicos.
- Funciones críticas ligadas a licencia.

No existe protección perfecta para apps de escritorio. El objetivo es reducir abuso sin molestar a compradores reales.

### Riesgo 3: soporte pesado

Mitigación:

- Guía clara.
- Diagnóstico dentro de la app.
- Logs exportables.
- FAQ.

### Riesgo 4: problemas con modelos de transcripción

Mitigación:

- Diagnóstico de modelos.
- Fallback automático.
- Botón reparar modelos.
- Documentar que la primera descarga necesita internet.

## Recomendación final

Para empezar, no construyas una plataforma gigante.

Implementa primero:

1. Gumroad como checkout.
2. Product Key.
3. Backend de activación.
4. Límite por dispositivo.
5. Panel admin básico.

Después agregas:

- Webhooks.
- Métricas.
- Trial.
- Updates automáticos.
- Portal de cliente.

La clave es que Helpmeet se venda como una herramienta completa para convertir reuniones en contexto reutilizable para IA, no como una simple grabadora.

## Fuentes revisadas

- Gumroad Help Center — License keys: https://gumroad.com/help/article/76-license-keys
- Gumroad Help Center — License keys HTML: https://gumroad.com/help/article/76-license-keys.html
