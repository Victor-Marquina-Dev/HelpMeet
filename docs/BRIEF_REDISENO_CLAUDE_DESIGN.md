# Helpmeet — Brief completo para rediseño de interfaz

> **Actualizado:** 2026-06-23  
> **Fuente de verdad:** contrato observado en el código actual más funciones V2 planificadas.  
> **Importante:** grabación de pantalla, video diferido, Archivo y Papelera ya están implementados en la rama de trabajo y no son simples mockups.

## 1. Encargo para Claude Design

Rediseña la interfaz de **Helpmeet**, una aplicación de escritorio para Windows hecha con Python, `pywebview`, HTML, CSS y JavaScript sin framework.

El objetivo es conseguir una interfaz más clara, moderna y profesional, manteniendo todas las funciones existentes e incorporando visualmente las mejoras funcionales previstas para la siguiente versión. No debe convertirse en una aplicación web genérica. Debe sentirse como una herramienta de trabajo enfocada en reuniones, transcripción y documentación técnica: rápida, tranquila, confiable y cómoda durante sesiones largas.

El diseño debe cubrir dos alcances:

- **Funciones actuales:** deben quedar completamente implementadas y conectadas a la API existente.
- **Funciones objetivo V2:** deben quedar diseñadas e integradas coherentemente. Cuando necesiten backend nuevo, se debe documentar el contrato propuesto y evitar fingir que ya funcionan.

### Resultado esperado

Entrega una implementación lista para reemplazar estos archivos:

- `helpmeet/ui/web/index.html`
- `helpmeet/ui/web/style.css`
- `helpmeet/ui/web/app.js`

Puedes reorganizar el HTML, CSS y JavaScript, pero debes conservar el contrato con la API Python descrito en este documento. Si necesitas añadir un método Python, indícalo explícitamente y explica por qué; no inventes endpoints silenciosamente.

Además de los archivos de interfaz, entrega una sección técnica con los métodos Python nuevos que harán falta para completar las funciones V2.

## 2. Qué es Helpmeet

Helpmeet permite:

- Crear iniciativas o proyectos.
- Crear y consultar reuniones dentro de cada iniciativa.
- Grabar simultáneamente el micrófono del usuario y el audio del sistema.
- Transcribir reuniones con Whisper local o Replicate.
- Importar archivos de video o audio para transcribirlos.
- Grabar el monitor seleccionado como video MP4 con micrófono y audio del sistema.
- Cambiar de monitor y silenciar el micrófono durante la captura de pantalla.
- Reproducir y transcribir posteriormente un video grabado.
- Distinguir las intervenciones como **Yo** y **Los demás**.
- Tomar capturas de una pantalla durante una reunión.
- Añadir notas rápidas vinculadas al momento de la reunión.
- Buscar frases y notas en todas las reuniones.
- Consultar un glosario automático de términos frecuentes.
- Renombrar iniciativas y reuniones.
- Mover reuniones entre iniciativas.
- Archivar, enviar a Papelera, restaurar y eliminar definitivamente iniciativas/reuniones.
- Exportar una reunión o una iniciativa completa a Markdown con capturas.
- Abrir la carpeta exportada en el Explorador de Windows.
- Configurar la API key de Replicate y la carpeta de exportación.

La aplicación se utiliza principalmente para producir contexto que después se entrega a herramientas como Claude Code.

## 3. Dirección visual propuesta

### Personalidad

- Profesional, técnica y serena.
- Oscura, pero no completamente negra ni excesivamente “gaming”.
- Con jerarquía clara y pocos colores compitiendo.
- Densa cuando muestra información, espaciosa en controles y acciones.
- Debe transmitir que la grabación y los datos están bajo control.

### Referencias conceptuales

Combinar la claridad de Linear, la densidad controlada de VS Code y la legibilidad de Notion, sin copiar literalmente ninguna de ellas.

### Evitar

- Gradientes decorativos excesivos.
- Efectos glassmorphism en todas partes.
- Botones de muchos colores sin una jerarquía común.
- Emojis como sistema principal de iconos.
- Bordes brillantes, neón o estética gamer.
- Animaciones largas o que distraigan durante una grabación.
- Ocultar acciones esenciales únicamente en menús contextuales.

### Iconos

Usar un sistema consistente de iconos SVG, por ejemplo Lucide. Los iconos deben tener texto visible en las acciones importantes. No depender solo del color para comunicar el estado.

## 4. Estructura general recomendada

Diseñar una ventana con cuatro zonas:

1. **Barra superior global**, compacta.
2. **Sidebar de iniciativas y reuniones**, redimensionable o colapsable.
3. **Área principal de reunión/transcripción**.
4. **Barra de acciones contextual**, que cambia entre reposo, grabación y procesamiento.

Propuesta esquemática:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Helpmeet   [Buscar…]                     Estado / progreso       [Ajustes]   │
├───────────────────────┬──────────────────────────────────────────────────────┤
│ INICIATIVAS       [+] │  Iniciativa / Reunión                    [···]       │
│ [Buscar en todo]      │  Título de la reunión                                │
│                       │  Fecha · duración · número de frases                  │
│ ▾ Proyecto Alpha      ├──────────────────────────────────────────────────────┤
│   Reunión de alcance  │  00:12  YO                                           │
│   API y autenticación │         Texto transcrito…                            │
│ ▸ Helpmeet            │                                                      │
│                       │  00:18  LOS DEMÁS                                   │
│                       │         Texto transcrito…                            │
│                       │                                                      │
├───────────────────────┴──────────────────────────────────────────────────────┤
│ [Pantalla 1 ▾]  [Grabar] [Subir archivo]    [Captura] [Nota] [Exportar ▾]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

