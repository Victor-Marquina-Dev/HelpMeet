# Mejoras UI: Animaciones, Botones, Iconos y Componentes — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un sistema visual unificado en Helpmeet: tokens de animación, botones consistentes, microinteracciones suaves, toasts mejorados y helpers JS reutilizables.

**Architecture:** Todo el cambio ocurre en `style.css` (tokens + componentes CSS) y `app.js` (helpers JS). No se crean ficheros nuevos; se extienden los existentes con las variables y animaciones definidas en el spec. Las mejoras son aditivas: los componentes actuales se refinan, no se reescriben.

**Tech Stack:** CSS custom properties, CSS animations (keyframes), vanilla JS (helpers de botones/modales), pywebview/WebView2.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `helpmeet/ui/web/style.css` | Tokens animación, unificación botones, animaciones modales/toasts/listas |
| `helpmeet/ui/web/app.js` | Helpers JS: `btnEl()`, `emptyState()`, aplicar en screens clave |

---

## Fase 1: Tokens de diseño y variables de animación

### Tarea 1.1 — Añadir tokens de animación y espaciado a `:root`

**Archivos:**
- Modificar: `helpmeet/ui/web/style.css` — bloque `:root` (líneas 7-44)

- [ ] **Añadir al bloque `:root`** en `style.css` justo después de `--sidebar-w`:

```css
  /* Animación */
  --ease-out:      cubic-bezier(.2, .8, .2, 1);
  --ease-in:       cubic-bezier(.4, 0, 1, 1);
  --ease-standard: cubic-bezier(.4, 0, .2, 1);
  --dur-hover:   120ms;
  --dur-click:    80ms;
  --dur-panel:   200ms;
  --dur-toast:   220ms;
  /* Espaciado */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;
  --sp-4: 16px; --sp-5: 20px; --sp-6: 24px;
  /* Radios adicionales */
  --r-pill: 999px;
  /* Sombras */
  --shadow-soft: 0 10px 30px rgba(0,0,0,.20);
```

- [ ] **Verificar** que la app arranca sin errores CSS (`python -m helpmeet.main`).

---

### Tarea 1.2 — Unificar alturas y estados de botones

**Archivos:**
- Modificar: `helpmeet/ui/web/style.css` — bloque `.btn` (~línea 99)

Estado actual del `.btn`:
```css
.btn { height:36px; padding:0 14px; border-radius:var(--r-md); ... }
```

- [ ] **Reemplazar el bloque `.btn` base** para añadir transición y press state:

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 36px; padding: 0 14px; border-radius: var(--r-md);
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface); color: var(--text-primary);
  font-family: inherit; font-size: 11.9px; font-weight: 500;
  cursor: pointer; white-space: nowrap; outline: none;
  /* Transición unificada */
  transition:
    background var(--dur-hover) var(--ease-out),
    color      var(--dur-hover) var(--ease-out),
    border-color var(--dur-hover) var(--ease-out),
    transform  var(--dur-click) var(--ease-out);
}
.btn:hover { background: var(--bg-elevated); }
/* Press / click sutil */
.btn:active { transform: scale(.98); }
.btn:disabled, .btn.is-disabled {
  opacity: .45; cursor: not-allowed; pointer-events: none;
}
```

- [ ] **Añadir variante compacta** después del bloque `.btn`:

```css
.btn.sm { height: 28px; padding: 0 10px; font-size: 11px; }
.btn.lg { height: 44px; padding: 0 22px; font-size: 13px; }
```

- [ ] **Verificar** visualmente que los botones Cancelar / Guardar del formModal se ven correctos.

---

### Tarea 1.3 — Unificar icon-btn (transición + press)

**Archivos:**
- Modificar: `helpmeet/ui/web/style.css` — bloque `.icon-btn` (~línea 144)

- [ ] **Añadir transición al `.icon-btn`**:

```css
.icon-btn {
  /* existente ... */
  transition:
    background var(--dur-hover) var(--ease-out),
    color      var(--dur-hover) var(--ease-out),
    transform  var(--dur-click) var(--ease-out);
}
.icon-btn:active { transform: scale(.94); }
```

---

## Fase 2: Animaciones de entrada

### Tarea 2.1 — Modal con fade + slide suave

**Archivos:**
- Modificar: `helpmeet/ui/web/style.css` — zona de modales

- [ ] **Añadir animación al `.modal-card` y `.modal`**:

```css
/* Añadir DESPUÉS de las reglas de .modal-card existentes */
.modal-card, .modal {
  animation: modalIn var(--dur-panel) var(--ease-out);
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(.97) translateY(8px); }
  to   { opacity: 1; transform: scale(1)   translateY(0); }
}
/* El overlay fondo también hace fade */
#overlayRoot:not([hidden]) {
  animation: overlayIn var(--dur-panel) var(--ease-out);
}
@keyframes overlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

