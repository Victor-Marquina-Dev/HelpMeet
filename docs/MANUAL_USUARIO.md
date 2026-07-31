# Manual de Usuario -- Helpmeet

Version: 2.5.0
Fecha: 2026-07-18
Audiencia: Usuarios finales

---

## Indice

- [1. Que es Helpmeet](#1-que-es-helpmeet)
- [2. Instalacion](#2-instalación)
- [3. Activacion de licencia](#3-activación-de-licencia)
- [4. Navegacion general](#4-navegacion-general)
- [5. Iniciativas (proyectos)](#5-iniciativas-proyectos)
- [6. Reuniones](#6-reuniones)
- [7. Grabacion de audio](#7-grabación-de-audio)
- [8. Grabacion de pantalla](#8-grabación-de-pantalla)
- [9. Transcripcion](#9-transcripción)
- [10. Capturas y notas](#10-capturas-y-notas)
- [11. Participantes](#11-participantes)
- [12. Busqueda](#12-busqueda)
- [13. Exportacion](#13-exportación)
- [14. Calendario](#14-calendario)
- [15. Archivo y papelera](#15-archivo-y-papelera)
- [16. Ajustes](#16-ajustes)
- [17. Copia de seguridad](#17-copia-de-seguridad)
- [18. Atajos de teclado](#18-atajos-de-teclado)
- [19. Panel de administración (licencias)](#19-panel-de-administración-licencias)
- [20. Solucion de problemas](#20-solucion-de-problemas)

---

## 1. Que es Helpmeet

Helpmeet es una aplicación de escritorio para Windows que transcribe reuniones, las organiza por iniciativa, permite tomar capturas de pantalla y notas ligadas al momento exacto de la reunión, y exporta todo el contexto en Markdown listo para usar con Claude Code.

**Que permite hacer:**

- Transcribir reuniones con inteligencia artificial local (sin internet, sin costo por uso)
- Organizar el trabajo por iniciativas, cada una con sus propias reuniones, participantes y contexto
- Grabar solo el audio del microfono o también la pantalla completa
- Tomar capturas de pantalla y escribir notas que quedan ancladas al minuto exacto de la reunión
- Exportar reuniones completas o iniciativas enteras en formato Markdown con todas las capturas incluidas
- Buscar palabras o frases dentro de todas las transcripciones

**Que NO hace:**

- No transcribe en tiempo real. La transcripción se procesa al finalizar la grabación.
- No funciona en Mac ni Linux. Solo Windows 10 u 11.
- No graba reuniones de Google Meet directamente desde el navegador. Graba el audio del sistema y el microfono.

---

## 2. Instalacion

### Requisitos del sistema

- Windows 10 o 11 (64 bits)
- 4 GB de RAM como mínimo (8 GB recomendado)
- 2 GB de espacio libre en disco (para el modelo de transcripción)
- Microfono (para grabar su propia voz)
- Conexion a internet solo para la primera instalación (descarga del modelo de IA)

### Instalacion paso a paso

1. Ejecutar el instalador `Helpmeet-Setup-X.X.X.exe`.
2. Seguir los pasos del asistente. La instalación es por usuario, no requiere permisos de administrador.
3. Al abrir Helpmeet por primera vez, el asistente de configuración descargara el modelo de transcripción. Esto puede tardar entre 3 y 10 minutos segun la velocidad de internet.
4. Una vez completada la descarga, la aplicación esta lista para usar.

> El modelo de transcripción ocupa aproximadamente 500 MB y se descarga una sola vez. Las siguientes aperturas de la aplicación seran inmediatas.

---

## 3. Activacion de licencia

Helpmeet requiere una licencia para funcionar.

1. Al abrir la aplicación, aparece la pantalla de activación.
2. Ingresar la clave de licencia proporcionada (formato: `HM-XXXX-XXXX-XXXX-XXXX`).
3. Hacer clic en **Activar**.

> Si no tiene clave de licencia, contacte a su proveedor. Cada licencia esta asociada a un único dispositivo.

### Estados de la licencia

| Estado | Significado |
|---|---|
| Activa | Licencia valida, todas las funciones disponibles |
| Sin conexión | Sin internet. La licencia funciona hasta 7 dias sin validación en linea |
| Expirada | La licencia vencio. Contactar al proveedor para renovar |
| Revocada | La licencia fue desactivada por el administrador |

---

## 4. Navegacion general

La interfaz de Helpmeet tiene tres areas principales:

**Barra superior:** Muestra el nombre de la aplicación, la version, y el estado actual (grabando, procesando, etc.). Los botones de la derecha permiten minimizar, maximizar y cerrar la ventana.

**Panel lateral izquierdo:** Contiene la lista de iniciativas, accesos rapidos a Inicio, Favoritos, Calendario, Archivados y Papelera. El boton **Nuevo proyecto** crea una iniciativa.

**Area principal:** Cambia segun la vista activa. Muestra las reuniones de la iniciativa seleccionada, el calendario, los ajustes, o la vista de reunión en detalle.

---

## 5. Iniciativas (proyectos)

Las iniciativas son la forma de organizar el trabajo. Cada iniciativa agrupa reuniones, participantes y contexto.

### Crear una iniciativa

1. Hacer clic en el boton **Nuevo proyecto** en el panel lateral.
2. Escribir el nombre de la iniciativa.
3. Opcional: elegir un color para identificarla visualmente.
4. Presionar **Enter** o hacer clic fuera del campo.

### Anclar una iniciativa como favorita

1. Hacer clic derecho sobre la iniciativa en el panel lateral.
2. Seleccionar **Anclar a favoritos**.

Las iniciativas ancladas aparecen al principio de la lista y en la seccion **Favoritos**.

### Establecer el objetivo de una iniciativa

1. Seleccionar la iniciativa en el panel lateral.
2. En el area principal, hacer clic en el campo **Objetivo / Contexto**.
3. Escribir una descripción del proposito de la iniciativa.
4. Este texto se incluye en todas las exportaciones como contexto para la IA.

### Cambiar nombre o color

1. Hacer clic derecho sobre la iniciativa.
2. Seleccionar **Renombrar** o **Cambiar color**.

---

## 6. Reuniones

Cada reunión pertenece a una iniciativa. Las reuniones se muestran en orden cronologico inverso (la mas reciente primero).

### Iniciar una reunión

1. Seleccionar la iniciativa en el panel lateral.
2. Hacer clic en el boton **Nueva reunión**.
3. Escribir un titulo descriptivo (por ejemplo: "Revision de avances Q3").
4. Elegir el tipo de grabación: solo audio o pantalla.

### Ver una reunión

1. Seleccionar la iniciativa.
2. Hacer clic sobre la tarjeta de la reunión.
3. Se abre la vista de detalle con la transcripción, capturas, notas y opciones de exportación.

### Cambiar fecha de una reunión

1. Abrir la reunión.
2. Hacer clic en la fecha mostrada en la cabecera.
3. Seleccionar la nueva fecha en el calendario.

### Estados de una reunión

| Estado | Significado |
|---|---|
| Pendiente | Reunion creada pero sin grabar o sin transcripción |
| Procesando | La transcripción se esta ejecutando en segundo plano |
| Completada | Transcripcion finalizada, lista para revisar y exportar |

---

## 7. Grabacion de audio

Helpmeet graba dos pistas de audio simultaneas:

- **Yo:** Su voz a traves del microfono.
- **Los demas:** El audio del sistema (lo que suena en los altavoces, como una videollamada).

### Iniciar grabación de audio

1. Seleccionar una iniciativa.
2. Hacer clic en **Nueva reunión**.
3. Escribir el titulo.
4. Seleccionar la opcion **Solo audio**.
5. Hacer clic en **Iniciar grabación**.
6. La barra superior mostrara un indicador rojo y el tiempo de grabación.
7. Para finalizar, hacer clic en el boton **Detener**.

> La transcripción comienza automáticamente al detener la grabación. Puede seguir usando la aplicación mientras se procesa en segundo plano.

### Silenciar microfono durante la grabación

1. Durante la grabación, hacer clic en el icono del microfono en la barra de estado.
2. El icono cambiara a tachado, indicando que el microfono esta silenciado.
3. Volver a hacer clic para reactivarlo.

---

## 8. Grabacion de pantalla

Permite grabar la pantalla completa (o un monitor especifico) junto con el audio.

### Iniciar grabación de pantalla

1. Seleccionar una iniciativa.
2. Hacer clic en **Nueva reunión**.
3. Seleccionar la opcion **Pantalla**.
4. Aparece una vista previa de la pantalla. Ajustar la posicion si es necesario.
5. Hacer clic en **Iniciar grabación**.
6. Para finalizar, hacer clic en **Detener**.

> La grabación de pantalla genera un archivo de video. La transcripción se extrae del audio de ese video.

### Cambiar de monitor durante la grabación

1. Durante la grabación, hacer clic en el selector de monitor.
2. Elegir el monitor deseado (Monitor 1, Monitor 2, etc.).

### Grabaciones interrumpidas

Si la aplicación se cierra inesperadamente durante una grabación, al volver a abrir Helpmeet ofrecera recuperar la grabación.

---

## 9. Transcripcion

La transcripción convierte el audio grabado en texto, separando las intervenciones de **Yo** y **Los demas**.

### Como funciona

1. Al detener una grabación, la transcripción se encola automáticamente.
2. El proceso ocurre en segundo plano. Puede ver el progreso en la parte superior de la ventana.
3. Al terminar, la reunión se marca como **Completada** y la transcripción esta disponible.

### Editar una frase

1. Abrir la reunión.
2. Hacer clic en el texto de la frase que desea editar.
3. Modificar el texto.
4. El cambio se guarda automáticamente.

### Cambiar el hablante de una frase

1. Hacer clic derecho sobre la frase.
2. Seleccionar **Yo** o **Los demas** segun corresponda.
3. Si tiene participantes configurados, puede asignar la frase a una persona especifica.

### Marcar una frase como importante

1. Hacer clic en el icono de estrella junto a la frase.
2. La frase se resalta y aparece marcada en las exportaciones.

### Eliminar una frase

1. Hacer clic derecho sobre la frase.
2. Seleccionar **Eliminar**.

---

## 10. Capturas y notas

### Tomar una captura de pantalla

1. Durante una grabación (audio o pantalla), presionar **Ctrl+Shift+S**.
2. La captura se guarda automáticamente y queda anclada al momento exacto de la reunión.
3. Las capturas aparecen en la pestana **Capturas** de la reunión.

> Tambien puede usar el boton de captura en la barra de herramientas durante la grabación.

### Agregar una nota

1. Durante la grabación, escribir en el campo de nota rapida y presionar **Enter**.
2. La nota queda anclada al minuto exacto de la reunión.
3. En la vista de reunión, las notas aparecen en la pestana **Notas**.

### Agregar contexto a una reunión terminada

1. Abrir la reunión.
2. En la cabecera, hacer clic en **Agregar contexto**.
3. Escribir un resumen o notas adicionales sobre la reunión.
4. Este texto aparece destacado al inicio de la transcripción.

---

## 11. Participantes

Los participantes permiten asignar nombres reales a las frases, reemplazando las etiquetas genericas "Yo" y "Los demas".

### Agregar participantes

1. Abrir una reunión de la iniciativa.
2. Ir a la pestana **Participantes**.
3. Escribir los nombres, uno por linea.
4. Hacer clic en **Agregar**.

### Marcar quien es usted

1. En la lista de participantes, hacer clic en el icono de persona junto a su nombre.
2. El participante marcado como "Yo" se usara para identificar sus intervenciones.

### Asignar una frase a un participante

1. Hacer clic derecho sobre la frase.
2. Seleccionar el nombre del participante en el menu.
3. La frase mostrara ese nombre en lugar de la etiqueta generica.

---

## 12. Busqueda

La busqueda global permite encontrar palabras o frases en todas las transcripciones.

1. Presionar **Ctrl+F**.
2. Escribir el termino de busqueda.
3. Los resultados muestran la reunión, el tipo (frase o nota), el hablante y el texto.
4. Hacer clic en un resultado para abrir esa reunión en el punto exacto.

> La busqueda no distingue mayusculas ni minusculas. Buscar "presupuesto" encontrara "Presupuesto", "PRESUPUESTO", etc.

---

## 13. Exportacion

Helpmeet exporta las reuniones en formato Markdown, listo para usar con Claude Code u otras herramientas de IA.

### Exportar una reunión

1. Abrir la reunión.
2. Hacer clic en **Exportar**.
3. Elegir el formato:
   - **TXT:** Solo el texto de la transcripción.
   - **ZIP:** Texto + todas las capturas + archivo de video (si existe).
4. Elegir la carpeta de destino.
5. La carpeta de exportación se abre automáticamente.

### Exportar una iniciativa completa

1. Hacer clic derecho sobre la iniciativa en el panel lateral.
2. Seleccionar **Exportar iniciativa**.
3. Se genera una carpeta con todas las reuniones de la iniciativa, organizadas por mes.

### Estructura de la exportación

```
Iniciativa/
  2026-07 Julio/
    2026-07-18_10-30_Titulo de la reunión/
      transcripción.md
      capturas/
        CAP-0001.png
        CAP-0002.png
```

### Copiar contexto para Claude Code

1. Abrir una reunión o seleccionar una iniciativa.
2. Hacer clic en **Copiar contexto**.
3. El texto se copia al portapapeles, listo para pegar en Claude Code.

> El texto incluye instrucciones para la IA, el objetivo de la iniciativa, un glosario de terminos frecuentes y la transcripción completa.

---

## 14. Calendario

El calendario muestra las reuniones organizadas por mes en una vista tipo agenda.

1. Hacer clic en **Calendario** en el panel lateral.
2. Las reuniones se agrupan por mes.
3. Hacer clic en cualquier reunión para abrirla.

---

## 15. Archivo y papelera

### Archivar

Archivar una iniciativa o reunión la oculta de la vista principal pero conserva todos los datos.

1. Hacer clic derecho sobre la iniciativa o reunión.
2. Seleccionar **Archivar**.

Los elementos archivados se pueden ver en la seccion **Archivados** del panel lateral.

### Papelera

Eliminar una iniciativa o reunión la mueve a la papelera.

1. Hacer clic derecho sobre la iniciativa o reunión.
2. Seleccionar **Eliminar**.

Los elementos en papelera se pueden ver en la seccion **Papelera**.

### Restaurar

1. Ir a **Papelera** en el panel lateral.
2. Hacer clic derecho sobre el elemento.
3. Seleccionar **Restaurar**.

### Eliminar permanentemente

1. Ir a **Papelera**.
2. Hacer clic derecho sobre el elemento.
3. Seleccionar **Eliminar permanentemente**.

> Una vez eliminado permanentemente, el elemento y todos sus datos (transcripciones, capturas, notas) no se pueden recuperar.

---

## 16. Ajustes

Para abrir los ajustes, hacer clic en el icono de configuración en la barra superior.

### Carpeta de exportación

Define donde se guardan las exportaciones de reuniones e iniciativas.

1. En **Ajustes**, hacer clic en **Cambiar carpeta**.
2. Seleccionar la carpeta deseada.

### Modelo de transcripción

Controla la calidad y velocidad de la transcripción.

| Nivel | Calidad | Velocidad | Descarga |
|---|---|---|---|
| Mas rapido | Menor | Alta | ~145 MB |
| Rapido (recomendado) | Buena | Alta | ~480 MB |
| Preciso | Muy buena | Media | ~1.5 GB |
| Maxima calidad | Excelente | Baja | ~3 GB |

> El modelo "Rapido" es suficiente para la mayoria de reuniones. Use "Preciso" o "Maxima calidad" para reuniones muy importantes o con mucho ruido de fondo.

### Instrucciones para la IA

Texto que se incluye al inicio de cada exportación para orientar a la IA externa.

1. En **Ajustes**, editar el campo **Instrucciones para la IA**.
2. El texto se incluira en todas las exportaciones como cabecera de contexto.

---

## 17. Copia de seguridad

### Crear copia de seguridad

1. Ir a **Ajustes**.
2. Hacer clic en **Crear copia de seguridad**.
3. Elegir la carpeta de destino.
4. Se genera una carpeta `helpmeet-backup-YYYY-MM-DD_HH-MM-SS` con la base de datos y los ajustes.

> La copia de seguridad NO incluye las grabaciones de audio/video ni las capturas. Solo incluye la base de datos (iniciativas, reuniones, transcripciones, notas) y los ajustes.

### Borrar todos los datos

1. Ir a **Ajustes**.
2. Hacer clic en **Borrar todos los datos**.
3. Confirmar la acción.

> Esta acción elimina toda la información local: reuniones, transcripciones, capturas, ajustes y licencia. Las exportaciones guardadas en disco no se ven afectadas.

---

## 18. Atajos de teclado

| Atajo | Accion |
|---|---|
| `Ctrl+N` | Nueva iniciativa |
| `Ctrl+F` | Buscar en transcripciones |
| `Ctrl+Shift+S` | Captura de pantalla (durante grabación) |
| `Ctrl+E` | Exportar reunión actual |
| `Escape` | Cerrar ventana modal o volver atras |

---

## 19. Panel de administración (licencias)

El panel de administración permite gestionar las licencias de los usuarios. Esta dirigido a administradores, no a usuarios finales.

### Acceder al panel

El panel se ejecuta localmente junto con el backend de licencias. Para acceder:

1. Iniciar el backend de licencias.
2. Abrir `admin-panel/index.html` en el navegador.
3. Ingresar la clave de administrador (configurada en el archivo `.env` del backend).

### Funciones del panel

| Funcion | Descripcion |
|---|---|
| Crear licencia | Genera una nueva clave de licencia para un cliente |
| Ver licencias | Lista todas las licencias con su estado y dispositivos activos |
| Revocar licencia | Desactiva una licencia y todos sus dispositivos |
| Resetear dispositivos | Libera los dispositivos asociados a una licencia |
| Generar nueva clave | Crea una nueva clave para una licencia existente |

### Flujo de activación

1. El administrador crea una licencia en el panel.
2. El sistema genera una clave con formato `HM-XXXX-XXXX-XXXX-XXXX`.
3. El administrador envia la clave al usuario final.
4. El usuario ingresa la clave en Helpmeet para activar la aplicación.

---

## 20. Solucion de problemas

### La aplicación no abre

- Verificar que Windows 10 u 11 este actualizado.
- Verificar que WebView2 este instalado (la aplicación lo instala automáticamente si falta).
- Ejecutar como usuario normal, no como administrador.

### La transcripción no se genera

- Verificar que el modelo se haya descargado correctamente (en Ajustes > Modelo > debe mostrar el modelo seleccionado).
- Verificar que la reunión tenga audio (en la vista de reunión debe mostrar una duración mayor a 0).
- Si el problema persiste, ir a Ajustes > **Limpiar cache de Whisper** y reintentar.

### Error de licencia

- Verificar la conexión a internet.
- La licencia funciona hasta 7 dias sin conexión.
- Si el error persiste, contactar al administrador de licencias.

### La aplicación se cierra inesperadamente

- Al volver a abrir, Helpmeet ofrece recuperar las grabaciones interrumpidas.
- Si la recuperación falla, los datos de reuniones anteriores no se pierden (estan en la base de datos local).

### Liberar espacio en disco

- El modelo de transcripción y las grabaciones ocupan espacio. Para liberar:
  1. Eliminar reuniones antiguas que ya no necesite.
  2. Vaciar la papelera.
  3. Las grabaciones originales estan en la carpeta de exportación de cada iniciativa.
