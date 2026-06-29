# Mejoras para organizar muchas iniciativas en Helpmeet

## Objetivo

Mejorar la sección de iniciativas para que funcione bien cuando el usuario tenga muchas iniciativas activas, sin que el sidebar se vuelva difícil de navegar.

La idea principal es que Helpmeet ayude a encontrar, priorizar y ordenar iniciativas rápidamente, manteniendo una interfaz limpia y minimalista.

## Problema actual

En el sidebar las iniciativas aparecen como una lista simple:

- Nombre de la iniciativa.
- Color.
- Cantidad de reuniones.
- Indicador de fijado.
- Desplegable para ver reuniones.

Esto funciona con pocas iniciativas, pero puede volverse incómodo cuando haya muchas porque:

- La lista crecerá demasiado.
- No hay búsqueda directa dentro de iniciativas.
- No hay agrupación por estado, cliente, mes o prioridad.
- No es fácil diferenciar iniciativas activas, pausadas o cerradas.
- Las iniciativas fijadas pueden mezclarse visualmente con las demás.
- El contador de reuniones no siempre ayuda a decidir qué abrir primero.

## Propuesta de rediseño

### 1. Buscador dentro de iniciativas

Agregar un buscador pequeño dentro del bloque de iniciativas.

Debe permitir buscar por:

- Nombre de iniciativa.
- Cliente/proyecto.
- Palabras del contexto de la iniciativa.
- Reuniones asociadas.

Comportamiento esperado:

- Si el usuario escribe, filtra en tiempo real.
- Si no hay resultados, mostrar mensaje simple: “Sin iniciativas encontradas”.
- El buscador no debe ocupar mucho espacio.
- Puede aparecer solo al hacer clic en un icono de lupa.

Ejemplo visual:

```text
Iniciativas        +
[ Buscar iniciativa... ]

★ Fijadas
  BC digital       21

Activas
  weqd             13
```

### 2. Separar iniciativas fijadas

Las iniciativas fijadas deben aparecer en una sección propia.

Propuesta:

- Fijadas arriba.
- Separación visual sutil, no una caja pesada.
- Mostrar máximo 5 fijadas inicialmente.
- Si hay más, mostrar “Ver más”.

Esto ayuda a que los proyectos importantes estén siempre a mano.

### 3. Estados de iniciativa

Agregar estado a cada iniciativa:

- Activa.
- Pausada.
- Cerrada.
- Archivada.

Uso recomendado:

- Activa: aparece normal.
- Pausada: aparece con menor intensidad.
- Cerrada: no se muestra por defecto, pero puede verse con filtro.
- Archivada: se mueve a Archivo.

Esto evita que proyectos antiguos sigan ocupando espacio visual.

### 4. Filtros rápidos

Agregar filtros simples dentro de iniciativas.

Filtros recomendados:

- Todas.
- Fijadas.
- Activas.
- Recientes.
- Sin reuniones recientes.

Diseño recomendado:

- Usar chips pequeños.
- No usar cajas grandes.
- Solo resaltar el filtro seleccionado.

Ejemplo:

```text
Todas  Fijadas  Activas  Recientes
```

### 5. Orden inteligente

Permitir ordenar automáticamente por:

- Última actividad.
- Nombre.
- Cantidad de reuniones.
- Fijadas primero.
- Pendientes primero.

Orden recomendado por defecto:

1. Iniciativas fijadas.
2. Iniciativas con grabación/transcripción en curso.
3. Iniciativas activas con actividad reciente.
4. Iniciativas activas sin actividad reciente.
5. Cerradas o pausadas ocultas por defecto.

### 6. Agrupación por cliente o categoría

Cuando haya muchas iniciativas, conviene agruparlas.

Opciones posibles:

- Por cliente.
- Por mes.
- Por estado.
- Por tipo de proyecto.
- Por área: SAP, CRM, APIs, soporte, diseño, etc.

Recomendación:

Primero implementar agrupación por estado y por cliente/categoría.

Ejemplo:

```text
Fijadas
  BC digital

Clientes
  Cliente A
    Integración SAP
    Portal CRM

  Cliente B
    Rediseño App
```

### 7. Tags o etiquetas

Permitir agregar etiquetas a una iniciativa.

Ejemplos:

- SAP
- API
- CRM
- Urgente
- Cliente
- Interno
- Diseño
- Soporte

Uso:

- Filtrar iniciativas.
- Entender rápido de qué trata cada proyecto.
- Mejorar el contexto enviado a la IA.

Diseño:

- Mostrar máximo 1 o 2 etiquetas en el sidebar.
- El resto se ve al entrar a la iniciativa.

