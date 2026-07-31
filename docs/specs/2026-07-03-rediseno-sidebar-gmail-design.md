# Rediseño de la UI estilo Gmail — Diseño

**Fecha:** 2026-07-03
**Autor:** Víctor (dirección) + Claude (diseño técnico)
**Estado:** Aprobado el mockup visual (v3). Pendiente de escribir plan de implementación.

---

## Objetivo

Rediseñar la interfaz de Helpmeet para que se vea tan pulida y profesional como
Google Chat / Gmail, replicando su patrón visual: **sidebar sin recuadro** que
flota sobre el fondo, **contenido principal en una tarjeta blanca redondeada**,
iconos de línea profesionales (sin emojis), avatares de iniciales con color por
proyecto, y secciones colapsables ("Accesos directos", "Proyectos").

El trabajo se ejecuta **por fases**, y tras cada fase Víctor da su visto bueno
antes de continuar. Víctor no programa: cada fase debe dejar la app funcionando
y verse mejor que la anterior, sin pantallas rotas.

## Contexto y estado actual

Helpmeet es una app de escritorio Python (pywebview / WebView2, frameless en
Windows). La UI vive en `helpmeet/ui/web`:

- `index.html` — estructura: topbar, sidebar (`#sidebar`), rail colapsado
  (`#sidebarRail`), área principal (`#main`), barra de acciones (`#actionbar`),
  handles de resize de ventana (`.wr`).
- `app.js` — render por estado (`renderSidebar`, `renderMain`, `renderTopStatus`,
  `renderActionBar`); estado global `STATE`; puente `api.*` con Python.
- `style.css` — **tema oscuro** con tokens semánticos en `:root`
  (`--bg-app`, `--bg-sidebar`, `--text-primary`, `--accent`, etc.).

**Ventaja clave:** como el CSS ya usa variables semánticas, el cambio de tema
oscuro → claro se hace en su mayor parte **redefiniendo los tokens en `:root`**,
no reescribiendo cada componente. Esto reduce el riesgo enormemente.

El sidebar actual: nav plano (Calendario / Favoritos / Proyectos con un `＋` y un
`↺`) + árbol de proyectos (`#sidebarTree`, renderizado por `renderSidebar()`) +
pie con Archivados / Configuración. Los proyectos ya soportan fijado (`pinned`)
y expansión (`STATE.openInits`), y las reuniones cuelgan de cada proyecto.

## Decisiones de diseño (confirmadas con el mockup v3)

1. **Tema claro estilo Gmail.** Fondo general gris-azulado claro (`#f8fafd` sobre
   `#dfe3ea`). La app deja de ser oscura. Se replica el look de Gmail, que es
   claro. (Fuera de alcance por ahora: un conmutador claro/oscuro — YAGNI.)

2. **Barra superior:** logo "H" en verde menta + "Helpmeet" + chip de versión.
   **Sin buscador** en la barra (la búsqueda se mantiene como hoy, con Ctrl+K).
   La esquina derecha es para los **controles de ventana**: minimizar, maximizar,
   cerrar (cerrar con hover rojo, como Windows). Se conservan los controles
   frameless actuales; solo cambia su aspecto.

3. **Sidebar sin recuadro:** mismo fondo que la app (transparente), sin borde ni
   caja alrededor. Contiene, de arriba a abajo:
   - Botón **"Nuevo proyecto"** tipo píldora celeste (como "Nuevo chat" de Gmail).
   - Sección **"Accesos directos"** (colapsable, con triangulito): Inicio,
     Favoritos, Calendario. Iconos de línea. "Favoritos" muestra su contador.
   - Sección **"Proyectos"** (colapsable, con `＋` al pasar el ratón para crear):
     lista de proyectos, cada uno con **avatar de iniciales** con color, nombre,
     y estado (punto azul si hay algo nuevo). El proyecto activo se resalta con
     **píldora azul**. Al expandirse, sus reuniones aparecen indentadas con una
     línea guía vertical; las no vistas van en negrita con punto azul.
   - **"Mostrar todo"** al final de la lista de proyectos (si hay muchos).
   - **Pie** con Archivados (con contador) y Configuración, con iconos de línea.

4. **Avatares de iniciales:** cada proyecto genera 2 letras a partir de su nombre
   (p. ej. "Marketing Q3" → "MK", "Producto 2025" → "PR") y un color estable
   derivado del nombre (paleta Google: azul, verde, morado, naranja, teal…).

5. **Área principal en tarjeta:** el contenido de la derecha va en una **tarjeta
   blanca redondeada** con margen respecto al borde (como el panel de chat de
   Gmail). Cabecera de la tarjeta con el avatar del proyecto, su nombre y meta
   ("N reuniones · M transcripciones"), y acciones a la derecha.

