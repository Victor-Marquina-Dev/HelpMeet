# Guia de venta Helpmeet en Gumroad

> Estrategia completa en: `docs/ventas/ESTRATEGIA_PLANES_PRECIOS.md`

## Los 3 planes

| Plan | Precio | Dispositivos | Video | Diferencial |
|---|---|---|---|---|
| **Personal** | $49 | 1 | 10h | Audio + video limitado + Markdown |
| **Pro** | $99 | 2 | Ilimitado | + ZIP + participantes + glosario |
| **Team** | $199 | 5 | Ilimitado | + Soporte prioritario |

Pago único. Sin suscripciones. Actualizaciones incluidas por 1 ano. Video limitado a 10h en Personal, ilimitado en Pro/Team.

## Resumen del flujo

```
Cliente paga en Gumroad
        ↓
Gumroad llama a tu webhook
        ↓
Backend crea cliente + licencia segun el plan comprado
        ↓
Cliente recibe email con Product Key + descarga
        ↓
Cliente activa Helpmeet con su key
```

---

## Paso 1 — Crear los 3 productos en Gumroad

Crear un producto para cada plan. En **Productos → Nuevo producto → Producto digital**:

### Producto 1: Helpmeet Personal ($49)
- **Slug:** `helpmeet_personal`
- **Nombre:** `Helpmeet Personal — Transcripcion de reuniones`
- **Descripcion:** ver abajo

### Producto 2: Helpmeet Pro ($99)
- **Slug:** `helpmeet_pro`
- **Nombre:** `Helpmeet Pro — Grabacion de pantalla + video`
- **Descripcion:** ver abajo

### Producto 3: Helpmeet Team ($199)
- **Slug:** `helpmeet_team`
- **Nombre:** `Helpmeet Team — Para equipos`
- **Descripcion:** ver abajo

> Los slugs deben coincidir exactamente con `PLAN_MAP` en `routers/gumroad.py`.

### Descripcion sugerida para los 3 productos

**Comun a todos:**
```
Helpmeet graba tus reuniones, transcribe el audio localmente en tu PC
y exporta el contexto listo para trabajar con IA.

✅ Transcripcion 100% local — sin subir tu audio a ningun servidor
✅ Graba reuniones de Meet, Teams, Zoom o cualquier app
✅ Exporta a Claude, ChatGPT o cualquier IA
✅ Windows 10/11
✅ Pago único — sin suscripciones mensuales
✅ Actualizaciones incluidas por 1 ano
```

**Diferencias por plan (añadir al final de cada descripción):**

Personal:
```
Incluye:
- 1 dispositivo
- Grabacion de audio + microfono (ilimitado)
- Grabacion de pantalla en video
- Transcripcion de video (10 horas)
- Capturas de pantalla
- Export Markdown + TXT
- Busqueda en transcripciones
```

Pro:
```
Incluye TODO lo de Personal, mas:
- 2 dispositivos
- Transcripcion de video ILIMITADA
- Export ZIP con todos los recursos
- Gestion de participantes
- Glosario de terminos
- Recuperacion de grabaciones
```

Team:
```
Incluye TODO lo de Pro, mas:
- 5 dispositivos
- Soporte prioritario
```

---

## Paso 2 — Subir el instalador a cada producto

En la seccion **Contenido** de cada producto:

1. Subir el instalador (`Helpmeet-Setup-X.X.X.exe`)
2. Añadir `INSTRUCCIONES.txt`:

```
¡Gracias por comprar Helpmeet!

COMO ACTIVAR:
1. Descarga e instala Helpmeet-Setup-x.x.x.exe
2. Abre Helpmeet
3. Introduce tu Product Key cuando se solicite
4. ¡Listo!

Tu Product Key te llegara por email en los proximos minutos.

Soporte: helpmeet@mimotech.vip
```

---

## Paso 3 — Configurar el webhook (automatización)

El webhook hace que cada compra cree una licencia automáticamente en tu backend.

### En Gumroad

1. Ve a **Ajustes** → **Avanzado** → **Webhooks**
2. Añade la URL:
   ```
   https://helpmeet-licenses.fly.dev/api/gumroad/webhook
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
https://helpmeet-licenses.fly.dev/docs
```

Endpoint para ver las licencias:
```
GET /api/admin/licenses
Header: X-Admin-Key: <tu-admin-key>
```

---

## Paso 4 — Email de agradecimiento en Gumroad

En cada producto → **Editar** → **Recibo**, personalizar:

```
¡Gracias por comprar Helpmeet!

Tu instalador esta adjunto. Descargalo e instalalo.

Tu Product Key te llegara en un email separado en los proximos minutos.

¿Dudas? helpmeet@mimotech.vip

— Victor, MimoTech
```

---

## Paso 5 — Flujo de atencion al cliente

### Cuando se recibe una venta

1. Gumroad envia email de venta
2. El webhook crea automáticamente la licencia
3. Revisar en `GET /api/admin/licenses` que aparezca
4. Enviar la Product Key al cliente por email

### Si el webhook falla, crear manualmente

```bash
cd helpmeet-licenses
python cli.py create-customer --email comprador@email.com --name "Nombre"
python cli.py create-license --customer-id 1 --plan personal
```

### Template de email al cliente

```
Asunto: Tu Product Key de Helpmeet

Hola,

Gracias por comprar Helpmeet. Aqui esta tu Product Key:

  HM-XXXX-XXXX-XXXX-XXXX

Para activar:
1. Abre Helpmeet
2. Introduce la key en la pantalla de activación
3. Clic en Activar

La licencia cubre los dispositivos de tu plan. Si necesitas cambiarlos,
escribeme y lo gestiono.

Soporte: helpmeet@mimotech.vip

— Victor
```

---

## Paso 6 — Mapeo de product_id a plan

Editar `helpmeet-licenses/helpmeet_licenses/routers/gumroad.py`:

```python
PLAN_MAP = {
    "helpmeet_personal": "personal",
    "helpmeet_pro": "pro",
    "helpmeet_team": "team",
}
```

Los slugs deben coincidir EXACTAMENTE con los slugs de los productos en Gumroad.

## Paso 7 — Verificar antes de publicar

- [ ] Los 3 productos creados con los slugs correctos
- [ ] El instalador subido a cada producto
- [ ] El webhook configurado
- [ ] Probado con compra de prueba (cupon 100% descuento)
- [ ] Verificado que el webhook crea la licencia del plan correcto
- [ ] Admin key guardada en lugar seguro

## URLs de produccion

| Que | URL |
|---|---|
| Backend | `https://helpmeet-licenses.fly.dev` |
| Swagger | `https://helpmeet-licenses.fly.dev/docs` |
| Health | `https://helpmeet-licenses.fly.dev/health` |
| Webhook Gumroad | `https://helpmeet-licenses.fly.dev/api/gumroad/webhook` |
