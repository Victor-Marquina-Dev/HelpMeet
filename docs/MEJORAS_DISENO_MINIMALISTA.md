# Helpmeet — Brief de rediseño minimalista

## 1. Objetivo

Rediseñar Helpmeet para que se perciba más limpia, rápida y profesional, conservando su identidad oscura actual.

La interfaz debe:

- Mostrar primero la acción principal de cada pantalla.
- Reducir textos explicativos permanentes.
- Usar iconos reconocibles acompañados de texto solo cuando sea necesario.
- Evitar controles duplicados y elementos decorativos sin función.
- Mostrar ayuda mediante tooltips, estados vacíos y mensajes contextuales.
- Mantener las funciones actuales sin ocultar acciones importantes.

## 2. Dirección visual

Concepto: **herramienta de trabajo silenciosa**. La aplicación acompaña la reunión sin competir con ella.

- Tema oscuro sobrio.
- Una sola acción primaria visible por contexto.
- Superficies planas con bordes suaves; usar sombras únicamente en modales y menús flotantes.
- Menos tarjetas anidadas.
- Más espacio vacío y menos líneas divisorias.
- Iconografía lineal consistente, preferentemente Lucide.
- Animaciones breves de 150–200 ms.

## 3. Colores existentes que deben conservarse

| Uso | Color |
|---|---|
| Fondo principal | `#0B0D12` |
| Barra lateral | `#10131A` |
| Superficie | `#151922` |
| Superficie elevada | `#1A1F2B` |
| Campo de entrada | `#0D1017` |
| Borde sutil | `#262C38` |
| Borde fuerte | `#343C4C` |
| Texto principal | `#F1F4F8` |
| Texto secundario | `#A6AFBF` |
| Texto tenue | `#727D90` |
| Acento | `#6D8CFF` |
| Éxito | `#34C78A` |
| Advertencia | `#F1B84B` |
| Peligro | `#EF5B62` |
| Grabación | `#FF4D57` |

Reglas:

- El azul se reserva para selección, foco y acción principal.
- El rojo se usa solamente para grabación activa o acciones destructivas.
- El verde indica una operación completada o un sistema disponible.
- No añadir colores nuevos sin una función semántica.

## 4. Tipografía, tamaños y espaciado

- Fuente principal: `Segoe UI`, con fallback a `system-ui`.
- Fuente monoespaciada: `Cascadia Code` para horas, duración y rutas.
- Título de pantalla: 20–22 px, peso 650–700.
- Título de modal: 15–16 px, peso 650–700.
- Texto normal: 13 px.
- Texto secundario: 11–12 px.
- Botones: 12–13 px, peso 600.
- Usar una escala de separación de `4, 8, 12, 16, 24, 32 px`.
- Altura estándar de botones y campos: 36–40 px.
- Radio estándar: 8 px; tarjetas: 11 px; modales: 16 px.

## 5. Iconografía

Usar una única familia de iconos lineales. No mezclar emojis, iconos rellenos y símbolos de texto.

| Acción | Icono sugerido |
|---|---|
| Grabar reunión | `mic` |
| Grabar pantalla | `monitor-dot` |
| Subir archivo | `upload` |
| Captura | `camera` |
| Nota | `plus` o `sticky-note` |
| Exportar | `download` |
| Abrir carpeta | `folder-open` |
| Copiar Markdown | `copy` |
| Participantes | `users` |
| Ajustes | `settings` |
| Buscar | `search` |
| Editar | `pencil` |
| Cambiar hablante | `user-round-cog` |
| Importante | `star` |
| Eliminar | `trash-2` |
| Archivo | `archive` |
| Papelera | `trash-2` |
| Silenciar | `mic-off` |
| Diagnóstico | `activity` |

Reglas:

- Iconos de 14–16 px dentro de botones.
- Iconos de 18–20 px para navegación.
- Todo botón que contiene solo un icono debe tener tooltip y `aria-label`.
- No usar más de cinco acciones visibles en una misma fila.
- Las acciones menos frecuentes deben ir en el menú `···`.

## 6. Reducción de texto

La ayuda larga no debe permanecer siempre visible. Usar tooltip, icono de información o texto desplegable.