En ventanas estrechas, la barra inferior puede dividirse en dos filas y el sidebar debe poder ocultarse.

## 5. Pantallas y vistas

### 5.1 Estado inicial

Cuando no hay una iniciativa seleccionada:

- Mostrar una bienvenida breve, no una pantalla vacía.
- Acción primaria: **Nueva iniciativa**.
- Acción secundaria: **Seleccionar una iniciativa existente**.
- Explicar en una línea el flujo: seleccionar iniciativa → grabar o importar → revisar → exportar.

### 5.2 Iniciativa seleccionada, sin reunión abierta

- Mostrar el nombre de la iniciativa.
- Mostrar número de reuniones y fecha de la última reunión si esos datos están disponibles.
- Acciones visibles: **Grabar reunión**, **Subir archivo**, **Exportar iniciativa** y menú adicional.
- Mostrar una lista o resumen de reuniones recientes.

### 5.3 Reunión guardada

Encabezado con:

- Nombre de la iniciativa como breadcrumb.
- Título de la reunión.
- Fecha y hora.
- Estado finalizada.
- Acciones: **Exportar**, **Abrir carpeta** y menú `···`.

Cuerpo:

- Transcripción cronológica.
- Cada intervención muestra tiempo, hablante y texto.
- Diferenciar “Yo” y “Los demás” con una banda lateral, avatar mínimo o etiqueta; no convertir cada intervención en una tarjeta pesada.
- Las capturas y notas deben aparecer como eventos dentro de la línea temporal.
- Mantener un ancho de lectura aproximado de 760–900 px.

### 5.4 Grabación activa

Este es el estado más importante y debe ser inequívoco.

- Indicador rojo con texto **Grabando** y cronómetro.
- Botón primario grande **Detener grabación**.
- Acciones habilitadas: **Captura** y **Añadir nota**.
- Mostrar la pantalla seleccionada para capturas.
- Si hay transcripción local en vivo, añadir frases progresivamente.
- Si se usa Replicate, indicar claramente: “El texto aparecerá al detener la grabación”.
- Bloquear o deshabilitar con explicación las acciones incompatibles, como importar otro archivo.
- Prevenir el cierre accidental de la ventana o pedir confirmación mientras se graba.

### 5.5 Procesamiento/transcripción

- Mostrar progreso determinado cuando exista porcentaje real.
- Mostrar progreso indeterminado cuando el proveedor no entregue porcentaje.
- Indicar etapa actual: extrayendo audio, preparando modelo, transcribiendo o guardando.
- Mostrar porcentaje, tiempo transcurrido y estimación restante cuando estén disponibles.
- Evitar que parezca que la aplicación se congeló.
- Mantener visible el nombre de la reunión que se está procesando.
- Prever una acción **Cancelar** visualmente, aunque necesitaría soporte adicional en Python antes de funcionar.

### 5.6 Resultados de búsqueda

- El buscador global debe estar siempre accesible en el sidebar.
- Ejecutar al pulsar Enter; opcionalmente añadir debounce para búsqueda al escribir.
- Mostrar la consulta y cantidad de resultados.
- Cada resultado incluye iniciativa, reunión, fecha, tipo —frase o nota—, hablante y fragmento coincidente.
- Resaltar el término buscado sin usar HTML inseguro.
- Al pulsar un resultado, abrir la reunión correspondiente.
- Incluir botón para limpiar la búsqueda y volver al árbol de iniciativas.

### 5.7 Glosario

- Mostrar título de la iniciativa.
- Mostrar términos como lista ordenada o chips con frecuencia.
- Permitir volver fácilmente a la iniciativa.
- No usar una nube de palabras difícil de leer.

### 5.8 Ajustes

Puede ser modal o panel lateral. Debe contener:

- **API key de Replicate**: campo password, indicador configurada/no configurada y botón Guardar.
- **Carpeta de exportación**: ruta de solo lectura y botón Elegir carpeta.
- Texto de ayuda breve para cada sección.
- Botón visible para cerrar.
- Cierre con `Escape` y clic fuera, sin perder cambios silenciosamente.

Incorporar en el diseño objetivo:

- Proveedor de transcripción: Automático, Local o Replicate.
- Modelo local y descripción del equilibrio velocidad/calidad.
- Idioma de transcripción.
- Carpeta de exportación.
- Estado y prueba de micrófono/audio del sistema.
- Preferencia de tema si se implementa una variante clara.

Los controles que todavía requieran backend deben quedar identificados en la entrega y conectarse cuando exista su método Python. No deben guardarse solo en el frontend dando una falsa sensación de funcionamiento.

### 5.9 Resumen, decisiones y tareas

La reunión guardada debe incluir pestañas o secciones claras:

- **Resumen:** síntesis breve de la reunión.
- **Transcripción:** línea temporal completa.
- **Decisiones:** acuerdos detectados o añadidos manualmente.
- **Tareas:** descripción, responsable, fecha y estado.
- **Archivos:** capturas y audio disponible.

Si todavía no existe un resumen, mostrar una acción **Generar resumen**. Durante la generación debe existir estado de carga, error y reintento. El usuario debe poder editar el resultado antes de exportarlo.

