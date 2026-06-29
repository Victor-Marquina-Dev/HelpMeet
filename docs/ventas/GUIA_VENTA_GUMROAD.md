# Guía de venta Helpmeet en Gumroad

## Resumen del flujo

```
Cliente paga en Gumroad
        ↓
Gumroad llama a tu webhook (Railway)
        ↓
Backend crea cliente + licencia automáticamente
        ↓
Tú recibes email de venta → vas al backend → copias la key
        ↓
Envías la key al cliente por email (manual por ahora)
        ↓
Cliente activa Helpmeet con su key
```

---

## Paso 1 — Crear el producto en Gumroad

1. En el panel de Gumroad, clic en **Productos** → **Nuevo producto**
2. Selecciona **Producto digital**
3. Rellena:
   - **Nombre:** `Helpmeet — Grabación y transcripción de reuniones`
   - **Precio:** el que decidas (ej. $29 o $49)
   - **Descripción corta:** ver sección abajo

### Descripción sugerida para Gumroad

```
Helpmeet graba tus reuniones, transcribe el audio localmente en tu PC
y exporta el contexto listo para trabajar con IA.

✅ Transcripción 100% local — sin subir tu audio a ningún servidor
✅ Graba reuniones de Meet, Teams, Zoom o cualquier app
✅ Captura de pantalla durante la reunión
✅ Exporta a Claude, ChatGPT o cualquier IA
✅ Windows 10/11

Incluye:
- Instalador para Windows (.exe)
- Licencia personal (1 dispositivo)
- Product Key para activación

⚠️ Requiere Windows 10 o 11 de 64 bits.
⚠️ La primera vez descarga el modelo de transcripción (~480 MB) — necesita internet.
```

---

## Paso 2 — Subir el instalador

1. En la sección **Contenido** del producto, haz clic en **Subir un archivo**
2. Sube: `dist\installer\Helpmeet-Setup-1.2.7.exe`
3. Añade también un archivo `INSTRUCCIONES.txt`:

```
¡Gracias por comprar Helpmeet!

CÓMO ACTIVAR:
1. Descarga e instala Helpmeet-Setup-x.x.x.exe
2. Abre Helpmeet
3. Introduce tu Product Key cuando se solicite
4. ¡Listo!

Tu Product Key te llegará por email en las próximas horas.

Soporte: victor@mimotech.app
```

---

## Paso 3 — Configurar el webhook (automatización)

El webhook hace que cada compra cree una licencia automáticamente en tu backend.

### En Gumroad

1. Ve a **Ajustes** → **Avanzado** → **Webhooks**
2. Añade la URL:
   ```
   https://web-production-93435.up.railway.app/api/gumroad/webhook
   ```
3. Activa los eventos: **Sale** (venta) y **Refund** (reembolso)

### Cómo funciona

Cuando alguien compra, Gumroad envía al webhook:
```json
{
  "email": "comprador@email.com",
  "sale_id": "abc123",
  "product_id": "helpmeet_personal"
}
```

El backend crea automáticamente el cliente + la licencia. Tú recibes el email de venta de Gumroad y luego vas a:

```
https://web-production-93435.up.railway.app/docs
```

Endpoint para ver la licencia recién creada:
```
GET /api/admin/licenses
Header: X-Admin-Key: d5a59c77de67e18b9984c5b5d4a0f4d48707abe2629ce2e6
```

---

## Paso 4 — Configurar el email de agradecimiento en Gumroad

1. En tu producto → **Editar** → **Recibo**
2. Personaliza el mensaje de confirmación que recibe el comprador:

```
¡Gracias por comprar Helpmeet!

Tu instalador está adjunto a este email. Descárgalo e instálalo.

Tu Product Key personal te llegará en un email separado en las próximas
horas (normalmente en minutos).

Si tienes dudas: victor@mimotech.app

¡Disfruta de Helpmeet!
— Victor, MimoTech
```

---

## Paso 5 — Flujo completo de atención al cliente

### Cuando recibes una venta

1. Gumroad te manda email: "¡Has realizado una venta!"
2. Ve a: `https://web-production-93435.up.railway.app/docs`
3. Usa `GET /api/admin/licenses` con tu admin key → verás la nueva licencia
4. La licencia mostrará los **últimos 4 caracteres** de la key (`key_last4`)

**IMPORTANTE:** La key completa solo se muestra UNA VEZ al crearla.

### Si la key no se creó automáticamente (webhook no llegó)

Créala manualmente con el CLI:
```powershell
cd helpmeet-licenses
.\.venv\Scripts\python.exe cli.py create-customer --email comprador@email.com
.\.venv\Scripts\python.exe cli.py create-license --customer-id 1 --plan personal
```

### Enviar la key al cliente

Responde al email de Gumroad o envía un email directo:

```
Asunto: Tu Product Key de Helpmeet

Hola [nombre],

Aquí está tu Product Key de Helpmeet:

  HM-XXXX-XXXX-XXXX-XXXX

Pasos para activar:
1. Abre Helpmeet
2. Introduce la key en la pantalla de activación
3. Clic en Activar

La key funciona en 1 dispositivo. Si cambias de PC, escríbeme y la reseteo.

Soporte: victor@mimotech.app

¡Gracias por confiar en Helpmeet!
— Victor
```

---

## Paso 6 — Configurar el product_id para el webhook

El webhook de Gumroad envía el ID del producto. Para que el backend lo mapee correctamente al plan:

Edita `helpmeet-licenses/helpmeet_licenses/routers/gumroad.py`:

```python
PLAN_MAP = {
    "helpmeet_personal": "personal",   # ← pon aquí el ID real de tu producto en Gumroad
    "helpmeet_pro": "pro",
    "helpmeet_team": "team",
}
```

El `product_id` de Gumroad lo encuentras en:
**Gumroad → Productos → tu producto → URL** (el slug en la URL)

---

## Paso 7 — Verificar antes de publicar

- [ ] El producto tiene nombre y descripción claros
- [ ] El instalador está subido
- [ ] El webhook está configurado con la URL correcta
- [ ] Tienes el admin key guardado en lugar seguro
- [ ] Probaste crear una licencia manualmente
- [ ] Sabes cómo enviar la key al cliente

---

## URLs importantes

| Qué | URL |
|---|---|
| Backend producción | `https://web-production-93435.up.railway.app` |
| Swagger (admin) | `https://web-production-93435.up.railway.app/docs` |
| Health check | `https://web-production-93435.up.railway.app/health` |
| Webhook para Gumroad | `https://web-production-93435.up.railway.app/api/gumroad/webhook` |

## Admin Key (guárdala en lugar seguro)

```
d5a59c77de67e18b9984c5b5d4a0f4d48707abe2629ce2e6
```

---

## Automatización futura (cuando escales)

Cuando tengas más ventas, añade envío automático de emails:
- **Resend** (free hasta 3000 emails/mes) — integrar en el webhook handler
- Cuando llega la compra → backend crea licencia → envía email con la key automáticamente
- El cliente recibe su key en segundos sin intervención manual

Por ahora el flujo manual funciona perfectamente para las primeras ventas.
