# Diseño: rediseño de la vista Proyectos y barra lateral

**Fecha:** 2026-07-06
**Estado:** Aprobado (mockup validado por el usuario)
**Alcance:** solo frontend (`app.js`, `style.css`, `index.html`). Sin backend.

## 1. Objetivo

Reordenar y pulir la sección de proyectos, reutilizando lo que ya existe
(`viewAllInitiatives` — el "init-hub" — y su panel). El backend y la estructura
de datos no cambian; es un rediseño visual + un cambio en la barra lateral.

## 2. Cambios

### 2.1 Barra lateral
- **"Proyectos" como acceso**: la cabecera `#navInitiatives` pasa a verse como un
  ítem de navegación normal (mismo formato que Inicio/Favoritos/Calendario/
  Documentos → .md): icono de carpeta + "Proyectos" + contador. Al pulsarlo abre
  la vista `initiatives-list` (ya lo hace).
- **El árbol de iniciativas se mantiene DEBAJO** (el `#sidebarTree` actual con sus
  reuniones por semana). **No se toca** el estilo del desglose de cada iniciativa.
- Se conserva el poder plegar/expandir el árbol (chevron), pero la fila principal
  "Proyectos" luce como los demás accesos.

### 2.2 Vista Proyectos (`viewAllInitiatives` / init-hub) — restyle
- **Encabezado de la tabla en plomo, solo el encabezado** (`--bg-input`/plomo);
  las filas del cuerpo van sobre la superficie normal, no en gris.
- **Compacta**: letra pequeña como en la app actual (encabezado ~10px, celdas
  ~12.5px), filas con aire moderado (no apretadas).
- **Fila seleccionada resaltada**: barra/acento verde a la izquierda + fondo
  `--accent-soft`.
- **Filas de reunión desplegadas (desglose): SIN gris**, sobre la superficie, con
  letra pequeña (~10.5px). Se conserva el agrupado por mes/semana existente.
- **Indicador de proyecto compacto**: chevron + pin + punto de color + nombre (sin
  el cuadro/avatar grande).
- **Quitar el botón "Nuevo proyecto" redundante** del encabezado de la vista (ya
  está en la barra lateral). Crear proyecto sigue disponible desde el sidebar.
- Se conserva TODO el comportamiento actual: columnas redimensionables, chips de
  filtro (Todas/Fijadas), búsqueda, desplegar reuniones, menú por fila.

### 2.3 Panel de acciones rápidas (`init-hub-panel`)
- Ya existe (Abrir proyecto, Fijar, Editar, Exportar contexto, Archivar + datos).
- Restyle ligero para que combine con la tabla: cabecera con punto de color +
  nombre + botones (fijar / más / cerrar), bloque de datos (reuniones, pendientes
  en ámbar, última actividad, creada el) y lista de acciones con iconos; "Archivar"
  en color de peligro. Iconos SVG (sin emojis).

## 3. Restricciones
- **No romper** el comportamiento existente del init-hub (resize de columnas,
  filtros, expandir/colapsar reuniones, menú contextual, panel).
- Usar las **variables de tema** existentes (claro/oscuro).
- Iconos del set `ICONS`/`svg()` (sin emojis).

## 4. Archivos afectados
- `helpmeet/ui/web/index.html` (cabecera "Proyectos" como acceso; cache-bust)
- `helpmeet/ui/web/app.js` (`viewAllInitiatives`: estructura mínima — quitar botón
  redundante, clases del indicador/fila seleccionada/panel)
- `helpmeet/ui/web/style.css` (restyle de `.init-hub-*`, `.sb-projects-hdr`/nav
  item de Proyectos, filas de reunión sin gris, encabezado plomo, panel)

## 5. Referencia visual
Mockup aprobado (tabla compacta desplegable + panel de acciones rápidas), con
tokens reales de la app y claro/oscuro.