---

### Tarea 2.2 — Toast con animación y duración ajustada

**Archivos:**
- Modificar: `helpmeet/ui/web/style.css` — bloque `.toast`
- Modificar: `helpmeet/ui/web/app.js` — función `toast()`

- [ ] **CSS: mejorar animación del toast**:

```css
/* Buscar @keyframes toast-in y reemplazar */
@keyframes toast-in {
  from { opacity: 0; transform: translateY(10px) scale(.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
.toast {
  /* añadir a las propiedades existentes: */
  animation: toast-in var(--dur-toast) var(--ease-out);
}
```

- [ ] **JS: ajustar duraciones según tipo** en la función `toast()` en `app.js`:

```js
// Cambiar el timeout fijo de 3600 según kind:
const ms = kind === 'err' ? 4500 : kind === 'info' ? 3000 : 2500;
setTimeout(() => {
  t.style.opacity = '0';
  t.style.transition = `opacity .3s var(--ease-in)`;
  setTimeout(() => t.remove(), 320);
}, ms);
```

---

### Tarea 2.3 — Fade-in en listas de reuniones

**Archivos:**
- Modificar: `helpmeet/ui/web/style.css` — zona `.row-card`

- [ ] **Añadir animación de entrada a las cards de reunión**:

```css
/* Añadir a .row-card */
.row-card {
  animation: listItemIn 180ms var(--ease-out) both;
}
@keyframes listItemIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Escalonar items: max 8 → después sin delay */
.row-card:nth-child(1) { animation-delay:  0ms; }
.row-card:nth-child(2) { animation-delay: 20ms; }
.row-card:nth-child(3) { animation-delay: 40ms; }
.row-card:nth-child(4) { animation-delay: 60ms; }
.row-card:nth-child(5) { animation-delay: 80ms; }
.row-card:nth-child(6) { animation-delay: 100ms; }
.row-card:nth-child(7) { animation-delay: 120ms; }
.row-card:nth-child(8) { animation-delay: 140ms; }
```

---

## Fase 3: Helpers JS reutilizables

### Tarea 3.1 — Helper `btnEl()` para no repetir HTML de botones

**Archivos:**
- Modificar: `helpmeet/ui/web/app.js` — añadir al inicio (después de `const $ = ...`)

- [ ] **Añadir helper `btnEl` en `app.js`** justo después de `const el = ...`:

```js
/**
 * Crea un botón reutilizable.
 * @param {Object} opts
 * @param {string}   opts.label    - Texto visible
 * @param {string}  [opts.icon]    - Nombre de icono SVG (opcional)
 * @param {string}  [opts.variant] - 'primary' | 'danger' | 'ghost' | '' (default)
 * @param {string}  [opts.size]    - 'sm' | 'lg' | '' (default)
 * @param {boolean} [opts.disabled]
 * @param {Function}[opts.onClick]
 */
function btnEl({ label, icon, variant = '', size = '', disabled = false, onClick } = {}) {
  const cls = ['btn', variant ? `btn-${variant}` : '', size].filter(Boolean).join(' ');
  const b = el('button', cls);
  if (icon) b.appendChild(elFromHTML(`<span class="ico">${svg(icon, 14)}</span>`));
  b.appendChild(document.createTextNode(label));
  if (disabled) b.disabled = true;
  if (onClick) b.onclick = onClick;
  return b;
}
```

- [ ] **Verificar** creando un botón de prueba en la consola del devtools de pywebview:
```js
document.body.appendChild(btnEl({ label: 'Test', variant: 'primary', icon: 'check' }))
```

---

### Tarea 3.2 — Helper `emptyState()` unificado