### 8. Vista compacta y vista detallada

Agregar dos modos de visualización:

#### Vista compacta

Para navegar rápido:

- Punto de color.
- Nombre.
- Contador.
- Pin.

#### Vista detallada

Para revisar mejor:

- Nombre.
- Última actividad.
- Estado.
- Cantidad de reuniones.
- Tags.

Recomendación:

El sidebar debe usar vista compacta. La pantalla principal de “Iniciativas” puede usar vista detallada.

### 9. Indicadores útiles

Mejorar el contador actual para que comunique más.

Además de número de reuniones, considerar:

- Reuniones pendientes de transcribir.
- Última actividad.
- Si tiene contexto escrito.
- Si tiene tareas o notas importantes.

Ejemplo:

```text
BC digital       21
2 pendientes
```

En el sidebar no conviene mostrar todo siempre. Puede aparecer en tooltip o al pasar el mouse.

### 10. Acciones rápidas por iniciativa

Agregar acciones rápidas al pasar el mouse o desde menú de tres puntos:

- Fijar/desfijar.
- Renombrar.
- Cambiar color.
- Cambiar estado.
- Abrir carpeta.
- Exportar contexto.
- Archivar.
- Eliminar.

Recomendación:

No mostrar todos los botones siempre. Mantener limpio y mostrar acciones al pasar el mouse.

## Diseño recomendado

### Estilo visual

Mantener:

- Fondo oscuro.
- Bordes sutiles.
- Colores suaves.
- Nada de tarjetas pesadas dentro del sidebar.
- Mucho espacio respirable.

Evitar:

- Demasiados iconos visibles al mismo tiempo.
- Líneas divisorias fuertes.
- Cajas dentro de cajas.
- Contadores grandes.
- Textos largos en el sidebar.

### Sidebar recomendado

```text
Reuniones

Iniciativas                         +
[ Buscar... ]

Fijadas
  ● BC digital                 21

Activas
  ● weqd                       13
  ● Integración SAP             8
  ● Portal CRM                  4

Pausadas
  ● Migración legacy            6
```

### Pantalla principal de iniciativas

Cuando el usuario haga clic en “Iniciativas”, mostrar una vista más completa:

- Buscador grande.
- Filtros.
- Orden.
- Lista o grid de iniciativas.
- Estado.
- Última actividad.
- Total de reuniones.
- Pendientes.

Ejemplo:

```text
Iniciativas

[ Buscar iniciativas... ]   Todas  Fijadas  Activas  Pausadas

BC digital
Activa · 21 reuniones · última actividad hoy

weqd
Activa · 13 reuniones · última actividad 26/06/26
```

## Reglas funcionales recomendadas

### Crear iniciativa

Al crear una iniciativa, pedir solo:

- Nombre.

Opcional después:

- Cliente.
- Tags.
- Color.
- Estado.
- Contexto.

No hacer el formulario inicial pesado.

### Cerrar iniciativa

Una iniciativa cerrada:

- No debe aparecer en la lista principal por defecto.
- Debe seguir accesible desde filtro “Cerradas”.
- No debe borrarse.

### Archivar iniciativa

Una iniciativa archivada:

- Sale del sidebar.
- Se mueve a Archivo.
- Conserva reuniones, transcripciones, notas y archivos.

### Buscar iniciativa

La búsqueda debe priorizar:

1. Coincidencia exacta del nombre.
2. Coincidencia parcial del nombre.
3. Tags.
4. Contexto.
5. Reuniones dentro de la iniciativa.

## Priorización sugerida

### Fase 1: mejoras rápidas

- Buscador dentro de iniciativas.
- Fijadas separadas arriba.
- Orden por última actividad.
- Menú de acciones rápido.
- Ocultar cerradas/archivadas.

### Fase 2: organización avanzada

- Estados de iniciativa.
- Tags.
- Filtros rápidos.
- Vista principal de iniciativas mejorada.

### Fase 3: organización inteligente

- Agrupación por cliente/categoría.
- Sugerencias automáticas de tags.
- Detección de iniciativas sin actividad.
- Recomendación de archivar/cerrar iniciativas antiguas.

## Recomendación final

La mejora más importante es que el sidebar no intente mostrar toda la información. Debe servir para navegación rápida.

La información completa debe vivir en la pantalla principal de “Iniciativas”.

Dividir así:

- Sidebar: rápido, compacto, limpio.
- Pantalla de Iniciativas: búsqueda, filtros, orden, detalles.
- Menú contextual: acciones avanzadas.

Esto permitirá que Helpmeet escale bien aunque el usuario tenga muchas iniciativas.
