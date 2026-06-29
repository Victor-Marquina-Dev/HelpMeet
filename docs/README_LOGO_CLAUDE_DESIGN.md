# Brief de identidad y logo — Helpmeet

Este documento está preparado para entregarse directamente a Claude Design. El objetivo es diseñar un logo profesional y un sistema de marca pequeño, coherente con la interfaz que Helpmeet ya utiliza.

> Estado: se seleccionó e implementó el concepto **Capas de Contexto**. Tres bloques representan la transcripción convertida en información estructurada y recuperable. Los SVG vigentes están en `helpmeet/ui/web/assets/`.

## 1. Qué es Helpmeet

Helpmeet es una aplicación de escritorio para Windows que convierte reuniones y grabaciones de pantalla en conocimiento organizado.

Funciones principales:

- Graba el micrófono del usuario y el audio de los demás en pistas separadas.
- Graba la pantalla y permite cambiar de monitor durante la captura.
- Transcribe audio y video.
- Organiza el contenido por iniciativa, mes y reunión.
- Vincula frases, capturas de pantalla y notas con su momento exacto.
- Permite editar la transcripción, cambiar hablantes y marcar contenido importante.
- Recupera grabaciones después de un cierre inesperado.
- Exporta el contexto a Markdown para trabajar posteriormente con Claude.

La idea central de la marca es:

> Convertir conversaciones efímeras en contexto claro, recuperable y útil.

## 2. Personalidad de marca

El logo debe transmitir:

- Claridad: ordena información compleja sin generar ruido.
- Confianza: una grabación importante no debería perderse.
- Precisión: audio, texto, tiempo y capturas permanecen vinculados.
- Calma: es una herramienta de trabajo seria, no una red social ruidosa.
- Inteligencia práctica: usa IA como apoyo, sin una estética de ciencia ficción.
- Productividad profesional: debe sentirse apropiada para desarrollo, reuniones técnicas, producto, consultoría y documentación.

Adjetivos visuales: sobrio, moderno, compacto, reconocible, tecnológico, amable y preciso.

No debe sentirse: infantil, juguetón en exceso, corporativo genérico, recargado, futurista de neón ni similar a una aplicación de videollamadas.

## 3. Público principal

- Programadores y equipos técnicos.
- Product managers, diseñadores y consultores.
- Personas que documentan decisiones y tareas de reuniones.
- Usuarios que trabajan con Claude o herramientas de IA usando archivos Markdown.
- Equipos que necesitan conservar evidencia, contexto y acuerdos.

## 4. Identidad visual existente

La aplicación tiene un tema oscuro, con superficies azul-negras y un acento azul lavanda. La interfaz usa pocos colores y reserva cada color semántico para una función concreta.

### Paleta principal

| Uso | Token actual | Color |
|---|---|---|
| Fondo principal | `--bg-app` | `#0B0D12` |
| Barra lateral y superior | `--bg-sidebar` | `#10131A` |
| Superficies y botones | `--bg-surface` | `#151922` |
| Superficie elevada | `--bg-elevated` | `#1A1F2B` |
| Campos oscuros | `--bg-input` | `#0D1017` |
| Borde sutil | `--border-subtle` | `#262C38` |
| Borde fuerte | `--border-strong` | `#343C4C` |
| Texto principal | `--text-primary` | `#F1F4F8` |
| Texto secundario | `--text-secondary` | `#A6AFBF` |
| Texto atenuado | `--text-muted` | `#727D90` |
| Acento principal | `--accent` | `#6D8CFF` |
| Acento al pasar el cursor | `--accent-hover` | `#819CFF` |
| Violeta complementario | usado en el degradado actual | `#8A6DFF` |
| Éxito/audio activo | `--success` | `#34C78A` |
| Aviso/notas | `--warning` | `#F1B84B` |
| Error/eliminar | `--danger` | `#EF5B62` |
| Grabación activa | `--recording` | `#FF4D57` |

### Degradado de marca existente

El icono seleccionado utiliza un símbolo blanco sobre este degradado:

```css
background: linear-gradient(135deg, #6D8CFF, #8A6DFF);
```

El símbolo de Capas de Contexto reemplaza la antigua `H` provisional y mantiene el degradado azul-violeta como color principal de marca.

El rojo de grabación, el verde de éxito y el amarillo de notas son colores funcionales. No deben competir con el azul-violeta como color principal del logo.

