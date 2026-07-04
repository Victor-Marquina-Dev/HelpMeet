# Rediseño de UI estilo Gmail — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la UI de Helpmeet para replicar el patrón visual de Gmail/Google Chat (tema claro, sidebar sin recuadro, contenido en tarjeta blanca, avatares de iniciales por proyecto), ejecutado en 4 fases con visto bueno visual entre cada una.

**Architecture:** Rediseño CSS + ajustes de marcado, sin tocar la arquitectura de render (`renderSidebar` / `renderMain`). La palanca principal es redefinir los tokens semánticos de `:root` en `style.css` (el CSS ya los usa). Se tokenizan los hovers/selección hoy hardcodeados (`rgba(255,255,255,.0x)`) para que el tema claro sea coherente. Se añaden helpers puros en `app.js` (`initialsFor`, `avatarColorFor`) para los avatares.

**Tech Stack:** HTML/CSS/JS vanilla dentro de pywebview (WebView2). Sin frameworks. Iconos SVG inline vía helper `svg(name, size)`.

---

## Contexto imprescindible para quien ejecuta

- **Estructura:** `helpmeet/ui/web/index.html` (topbar `.topbar`, sidebar `#sidebar`, rail `#sidebarRail`, main `#main`, actionbar `#actionbar`, handles `.wr`). `app.js` renderiza por estado. `style.css` es tema oscuro con tokens en `:root`.
- **Cache buster:** `index.html` referencia `style.css?v=YYYYMMDD-NN` y `app.js?v=YYYYMMDD-NN`. **Incrementar el sufijo en cada cambio de CSS/JS** o WebView2 sirve la versión cacheada. Valor actual: `20260703-03`. Usa `20260703-04`, `-05`, … según avances.
- **BOM UTF-8:** `app.js` YA tiene BOM pre-existente en `main` — no lo quites ni lo añadas dos veces. `app.py` NO debe tener BOM. Tras editar con herramientas, si algo se rompe, verifica los primeros bytes.
- **Iconos:** se añaden a la constante `ICONS` en `app.js` (línea ~28) y se pintan con `svg('nombre', tamaño)`. El helper añade `fill=none stroke=currentColor` salvo para `dots`.
- **Verificación tras cada tarea:**
  - JS: `node --check helpmeet/ui/web/app.js` → "sin salida" = OK.
  - App: lanzar con `.venv\Scripts\python.exe -c "from helpmeet.ui.app import run; run()"` (en segundo plano) y **mirar** la pantalla (skill `run`). Es un rediseño visual: la prueba principal es mirar.
  - Python: `.\.venv\Scripts\python.exe -m pytest tests/ -q` → baseline **133 passed + 2 fallos pre-existentes** no relacionados (`test_whisper_model_status_not_downloaded`, `test_force_video_transcription_replaces_old_text_using_sidecar`). No debe bajar de ahí.
- **Rama:** crear `feat/rediseno-ui-gmail` desde `feat/recorte-video-transcripcion` antes de la Task 1.

## Decisión de color (confirmar en el visto bueno de Fase 1)

El mockup aprobado usa **azul Gmail** para lo interactivo (selección `#d3e3fd`, acciones `#0b57d0`, botón "Nuevo proyecto" `#c2e7ff`) y **verde menta** solo en el logo. El plan implementa eso. Si Víctor prefiere mantener el verde menta de marca como acento, es cambiar 3 tokens (`--accent`, `--sel-bg`, `--newbtn-bg`) — se resuelve en vivo durante su revisión de la Fase 1.

## File Structure

| Archivo | Responsabilidad en este rediseño |
|---|---|
| `helpmeet/ui/web/style.css` | Tokens del tema claro en `:root`; tokens de hover/selección; CSS de topbar, sidebar (avatares, secciones, píldora), `.main-card`, tarjetas de reunión, y pulido de overlays. |
| `helpmeet/ui/web/index.html` | Marcado nuevo de `.win-controls`; cache buster; envoltura `.main-card` alrededor de `#main` si hace falta. |
| `helpmeet/ui/web/app.js` | Iconos nuevos (`home`); helpers `initialsFor`/`avatarColorFor`; reestructura de `renderSidebar`/`_renderInitRow` (avatares, secciones, "Mostrar todo"). |
| `tests/ui/test_avatar_helpers.py` (nuevo, opcional) | No aplica: los helpers son JS. Se prueban con asserts JS vía `node`. Ver Task 5. |