No ocultar la transcripción detrás de demasiadas capas: debe seguir siendo la vista principal o quedar a un clic como máximo.

### 5.10 Edición de transcripción

Cada intervención debe ofrecer acciones al pasar el cursor, enfocar con teclado o abrir su menú:

- Editar texto.
- Cambiar hablante entre “Yo” y “Los demás”.
- Dividir una intervención desde una posición elegida.
- Unirla con la anterior o la siguiente.
- Eliminarla con confirmación y posibilidad de deshacer.
- Marcarla como importante.

La edición debe hacerse inline o en un panel ligero, sin abrir una pantalla separada. Mostrar estado guardando/guardado/error y conservar el tiempo original.

### 5.11 Centro de recuperación

Si la aplicación detecta una grabación interrumpida, mostrar un banner o pantalla de recuperación antes de iniciar otra reunión:

- Nombre provisional y fecha.
- Duración de audio recuperada.
- Pistas disponibles: micrófono y sistema.
- Acciones **Recuperar y transcribir**, **Conservar para después** y **Descartar**.

El descarte debe requerir confirmación. Un fallo de transcripción no debe eliminar automáticamente el audio recuperado.

### 5.12 Diagnóstico de audio

Antes y durante la grabación, mostrar dos medidores independientes:

- **Mi micrófono**.
- **Audio del sistema**.

Cada pista debe mostrar dispositivo, señal en vivo y estados como disponible, sin señal, silenciada o error. Añadir una prueba previa de cinco segundos y acceso a selección de dispositivo cuando el backend lo permita.

Durante una grabación, los medidores deben ser discretos pero visibles. Si una pista lleva varios segundos sin señal, mostrar una advertencia no bloqueante.

### 5.13 Biblioteca de capturas y archivos

Dentro de una reunión, mostrar las capturas con miniatura, tiempo y nota asociada. Acciones previstas:

- Abrir imagen.
- Copiar ruta.
- Editar nota.
- Eliminar captura.
- Saltar al momento de la transcripción relacionado.

El audio original o recuperado puede aparecer en esta sección con duración, tamaño y estado de conservación.

### 5.14 Gestión de iniciativas, Archivo y Papelera

Estas funciones ya están implementadas y el rediseño debe conservarlas:

- Archivar iniciativas y reuniones sin eliminarlas.
- Enviar iniciativas y reuniones a la Papelera con confirmación.
- Restaurar elementos desde Archivo o Papelera.
- Mover un elemento archivado a la Papelera.
- Eliminar permanentemente solo desde la Papelera y con confirmación reforzada.
- Impedir archivar o eliminar una reunión que esté siendo utilizada por una grabación activa.

La navegación debe incluir accesos persistentes a **Archivo** y **Papelera**, preferiblemente al pie del sidebar. Cada vista debe explicar su propósito, mostrar el tipo de elemento, fecha de archivado/eliminación e iniciativa contenedora cuando corresponda.

También se desea:

- Ordenar reuniones por fecha o nombre.
- Filtrar por estado: finalizada, pendiente de transcripción, con error o recuperada.
- Mostrar acciones frecuentes sin depender exclusivamente del clic derecho.

### 5.15 Grabación de pantalla en video

El rediseño debe incorporar la función ya implementada **Grabar pantalla**. Su captura es independiente de la grabación de audio tradicional, pero ahora crea una reunión asociada para conservar el video, las notas, las capturas y una transcripción opcional.

Comportamiento previsto:

- Requiere una iniciativa seleccionada.
- Graba el monitor seleccionado a resolución nativa, aproximadamente 30 fps.
- Incluye micrófono y audio del sistema cuando estén disponibles.
- Guarda un archivo `AAAA-MM-DD_HH-MM-SS_grabacion.mp4` en la carpeta de la iniciativa.
- Crea una reunión en la base de datos y guarda la ruta del MP4 en ella.
- Permite capturas y notas durante la grabación, vinculadas a esa reunión.
- Permite silenciar/reactivar el micrófono en caliente sin afectar el audio del sistema.
- Permite cambiar de monitor durante la grabación y continuar en el mismo MP4.
- La transcripción es opcional y diferida: se realiza desde el MP4 al terminar o al reabrir la reunión.
- Una reunión de pantalla guardada muestra reproductor incrustado; si WebView2 no reproduce `file://`, ofrece abrir el video externamente.
- No debe iniciarse al mismo tiempo que otra grabación incompatible; la interfaz debe comunicar el conflicto.

Estados del control:

1. **Preparado:** botón secundario `Grabar pantalla` y monitor seleccionado visible.
2. **Iniciando:** spinner y texto `Preparando grabación…`.
3. **Grabando:** indicador persistente `REC`, cronómetro `MM:SS` y botón inequívoco `Detener video`.
4. **Guardando:** progreso indeterminado y texto `Guardando y mezclando audio…`; deshabilitar dobles clics.
5. **Completado:** mostrar reproductor, ruta, estado del audio y acciones `Transcribir video`, `Abrir video` y `Mostrar en carpeta`.
6. **Completado con advertencia:** video guardado sin una pista de audio o sin sonido; explicar qué faltó.
7. **Error:** conservar el video temporal recuperable cuando sea posible y ofrecer abrir su ubicación.

Vista durante la grabación:

- Mostrar una vista previa ligera del monitor, aproximadamente 3–4 fps, sin sugerir que es el frame rate final.
- Incluir el nombre/resolución del monitor y el espacio libre estimado si el backend lo proporciona.
- Mostrar indicadores separados para micrófono y sistema.
- Mostrar el estado del micrófono y un botón visible `Silenciar micro` / `Activar micro`.
- Permitir cambiar el monitor desde el selector sin presentar la acción como una nueva grabación.
- Advertir que la máxima nitidez puede producir archivos de varios GB.
- La vista previa nunca debe ocultar el botón para detener ni desplazarlo fuera de la ventana.

Jerarquía recomendada:

- **Grabar reunión** sigue siendo la acción primaria del producto.
- **Grabar pantalla** es una acción secundaria diferenciada, no otro botón rojo permanente.
- Solo el estado activo utiliza rojo y la etiqueta `REC`.
- No confundir `Subir video` —importar/transcribir un archivo— con `Grabar pantalla` —crear un MP4—.

## 6. Inventario completo de controles actuales

### Barra global

| Control | Función | Disponibilidad/estado |
|---|---|---|
| Mostrar/ocultar panel | Colapsa o expande el sidebar | Siempre disponible |
| Selector de pantalla | Elige el monitor que se capturará | Siempre visible; se usa durante grabación |
| Grabar | Inicia una reunión en la iniciativa seleccionada | Requiere iniciativa activa |
| Parar | Detiene la grabación y comienza la transcripción | Solo durante grabación |
| Subir video | Elige video/audio, extrae audio, transcribe y guarda | Requiere iniciativa; deshabilitado durante grabación |
| Grabar pantalla | Crea una reunión y graba el monitor seleccionado a MP4 | Requiere iniciativa; alterna a Detener video |
| Micro | Silencia o reactiva el micrófono del video sin cortar la grabación | Visible durante grabación de pantalla |
| Captura | Captura el monitor seleccionado | Solo durante grabación |
| Nota | Solicita y guarda una nota rápida | Solo durante grabación |
| Abrir carpeta | Exporta/refresca la iniciativa y abre su carpeta | Requiere iniciativa activa |
| Ajustes | Abre el panel de configuración | Siempre disponible |

### Sidebar

| Control | Función |
|---|---|
| Nueva iniciativa | Solicita nombre y crea una iniciativa |
| Buscar en todo | Busca frases y notas en todas las reuniones |
| Fila de iniciativa | Selecciona la iniciativa y expande/colapsa sus reuniones |
| Fila de reunión | Abre una transcripción guardada |
| Exportar iniciativa completa | Exporta todas las reuniones de la iniciativa |
| Archivo | Abre iniciativas y reuniones archivadas |
| Papelera | Abre elementos eliminados de forma reversible |

### Menú de iniciativa

Actualmente se abre con clic derecho. En el rediseño también debe poder abrirse mediante un botón visible `···` para mejorar descubribilidad y accesibilidad.

| Acción | Función |
|---|---|
| Ver glosario | Muestra los términos frecuentes de la iniciativa |
| Renombrar iniciativa | Cambia su nombre |
| Exportar iniciativa a otra carpeta | Abre selector y exporta en un destino puntual |
| Archivar | Mueve la iniciativa al Archivo |
| Enviar a Papelera | Oculta la iniciativa y permite restaurarla antes del borrado permanente |

### Menú de reunión

También debe estar disponible mediante `···`, además del clic derecho.

| Acción | Función |
|---|---|
| Renombrar reunión | Cambia el título |
| Mover a otra iniciativa | Solicita iniciativa destino o crea una nueva |
| Exportar a otra carpeta | Exporta el contenido a una carpeta elegida |
| Archivar | Mueve la reunión al Archivo |
| Enviar a Papelera | Oculta la reunión y permite restaurarla |

### Encabezado de reunión guardada

| Acción | Función |
|---|---|
| Re-exportar | Regenera la exportación de la reunión/iniciativa |
| Abrir en explorador | Abre la carpeta exportada; exporta primero si no existe |

### Ajustes

| Control | Función |
|---|---|
| Guardar API key | Guarda la credencial de Replicate |
| Elegir carpeta | Selecciona la carpeta de exportación |
| Cerrar | Cierra el panel de ajustes |

### Controles objetivo para grabación de pantalla

| Control | Función | Estado |
|---|---|---|
| Grabar pantalla | Inicia MP4 del monitor seleccionado | Requiere iniciativa; no está activo mientras guarda otro video |
| Detener video | Finaliza captura y comienza mezcla/mux | Solo durante grabación de pantalla |
| Indicador REC | Muestra que existe captura de pantalla activa | Visible y persistente durante toda la grabación |
| Cronómetro | Muestra duración `MM:SS` | Se reinicia en cada video |
| Vista previa | Miniatura del monitor a baja frecuencia | Visible mientras se graba; fallo no bloqueante |
| Abrir carpeta | Abre el destino del MP4 terminado | Al completar con archivo válido |
| Selector de monitor | Define monitor para captura y permite cambiarlo en caliente | Disponible antes y durante la grabación de pantalla |
| Silenciar/activar micro | Escribe silencio o recupera la pista del micrófono | Durante grabación de pantalla |
| Transcribir este video | Extrae audio del MP4 y genera frases de forma diferida | Al terminar o reabrir una reunión con video |
| Abrir video | Reproduce el MP4 con la aplicación del sistema | Si falla o no se desea el reproductor incrustado |
| Mostrar en carpeta | Abre Explorer seleccionando el MP4 | Tras guardar o al reabrir la reunión |