## 5. Tipografía y estilo de interfaz

Tipografía de la interfaz:

```css
font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
```

Tipografía para tiempos y datos técnicos:

```css
font-family: "Cascadia Code", "Consolas", monospace;
```

El wordmark debe armonizar con Segoe UI: formas limpias, buena legibilidad, peso semibold o bold y sin detalles decorativos frágiles. Puede ser un lettering propio, pero debe seguir sintiéndose natural junto a una interfaz de Windows.

La interfaz utiliza esquinas moderadamente redondeadas de 6 a 11 px, bordes finos e iconos lineales estilo Lucide. El logo debe compartir esa precisión geométrica.

## 6. Logo solicitado

Diseñar un sistema compuesto por:

1. Símbolo independiente para el icono de la aplicación.
2. Logo horizontal: símbolo + palabra `Helpmeet`.
3. Variante compacta para la barra superior.
4. Variante monocromática clara y oscura.
5. Icono de Windows en tamaños pequeños.

El nombre debe escribirse exactamente así:

> Helpmeet

Usar una sola palabra, con `H` mayúscula y el resto en minúsculas.

## 7. Dirección conceptual preferida

El concepto debe representar dos o más ideas sin convertirse en una ilustración compleja:

- Conversación o voz.
- Transcripción/documentación.
- Línea de tiempo o marcador temporal.
- Captura y conservación de contexto.
- Dos participantes o dos pistas de audio que convergen.
- Una `H` abstracta, si aparece de forma natural.

Dirección recomendada:

> Un símbolo geométrico compacto donde dos pistas, voces o bloques convergen y forman una `H`, un marcador o una pieza de contexto organizada.

El símbolo debe ser entendible aunque el usuario no descubra inmediatamente todas las metáforas. Primero debe funcionar como forma memorable; la explicación conceptual es secundaria.

### Rutas que se pueden explorar

- Dos ondas o pistas verticales conectadas formando una `H` abstracta.
- Dos globos de conversación mínimos que crean un espacio central o marcador.
- Una forma de documento o bloque de texto combinada con una señal de audio.
- Un marcador temporal formado por dos voces convergentes.
- Capas de contexto organizadas dentro de un cuadrado redondeado.

Claude Design debe presentar entre 3 y 5 conceptos claramente diferentes antes de desarrollar la versión final.

## 8. Restricciones importantes

- No copiar ni aproximarse al logo de Google Meet, Zoom, Teams, Slack, Notion, Otter, Fireflies o Claude.
- No usar una cámara de video multicolor como símbolo principal.
- No usar un micrófono genérico sin una transformación distintiva.
- No usar un cerebro, robot, estrellas mágicas o circuitos para representar IA.
- No depender de texto diminuto, ondas muy finas o muchos detalles internos.
- No convertir la letra `H` en un monograma corporativo genérico sin relación con el producto.
- No utilizar el rojo de grabación como color dominante de marca.
- No mezclar más de dos colores dentro del símbolo principal.
- Evitar efectos 3D, glassmorphism, brillos intensos y sombras complejas.
- El logo no debe incluir el eslogan dentro del símbolo.

## 9. Requisitos de legibilidad

El símbolo debe seguir siendo reconocible en:

- `16 × 16 px`: icono mínimo de interfaz.
- `22 × 22 px`: tamaño actual en la barra superior.
- `32 × 32 px`: accesos y menús.
- `48 × 48 px`: icono pequeño de aplicación.
- `256 × 256 px`: icono de Windows.
- `512 × 512 px` y `1024 × 1024 px`: material de producto y distribución.

Debe funcionar sobre:

- Fondo principal `#0B0D12`.
- Fondo de barra `#10131A`.
- Blanco o fondo muy claro.
- Un solo color, tanto blanco como negro.

No confiar exclusivamente en un degradado: la silueta debe funcionar en monocromo.

## 10. Uso previsto dentro de Helpmeet

El primer uso real será sustituir este marcador provisional:

```html
<span class="brand-mark">H</span>
```

El contenedor actual mide `22 × 22 px`, tiene radio de 6 px y aparece al lado del wordmark `Helpmeet` en una barra de color `#10131A`.

La propuesta final debe indicar una de estas opciones:

- Símbolo sin contenedor, diseñado para verse directamente a 22 px.
- Símbolo blanco dentro del cuadrado degradado actual.
- Símbolo con su propio contenedor, especificando fondo, radio y área de seguridad.

También se utilizará como:

- Icono del ejecutable de Windows.
- Icono de la ventana y barra de tareas.
- Favicon o icono de una futura versión web.
- Imagen de repositorio y documentación.
- Pantalla de bienvenida o instalador.

## 11. Entregables esperados

Solicitar los siguientes archivos:

- `helpmeet-symbol.svg`: símbolo principal editable.
- `helpmeet-logo-horizontal.svg`: símbolo y wordmark.
- `helpmeet-symbol-mono-light.svg`: blanco.
- `helpmeet-symbol-mono-dark.svg`: negro o azul-negro.
- `helpmeet-icon-1024.png`: fondo transparente o fondo definido.
- `helpmeet-icon.ico`: tamaños de Windows incluidos.
- PNG transparentes a 16, 22, 32, 48, 128, 256, 512 y 1024 px.
- Una hoja breve con colores, área de seguridad y tamaño mínimo.

Los SVG deben:

- Tener `viewBox` correcto.
- No depender de fuentes externas.
- Convertir el lettering personalizado a curvas si fuera necesario.
- Evitar máscaras o filtros incompatibles cuando sea posible.
- Mantener nombres y estructura de capas comprensibles.

## 12. Presentación requerida a Claude Design

Para cada concepto, mostrar:

1. Símbolo grande sobre fondo oscuro.
2. Símbolo a 22 px dentro de una barra simulada de Helpmeet.
3. Logo horizontal con el nombre.
4. Versión monocromática.
5. Icono de aplicación cuadrado.
6. Explicación de dos o tres frases sobre la idea.
7. Riesgos de legibilidad o similitud con marcas conocidas.

La propuesta final debe incluir una prueba visual junto a estos colores:

- `#0B0D12`
- `#10131A`
- `#6D8CFF`
- `#8A6DFF`
- `#F1F4F8`

## 13. Criterios para elegir la propuesta final

Evaluar cada propuesta del 1 al 5 en:

- Reconocimiento a 16 y 22 px.
- Relación con conversación + contexto/documentación.
- Diferenciación respecto a aplicaciones de videollamadas y transcripción.
- Coherencia con la interfaz oscura existente.
- Calidad en monocromo.
- Facilidad para convertirla en `.ico` y SVG.
- Sensación de confianza y producto profesional.
- Posibilidad de evolucionar la marca sin rediseñar el símbolo.

No elegir una propuesta solo porque se vea atractiva a gran tamaño. La prioridad es que funcione como icono pequeño de una aplicación de escritorio.

## 14. Prompt listo para copiar en Claude Design

```text
Diseña el sistema de logo de Helpmeet siguiendo íntegramente el brief adjunto.

Helpmeet es una aplicación de escritorio que graba reuniones y pantalla, separa las pistas de audio, transcribe, vincula frases con notas y capturas, recupera grabaciones interrumpidas y exporta el contexto a Markdown para Claude.

Quiero entre 3 y 5 conceptos diferentes. La dirección preferida es un símbolo geométrico compacto que combine conversación o dos pistas de audio con contexto organizado, línea de tiempo o una H abstracta. Debe funcionar primero como una silueta memorable, no como una ilustración.

Respeta la identidad oscura existente y usa como marca principal el azul #6D8CFF con el violeta #8A6DFF. El símbolo debe funcionar también en blanco y negro, ser legible a 16 px y reemplazar el marcador actual de 22 × 22 px de la barra superior.

No imites Google Meet ni otras aplicaciones de reuniones. Evita cámaras multicolor, micrófonos genéricos, cerebros, robots, estrellas de IA, detalles finos y efectos 3D.

Para cada propuesta muestra: símbolo grande, uso a 22 px en una barra #10131A, logo horizontal “Helpmeet”, versión monocromática e icono cuadrado de aplicación. Explica el concepto y cualquier riesgo de similitud o legibilidad. Después desarrolla la propuesta seleccionada en SVG, PNG e ICO según los entregables del brief.
```

## 15. Resultado esperado

El resultado ideal debe sentirse como una herramienta que escucha, conserva y estructura, no como otra plataforma para hacer videollamadas. Al verla, el usuario debería percibir orden, continuidad y confianza.