---

# FASE 1 — Base de tema claro + topbar

Al terminar la fase, **toda la app se ve clara y coherente** (aunque el sidebar conserve su estructura vieja) y la barra superior tiene el aspecto Gmail con controles min/max/cerrar. Punto de visto bueno de Víctor.

### Task 1: Crear la rama de trabajo

**Files:** —

- [ ] **Step 1: Crear y cambiar a la rama**

```bash
cd "d:/docu/02_Proyectos/3_ProyectosMimoTech/Helpmeet"
git checkout -b feat/rediseno-ui-gmail
```

- [ ] **Step 2: Verificar**

Run: `git branch --show-current`
Expected: `feat/rediseno-ui-gmail`

---

### Task 2: Tokens del tema claro en `:root`

**Files:**
- Modify: `helpmeet/ui/web/style.css:7-59` (bloque `:root`)

- [ ] **Step 1: Reemplazar los valores de superficie/borde/texto/acento por la paleta clara**

En el bloque `:root` (líneas ~7-32) sustituye SOLO los valores de color (deja radios, tipografía, animación y espaciado igual). Añade los tokens nuevos de hover/selección/avatar al final del bloque de acentos:

```css
:root {
  /* Superficies — tema claro estilo Gmail */
  --bg-app: #f6f8fc;             /* shell claro gris-azulado (sidebar + topbar heredan) */
  --bg-sidebar: #f6f8fc;         /* el sidebar comparte el shell, sin recuadro */
  --bg-surface: #ffffff;         /* tarjetas, main-card, superficies elevadas */
  --bg-elevated: #ffffff;        /* menús/modales (con sombra) */
  --bg-input: #eaeef4;           /* campos e inputs */
  /* Bordes */
  --border-subtle: #e4e7ec;      /* separadores suaves */
  --border-strong: #d3d7de;      /* bordes de tarjetas/botones */
  /* Texto */
  --text-primary: #1f1f1f;       /* texto principal */
  --text-secondary: #444746;     /* texto secundario */
  --text-muted: #5f6368;         /* atenuado */
  --text-faint: #80868b;         /* muy atenuado */
  /* Acentos — azul Gmail para lo interactivo, verde menta solo en el logo */
  --accent: #0b57d0;             /* azul acción/selección */
  --accent-hover: #0842a0;
  --on-accent: #ffffff;          /* texto sobre azul */
  --accent-soft: rgba(11, 87, 208, 0.10);
  --success: #188038;            /* verde ok */
  --warning: #e37400;            /* ámbar */
  --danger: #d93025;             /* rojo */
  --recording: #d93025;
  --pending: #b06000;
  --focus: #0b57d0;
  /* Estilo Gmail: hovers, selección, avatares, botón nuevo */
  --hover-soft: rgba(60, 64, 67, 0.06);   /* hover muy sutil */
  --hover-med:  rgba(60, 64, 67, 0.09);   /* hover normal */
  --sel-bg:     #d3e3fd;                    /* píldora de selección azul */
  --sel-text:   #041e49;                    /* texto sobre píldora */
  --newbtn-bg:  #c2e7ff;                    /* botón "Nuevo proyecto" */
  --newbtn-text:#001d35;
  --brand-green:#10b981;                    /* logo Helpmeet */
  --brand-green-2:#34d399;
  /* … el resto del :root (radios --r-*, sombras, tipografía, animación,
     espaciado) se mantiene EXACTAMENTE como está … */
}
```

Ajusta también las sombras para que en claro sean más suaves (líneas ~38-39, 58):

```css
  --shadow-pop: 0 8px 28px rgba(60, 64, 67, 0.22);
  --shadow-modal: 0 16px 48px rgba(60, 64, 67, 0.28);
  --shadow-soft: 0 4px 16px rgba(60, 64, 67, 0.14);
```

- [ ] **Step 2: Ajustar la barra de scroll y `::selection` al tema claro**

Líneas ~77-84:

```css
::selection { background: rgba(11, 87, 208, 0.20); }

::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-thumb {
  background: #c4c9d0; border-radius: 6px;
  border: 3px solid transparent; background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: #aab0b8; background-clip: padding-box; }
```