### Controles actuales de Archivo y Papelera

| Control | Función |
|---|---|
| Restaurar | Devuelve iniciativa/reunión a la biblioteca activa |
| Enviar a Papelera | Disponible desde Archivo |
| Eliminar permanentemente | Disponible únicamente en Papelera; requiere confirmación |

## 7. Contrato de la API Python que debe conservarse

Todos los métodos se llaman mediante `window.pywebview.api`.

| Método | Entrada | Salida/uso |
|---|---|---|
| `list_initiatives()` | — | Lista `{id, name}` |
| `list_library(view)` | `archive` o `trash` | Lista elementos archivados o en Papelera con tipo, fecha e iniciativa |
| `archive_item(kind, item_id)` | Tipo e ID | Archiva iniciativa/reunión si no está en uso |
| `trash_item(kind, item_id)` | Tipo e ID | Envía iniciativa/reunión a Papelera |
| `restore_item(kind, item_id)` | Tipo e ID | Restaura un elemento; al restaurar reunión reactiva su iniciativa |
| `permanently_delete_item(kind, item_id)` | Tipo e ID | Elimina definitivamente un elemento que ya está en Papelera |
| `create_initiative(name)` | Nombre | Iniciativa `{id, name}` |
| `rename_initiative(id, name)` | ID y nombre | `{ok: true}` |
| `rename_meeting(id, title)` | ID y título | `{ok: true}` |
| `move_meeting(meeting_id, initiative_id)` | IDs | `{ok: true}` |
| `get_glossary(initiative_id)` | ID | Lista `{term, count}` |
| `list_meetings(initiative_id)` | ID | Lista `{id, title, date}` |
| `search(query)` | Texto | Lista con reunión, iniciativa, fecha, tipo, hablante y texto |
| `get_transcript(meeting_id)` | ID | `{title, started_at, utterances, video_path}` |
| `start_recording(initiative_id, title)` | ID y título | Datos de reunión y bandera `live` |
| `stop_recording()` | — | Estado, duración e intervenciones |
| `list_monitors()` | — | Lista `{index, width, height}` |
| `take_capture(monitor_index)` | Índice | `{ok}` |
| `add_note(text)` | Texto | `{ok}` |
| `start_screen_recording(initiative_id, monitor_index)` | IDs | Crea reunión, inicia MP4 y devuelve estado/error |
| `toggle_screen_mic_mute(muted)` | Booleano | Silencia/reactiva la pista de micrófono |
| `set_screen_monitor(monitor_index)` | Índice | Cambia monitor en caliente durante el mismo MP4 |
| `stop_screen_recording()` | — | Finaliza MP4 y devuelve ruta, reunión, audio y posibles advertencias |
| `transcribe_meeting_video(meeting_id)` | ID | Extrae/transcribe el MP4 de forma idempotente |
| `reveal_path(path)` | Ruta | Abre Explorer seleccionando el archivo |
| `import_media(initiative_id)` | ID | Abre selector y devuelve reunión/intervenciones o error |
| `export_meeting_by_id(meeting_id)` | ID | `{path}` |
| `export_initiative_by_id(initiative_id)` | ID | `{path}` |
| `export_meeting_to(meeting_id)` | ID | Abre selector y devuelve `{ok, path}` |
| `export_initiative_to(initiative_id)` | ID | Abre selector y devuelve `{ok, path}` |
| `open_meeting_folder(meeting_id)` | ID | `{ok, path}` |
| `open_path(path)` | Ruta | `{ok}` |
| `get_settings()` | — | Ruta de exportación y estado del token |
| `set_api_token(token)` | Token | `{ok}` |
| `choose_export_dir()` | — | Abre selector y devuelve `{ok, path}` |

Python también llama desde fuera a estas funciones JavaScript; deben seguir existiendo con esos nombres o debe añadirse una capa adaptadora:

- `addUtterance(speaker, text)`
- `setStatus(text)`
- `setProgress(frac)`
- `setPreview(base64Image)`

## 8. Estados globales que la interfaz debe manejar

| Estado | Acción principal | Acciones permitidas | Mensaje clave |
|---|---|---|---|
| Sin iniciativa | Nueva iniciativa | Buscar, ajustes | Selecciona o crea una iniciativa |
| Iniciativa activa | Grabar reunión | Importar, exportar | Preparado para grabar |
| Grabando local | Detener | Captura, nota | Transcripción en vivo |
| Grabando nube | Detener | Captura, nota | El texto aparecerá al detener |
| Grabando pantalla | Detener video | Consultar preview y niveles | REC, cronómetro y monitor activo |
| Guardando video | Esperar | Navegación limitada | Mezclando audio y creando MP4 |
| Importando | Esperar/cancelar futuro | Navegación limitada | Etapa y progreso actuales |
| Transcribiendo | Esperar/cancelar futuro | Navegación limitada | Tiempo y progreso |
| Recuperación pendiente | Recuperar y transcribir | Conservar, descartar | Se encontró audio de una sesión interrumpida |
| Generando resumen | Esperar/cancelar | Consultar transcripción | Analizando decisiones y tareas |
| Editando transcripción | Guardar | Cancelar, deshacer | Cambios pendientes o guardados |
| Audio sin señal | Revisar dispositivos | Continuar bajo responsabilidad | Una pista no está recibiendo sonido |
| Error | Reintentar o cerrar | Copiar detalle | Mensaje humano + detalle técnico desplegable |
| Reunión guardada | Exportar/abrir | Renombrar, mover | Datos y transcripción de la reunión |

