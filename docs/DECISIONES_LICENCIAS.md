# Decisiones — Sistema de Licencias Helpmeet

Registro de todas las decisiones tomadas durante el diseño del sistema de licencias.

---

## Plataforma de venta

**Decisión:** Gumroad como checkout y entrega de licencias.

**Razón:** Maneja pagos, impuestos, comprobantes y generación de product keys sin infraestructura propia.

---

## Subsistema a implementar primero

**Decisión:** Backend de licencias (Fase A).

**Orden definido:**
1. Backend de licencias ← empezamos aquí
2. Pantalla de activación en Helpmeet
3. Panel admin web

---

## Deploy inicial

**Decisión:** Local (desarrollo y pruebas).

**Pendiente:** Elegir hosting para producción en Fase 3 (Railway / Render / VPS).

---

## Base de datos

**Decisión:** PostgreSQL.

**Razón:** Más robusto para producción. Se usa localmente al inicio.

---

## Creación de licencias

**Decisión:** Manual por ahora (el admin crea licencias desde CLI o panel).

**Pendiente:** Integración automática con webhook de Gumroad en Fase 2.

---

## Límite de activaciones por dispositivo

**Decisión:** Sin límite por ahora.

**Pendiente:** Añadir `max_devices` y validación en Fase 2. Ver `PENDIENTES_LICENCIAS.md`.

---

## Ubicación del backend

**Decisión:** Carpeta `helpmeet-licenses/` dentro del mismo repositorio de Helpmeet.

**Razón:** Todo en un lugar, más simple para empezar. Aislado del código de la app.

---

## Stack tecnológico del backend

**Decisión:** Opción A — FastAPI + SQLAlchemy + PostgreSQL + JWT.

**Razones:**
- SQLAlchemy ya se usa en Helpmeet → patrón conocido
- FastAPI genera documentación automática en `/docs`
- JWT es estándar para tokens de activación firmados
- Fácil de extender con webhook de Gumroad en Fase 2

**Descartadas:**
- Opción B (FastAPI + psycopg2): más difícil de mantener con migraciones
- Opción C (Django): demasiado pesado para el MVP

---

*Creado: 2026-06-28*
