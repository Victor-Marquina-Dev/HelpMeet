# Guia de estandarizacion visual de Helpmeet

## Objetivo

Unificar la interfaz de Helpmeet bajo un solo modelo visual y de interaccion. La meta no es redisenar todo desde cero, sino ordenar lo que ya existe para que cada pantalla, modal, boton, lista, transicion y estado se sienta parte del mismo producto.

Esta guia toma como base el estado actual del proyecto:

- App desktop con `pywebview` / WebView2.
- Frontend principal en `helpmeet/ui/web/app.js`.
- Estilos centralizados en `helpmeet/ui/web/style.css`.
- Tema claro estilo Gmail ya avanzado.
- Componentes existentes: sidebar, rail, calendario, proyectos, reuniones, grabación de pantalla, recortador de video, diagnostico, tour, licencia, documentos, toasts y modales.

## Modelo visual recomendado

Helpmeet debe sentirse como una herramienta profesional de productividad: clara, ligera, rapida, organizada y confiable. El modelo recomendado es:

```text
Productividad tecnica + Gmail/Google Workspace + herramienta local profesional
```

No debe sentirse como landing page, dashboard decorativo ni app oscura experimental. La interfaz debe priorizar lectura, organizacion y acciones frecuentes.

## Principios de diseno

1. **Claridad sobre decoracion**
   - Cada elemento visible debe ayudar a navegar, entender estado o ejecutar una acción.
   - Evitar textos largos dentro de tarjetas, modales y filas.

2. **Densidad controlada**
   - Helpmeet maneja reuniones, proyectos, transcripciones y archivos; necesita ser escaneable.
   - Usar filas compactas, chips, iconos y metadatos cortos.

3. **Un solo lenguaje de superficies**
   - Fondo general: shell claro.
   - Contenido principal: superficie blanca.
   - Elementos repetidos: filas/tarjetas planas con hover suave.
   - Modales: superficie elevada con sombra.

4. **Acciones principales siempre reconocibles**
   - Grabar reunión, grabar pantalla, importar video y transcribir deben mantener jerarquia visual clara.
   - Las acciones destructivas siempre deben ser rojas y confirmadas.

5. **Movimiento sutil**
   - Animaciones cortas, funcionales y sin llamar demasiado la atencion.
   - Nunca animar texto largo, layout grande o estados criticos de forma exagerada.

## Tokens base

Los tokens viven en `:root` dentro de `helpmeet/ui/web/style.css`. La regla principal es: ningun componente nuevo deberia usar colores o duraciones sueltas si ya existe un token.

### Color

Usar estos grupos semanticos:

| Token | Uso |
|---|---|
| `--bg-app` | Fondo general de la ventana |
| `--bg-sidebar` | Sidebar y rail |
| `--bg-surface` | Tarjetas, paneles y filas |
| `--bg-elevated` | Modales, menus, popovers |
| `--bg-input` | Inputs, selects, campos |
| `--border-subtle` | Separadores suaves |
| `--border-strong` | Bordes de controles/tarjetas |
| `--text-primary` | Texto principal |
| `--text-secondary` | Texto secundario |
| `--text-muted` | Metadatos |
| `--text-faint` | Informacion de baja prioridad |
| `--accent` | Accion principal y foco |
| `--accent-hover` | Hover de acción principal |
| `--success` | Correcto/listo |
| `--warning` | Advertencia |
| `--danger` | Error/destructivo |
| `--recording` | Grabacion activa |

### Radios

| Token | Uso |
|---|---|
| `--r-sm` | Detalles pequenos, foco |
| `--r-md` | Botones, inputs, filas |
| `--r-lg` | Tarjetas y bloques |
| `--r-xl` | Modales o paneles especiales |
| `--r-pill` | Chips, badges, botones tipo pill |

Regla: no usar radios grandes por defecto. Helpmeet debe verse tecnico y ordenado. Las tarjetas deben mantenerse entre `6px` y `8px`, salvo modales o componentes especiales.

### Espaciado

Usar la escala:

```css
--sp-1: 4px;
--sp-2: 8px;
--sp-3: 12px;
--sp-4: 16px;
--sp-5: 20px;
--sp-6: 24px;
```