No usar únicamente variables booleanas dispersas para el nuevo diseño. Centralizar el estado visual con nombres claros, por ejemplo `idle`, `recording`, `processing`, `error`.

## 9. Comportamiento y feedback

### Confirmaciones

- No pedir confirmación para acciones reversibles y frecuentes.
- Confirmar detener una grabación solo si el clic puede ser accidental.
- Si en el futuro se añade eliminación, usar confirmación explícita y describir qué se eliminará.

### Errores

- Reemplazar `alert()` por mensajes inline, banners o toasts accesibles.
- Explicar qué ocurrió y qué puede hacer el usuario.
- Mantener un detalle técnico copiable para soporte.
- No dejar botones cargando indefinidamente.

### Carga

- Los botones que ejecutan operaciones deben mostrar spinner y quedar temporalmente deshabilitados.
- Evitar dobles clics que lancen dos grabaciones o dos exportaciones.
- Usar skeletons solo en listas que realmente tardan; para operaciones cortas basta un indicador discreto.

### Formularios

- Sustituir los `prompt()` actuales por modales propios para crear, renombrar, mover y añadir notas.
- Validar campos vacíos.
- Enviar con Enter y cancelar con Escape.
- Mantener foco inicial y devolver el foco al control que abrió el modal.

## 10. Sistema visual sugerido

### Colores

Usar variables CSS semánticas. Valores orientativos:

```css
:root {
  --bg-app: #0b0d12;
  --bg-sidebar: #10131a;
  --bg-surface: #151922;
  --bg-elevated: #1a1f2b;
  --border-subtle: #262c38;
  --border-strong: #343c4c;
  --text-primary: #f1f4f8;
  --text-secondary: #a6afbf;
  --text-muted: #727d90;
  --accent: #6d8cff;
  --accent-hover: #819cff;
  --success: #34c78a;
  --warning: #f1b84b;
  --danger: #ef5b62;
  --recording: #ff4d57;
  --focus: #8aa4ff;
}
```

Validar contraste WCAG AA. El rojo se reserva para grabación, detener y errores; verde para éxito; amarillo para advertencias; el azul/violeta es el acento principal.

### Tipografía

- Inter, Segoe UI o una fuente de sistema fiable en Windows.
- Texto normal: 13–14 px.
- Transcripción: 14–15 px con `line-height` aproximado de 1.55.
- Metadatos: 11–12 px.
- Títulos: 18–24 px, sin tamaños gigantes.
- Tiempos de la transcripción pueden usar una fuente monoespaciada.

### Espaciado y forma

- Escala de espaciado basada en 4 px.
- Radio: 6–10 px; evitar que todo parezca una píldora.
- Sombras solo en modales, menús y elementos flotantes.
- Bordes sutiles para separar zonas.
- Altura mínima de controles: 36 px; acciones principales: 40–44 px.

### Botones

- **Primary**: una única acción principal por estado.
- **Secondary**: acciones relevantes no principales.
- **Ghost**: navegación, utilidades y menús.
- **Danger**: detener/eliminar, con texto inequívoco.
- Todos deben tener estados hover, active, focus-visible, disabled y loading.

## 11. Accesibilidad y teclado

- Navegación completa con teclado.
- Foco visible en todos los controles.
- `aria-label` en botones de solo icono.
- `aria-live` para estado de grabación, progreso y errores.
- `role="dialog"`, título asociado y focus trap en modales.
- `Escape` cierra menús y modales.
- Enter activa filas seleccionadas.
- Menús contextuales también accesibles mediante botón y teclado.
- No comunicar “Yo/Los demás”, éxito/error o habilitado/deshabilitado solo por color.
- Respetar `prefers-reduced-motion`.

Atajos sugeridos, solo si no interfieren con pywebview:

- `Ctrl+K`: enfocar búsqueda global.
- `Ctrl+N`: nueva iniciativa.
- `Ctrl+Shift+S`: captura, ya reservado globalmente por la aplicación.
- `Escape`: cerrar modal/menú; no detener grabación.

## 12. Mejoras de UX que pueden hacerse solo en frontend

- Persistir visualmente sidebar abierto/cerrado mediante `localStorage`.
- Recordar la iniciativa seleccionada durante la sesión.
- Reemplazar prompts y alerts por componentes propios.
- Añadir menús `···` accesibles a iniciativas y reuniones.
- Incorporar toasts de éxito/error.
- Añadir estados loading a todas las operaciones async.
- Impedir dobles envíos.
- Formatear y agrupar mejor la transcripción.
- Mostrar empty states específicos.
- Añadir tooltips a iconos y acciones deshabilitadas.
- Hacer responsive la barra de acciones.
- Mostrar claramente la etapa de procesamiento.

## 13. Funciones objetivo V2 que deben formar parte del rediseño

Estas funciones forman parte del producto objetivo. Algunas ya están implementadas en la rama de trabajo actual; las restantes deben incluirse en el sistema de navegación, componentes y estados del rediseño con su conexión Python claramente identificada.

### Ya implementado y obligatorio en el rediseño