| Texto actual o extenso | Versión minimalista |
|---|---|
| Copiar transcripción .md | Copiar MD |
| Abrir carpeta | Carpeta |
| Volver a transcribir | Retranscribir |
| Silenciar mi audio por defecto | Iniciar con micrófono silenciado |
| Modelo (calidad vs. velocidad) | Calidad |
| Diagnóstico del sistema | Diagnóstico |
| Borrar todos los datos | Borrar datos |
| Nombre de la reunión (opcional) | Nombre de la reunión |
| Buscar en esta transcripción… | Buscar… |

Los textos explicativos deben aparecer solo:

- Cuando el usuario pasa el cursor por un icono.
- Debajo de un campo que necesita una decisión técnica.
- En un estado vacío.
- Después de un error o una advertencia real.

## 7. Barra lateral

### Estructura

1. Logotipo y nombre Helpmeet.
2. Botón de búsqueda compacto.
3. Título `Iniciativas` y botón `+`.
4. Lista de iniciativas y reuniones agrupadas por mes.
5. Archivo y Papelera anclados al pie.

### Mejoras

- Mostrar el conteo únicamente al pasar el cursor o cuando sea relevante.
- Limitar cada nombre a una línea con elipsis.
- Usar un punto de color para el estado de la reunión, no texto adicional.
- Mostrar acciones de iniciativa al pasar el cursor.
- Mantener una sola iniciativa expandida opcionalmente.
- Reducir sangrías y líneas de árbol.
- Ocultar mensajes repetidos como `Sin reuniones`; mostrar un solo estado vacío dentro de la iniciativa seleccionada.

## 8. Pantalla de reunión

### Encabezado

Fila 1:

- Breadcrumb pequeño.
- Fecha o nombre de la reunión.
- Estado mediante una insignia compacta.

Fila 2:

- Duración y número de frases en texto tenue.
- Acción primaria: `Copiar MD`.
- Acciones secundarias: Exportar, Carpeta y Participantes.
- Menú `···` para acciones adicionales.

### Pestañas

- Transcripción
- Resumen
- Decisiones
- Tareas
- Archivos

Mantenerlas en una sola fila. La pestaña activa usa texto claro y una línea azul de 2 px.

### Transcripción

- Barra de búsqueda compacta.
- Cada frase debe mostrar hora, hablante y texto.
- Acciones visibles por frase: Editar, Cambiar hablante, Importante y Eliminar.
- En reposo, mostrar solo Importante; revelar las demás al pasar el cursor o seleccionar la frase.
- Eliminar bordes fuertes alrededor de todas las frases. Usar fondo elevado solo para la frase seleccionada.
- Capturas y notas deben integrarse en la línea temporal sin tarjetas demasiado grandes.

## 9. Grabación de reunión

- Temporizador grande y siempre visible.
- Un indicador rojo pequeño comunica que se está grabando.
- Botón principal rojo: `Detener`.
- Botón de micrófono como interruptor: activo/silenciado.
- Captura y Nota como botones secundarios con iconos.
- Ocultar explicaciones durante la grabación.
- Mostrar niveles de audio mediante dos medidores compactos: `Tú` y `Sistema`.

## 10. Grabación de pantalla

Orden recomendado:

1. Indicador REC y temporizador.
2. Selector de pantalla.
3. Nombre de la reunión.
4. Vista previa.
5. Controles de encuadre.
6. Acciones de grabación.

### Encuadre

Usar un control segmentado con iconos:

- `Ajustar`: muestra toda la pantalla y conserva proporción.
- `Rellenar`: llena el lienzo y recorta bordes.
- `Estirar`: ocupa todo el lienzo y puede deformar.

Mostrar la explicación solamente en tooltip. La vista previa debe reflejar el modo inmediatamente.

### Controles

- `Detener` como único botón rojo.
- Micrófono como botón con estado visual.
- Captura y Nota como botones secundarios.
- Evitar advertencias permanentes. Mostrar el aviso de tamaño como icono de información junto a la resolución.

## 11. Ajustes

### Encabezado

- Título `Ajustes`.
- Subtítulo breve: `Grabación, transcripción y datos`.
- Botón de cerrar alineado a la derecha.

### Secciones

Usar tarjetas separadas:

1. Transcripción.
2. Instrucciones para IA.
3. Exportación.
4. Diagnóstico.
5. Privacidad y datos.

### Transcripción

- Insignia verde `Local y privado`.
- Dos columnas: Idioma y Calidad.
- Interruptor: `Iniciar con micrófono silenciado`.
- Mover detalles sobre descargas y modelos a un tooltip de información.

### Privacidad

