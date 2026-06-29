# Pendientes — Sistema de Licencias Helpmeet

Cosas decididas que quedan para fases posteriores.

---

## Fase 2 — Integración Gumroad automática

- [ ] Configurar webhook en Gumroad apuntando a `/api/gumroad/webhook`
- [ ] Implementar endpoint `POST /api/gumroad/webhook` que crea cliente + licencia automáticamente al recibir una compra
- [ ] Verificar firma del webhook (header `X-Gumroad-Signature`) para seguridad
- [ ] Marcar licencias como `refunded` cuando Gumroad envíe un ping de reembolso

## Fase 2 — Límite de activaciones por dispositivo

- [ ] Añadir campo `max_devices` a la tabla `licenses`
- [ ] En `POST /api/license/activate`: contar activaciones activas y rechazar si supera el límite
- [ ] En el panel admin: botón "Resetear dispositivos" para casos de soporte
- [ ] En Helpmeet: mostrar mensaje claro cuando se alcanza el límite ("Has llegado al límite de dispositivos para esta licencia")

## Fase 3 — Panel admin web

- [ ] Dashboard con métricas: licencias activas, activaciones hoy, bloqueadas
- [ ] Vista de licencias con filtros (plan, estado, fecha)
- [ ] Detalle de licencia: dispositivos activos, historial de eventos
- [ ] Acciones: bloquear licencia, resetear dispositivos, cambiar plan, extender updates
- [ ] Login con 2FA para el panel

## Fase 3 — Deploy en producción

- [ ] Elegir hosting: Railway / Render / VPS
- [ ] Migrar de SQLite a PostgreSQL gestionado
- [ ] Configurar HTTPS (dominio propio)
- [ ] Rate limiting en endpoints de activación y validación
- [ ] Monitoreo de activaciones sospechosas (misma key en muchos equipos)

## Fase 4 — Trial y funciones Pro

- [ ] Modo trial de 7 días sin necesidad de licencia
- [ ] Bloquear funciones Pro si la licencia no es válida o expiró
- [ ] Funciones gratuitas vs Pro definidas en el código
- [ ] `updates_until`: bloquear actualizaciones si expiró pero seguir permitiendo uso

## Fase 4 — Portal de cliente

- [ ] Página donde el cliente puede ver sus dispositivos activos
- [ ] Desactivar un dispositivo propio sin pasar por soporte
- [ ] Historial de activaciones

---

*Creado: 2026-06-28 — Se actualiza conforme se implementan fases*
