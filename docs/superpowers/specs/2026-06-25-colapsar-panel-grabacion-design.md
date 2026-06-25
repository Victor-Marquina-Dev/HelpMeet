# Diseño: colapsar panel de grabación de pantalla

**Fecha:** 2026-06-25  
**Estado:** Aprobado

## Problema

Durante la grabación de pantalla, el panel de Helpmeet (`.modal.screen-panel`) ocupa un área considerable y tapa el contenido que el usuario quiere ver o grabar. No hay forma de quitarlo de en medio sin detener la grabación.

## Solución

Añadir un botón **−** en la cabecera del panel que colapsa el modal a una única línea compacta, manteniendo todos los controles accesibles. Un botón **▲ Expandir** restaura el panel completo.

El colapso solo está disponible durante la grabación activa (no en el estado de preparación, donde el preview y la composición OBS son necesarios).

## Comportamiento

### Estado expandido (actual, sin cambios)

El panel muestra: cabecera con cronómetro + selector de monitor, campo de nombre de reunión, lienzo de preview (OBS), y fila de botones (Detener vídeo · Micro · Captura · Nota).

En la cabecera se añade el botón **−** (solo cuando `STATE.screenRecording === true`).

### Estado colapsado (nuevo)

Al pulsar **−**, el panel se colapsa ocultando:
- El campo de nombre de reunión (`.screen-setup`)
- El lienzo de preview (`.obs-canvas`)
- La fila de botones grandes

La cabecera permanece visible con una fila compacta:
```
● REC 00:08   Pantalla 2 · 1920×1080   [■ Detener] [Micro] [Captura] [Nota] [▲ Expandir]
```

Al pulsar **▲ Expandir** (o el mismo botón **−** que ahora muestra **+**), el panel vuelve a su estado completo.

### Estado recordado

`STATE.screenPanelCollapsed` persiste durante la sesión. Si el panel se vuelve a mostrar (p.ej., después de cerrar un modal sobre él), respeta el estado de colapso previo.

## Implementación

### Cambios en `app.js`

1. **Nuevo flag de estado:** `STATE.screenPanelCollapsed = false` en el objeto STATE.

2. **Botón − en el modal-head:** Añadir `<button id="scCollapse">` solo cuando `recording === true` en `showScreenPanel()`.

3. **Lógica de colapso:** El botón alterna la clase CSS `screen-panel--collapsed` en el elemento `.modal.screen-panel` y actualiza `STATE.screenPanelCollapsed`.

4. **Controles compactos en la cabecera:** Cuando el panel está colapsado, los botones Detener · Micro · Captura · Nota se muestran inline en la cabecera (ocultos por CSS en estado expandido). Estos botones son elementos HTML separados de los botones grandes; tienen sus propios `onclick` que llaman a las mismas funciones (`stopScreenRecording`, `toggleScreenMic`, `api.takeCapture`, `promptNote`). Se duplica el HTML pero no la lógica de negocio.

5. **`showScreenPanel()` respeta el estado:** Al final del render, si `STATE.screenPanelCollapsed && recording`, aplica la clase inmediatamente sin animación.

### Cambios en `style.css`

```css
/* Botón colapsar */
.sc-collapse-btn { /* estilo icon-btn pequeño */ }

/* Estado colapsado */
.screen-panel--collapsed .screen-setup,
.screen-panel--collapsed .obs-canvas,
.screen-panel--collapsed .sc-footer { display: none; }

.screen-panel--collapsed .sc-compact { display: flex; }
.sc-compact { display: none; }

/* Transición suave */
.screen-panel { transition: height 0.2s ease; overflow: hidden; }
```

### Sin cambios en Python/backend

El colapso es puramente visual (client-side). No requiere cambios en `app.py`, `recorder.py` ni ningún otro módulo Python.

## Casos límite

| Caso | Comportamiento |
|---|---|
| Usuario colapsa y luego abre un modal encima (p.ej., "Añadir nota") | `closeModal()` ya llama a `showScreenPanel()` si `STATE.screenPanelOpen`; respetará `STATE.screenPanelCollapsed` |
| Usuario colapsa y cambia de monitor | El selector de monitor en la cabecera compacta no aparece (no hay espacio); el cambio de monitor se hace expandiendo primero |
| Grabación termina mientras está colapsado | `stopScreenRecording()` ya cierra el modal con `closeModal()`; `STATE.screenPanelCollapsed` se resetea en `openScreenPanel()` |
| Estado de preparación (sin grabación activa) | El botón − no aparece; el panel siempre está expandido |

## Archivos afectados

- `helpmeet/ui/web/app.js` — STATE, `showScreenPanel()`, event listeners
- `helpmeet/ui/web/style.css` — clases `.screen-panel--collapsed`, `.sc-compact`, `.sc-collapse-btn`
- `helpmeet/ui/web/index.html` — sin cambios necesarios