- Separar visualmente las acciones destructivas.
- `Borrar datos` debe ser un botón secundario rojo, nunca la acción dominante.
- Pedir confirmación mostrando exactamente qué se eliminará.

## 12. Diagnóstico previo

- Mostrar solo verificaciones necesarias para el tipo de grabación seleccionado.
- Cada fila incluye icono, nombre y estado.
- Estados: listo, advertencia o error.
- No repetir detalles técnicos si todo está correcto.
- Mostrar rutas, versiones y dispositivos completos mediante `Ver detalles`.
- Acción primaria: `Empezar grabación`.
- Acción secundaria: `Comprobar de nuevo`.

## 13. Estados vacíos

Cada pantalla vacía debe contener:

- Un icono lineal sencillo.
- Un título de máximo cinco palabras.
- Una frase breve.
- Una única acción recomendada.

Ejemplo:

> **Aún no hay reuniones**  
> Graba o importa una conversación para comenzar.  
> `[Grabar reunión]`

## 14. Feedback y estados

- Usar toast para confirmaciones breves: copiado, guardado o exportado.
- Usar barra de progreso para tareas de más de dos segundos.
- No mostrar `0 %` si todavía no existe una estimación; mostrar actividad indeterminada y el nombre de la etapa.
- Deshabilitar botones mientras procesan y conservar su ancho.
- Los errores deben decir qué ocurrió y cómo resolverlo.
- No usar ventanas del sistema para errores normales.

## 15. Responsive

- El modal de Ajustes debe usar dos columnas desde 650 px y una columna por debajo.
- Los grupos de botones deben poder envolver sin perder jerarquía.
- En ventanas estrechas, convertir acciones secundarias en menú `···`.
- La barra lateral puede colapsar a un rail de iconos.
- No permitir desplazamiento horizontal.

## 16. Accesibilidad

- Contraste WCAG AA para texto y controles.
- Foco visible en todos los elementos interactivos.
- Navegación completa con teclado.
- Área mínima de interacción de 36 × 36 px.
- Tooltips accesibles mediante teclado.
- No comunicar estados exclusivamente mediante color.
- Respetar `prefers-reduced-motion`.

## 17. Componentes que deben unificarse

Crear componentes reutilizables para:

- Botón primario, secundario, peligro e icono.
- Campo, selector y área de texto.
- Interruptor.
- Tooltip.
- Insignia de estado.
- Pestañas.
- Menú contextual.
- Modal y confirmación.
- Toast.
- Barra de progreso.
- Estado vacío.
- Fila de diagnóstico.
- Elemento de transcripción.

No crear estilos inline para elementos nuevos. Todas las variantes deben vivir en clases CSS reutilizables.

## 18. Prioridad de implementación

### Prioridad 1

- Simplificar encabezado de reunión.
- Reducir acciones visibles en cada frase.
- Rediseñar grabación de pantalla.
- Unificar botones, campos e interruptores.
- Eliminar textos explicativos repetidos.

### Prioridad 2

- Simplificar barra lateral.
- Rediseñar Ajustes y Diagnóstico.
- Añadir tooltips.
- Mejorar estados vacíos y progreso.

### Prioridad 3

- Animaciones y transiciones.
- Vista colapsada de barra lateral.
- Ajustes finales de responsive y accesibilidad.

## 19. Criterios de aceptación

El rediseño se considera terminado cuando:

- Cada pantalla tiene una acción principal claramente identificable.
- No existen más de cinco acciones visibles en una fila.
- Los textos de ayuda permanentes se reducen al mínimo.
- Todos los botones de solo icono tienen tooltip y etiqueta accesible.
- Las funciones existentes siguen disponibles.
- Los controles comparten tamaños, radios y estados.
- La interfaz funciona sin desplazamiento horizontal.
- Grabación, transcripción y exportación muestran estados comprensibles.
- Los colores mantienen su significado semántico.
- El diseño se ve correcto en ventanas de 480, 768, 1024 y 1440 px de ancho.

## 20. Instrucción para Claude Design

Implementa este rediseño sobre la interfaz existente de Helpmeet sin eliminar funcionalidades ni cambiar contratos del backend. Reutiliza la paleta, tipografías, logotipo y componentes actuales. Prioriza reducción de texto, jerarquía visual, iconos Lucide, espaciado consistente y accesibilidad. Antes de sustituir una acción por un icono, comprueba que conserve tooltip y `aria-label`. Mantén los estados de grabación y acciones destructivas claramente diferenciados.