Reglas:

- Separacion interna de filas: `8px` a `12px`.
- Separacion entre secciones: `16px` a `24px`.
- Modales: `16px` a `20px`.
- Evitar margenes arbitrarios como `13px`, `17px`, `23px` salvo necesidad visual especifica.

### Tipografia

Fuente actual:

```css
--font-ui: 'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', ui-monospace, monospace;
```

Escala recomendada:

| Uso | Tamano |
|---|---:|
| Texto base app | `11.5px` - `12px` |
| Metadatos | `9.5px` - `10.5px` |
| Titulos de seccion | `13px` - `15px` |
| Titulos principales | `18px` - `22px` |
| Monoespaciado tiempo/version | `9px` - `10.5px` |

Reglas:

- No usar hero text dentro de paneles.
- Evitar `letter-spacing` negativo.
- Solo usar uppercase en labels pequenos y badges.

## Sistema de componentes

### Botones

Todas las acciones deben usar `.btn`, `.icon-btn` o variantes derivadas.

Modelo:

| Clase | Uso |
|---|---|
| `.btn` | Accion normal |
| `.btn-primary` | Accion principal positiva |
| `.btn-danger` | Destructiva |
| `.btn-ghost` | Accion secundaria ligera |
| `.btn.sm` | Acciones compactas |
| `.btn.lg` / `.btn-lg` | Acciones principales de modal o grabación |
| `.icon-btn` | Acciones con icono |

Reglas:

- No crear botones con estilos inline.
- Si hay icono existente en `ICONS`, usarlo.
- Acciones destructivas: texto claro + confirmación.
- Botones de texto largo deben acortarse antes de reducir tamano.

Mejora recomendada:

- Crear helper JS `buttonHTML({ icon, label, variant, size })` o `btnEl(...)` para evitar HTML repetido en `app.js`.

### Chips y badges

Usos:

- Estado: activa, pendiente, revocada, archivada.
- Filtros: calendario, proyectos, favoritos.
- Secciones de video.
- Version y actualizacion.

Reglas:

- Chips seleccionables usan borde + fondo suave.
- Chips informativos usan fondo ligero, sin parecer boton.
- Badges de error o peligro usan `--danger`, no naranja.

### Listas y filas

Las filas son el componente principal de Helpmeet.

Modelo recomendado:

```text
[icono/avatar] [titulo]
               [metadatos cortos]
                         [acciones al hover]
```

Reglas:

- Altura compacta.
- Hover suave con `--hover-soft` o `--hover-med`.
- Acciones ocultas hasta hover/focus, pero accesibles por teclado.
- Evitar tarjetas grandes para cada reunión si no aportan información.

Mejoras:

- Unificar `.row-card`, `.init-hub-row`, `.tree-meeting`, `.docs-card` bajo patrones comunes.
- Crear clases base:
  - `.hm-row`
  - `.hm-row__icon`
  - `.hm-row__body`
  - `.hm-row__title`
  - `.hm-row__meta`
  - `.hm-row__actions`

### Modales

Modelo:

```text
Header compacto
Contenido organizado
Footer de acciones
```

Reglas:

- Header siempre con titulo + cerrar.
- Acciones abajo, alineadas a la derecha.
- No poner textos explicativos largos si pueden ser resumen + tooltip.
- Modales de confirmación destructiva deben incluir nombre del elemento afectado.

Clases a consolidar:

- `.modal`
- `.modal-head`
- `.modal-body`
- `.modal-foot`
- `.diagnostics-modal`
- `.preflight-modal`
- `.docs-modal`

### Sidebar

Modelo actual correcto:

- Topbar de marca.
- Boton Nuevo proyecto.
- Accesos directos.
- Proyectos.
- Archivados / Configuracion abajo.

Mejoras:

- Consolidar estados activo/hover en una sola clase base.
- Mantener avatares de iniciales para proyectos.
- Evitar mezclar estilos de sidebar antiguo y nuevo.
- Crear un limite visual claro para proyectos fijados y recientes.

### Barra de acciones inferior

Debe ser el centro operativo:

- Grabar reunión.
- Grabar pantalla.
- Importar video.
- Captura/nota cuando hay grabación activa.

Mejoras:

- Mantener iconos constantes.
- Agregar transicion de cambio de estado `idle -> recording -> processing`.
- Cuando una acción no este disponible, mostrar tooltip corto.

### Diagnostico

El diagnostico ya se esta acercando al modelo correcto:

- Resumen superior.
- Checks en dos columnas.
- Detalles compactos.
- Acciones simples.

Reglas:

- No mostrar rutas completas salvo tooltip.
- No mostrar explicaciones largas en cada fila.
- Usar color solo para estado.

### Recortador de video

Modelo recomendado:

- Video.
- Controles compactos.
- Timeline con miniaturas.
- Secciones como chips.
- Footer con total a transcribir.

Mejoras:

- Animar creación/eliminación de seccion.
- Mostrar ahorro estimado: `0:08 de 0:29 · ahorras 72%`.
- Mantener `Seccion 1` como lenguaje final, no `Trozo`.
- Agregar tooltip en manijas: "Inicio" / "Fin".

## Motion design

Helpmeet debe usar microinteracciones consistentes. No todo necesita animacion.

### Tokens actuales

```css
--ease-out: cubic-bezier(.2, .8, .2, 1);
--ease-in: cubic-bezier(.4, 0, 1, 1);
--ease-standard: cubic-bezier(.4, 0, .2, 1);
--dur-hover: 120ms;
--dur-click: 80ms;
--dur-panel: 200ms;
--dur-toast: 220ms;
```

### Duraciones recomendadas

| Movimiento | Duracion |
|---|---:|
| Hover | `100ms` - `140ms` |
| Press/click | `60ms` - `90ms` |
| Modal entrada | `180ms` - `220ms` |
| Sidebar expand/collapse | `240ms` - `320ms` |
| Toast entrada/salida | `200ms` - `260ms` |
| Lista item fade | `120ms` - `180ms` |
| Progreso indeterminado | `900ms` - `1600ms` loop |

### Animaciones aprobadas

1. **Boton press**

```css
.btn:active { transform: scale(.98); }
.icon-btn:active { transform: scale(.94); }
```

2. **Modal in**