- [ ] **Step 3: Incrementar el cache buster**

En `index.html`, cambia `style.css?v=20260703-03` y `app.js?v=20260703-03` a `?v=20260703-04` (ambos).

- [ ] **Step 4: Verificar en la app**

Lanza la app y míra­la. Toda la superficie debe verse clara. Es esperable que algunos hovers/selecciones "desaparezcan" (blanco sobre blanco) — se arreglan en la Task 3.

- [ ] **Step 5: Commit**

```bash
git add helpmeet/ui/web/style.css helpmeet/ui/web/index.html
git commit -m "feat(rediseño): tema claro base — tokens :root estilo Gmail"
```

---

### Task 3: Tokenizar hovers y selección hardcodeados

**Files:**
- Modify: `helpmeet/ui/web/style.css` (50 ocurrencias de `rgba(255,255,255,.0x)`)

- [ ] **Step 1: Reemplazar los blancos translúcidos por tokens**

Estos servían de hover/selección en tema oscuro; en claro se vuelven invisibles. Haz reemplazo global por su equivalente semántico:

- `rgba(255,255,255,.04)` → `var(--hover-soft)`
- `rgba(255,255,255,.05)` → `var(--hover-soft)`
- `rgba(255,255,255,.06)` → `var(--hover-med)`
- `rgba(255,255,255,.07)` → `var(--hover-med)`
- Cualquier otro `rgba(255,255,255,.1x)` de fondo → `var(--hover-med)`

Nota: los `.wc-btn` usan `rgba(255,255,255,.05/.07)` — quedan cubiertos por lo anterior y se re-tratan en la Task 4.

- [ ] **Step 2: Revisar los `#fff` de texto en hover**

Busca `color: #fff` en hovers (p. ej. `.wc-btn:hover { … color: #fff }`) y cámbialos a `var(--text-primary)` salvo donde el fondo sea de color fuerte (p. ej. `.wc-close:hover` sobre rojo mantiene `#fff`).

- [ ] **Step 3: Verificar**

Run: (mirar la app) — los hovers de sidebar/nav vuelven a notarse como un gris muy sutil; la selección de proyecto se ve como un fondo gris claro (la píldora azul llega en Fase 2).

- [ ] **Step 4: Commit**

```bash
git add helpmeet/ui/web/style.css
git commit -m "feat(rediseño): tokenizar hovers/selección para el tema claro"
```

---

### Task 4: Topbar estilo Gmail (logo, versión, controles de ventana)

**Files:**
- Modify: `helpmeet/ui/web/style.css:195-255` (`.topbar`, `.brand*`, `.win-controls`, `.wc-btn`)
- Modify: `helpmeet/ui/web/index.html:17-34` (marcado de controles, opcional)

- [ ] **Step 1: Ajustar `.topbar` y `.brand` al tema claro**

```css
.topbar {
  flex: none; height: 48px; display: flex; align-items: center; gap: 14px;
  padding: 0 0 0 12px; border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-app); z-index: 10000; position: relative;
}
.brand-mark {
  width: 30px; height: 30px; border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--brand-green-2), var(--brand-green));
  display: flex; align-items: center; justify-content: center; flex: none;
}
.brand-name { font-size: 15px; font-weight: 600; letter-spacing: -.2px; line-height: 1; padding-bottom: 3px; color: var(--text-secondary); }
.brand-version { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); background: #eef1f5; border-radius: 10px; padding: 2px 7px; line-height: 1; align-self: center; }
```

(Si `.brand-mark img` deja de verse bien sobre el verde, mantenlo; el símbolo blanco de Helpmeet contrasta con el verde.)

- [ ] **Step 2: Rediseñar los controles de ventana (min/max/cerrar) estilo Windows 11 claro**

```css
.win-controls { display: flex; align-items: center; height: 48px; margin-left: auto; gap: 0; padding: 0; }
.wc-btn {
  width: 46px; height: 48px; border: none; background: transparent; border-radius: 0;
  color: var(--text-secondary); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .1s, color .1s;
}
.wc-btn:hover { background: var(--hover-med); color: var(--text-primary); }
.wc-close:hover { background: #e81123; color: #fff; }
.wc-min svg, .wc-max svg, .wc-close svg { display: block; pointer-events: none; }
```

- [ ] **Step 3: Confirmar que la barra no tiene buscador**

