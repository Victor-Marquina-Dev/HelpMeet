# Mejoras UI para Helpmeet: animaciones, botones, iconos y componentes reutilizables

## Objetivo

Definir mejoras visuales y de arquitectura UI para que Helpmeet se vea más consistente, profesional y fácil de mantener.

Este documento está pensado para implementar un sistema visual reutilizable, evitando que cada pantalla tenga botones, iconos, estilos y animaciones diferentes.

## Problema actual

Helpmeet ya tiene una identidad visual clara, pero puede mejorar en estos puntos:

- Hay botones parecidos implementados de formas distintas.
- Algunos iconos no siempre tienen el mismo tamaño o alineación.
- Las animaciones no siguen una regla común.
- Hay pantallas con mucho texto o jerarquía visual desigual.
- Algunos estados visuales no están unificados: hover, activo, deshabilitado, cargando, error.
- El CSS puede crecer demasiado si cada nuevo módulo agrega estilos propios.

## Principio de diseño recomendado

Helpmeet debe sentirse:

- Minimalista.
- Rápido.
- Sobrio.
- Profesional.
- Con pocas distracciones.
- Con microinteracciones suaves, no llamativas.

La app no debe parecer una demo cargada de efectos. Las animaciones deben ayudar a entender qué pasó, no decorar por decorar.

## 1. Sistema de botones reutilizable

### Crear una escala única de botones

Definir variantes base:

```text
btn
btn-primary
btn-secondary
btn-ghost
btn-danger
btn-icon
btn-compact
```

### Reglas visuales

Todos los botones deben compartir:

- Altura consistente.
- Radio consistente.
- Padding consistente.
- Icono alineado.
- Estado hover.
- Estado active.
- Estado disabled.
- Estado loading.

### Tamaños recomendados

```text
Compacto: 28px alto
Normal:   36px alto
Grande:   44px alto
Icono:    32px x 32px
```

### Uso recomendado

#### Primary

Acciones principales:

- Grabar.
- Guardar.
- Transcribir.
- Crear iniciativa.

#### Secondary

Acciones útiles, pero no principales:

- Abrir carpeta.
- Exportar.
- Participantes.

#### Ghost

Acciones de baja prioridad:

- Buscar.
- Ver más.
- Cambiar vista.

#### Danger

Acciones destructivas:

- Eliminar.
- Descartar.
- Borrar datos.

## 2. Sistema de iconos

### Recomendación

Usar una sola librería de iconos para toda la app.

Recomendado:

- Lucide Icons.

Motivo:

- Son limpios.
- Funcionan bien en interfaces oscuras.
- Tienen estilo lineal consistente.
- Son fáciles de ajustar por tamaño y grosor.

### Reglas de iconos

Usar tamaños fijos:

```text
Icono pequeño: 14px
Icono normal: 16px
Icono grande: 20px
Icono destacado: 24px
```

### Grosor

Mantener un stroke visual similar:

```text
stroke-width: 1.8px o 2px
```

### No mezclar estilos

Evitar mezclar:

- Iconos rellenos.
- Iconos lineales.
- Iconos muy redondeados.
- Iconos cuadrados.
- Emojis como iconos principales.

Los emojis pueden aparecer en documentos exportados, pero no deberían ser la base de la UI.

## 3. Animaciones y microinteracciones

### Objetivo de las animaciones

Las animaciones deben comunicar:

- Entrada.
- Salida.
- Cambio de estado.
- Carga.
- Confirmación.
- Error.

No deben ser largas ni exageradas.

### Duraciones recomendadas

```text
Hover:        120ms
Click:         80ms
Panel/modal:  180ms - 220ms
Toast:        220ms
Sidebar:      200ms - 260ms
Loading:      continuo, suave
```

### Curva recomendada

```css
cubic-bezier(.2, .8, .2, 1)
```

O usar variables:

```css
--ease-out: cubic-bezier(.2, .8, .2, 1);
--ease-in: cubic-bezier(.4, 0, 1, 1);
--ease-standard: cubic-bezier(.4, 0, .2, 1);
```

### Animaciones recomendadas

#### Hover suave

Aplicar a:

- Botones.
- Items del sidebar.
- Tarjetas de reunión.
- Chips.

```css
transition: background .14s ease, color .14s ease, border-color .14s ease;
```

#### Press / click

Al hacer click:

```css
transform: scale(.98);
```

Debe ser sutil.

#### Entrada de modal

```text
opacity 0 → 1
scale .98 → 1
translateY 6px → 0
```

#### Entrada de lista

Para reuniones o iniciativas:

```text
opacity 0 → 1
translateY 4px → 0
```

Usar stagger muy corto si hay varias filas:

```text
delay: 20ms por item
```

No usar delays largos.

#### Carga / procesamiento

Usar spinner o barra, no ambos si no es necesario.

Para transcripción:

- Spinner pequeño.
- Porcentaje.
- Barra fina.
- Sin texto largo.

## 4. Variables de diseño

Centralizar tokens en CSS.

### Colores

```css
--color-bg: #121413;
--color-surface: #1a1c1b;
--color-surface-2: #202321;
--color-border: rgba(255,255,255,.10);
--color-border-strong: rgba(255,255,255,.18);
--color-text: #f4f7f5;
--color-text-muted: #93a19a;
--color-accent: #aacfbf;
--color-danger: #ef6b6b;
--color-warning: #e3b85c;
```

### Espaciado

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
```

### Radios

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 18px;
--radius-pill: 999px;
```

### Sombras

Usar sombras muy suaves.

```css
--shadow-pop: 0 18px 50px rgba(0,0,0,.35);
--shadow-soft: 0 10px 30px rgba(0,0,0,.20);
```

## 5. Componentes reutilizables