**Archivos:**
- Modificar: `helpmeet/ui/web/app.js` — añadir junto a `btnEl`

- [ ] **Añadir helper `emptyState` en `app.js`**:

```js
/**
 * Crea el estado vacío estándar de Helpmeet.
 * @param {Object} opts
 * @param {string}   opts.icon    - Nombre de icono SVG
 * @param {string}   opts.title   - Título corto
 * @param {string}  [opts.text]   - Texto secundario (opcional)
 * @param {Object}  [opts.action] - { label, onClick } para el botón CTA
 */
function emptyState({ icon, title, text, action } = {}) {
  const w = el('div', 'empty');
  let html = `
    <div class="empty-watermark" aria-hidden="true">
      <span class="wm-square"></span><span class="wm-diamond"></span>
    </div>
    <div class="empty-inner">
      <div class="empty-logo">${svg(icon, 24)}</div>
      <h2 class="empty-title">${esc(title)}</h2>`;
  if (text) html += `<p>${esc(text)}</p>`;
  html += `</div>`;
  w.innerHTML = html;
  if (action) {
    const btn = btnEl({ label: action.label, variant: 'primary', onClick: action.onClick });
    btn.classList.add('btn-welcome');
    w.querySelector('.empty-inner').appendChild(btn);
  }
  return w;
}
```

- [ ] **Aplicar en `viewFavorites`** — reemplazar el bloque del estado vacío actual:

```js
// Reemplazar el content.appendChild(el('div', 'empty', `...`)) por:
content.appendChild(emptyState({
  icon: 'star',
  title: 'Sin favoritas aún',
  text: 'Usa el botón ☆ en cada reunión o el menú ⋯ para marcarla como favorita.',
}));
```

- [ ] **Aplicar en `viewWelcome`** — reemplazar el HTML actual:

```js
function viewWelcome() {
  return emptyState({
    icon: 'rocket',
    title: 'Helpmeet',
    text: 'Listo para capturar contexto. Crea una nueva iniciativa o usa la barra de acciones.',
    action: { label: '+ Nueva iniciativa', onClick: promptNewInitiative },
  });
}
```

---

## Fase 4: Focus visible y accesibilidad básica

### Tarea 4.1 — Focus ring consistente

**Archivos:**
- Modificar: `helpmeet/ui/web/style.css` — añadir después de `::selection`

- [ ] **Añadir focus ring global**:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}
/* Ocultar focus para mouse/touch */
:focus:not(:focus-visible) { outline: none; }
```

---

### Tarea 4.2 — Escape cierra menús contextuales

**Archivos:**
- Modificar: `helpmeet/ui/web/app.js` — listener `keydown` global

- [ ] **Verificar** que el `keydown` existente incluye cierre de menú contextual:

```js
// Buscar el listener de keydown y confirmar que tiene:
if (e.key === 'Escape') {
  if (!$('#overlayRoot').hidden) closeModal();
  closeMenu();   // ← debe estar
  return;
}
```

Si `closeMenu()` falta en ese Escape, añadirlo.

---

## Verificación final

- [ ] Abrir la app y navegar por: Iniciativas → reunión → modal de renombrar → toast → Favoritas → pantalla vacía.
- [ ] Confirmar que los botones tienen press scale, los modales hacen fade-in, los toasts duran el tiempo correcto según tipo.
- [ ] Confirmar que `emptyState()` y `btnEl()` generan HTML correcto sin consola errors.
- [ ] Ejecutar tests Python para confirmar que el backend no fue afectado:

```bash
cd d:\docu\02_Proyectos\3_ProyectosMimoTech\Helpmeet
.venv\Scripts\python.exe -m pytest tests/ -q --ignore=tests/test_video_recorder.py
```

Resultado esperado: **117 passed**.

---

## Commits sugeridos

```
feat(ui): add animation timing tokens and spacing vars to :root
feat(ui): unify btn height/transitions/press-state
feat(ui): modal fade-in animation + overlay fade
feat(ui): toast duration by kind + improved animation
feat(ui): list-item stagger fade-in
feat(ui): add btnEl() and emptyState() helpers
feat(ui): apply emptyState() in viewFavorites and viewWelcome
feat(ui): focus-visible ring + escape closes context menus
```