El buscador (`.search`) NO va en la topbar en este diseño. Si está presente en la topbar, déjalo funcional pero fuera de la vista principal (la búsqueda sigue con Ctrl+K, `openSearch()`). No lo elimines del DOM salvo que esté claramente en la barra; en ese caso muévelo/ocúltalo. Verifica dónde se inyecta antes de tocar (buscar `#search` en `app.js` e `index.html`).

- [ ] **Step 4: Incrementar cache buster** a `20260703-05` en `index.html` (ambos).

- [ ] **Step 5: Verificar en la app** — barra superior clara, logo verde, versión en chip, esquina derecha con min/max/cerrar (cerrar se pone rojo al pasar el ratón).

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/style.css helpmeet/ui/web/index.html
git commit -m "feat(rediseño): topbar clara estilo Gmail con controles de ventana"
```

**⏸ VISTO BUENO DE VÍCTOR (Fase 1).** Mostrar la app y confirmar el tema claro + topbar (y la decisión azul vs. verde) antes de seguir.

---

# FASE 2 — Sidebar estilo Gmail

Al terminar: el panel izquierdo es el de los mockups (botón "Nuevo proyecto", secciones, avatares, píldora azul, "Mostrar todo", pie con iconos). Punto de visto bueno.

### Task 5: Helpers `initialsFor` y `avatarColorFor`

**Files:**
- Modify: `helpmeet/ui/web/app.js` (junto a otros helpers, tras `svg()`/`ico()` ~línea 86)

- [ ] **Step 1: Escribir un test JS temporal que falle**

Crea `helpmeet/ui/web/_avatar_test.mjs` (temporal, se borra al final):

```js
import assert from 'node:assert';
// Copias de trabajo — se sustituyen por import tras implementar en app.js
import { initialsFor, avatarColorFor } from './_avatar_impl.mjs';