```css
@keyframes hmModalIn {
  from { opacity: 0; transform: scale(.98) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

3. **Toast in**

```css
@keyframes hmToastIn {
  from { opacity: 0; transform: translateY(10px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

4. **Fila nueva**

```css
@keyframes hmListItemIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

5. **Grabacion activa**

Usar pulso solo en:

- punto REC;
- rail superior;
- indicador de audio.

No pulsar toda la barra ni botones grandes.

### Animaciones a evitar

- Rebotes grandes.
- Gradientes animados decorativos.
- Transiciones de layout completas en listas largas.
- Animar color y sombra en demasiados elementos a la vez.
- Animaciones infinitas fuera de grabación/progreso.

### Accesibilidad motion

Mantener:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

## Transiciones por flujo

### Abrir proyecto

Recomendado:

- Fade de contenido `120ms`.
- Lista de reuniones con entrada escalonada máximo 6 items.
- Mantener sidebar estable, sin saltos.

### Abrir reunión

Recomendado:

- Cabecera aparece estable.
- Transcripcion sin animacion por cada frase antigua.
- Nueva frase en vivo puede usar fade-in suave.

### Iniciar grabación

Recomendado:

- Boton pasa a loading corto.
- Aparece rail REC.
- Barra inferior cambia a estado grabando con transicion `200ms`.
- Toast breve: "Grabando".

### Detener grabación

Recomendado:

- Estado `guardando/procesando`.
- No cerrar abruptamente paneles.
- Mostrar progreso si hay transcripción.

### Archivar/restaurar/eliminar

Recomendado:

- Al archivar: fila se desvanece `120ms` y luego se refresca.
- Restaurar: toast + contador actualizado.
- Eliminar permanente: confirmación fuerte, sin animacion alegre.

## Problemas visuales detectados

1. **CSS demasiado grande y acumulativo**
   - `style.css` contiene estilos antiguos, nuevos, especificos y overrides al final.
   - Riesgo: cambios pequenos rompen pantallas por cascada.

2. **Nombres de clases inconsistentes**
   - Hay mezcla de `row-card`, `init-hub-row`, `docs-card`, `clip-*`, `diag-*`, `setup-*`.
   - No es malo por dominio, pero falta una capa base comun.

3. **Uso de estilos inline en `app.js`**
   - Hay varios bloques HTML con `style="..."`.
   - Dificulta estandarizar espaciado, hover, responsive y tema oscuro/claro.

4. **Duplicacion de componentes**
   - Botones, filas, headers, empty states y footers aparecen recreados varias veces.

5. **Tema claro y oscuro no estan al mismo nivel**
   - Existe `body[data-theme="dark"]`, pero no todo parece tener equivalencia clara.
   - Si se mantiene dark mode, debe ser una variante oficial; si no, retirar deuda visual.

6. **Documentacion previa con decisiones viejas**
   - Algunos docs aun dicen "iniciativas" y "trozos".
   - La UI actual ya usa "proyectos" y "secciones".

## Estandar recomendado para nuevos componentes

Cada componente nuevo debe cumplir:

```text
1. Usa tokens existentes.
2. No usa colores hardcodeados salvo casos externos como OBS rojo.
3. Tiene hover/focus/disabled.
4. Funciona a 720px de ancho.
5. No depende de texto largo.
6. Tiene estado vacio.
7. Tiene estado loading si llama backend.
8. Respeta prefers-reduced-motion.
```

## Estructura CSS recomendada

Actualmente `style.css` es monolitico. Si se mantiene un solo archivo, ordenar asi:

```text
1. Tokens
2. Reset/base
3. Layout shell
4. Componentes base
   - botones
   - icon buttons
   - inputs
   - chips
   - filas
   - modales
   - toasts
   - menus
5. Componentes de app
   - topbar
   - sidebar
   - actionbar
   - calendario
   - proyecto
   - reunión
   - grabación pantalla
   - recortador video
   - diagnostico
   - licencia
   - documentos
6. Motion/keyframes
7. Responsive
8. Tema oscuro, si se conserva
```

Mejor opcion a mediano plazo:

```text
helpmeet/ui/web/styles/
  tokens.css
  base.css
  components.css
  shell.css
  views.css
  motion.css
```

Pero no migrar de golpe. Primero limpiar y consolidar dentro de `style.css`.

## Roadmap de mejora visual

### Fase 1: Limpieza sin cambiar apariencia

- Crear seccion `Componentes base` en CSS.
- Mover `.btn`, `.icon-btn`, `.row-card`, `.modal`, `.toast`, `.field`, `.chip` a esa seccion.
- Reemplazar colores sueltos por tokens.
- Eliminar estilos duplicados de sidebar viejo si ya no se usan.
- Cambiar estilos inline repetidos por clases.

Resultado: misma UI, menos fragil.

### Fase 2: Componentes compartidos en JS

Crear helpers en `app.js`:

```js
function buttonHTML({ icon, label, variant, size, disabled }) {}
function emptyStateHTML({ icon, title, text, action }) {}
function rowCardHTML({ icon, title, meta, actions }) {}
function confirmDanger({ title, body, actionLabel, onConfirm }) {}
```

Resultado: menos HTML manual y mas consistencia.

### Fase 3: Motion system

- Unificar keyframes con prefijo `hm`.
- Aplicar modal enter/exit.
- Aplicar toast enter/exit.
- Aplicar transiciones de sidebar/actionbar.
- Agregar animacion de secciones en recortador.
- Agregar skeletons para operaciones lentas.

Resultado: la app se siente mas fluida.

### Fase 4: Pulido por flujo

Pulir en este orden:

1. Onboarding y diagnostico.
2. Grabacion de pantalla.
3. Recortador de video.
4. Archivados/restaurar/eliminar.
5. Proyecto/reunión.
6. Calendario.
7. Documentos.
8. Licencia.

Resultado: los flujos principales quedan profesionales.

## Mejoras especificas recomendadas

### Sidebar

- Animar expansion/colapso solo con width/opacity.
- Mantener rail estable, sin saltos.
- Agregar tooltip en rail colapsado.
- Mostrar contador de Archivados con badge sutil.

### Proyecto

- Agregar header único de proyecto:
  - avatar;
  - nombre;
  - ultima actividad;
  - acciones compactas.
- Reuniones agrupadas por mes/semana con encabezados consistentes.
- Hover actions siempre iguales.

### Reunion

- Transcripcion con mejor ritmo visual:
  - nuevo segmento entra con fade;
  - acciones aparecen al hover;
  - marcador de busqueda con highlight estable.
- Capturas/notas con filas compactas.

### Grabacion pantalla

- Mantener el estilo OBS rojo solo dentro del selector de pantalla.
- No mezclar rojo OBS con rojo destructivo en botones cercanos.
- Agregar microcopy breve:
  - "Pantalla seleccionada"
  - "Composicion final"
  - "Arrastra para mover"

### Recortador video

- Animar chips de seccion al crear/eliminar.
- Mostrar bloque seleccionado con mejor contraste.
- Agregar zoom de timeline mas adelante.
- Agregar "transcribir todo" como acción secundaria si la seccion cubre 100%.

### Archivados

- Agregar descripción compacta:
  - "Los archivos se guardan en exports/Archivados."
- En eliminar permanente, mostrar ruta resumida.
- Al restaurar, mostrar toast: "Restaurado a Proyecto / mes".

### Diagnostico

- Mantener resumen superior.
- Agregar boton "Copiar diagnostico" para soporte.
- Tooltip para rutas completas.

### Licencia

- Unificar con el mismo sistema de modal/tarjeta.
- Evitar animaciones propias (`lic-*`) si ya existe motion global, salvo shake de error.

## Lista de tokens faltantes sugeridos

Agregar si se refactoriza:

```css
--danger-soft: rgba(217, 48, 37, .10);
--warning-soft: rgba(227, 116, 0, .10);
--success-soft: rgba(24, 128, 56, .10);
--recording-soft: rgba(217, 48, 37, .12);

--z-overlay: 80;
--z-toast: 90;
--z-tour: 12000;
--z-window-controls: 20000;
```

Tambien conviene nombrar sombras:

```css
--shadow-row-hover;
--shadow-popover;
--shadow-modal;
```

## Checklist para revisar una pantalla

Antes de dar por terminada una pantalla:

- [ ] Usa tokens, no colores sueltos.
- [ ] Tiene estado vacio.
- [ ] Tiene loading si espera backend.
- [ ] Tiene error claro.
- [ ] Los botones tienen jerarquia correcta.
- [ ] La acción destructiva pide confirmación.
- [ ] Texto largo se corta con ellipsis o tooltip.
- [ ] Funciona con sidebar colapsado.
- [ ] Funciona en ancho pequeno.
- [ ] No hay saltos de layout al hover.
- [ ] Respeta `prefers-reduced-motion`.

## Checklist de animacion

- [ ] La animacion dura menos de `320ms`.
- [ ] No bloquea interaccion.
- [ ] No mueve contenido critico inesperadamente.
- [ ] Tiene version reducida o queda desactivada con reduced motion.
- [ ] No usa loop infinito salvo progreso/grabación.
- [ ] Refuerza causalidad: clic -> cambio visible.

## Prioridad de implementacion

1. Limpiar tokens y duplicados CSS.
2. Quitar estilos inline repetidos en `app.js`.
3. Crear helpers de botones, empty states y filas.
4. Estandarizar modales y confirmaciones.
5. Unificar toasts y duraciones.
6. Pulir sidebar/actionbar.
7. Pulir recortador de video y grabación pantalla.
8. Pulir diagnostico/licencia/documentos.
9. Revisar tema oscuro o retirarlo temporalmente como opcion no oficial.

## Resultado esperado

Despues de aplicar esta guia, Helpmeet deberia sentirse:

- Mas consistente.
- Mas facil de mantener.
- Menos cargado visualmente.
- Mas profesional para venta.
- Mas fluido sin sentirse animado de mas.
- Preparado para crecer con nuevas funciones sin romper el diseno.

