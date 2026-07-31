# Sistema de Gating por Plan y Actualizaciones

## Como funciona

Helpmeet distribuye un **único `.exe`** para todos los planes. Las funcionalidades se activan o bloquean en **runtime** segun el plan de la licencia del usuario.

```
Usuario descarga Helpmeet vX.Y.Z.exe
         |
         v
Al iniciar: check_license() -> servidor de licencias -> plan (personal|pro|team)
         |
         v
get_plan_features() -> window._planFeatures = { video_unlimited: true/false, ... }
         |
         v
Frontend: hasFeature('nombre_feature') -> !!window._planFeatures['nombre_feature']
```

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `helpmeet/ui/api/api_licenses.py` | `_PLAN_FEATURES`: diccionario con flags por plan |
| `helpmeet/ui/web/app.js:306` | `hasFeature(key)`: consulta si una feature esta habilitada |
| `helpmeet/ui/web/app.js:314` | `proBadge(key)`: muestra badge PRO si la feature no esta disponible |
| `helpmeet/ui/api/api_licenses.py:43` | `check_license()`: valida licencia y detecta cambio de major version |

## Planes actuales

```python
_PLAN_FEATURES = {
    "personal": {
        "devices": 1,
        "video_unlimited": False,
        "video_hours": 10,         # horas/mes
        "zip_export": False,
        "participants": False,
        "glossary": False,
        "recovery": False,
        "priority_support": False,
    },
    "pro": {
        "devices": 2,
        "video_unlimited": True,
        "video_hours": -1,         # ilimitado
        "zip_export": True,
        "participants": True,
        "glossary": True,
        "recovery": True,
        "priority_support": False,
    },
    "team": {
        "devices": 5,
        "video_unlimited": True,
        "video_hours": -1,
        "zip_export": True,
        "participants": True,
        "glossary": True,
        "recovery": True,
        "priority_support": True,
    },
}
```

## Agregar una nueva feature

### Paso 1: Definir el flag en `_PLAN_FEATURES`

```python
# helpmeet/ui/api/api_licenses.py

_PLAN_FEATURES = {
    "personal": {
        ...
        "ai_summary": False,       # NUEVA: solo Pro y Team
    },
    "pro": {
        ...
        "ai_summary": True,
    },
    "team": {
        ...
        "ai_summary": True,
    },
}
```

Si la feature NO existe en el diccionario de un plan, `hasFeature()` devuelve `false` por defecto (seguro).

### Paso 2: Gatear en el frontend

```javascript
// helpmeet/ui/web/app.js

// Opcion A: bloquear completamente
if (!hasFeature('ai_summary')) {
    showUpgradeToast('ai_summary');
    return;
}

// Opcion B: mostrar badge PRO en el boton
`<button>Generar resumen ${proBadge('ai_summary')}</button>`

// Opcion C: condicionar renderizado
const canSummarize = hasFeature('ai_summary');
```

### Paso 3: (Opcional) Etiqueta de upgrade

```javascript
// helpmeet/ui/web/app.js - agregar al mapa _PLAN_UPGRADE_LABELS
const _PLAN_UPGRADE_LABELS = {
    glossary: 'Glosario',
    participants: 'Participantes',
    ai_summary: 'Resumen IA',      // NUEVA
};
```

## Actualizaciones

### Actualizacion menor/patch (v2.5.0 -> v2.5.1)

- El usuario descarga el nuevo .exe
- Las features existentes se mantienen segun su plan
- Nuevas features se bloquean si su plan no las incluye
- **No requiere reactivar licencia**

### Actualizacion mayor (v2.x -> v3.0)

- `check_license()` detecta cambio en major version
- Fuerza reactivacion de licencia
- El servidor de licencias valida si el plan es compatible con v3
- Si el plan antiguo no cubre v3, el usuario debe upgradear

## Verificacion en el servidor de licencias

El servidor (`helpmeet-licenses`) tiene su propio mapeo de planes. Al agregar una nueva feature que requiera un plan superior:

1. Actualizar `_PLAN_FEATURES` en `api_licenses.py` (cliente)
2. Actualizar el mapeo equivalente en `helpmeet-licenses/main.py` (servidor)
3. El servidor es la fuente de verdad para validar licencias

## Reglas

- **Mismo .exe para todos**: no hay builds separadas por plan
- **Default seguro**: si una feature no esta en el diccionario del plan, `hasFeature()` retorna `false`
- **Sin conexión**: si `window._planFeatures` no se ha cargado aun, `hasFeature()` retorna `true` para no bloquear la UI durante la carga
- **Nuevas features bloqueadas por defecto**: solo agregarlas a los planes que deben tener acceso