assert.equal(initialsFor('Marketing Q3'), 'MQ');
assert.equal(initialsFor('Producto 2025'), 'P2');
assert.equal(initialsFor('legal'), 'LE');
assert.equal(initialsFor(''), '·');
assert.equal(initialsFor('  '), '·');
// color estable: mismo nombre → mismo color; de la paleta
const c1 = avatarColorFor('Marketing Q3');
const c2 = avatarColorFor('Marketing Q3');
assert.equal(c1, c2);
assert.ok(/^#([0-9a-f]{6})$/i.test(c1));
console.log('OK avatar helpers');
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `node helpmeet/ui/web/_avatar_test.mjs`
Expected: FAIL (no existe `_avatar_impl.mjs`).

- [ ] **Step 3: Implementar los helpers**

En `_avatar_impl.mjs` (temporal, para el test) y **también** en `app.js` (tras `ico()`), añade:

```js
// Iniciales de 2 letras a partir del nombre del proyecto.
// Dos palabras → primera letra de cada una; una palabra → sus 2 primeras;
// vacío → "·".
function initialsFor(name) {
  const s = (name || '').trim();
  if (!s) return '·';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

// Color estable derivado del nombre (paleta Google Material).
function avatarColorFor(name) {
  const palette = ['#1a73e8', '#188038', '#a142f4', '#e8710a', '#12a4af', '#d93025', '#9334e6', '#1e8e3e'];
  const s = (name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
```

En `_avatar_impl.mjs` añade `export { initialsFor, avatarColorFor };`. En `app.js` NO se exporta (es script global).

- [ ] **Step 4: Ejecutar el test**

Run: `node helpmeet/ui/web/_avatar_test.mjs`
Expected: `OK avatar helpers`

- [ ] **Step 5: Borrar los archivos temporales y validar app.js**

```bash
rm helpmeet/ui/web/_avatar_test.mjs helpmeet/ui/web/_avatar_impl.mjs
node --check helpmeet/ui/web/app.js
```
Expected: sin salida (OK).

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/app.js
git commit -m "feat(rediseño): helpers initialsFor y avatarColorFor para avatares"
```

---

### Task 6: Icono `home` y botón "Nuevo proyecto"

**Files:**
- Modify: `helpmeet/ui/web/app.js:28-80` (ICONS), `index.html` (sidebar), `style.css`

- [ ] **Step 1: Añadir el icono `home` a `ICONS`**

```js
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
```

- [ ] **Step 2: Añadir el botón "Nuevo proyecto" al principio del sidebar**

En `index.html`, dentro de `<aside class="sidebar">` antes de `.sidebar-nav`, añade:

```html
<button class="new-project-btn no-drag" id="btnNewProjectTop">
  <span class="np-ico"></span><span>Nuevo proyecto</span>
</button>
```

En `app.js`, donde se cablean los botones del sidebar (buscar `btnNewInitiative` y su `onclick`), añade el mismo handler para `#btnNewProjectTop` (reutiliza la función que abre el modal de nuevo proyecto). Rellena el icono: `$('#btnNewProjectTop .np-ico').innerHTML = svg('plus', 20);` en el arranque, junto a las otras inyecciones de iconos.

- [ ] **Step 3: CSS del botón**

```css
.new-project-btn {
  display: inline-flex; align-items: center; gap: 10px;
  align-self: flex-start; margin: 10px 8px 8px 10px;
  height: 46px; padding: 0 20px 0 14px;
  background: var(--newbtn-bg); color: var(--newbtn-text);
  border: none; border-radius: 15px;
  font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: box-shadow .15s;
}
.new-project-btn:hover { box-shadow: 0 1px 3px rgba(60,64,67,.3); }
.new-project-btn svg { fill: var(--newbtn-text); stroke: none; }
```

- [ ] **Step 4: Incrementar cache buster** a `20260703-06`.

- [ ] **Step 5: Verificar** (app) — botón celeste "Nuevo proyecto" arriba; al pulsarlo abre el modal de crear proyecto.

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/app.js helpmeet/ui/web/index.html helpmeet/ui/web/style.css
git commit -m "feat(rediseño): botón 'Nuevo proyecto' celeste + icono home"
```

---

### Task 7: Secciones "Accesos directos" y avatares de proyecto

**Files:**
- Modify: `helpmeet/ui/web/app.js:3258-3347` (`_renderInitRow`), `index.html` (nav), `style.css`

- [ ] **Step 1: Convertir el nav superior en sección "Accesos directos" con iconos**

En `index.html`, la `.sidebar-nav` actual tiene Calendario/Favoritos/Proyectos. Reorganiza a: una cabecera "Accesos directos" + Inicio, Favoritos, Calendario, cada uno con su icono. Mantén los `id` existentes (`navMeetings`, `navFavorites`) para no romper handlers; añade `navHome` para Inicio (que lleva a `welcome`). Rellena iconos en el arranque con `svg('home'|'star'|'calendar', 20)`.

```html
<div class="sb-section-title">Accesos directos</div>
<button class="side-item" id="navHome"><span class="si-ico"></span><span class="si-label">Inicio</span></button>
<button class="side-item" id="navFavorites"><span class="si-ico"></span><span class="si-label">Favoritos</span><span class="si-count" id="favCount"></span></button>
<button class="side-item" id="navMeetings"><span class="si-ico"></span><span class="si-label">Calendario</span></button>
```

`#navHome.onclick` → `STATE.screen='welcome'; renderSidebar(); renderMain();` (mira cómo lo hacen los otros nav en `app.js`).

- [ ] **Step 2: CSS de sección e ítem tipo Gmail (píldora)**

```css
.sb-section-title {
  padding: 12px 12px 4px 16px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
}
.side-item {
  display: flex; align-items: center; gap: 12px;
  width: calc(100% - 8px); margin: 1px 0; padding: 0 12px 0 14px;
  height: 34px; border: none; background: transparent;
  border-radius: 0 17px 17px 0; cursor: pointer;
  font-family: inherit; font-size: 14px; color: var(--text-secondary);
  transition: background .12s, color .12s;
}
.side-item:hover { background: var(--hover-soft); color: var(--text-primary); }
.side-item.active { background: var(--sel-bg); color: var(--sel-text); font-weight: 600; }
.side-item .si-ico { display: inline-flex; width: 20px; }
.side-item .si-ico svg { width: 20px; height: 20px; }
.side-item .si-label { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.side-item .si-count { font-size: 12px; color: var(--text-muted); }
```

- [ ] **Step 3: Reemplazar el `init-dot` por avatar en `_renderInitRow`**

En `_renderInitRow` (línea ~3265), sustituye el `<span class="init-dot">` por un avatar de iniciales. Cambia también la clase de fila a la píldora Gmail y usa `--sel-bg` para selección (ya cubierto por CSS de `.tree-initiative.selected` que actualizarás en el Step 4):

```js
  const av = `<span class="proj-av" style="background:${avatarColorFor(it.name)}">${esc(initialsFor(it.name))}</span>`;
  row.innerHTML = `<span class="chev">${svg('chevron', 14)}</span>${av}<span class="name">${esc(it.name)}</span>${it.pinned ? '<span class="pin-ind">' + svg('pin', 12) + '</span>' : ''}<span class="count">${ms.length || ''}</span>`;
```

- [ ] **Step 4: CSS del avatar y píldora de selección del proyecto**

```css
.proj-av {
  width: 26px; height: 26px; border-radius: 50%; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
}
.tree-initiative {
  gap: 10px; padding: 4px 12px 4px 10px; border-left: none;
  border-radius: 0 17px 17px 0; margin: 1px 8px 1px 0;
}
.tree-initiative:hover { background: var(--hover-soft); }
.tree-initiative.selected { background: var(--sel-bg); color: var(--sel-text); border-left: none; }
.tree-initiative .chev { color: var(--text-faint); }
```

- [ ] **Step 5: Incrementar cache buster** a `20260703-07`. Validar `node --check`.

- [ ] **Step 6: Verificar** (app) — sección "Accesos directos" con Inicio/Favoritos/Calendario; proyectos con avatar de iniciales de color; selección en píldora azul.

- [ ] **Step 7: Commit**

```bash
git add helpmeet/ui/web/app.js helpmeet/ui/web/index.html helpmeet/ui/web/style.css
git commit -m "feat(rediseño): sección Accesos directos + avatares de proyecto"
```

---

### Task 8: Reuniones indentadas con línea guía + "Mostrar todo" + pie

**Files:**
- Modify: `helpmeet/ui/web/app.js` (`_renderInitRow` reuniones, `renderSidebar` para "Mostrar todo"), `style.css`

- [ ] **Step 1: Re-estilar las reuniones al estilo Gmail (indentación + línea guía)**

Las reuniones ya se pintan (`.tree-meeting`) dentro de `.tree-meetings`. Ajusta el CSS para la línea guía vertical y la píldora:

```css
.tree-meeting {
  gap: 10px; padding: 4px 12px 4px 30px; margin-left: 26px;
  border-radius: 0 15px 15px 0; position: relative; font-size: 13px;
}
.tree-meeting::before {
  content: ''; position: absolute; left: 14px; top: 0; bottom: 0;
  width: 1.5px; background: var(--border-strong);
}
.tree-meeting:hover { background: var(--hover-soft); color: var(--text-primary); }
.tree-meeting.selected { background: var(--sel-bg); color: var(--sel-text); }
```

- [ ] **Step 2: Añadir "Mostrar todo" al final de la lista de proyectos**

En `renderSidebar` (línea ~3349), tras pintar las filas, si `all.length > VISIBLE_LIMIT` (define `const VISIBLE_LIMIT = 8;`) y no está expandido (`STATE.showAllProjects`), muestra solo los primeros y añade una fila "Mostrar todo":

```js
  const VISIBLE_LIMIT = 8;
  const showAll = !!STATE.showAllProjects;
  const visible = showAll ? rest : rest.slice(0, VISIBLE_LIMIT);
  visible.forEach(it => _renderInitRow(tree, it));
  if (!showAll && rest.length > VISIBLE_LIMIT) {
    const more = el('div', 'sb-show-more');
    more.innerHTML = `<span class="sm-ico">${svg('chevronDown', 16)}</span><span>Mostrar todo</span>`;
    more.onclick = () => { STATE.showAllProjects = true; renderSidebar(); };
    tree.appendChild(more);
  }
```

(Sustituye el `rest.forEach(...)` actual de la línea ~3367 por este bloque. Los fijados se siguen pintando aparte, arriba.)

- [ ] **Step 3: CSS de "Mostrar todo" y del pie con iconos**

```css
.sb-show-more {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 14px; margin: 2px 8px 2px 0;
  border-radius: 0 15px 15px 0; cursor: pointer;
  font-size: 13px; color: var(--text-muted);
}
.sb-show-more:hover { background: var(--hover-soft); color: var(--text-primary); }
.side-link { border-left: none; border-radius: 0 17px 17px 0; gap: 12px; }
.side-link:hover { background: var(--hover-soft); }
```

Añade iconos al pie (Archivados/Configuración) rellenando en el arranque: `svg('archive', 20)` y `svg('settings', 20)` en un `<span class="sl-ico">` dentro de cada `.side-link` (edita `index.html` para añadir el span).

- [ ] **Step 4: Incrementar cache buster** a `20260703-08`. Validar `node --check`.

- [ ] **Step 5: Verificar** (app) — reuniones con línea guía; "Mostrar todo" si hay >8 proyectos; pie con iconos.

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/app.js helpmeet/ui/web/index.html helpmeet/ui/web/style.css
git commit -m "feat(rediseño): reuniones indentadas, 'Mostrar todo' y pie con iconos"
```

**⏸ VISTO BUENO DE VÍCTOR (Fase 2).** Mostrar el sidebar completo antes de seguir.

---

# FASE 3 — Área principal en tarjeta

Envolver `#main` en la tarjeta blanca redondeada y re-estilar la cabecera del proyecto y las tarjetas de reunión. Punto de visto bueno.

### Task 9: Tarjeta blanca redondeada alrededor de `#main`

**Files:**
- Modify: `helpmeet/ui/web/style.css` (`.body`, `.main`)

- [ ] **Step 1: Dar a `.main` el aspecto de tarjeta**

El `.body` es el contenedor flex (sidebar + main). Aplica a `.main` fondo blanco, borde redondeado y margen para que "flote" sobre el shell claro:

```css
.main {
  flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  margin: 0 12px 12px 4px;
}
```

Verifica que el `.body` no imponga un fondo que tape el shell (`--bg-app`). Si el contenido interno asumía fondo `--bg-app`, revísalo al mirar la app.

- [ ] **Step 2: Incrementar cache buster** a `20260703-09`.

- [ ] **Step 3: Verificar** (app) — el área derecha es una tarjeta blanca redondeada con margen; el sidebar queda sobre el shell claro sin recuadro.

- [ ] **Step 4: Commit**

```bash
git add helpmeet/ui/web/style.css helpmeet/ui/web/index.html
git commit -m "feat(rediseño): área principal como tarjeta blanca redondeada"
```

---

### Task 10: Cabecera de proyecto y tarjetas de reunión estilo Gmail

**Files:**
- Modify: `helpmeet/ui/web/app.js:1054+` (`viewInitiative` y el render de filas de reunión de la vista principal), `style.css`

- [ ] **Step 1: Explorar `viewInitiative` y su render de reuniones**

Antes de tocar, lee `viewInitiative()` (línea ~1054) para ver cómo pinta la cabecera del proyecto y la lista de reuniones en el área principal (no confundir con el árbol del sidebar). Identifica las clases que usa para las filas/tarjetas de reunión.

- [ ] **Step 2: Cabecera de proyecto con avatar + meta**

En la cabecera de `viewInitiative`, antepón el avatar del proyecto (reutiliza `initialsFor`/`avatarColorFor`) y muestra meta "N reuniones · M transcripciones". CSS:

```css
.proj-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border-subtle); }
.proj-header .proj-av { width: 34px; height: 34px; font-size: 12.5px; }
.proj-header .ph-title { font-size: 16.5px; font-weight: 600; color: var(--text-primary); }
.proj-header .ph-meta { font-size: 12.5px; color: var(--text-muted); margin-top: 1px; }
```

- [ ] **Step 3: Tarjetas de reunión con icono redondo y chip de acción**

Re-estila las filas de reunión de la vista principal como tarjetas:

```css
.meet-card {
  display: flex; align-items: center; gap: 16px;
  border: 1px solid var(--border-strong); border-radius: 12px;
  padding: 14px 18px; margin: 0 20px 12px; cursor: pointer;
  transition: box-shadow .15s;
}
.meet-card:hover { box-shadow: 0 1px 6px rgba(60,64,67,.15); }
.meet-card .mc-ic { width: 40px; height: 40px; border-radius: 50%; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; flex: none; }
.meet-card .mc-ic svg { width: 20px; height: 20px; color: var(--accent); }
.meet-card .mc-info { flex: 1; min-width: 0; }
.meet-card .mc-title { font-size: 14.5px; font-weight: 500; color: var(--text-primary); }
.meet-card .mc-sub { font-size: 12.5px; color: var(--text-muted); margin-top: 3px; }
.meet-chip { border: 1px solid var(--border-strong); border-radius: 16px; padding: 7px 16px; font-size: 13px; font-weight: 500; color: var(--accent); cursor: pointer; white-space: nowrap; background: transparent; }
.meet-chip:hover { background: var(--accent-soft); }
.meet-chip.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
```

Aplica estas clases en el marcado que genera `viewInitiative` (adapta los nombres a lo que exista; si ya hay tarjetas, ajústalas en vez de duplicar).

- [ ] **Step 4: Incrementar cache buster** a `20260703-10`. Validar `node --check`.

- [ ] **Step 5: Verificar** (app) — cabecera de proyecto con avatar; reuniones como tarjetas con chip "Transcribir"/"Ver notas".

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/app.js helpmeet/ui/web/style.css
git commit -m "feat(rediseño): cabecera de proyecto y tarjetas de reunión estilo Gmail"
```

**⏸ VISTO BUENO DE VÍCTOR (Fase 3).**

---

# FASE 4 — Pulido y consistencia

Adaptar al tema claro lo que no hereda del todo. Punto de visto bueno final.

### Task 11: Overlays, menús, toasts, licencia y rail

**Files:**
- Modify: `helpmeet/ui/web/style.css` (secciones de `.overlay`, `.modal`, `.menu`, `.toast`, `.license-*`, `.sidebar-rail`)

- [ ] **Step 1: Revisar cada overlay sobre el tema claro**

Lanza la app y abre, uno a uno: un menú contextual (clic derecho en proyecto), un modal (crear proyecto), un toast (cualquier acción), la pantalla de licencia (si accesible), y el rail colapsado (colapsar el sidebar). Anota cuáles se ven mal (texto ilegible, fondos oscuros residuales).

- [ ] **Step 2: Corregir los que hereden mal**

Para cada uno, asegúrate de que use tokens (`--bg-elevated`, `--text-primary`, `--border-subtle`, `--shadow-modal`) y no colores oscuros hardcodeados. Ejemplos habituales:

```css
.menu, .modal { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-modal); }
.toast { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-pop); }
.sidebar-rail { background: var(--bg-app); border-right: 1px solid var(--border-subtle); }
```

- [ ] **Step 3: Estados no vistos (negrita + punto azul)**

Donde el diseño lo pida (reuniones nuevas), aplica negrita y un punto azul. Si el estado "no visto" no existe aún en los datos, omítelo (YAGNI) y déjalo anotado.

- [ ] **Step 4: Contraste**

Verifica que el texto principal sobre fondos claros sea legible (AA). El azul `#0b57d0` sobre blanco y el `--sel-text` sobre `--sel-bg` cumplen.