Crear estilos base para estos componentes:

### Button

Debe cubrir:

- Texto.
- Icono + texto.
- Solo icono.
- Loading.
- Disabled.

### IconButton

Para acciones compactas:

- Buscar.
- Configuración.
- Más opciones.
- Cerrar.

### Chip

Para:

- Estado.
- Filtros.
- Tags.
- Tipo de reunión.

Estados:

```text
chip-active
chip-muted
chip-success
chip-warning
chip-danger
```

### Input

Unificar:

- Text input.
- Search input.
- Textarea.

Reglas:

- Mismo background.
- Mismo border.
- Mismo focus.
- Placeholder más suave.
- Icono alineado.

### Empty State

Para pantallas sin contenido.

Debe tener:

- Icono simple.
- Título breve.
- Texto opcional corto.
- Acción principal.

Evitar textos largos.

### Card / Row

Separar:

- Card: contenido con más detalle.
- Row: listas compactas.

Iniciativas y reuniones deberían usar rows en sidebar y cards/lista en pantalla principal.

## 6. Sidebar mejorado

### Reglas

El sidebar debe ser rápido y compacto.

Debe incluir:

- Buscador opcional.
- Iniciativas fijadas.
- Iniciativas activas.
- Contador claro.
- Estado visual al seleccionar.

Evitar:

- Demasiados botones visibles.
- Mucho texto secundario.
- Cajas dentro de cajas.

### Microinteracciones

- Hover suave en filas.
- Chevrón rota al expandir.
- Nueva iniciativa aparece con fade.
- Item seleccionado con fondo sutil.

## 7. Estados visuales globales

Definir una regla única para estados:

### Idle

Sin indicador fuerte.

### Recording

Rojo sutil, visible pero no agresivo.

### Processing

Spinner pequeño + barra.

### Done

Pill verde suave.

### Pending

Pill ámbar.

### Error

Texto corto + acción para reintentar.

## 8. Toasts y confirmaciones

### Toasts

Usar para:

- Guardado.
- Exportado.
- Copiado.
- Error menor.

Duración:

```text
OK: 2s
Info: 3s
Error: 4s - 5s
```

### Confirmaciones

Usar modal solo para:

- Eliminar.
- Borrar datos.
- Descartar recuperación.

No usar modal para acciones simples.

## 9. Menús contextuales

Unificar menús de tres puntos.

Debe soportar:

- Icono.
- Texto.
- Separador.
- Acción destructiva.
- Disabled.

Ejemplo:

```text
Renombrar
Cambiar color
Abrir carpeta
Exportar
---
Archivar
Eliminar
```

## 10. Inputs largos con scroll

Para áreas como:

- Instrucciones para IA.
- Notas de reunión.
- Contexto de iniciativa.

Reglas:

- Altura mínima controlada.
- Altura máxima.
- Scroll interno.
- No deformar la pantalla.
- Evitar resize manual si rompe el layout.

## 11. Animaciones que sí convienen

Implementar:

- Fade de entrada para vistas.
- Slide corto en modales.
- Hover suave.
- Barra de progreso animada.
- Skeleton ligero en carga.
- Spinner consistente.

Evitar:

- Rebotes.
- Efectos grandes.
- Animaciones largas.
- Transiciones en todo el layout.
- Sombras excesivas.

## 12. Skeleton loading

Para cargas de:

- Lista de iniciativas.
- Reuniones.
- Transcript.
- Diagnóstico.

Usar skeletons simples:

```text
████████
████████████
██████
```

Con shimmer muy sutil.

No usar skeleton si la carga dura menos de 300ms.

## 13. Reutilización en JavaScript

Crear helpers UI para no repetir HTML.

Ejemplos:

```js
button({ label, icon, variant, size, disabled, loading })
iconButton({ icon, title, active })
chip({ label, tone })
emptyState({ icon, title, text, action })
menu(items)
```

Esto evita tener muchos botones escritos a mano con clases distintas.

## 14. Reutilización en CSS

Separar CSS por bloques:

```text
tokens
base
layout
components
screens
utilities
animations
```

Prioridad:

1. Tokens.
2. Botones.
3. Inputs.
4. Icon buttons.
5. Chips.
6. Menús.
7. Modales.
8. Listas/cards.

## 15. Accesibilidad básica

Implementar:

- `aria-label` en botones solo icono.
- Focus visible.
- No depender solo del color.
- Contraste suficiente.
- Teclas Enter/Escape en modales.
- Escape para cerrar menús.

## 16. Prioridad de implementación

### Fase 1: consistencia rápida

- Unificar botones.
- Unificar icon buttons.
- Unificar inputs.
- Corregir tamaños de iconos.
- Crear variables de animación.

### Fase 2: microinteracciones

- Hover/press común.
- Modales con entrada suave.
- Menús contextuales consistentes.
- Toasts consistentes.
- Spinner/barra común.

### Fase 3: sistema de componentes

- Helpers JS para botones, chips, menus y empty states.
- Reducir HTML repetido.
- Separar CSS por componentes.
- Documentar uso de cada componente.

### Fase 4: refinamiento visual

- Skeleton loading.
- Animación de listas.
- Estados vacíos mejorados.
- Sidebar más inteligente.
- Pantallas con menos texto.

## Resultado esperado

Después de implementar estas mejoras, Helpmeet debería sentirse:

- Más limpio.
- Más rápido.
- Más profesional.
- Más consistente.
- Más fácil de mantener.
- Menos “hecho por IA”.
- Más cercano a una app enterprise moderna.

## Regla final

Cada nueva pantalla o función debe reutilizar componentes existentes antes de crear estilos nuevos.

Si una nueva función necesita un botón, input, modal, menú o chip diferente, primero revisar si el sistema actual ya lo cubre.