6. **Tarjetas de reunión estilo Gmail:** dentro del proyecto, las reuniones se
   listan como tarjetas con icono redondo, título, subtítulo de estado
   ("Grabación 42 min · sin transcribir" / "Transcripción lista · Resumen
   generado") y un chip de acción a la derecha ("Transcribir" primario, "Ver
   notas" secundario). Opcionalmente agrupadas por día ("Hoy", "Ayer").

## Arquitectura de la solución

No se cambia la arquitectura de render (sigue `renderSidebar` / `renderMain` /
etc.). El rediseño es **CSS + ajustes de marcado**:

- **Tokens de tema (`:root` en `style.css`):** se crea un juego de valores claros.
  Esta es la palanca principal. Todo lo que ya usa las variables cambia solo.
- **Sidebar (`renderSidebar` + estructura en `index.html` + CSS):** se reestructura
  el marcado a: botón "Nuevo proyecto", sección "Accesos directos", sección
  "Proyectos" con filas de avatar. Se añade un helper `initialsFor(name)` y
  `avatarColorFor(name)` en `app.js`.
- **Área principal (`main-card`):** un contenedor con la tarjeta blanca redondeada;
  las vistas existentes (`viewInitiative`, `viewMeeting`, etc.) se renderizan
  dentro. Las tarjetas de reunión se re-estilan.
- **Topbar:** se ajusta el marcado de `.win-controls` y su CSS; se retira cualquier
  resto de buscador de la barra.

### Unidades y responsabilidades

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| Tokens de tema (`:root`) | Definir la paleta clara | — |
| `initialsFor` / `avatarColorFor` (app.js) | Iniciales + color estable por nombre | nombre del proyecto |
| Estructura del sidebar (index.html + renderSidebar) | Secciones "Accesos directos" y "Proyectos" con avatares | STATE.initiatives, STATE.openInits |
| `.main-card` (CSS) | Tarjeta blanca redondeada que envuelve `#main` | tokens de tema |
| Tarjetas de reunión (CSS) | Aspecto Gmail de las filas de reunión | tokens de tema, avatares |
| Topbar / win-controls (index.html + CSS) | Barra superior sin buscador + min/max/cerrar | controles frameless actuales |

## Plan por fases (con visto bueno entre cada una)

**Fase 1 — Base de tema claro + topbar.**
Redefinir los tokens de `:root` a la paleta clara y ajustar la barra superior
(logo, versión, controles de ventana min/max/cerrar; sin buscador). Al terminar,
la app entera se ve clara y coherente, aunque el sidebar aún tenga su estructura
vieja. *Resultado visible: la app ya no es oscura; se ve como Gmail en tono.*

**Fase 2 — Sidebar estilo Gmail.**
Botón "Nuevo proyecto" celeste; secciones "Accesos directos" (Inicio, Favoritos,
Calendario) y "Proyectos" con avatares de iniciales, píldora azul de selección,
reuniones indentadas con línea guía, "Mostrar todo"; pie con iconos. *Resultado
visible: el panel izquierdo es el de los mockups.*

**Fase 3 — Área principal en tarjeta.**
Envolver `#main` en la tarjeta blanca redondeada; re-estilar la cabecera del
proyecto (avatar + meta) y las tarjetas de reunión (icono redondo, chips de
acción). *Resultado visible: el contenido de la derecha se ve como el panel de
Gmail.*

**Fase 4 — Pulido y consistencia.**
Adaptar al tema claro los elementos que no heredan del todo: toasts, modales,
menús contextuales, la pantalla de licencia, el rail colapsado y los estados de
grabación. Negrita + punto azul en lo no visto. Revisar contraste/accesibilidad.

Cada fase incrementa el número de cache-buster (`?v=YYYYMMDD-NN`) en `index.html`.

## Manejo de errores y casos límite

- **Nombres de proyecto raros** (una sola palabra, emoji, vacío): `initialsFor`
  debe degradar con elegancia (1 letra si no hay dos palabras; un guion si vacío).
- **Muchos proyectos:** "Mostrar todo" controla el corte; por defecto se muestran
  los primeros N (p. ej. 8) más los fijados.
- **Rail colapsado:** debe seguir funcionando; en Fase 4 se adapta al tema claro.
- **Contraste:** el tema claro debe mantener contraste AA en texto sobre fondos
  claros (el azul de acción `#0b57d0` sobre blanco cumple).
- **Sin proyectos:** el estado vacío ("Sin proyectos") se mantiene, re-estilado.

## Estrategia de pruebas

Es un rediseño principalmente visual, así que la verificación es sobre todo
**lanzar la app y mirarla** tras cada fase (skill `run`), además de:

- `node --check helpmeet/ui/web/app.js` tras cada cambio de JS.
- Suite de Python (`.\.venv\Scripts\python.exe -m pytest tests/ -q`) para
  confirmar que no se rompe el puente ni la lógica (baseline: 133 passed +
  2 fallos pre-existentes no relacionados).
- Los helpers puros nuevos (`initialsFor`, `avatarColorFor`) se pueden probar con
  asserts rápidos, pero al ser triviales, la prueba principal es visual.

## Fuera de alcance (YAGNI)

- Conmutador claro/oscuro (por ahora solo claro).
- Buscador global en la barra superior (la búsqueda sigue como hoy).
- Reordenar proyectos por arrastre, carpetas anidadas, o "Espacios" tipo Gmail.
- Cambios en el backend Python o en la lógica de transcripción.

## Rama de trabajo

El rediseño se hace en una rama nueva **encima de**
`feat/recorte-video-transcripción` para no perder el trabajo del recortador que
Víctor aún está validando. Nombre sugerido: `feat/rediseno-ui-gmail`.