- [ ] **Step 5: Incrementar cache buster** a `20260703-11`. `node --check` y `pytest` (baseline intacto).

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/style.css helpmeet/ui/web/app.js
git commit -m "feat(rediseño): pulido de overlays, menús, toasts y rail en tema claro"
```

**⏸ VISTO BUENO FINAL DE VÍCTOR (Fase 4).** Luego: revisión de código final y decidir merge (`superpowers:finishing-a-development-branch`).

---

## Verificación final (tras Fase 4)

- [ ] `node --check helpmeet/ui/web/app.js` → OK.
- [ ] `.\.venv\Scripts\python.exe -m pytest tests/ -q` → 133 passed + 2 pre-existentes.
- [ ] Recorrido visual completo: welcome, proyecto, reunión, búsqueda, archivados, configuración, licencia, rail colapsado, grabación (rail rojo).
- [ ] Sin colores oscuros residuales; sin BOM nuevo en `app.py`; `app.js` conserva su BOM original.

## Notas de riesgo

- **50 hovers hardcodeados:** la Task 3 los tokeniza en bloque; revisa visualmente que ninguno quede invisible.
- **`viewInitiative` desconocido en detalle:** la Task 10 empieza explorándolo; adapta nombres de clase a lo real en vez de asumir.
- **Buscador:** confirmar en la Task 4 dónde vive `#search` antes de moverlo/ocultarlo.
- **Decisión azul vs. verde:** resolver en el visto bueno de Fase 1; afecta 3 tokens.