- Grabación de pantalla MP4 asociada a una reunión.
- Preview ligero, REC, cronómetro y guardado tolerante a fallos parciales.
- Cambio de monitor y silencio del micrófono durante la captura.
- Capturas y notas durante una grabación de pantalla.
- Reproductor de video con apertura externa como fallback.
- Transcripción opcional y diferida del MP4.
- Archivo, Papelera, restauración y eliminación permanente.
- Migración automática de las columnas necesarias para Archivo/Papelera.

### Prioridad 1 — confiabilidad de grabación

- Carpeta temporal única por reunión o importación.
- Recuperación de grabaciones interrumpidas.
- Estados persistentes: grabando, procesando, completada y error.
- Reintento de transcripciones fallidas sin perder el audio.
- Cancelación controlada de importación o transcripción.
- Diagnóstico y medidores de micrófono/audio del sistema.
- Mensajes claros cuando falta una pista o no existe señal.
- Recuperación general de grabaciones o videos interrumpidos que todavía no hayan generado una reunión válida.

### Prioridad 2 — revisión del contenido

- Editar, dividir, unir y eliminar intervenciones.
- Cambiar hablante.
- Marcar momentos importantes.
- Editar notas y vincularlas a una intervención.
- Galería de capturas con miniaturas.
- Deshacer operaciones destructivas cuando sea posible.

### Prioridad 3 — conocimiento de la reunión

- Generar y editar resumen.
- Detectar decisiones.
- Crear tareas con responsable, fecha y estado.
- Mantener preguntas abiertas.
- Incluir resumen, decisiones y tareas en las exportaciones.

### Prioridad 4 — navegación y escala

- Búsqueda FTS con filtros por iniciativa, fecha, hablante y tipo.
- Resaltado seguro del término encontrado.
- Ordenar y filtrar reuniones por estado.
- Mejorar Archivo/Papelera con contadores, filtros y mensajes de estado; las operaciones base ya existen.
- Mostrar duración, número de frases y estado en las listas.

### Prioridad 5 — configuración

- Seleccionar proveedor: Automático, Local o Replicate.
- Seleccionar modelo local e idioma.
- Verificar credenciales sin mostrar el token.
- Seleccionar dispositivos de entrada y salida.
- Probar audio antes de grabar.

## 14. Propuesta de ampliación de la API Python

Claude Design debe usar nombres consistentes en su implementación o entregar una tabla equivalente si propone otros. Los siguientes métodos corresponden únicamente a funciones V2 que todavía no existen; las APIs de video, Archivo y Papelera ya forman parte del contrato actual de la sección 7.

| Método propuesto | Objetivo |
|---|---|
| `get_app_state()` | Recuperar estado global, tarea activa y posibles sesiones interrumpidas |
| `cancel_current_job()` | Solicitar cancelación segura de importación/transcripción/resumen |
| `list_recoverable_recordings()` | Listar audios interrumpidos disponibles |
| `recover_recording(recording_id)` | Recuperar y transcribir una sesión |
| `discard_recoverable_recording(recording_id)` | Descartar audio con confirmación previa en UI |
| `get_audio_devices()` | Listar micrófonos y dispositivos de salida/loopback |
| `test_audio_devices(config)` | Ejecutar prueba breve y devolver niveles/errores |
| `get_audio_levels()` | Consultar nivel actual de micrófono y sistema durante grabación |
| `update_utterance(id, changes)` | Editar texto o hablante |
| `split_utterance(id, position)` | Dividir una intervención |
| `merge_utterances(first_id, second_id)` | Unir intervenciones consecutivas |
| `delete_utterance(id)` | Eliminar intervención, idealmente con borrado reversible |
| `toggle_utterance_highlight(id)` | Marcar/desmarcar momento importante |
| `list_meeting_assets(meeting_id)` | Obtener capturas y audios asociados |
| `update_note(id, text)` | Editar una nota |
| `delete_capture(id)` | Eliminar una captura |
| `generate_meeting_summary(meeting_id)` | Crear resumen, decisiones, tareas y preguntas |
| `get_meeting_insights(meeting_id)` | Consultar el análisis guardado |
| `update_meeting_insights(meeting_id, data)` | Corregir resumen, decisiones y tareas |
| `search_advanced(query, filters)` | Búsqueda indexada con filtros y paginación |
| `get_transcription_settings()` | Consultar proveedor, modelo, idioma y dispositivos |
| `set_transcription_settings(data)` | Guardar configuración de transcripción y audio |

Eventos/callbacks JavaScript adicionales sugeridos para tareas en segundo plano:

- `onAppStateChanged(state)`
- `onJobProgress(job)`
- `onAudioLevels(levels)`
- `onRecoveryDetected(recording)`

La entrega debe distinguir los métodos que realmente implementa de los que deja documentados para una fase posterior.

## 15. Criterios de aceptación

El rediseño se considera correcto cuando:

1. Todas las funciones actuales siguen siendo utilizables.
2. Grabar, detener, capturar y añadir nota son evidentes durante una reunión.
3. Nunca hay duda de si la aplicación está grabando o procesando.
4. Una reunión guardada puede abrirse, exportarse y localizarse en el Explorador.
5. Las acciones de iniciativa y reunión son accesibles sin conocer el clic derecho.
6. La búsqueda muestra resultados claros y permite volver al árbol de iniciativas.
7. Crear, renombrar, mover y añadir notas ya no depende de `prompt()`.
8. Los errores no dependen de `alert()` y ofrecen una salida clara.
9. La interfaz funciona correctamente desde 900×600 hasta pantallas grandes.
10. No hay scroll horizontal en el layout principal.
11. La transcripción sigue siendo cómoda después de decenas o cientos de frases.
12. El teclado y los lectores de pantalla pueden acceder a controles, menús y modales.
13. `addUtterance`, `setStatus` y `setProgress` siguen disponibles para Python.
14. No se inventan datos o endpoints que el backend actual no proporciona.
15. El diseño incluye recuperación de grabaciones interrumpidas y estados de reintento.
16. La reunión tiene vistas coherentes para resumen, transcripción, decisiones, tareas y archivos.
17. Las intervenciones muestran acciones de edición accesibles con ratón y teclado.
18. Los medidores distinguen claramente micrófono y audio del sistema.
19. Las funciones V2 no conectadas se entregan con su contrato Python explícito.
20. El usuario puede diferenciar visualmente una función disponible de una función pendiente de backend durante el desarrollo.
21. Grabar pantalla y grabar/transcribir reunión son acciones visualmente distintas y comprensibles.
22. Durante la captura de video, REC, cronómetro, monitor y acción Detener permanecen siempre visibles.
23. Al terminar un video se muestra si contiene ambas pistas, una sola pista o ninguna.
24. El video puede reproducirse o abrirse externamente y transcribirse ahora o más tarde.
25. Capturas y notas siguen disponibles durante la grabación de pantalla.
26. El cambio de monitor y el silencio del micrófono reflejan inmediatamente su estado visual.
27. Archivo y Papelera permiten restaurar elementos y reservan la eliminación permanente para Papelera.
28. Las acciones destructivas quedan bloqueadas o explicadas cuando una reunión está en uso.

## 16. Entregables solicitados a Claude Design

1. Breve explicación de la nueva jerarquía de información.
2. `index.html` completo y semántico.
3. `style.css` completo, con tokens y estados responsive.
4. `app.js` completo, preservando el contrato Python.
5. Lista explícita de funciones existentes que se conservaron.
6. Lista separada de cualquier cambio necesario en la API Python.
7. Verificación manual de estos flujos:
   - Crear iniciativa.
   - Seleccionar iniciativa y listar reuniones.
   - Iniciar y detener una grabación.
   - Tomar captura y añadir nota.
   - Importar video/audio.
   - Abrir una reunión guardada.
   - Buscar texto.
   - Ver glosario.
   - Renombrar y mover reuniones.
   - Exportar y abrir carpeta.
   - Configurar token y carpeta de exportación.
   - Archivar una iniciativa/reunión, restaurarla y enviarla a Papelera.
   - Eliminar permanentemente desde Papelera con confirmación.
8. Diseño y estados completos de los flujos V2:
   - Recuperar una grabación interrumpida.
   - Detectar una pista de audio sin señal.
   - Editar y eliminar una intervención.
   - Generar, editar y reintentar un resumen.
   - Administrar decisiones y tareas.
   - Filtrar una búsqueda avanzada.
   - Cambiar proveedor, modelo y dispositivos.
   - Iniciar/detener grabación de pantalla, cambiar monitor, silenciar micro y tomar nota/captura.
   - Reproducir, revelar y transcribir ahora o después el MP4 terminado.
9. Tabla de endpoints Python nuevos usados por cada componente V2.
10. Separación clara entre código conectado al backend actual y código preparado para la ampliación V2.

## 17. Orden de implementación recomendado

Para evitar que el rediseño se convierta en una maqueta imposible de integrar, trabajar en este orden:

1. Crear tokens, layout, componentes base, modales, toasts y estado global.
2. Reconectar todas las funciones actuales sin cambiar su comportamiento.
3. Añadir estados de grabación, procesamiento, error y recuperación.
4. Integrar grabación de pantalla, preview, REC, cronómetro y guardado del MP4.
5. Implementar diagnóstico de audio y medidores cuando exista backend.
6. Implementar edición de transcripción y gestión de capturas/notas.
7. Añadir resumen, decisiones y tareas.
8. Sustituir búsqueda simple por búsqueda avanzada.
9. Añadir administración, archivo/papelera y configuración completa.

Cada etapa debe ser utilizable y verificable antes de avanzar a la siguiente.

## 18. Instrucción final lista para copiar

> Implementa el rediseño V2 de Helpmeet descrito en este documento. Trabaja sobre la interfaz HTML/CSS/JavaScript existente y conserva íntegramente el contrato actual con `window.pywebview.api`. Reconecta todas las funciones existentes, incluyendo Archivo/Papelera y la grabación de pantalla MP4: reunión asociada, monitor intercambiable, preview, REC, cronómetro, micro silenciable, notas, capturas, reproductor, revelar archivo y transcripción diferida. Después integra visualmente recuperación, diagnóstico de audio, edición de transcripción, resumen, decisiones, tareas, biblioteca de archivos, búsqueda avanzada y configuración del motor. Prioriza claridad durante cualquier grabación, legibilidad, feedback de procesos y accesibilidad. No confundas Grabar reunión, Grabar pantalla y Subir video. No elimines funciones actuales ni inventes silenciosamente endpoints: para cada función V2 que necesite Python, entrega el método propuesto, sus datos de entrada/salida y el componente que lo consume. Devuelve archivos completos listos para pywebview, estados loading/error/empty y un plan de integración incremental.
