# Mejoras próximas para Helpmeet — sin IA de pago

> **Objetivo de la app:** capturar una reunión y entregar a **otra IA (Claude Code)**
> el **máximo contexto posible** en Markdown. Todo lo de aquí se hace con
> procesamiento **local** (en tu PC): **cero llamadas a IA de pago, cero resúmenes
> automáticos, cero nube**. La idea no es que Helpmeet "piense", sino que prepare
> un contexto tan completo y limpio que la IA externa lo aproveche al máximo.

**Cómo leer este documento:** cada mejora dice **Qué** es, **Por qué** ayuda al
objetivo (más/mejor contexto para la otra IA) y un **Esfuerzo** orientativo
(🟢 bajo · 🟡 medio · 🔴 alto). No hace falta hacerlas todas ni en orden.

---

## 🎯 Por dónde empezaría yo (las 5 de más impacto)

1. **Nombres reales de los hablantes** (🟢) — cambiar "Yo / Los demás" por
   "Víctor", "Cliente Juan", etc. La IA entiende muchísimo mejor quién dice qué.
2. **Corregir la transcripción antes de exportar** (🟡) — arreglar palabras mal
   oídas y nombres propios. Un contexto limpio vale el doble.
3. **Marcar lo importante y etiquetar (Decisión / Tarea / Pregunta)** (🟡) — tú
   marcas a mano; la app lo agrupa arriba del documento. Le das a la IA lo que un
   "resumen automático" daría, pero **sin IA** y sin inventar nada.
4. ✅ **Cabecera de instrucciones + objetivo de la iniciativa** (🟢) — un bloque al
   inicio del `contexto.md` que le dice a Claude qué es esto y qué quieres de él. **(HECHO)**
5. ✅ **Botón "Copiar contexto"** (🟢) — copiar el `contexto.md` al portapapeles de
   un clic para pegarlo directo en Claude Code. **(HECHO)**

---

## A. Enriquecer el contexto que recibe la otra IA  *(el corazón)*

### A1 · Nombres reales de los hablantes  🟢
- **Qué:** en cada iniciativa, poder definir nombres ("Yo" → *Víctor*, "Los demás"
  → *Cliente* o un nombre por persona) y que el export los use.
- **Por qué:** "Yo: …" / "Los demás: …" es ambiguo. Con nombres reales, la IA
  atribuye decisiones y tareas a la persona correcta. Es de lo más barato y de
  lo que más sube la calidad.

### A2 · Cabecera de instrucciones para la IA  🟢  ✅ HECHO
- **Qué:** al principio de `contexto.md`, un bloque editable tipo *"Eres un
  asistente del proyecto X. Abajo tienes transcripciones de reuniones. Quiero
  que…"*. Plantilla por defecto + editable por iniciativa.
- **Por qué:** es solo texto (cero IA), pero orienta a Claude desde la primera
  línea. Hoy el documento empieza directo con datos; darle rol y objetivo mejora
  mucho la respuesta.

### A3 · Objetivo / descripción de la iniciativa visible y editable  🟢  ✅ HECHO
- **Qué:** el exportador ya usa `descripción` si existe, pero conviene una caja
  clara en la UI para escribir el objetivo, a quién va dirigido y el contexto.
- **Por qué:** sitúa a la IA en el "para qué" del proyecto, no solo en el "qué se
  dijo".

### A4 · Puntos destacados (★) al inicio del documento  🟡
- **Qué:** marcar frases importantes con una estrella; el export crea una sección
  *"Puntos destacados"* arriba, con enlace a su momento.
- **Por qué:** la IA ve primero lo que tú consideras clave. Es un "resumen"
  hecho por ti, fiable, sin que la app invente.

### A5 · Etiquetas manuales: Decisión / Tarea / Pregunta / Acuerdo  🟡
- **Qué:** etiquetar una frase o nota con una de esas categorías; el export las
  agrupa (p. ej. *"Decisiones: …", "Tareas: …"*).
- **Por qué:** es exactamente lo que pedirías a un resumen de IA, pero lo marcas
  tú en 1 clic. Resultado: contexto estructurado **sin coste y sin errores de IA**.

### A6 · Glosario editable con definiciones  🟡
- **Qué:** el glosario ya detecta términos frecuentes; añadir poder **editarlo**
  (quitar ruido, añadir términos y escribir una breve definición).
- **Por qué:** un glosario con definiciones le enseña a la IA el vocabulario
  propio del proyecto (siglas, nombres de producto), evitando que se confunda.

### A7 · Asegurar que el texto de cada captura va al contexto  🟢
- **Qué:** revisar que la nota escrita junto a una captura se exporte pegada a esa
  captura (descripción de lo que se ve).
- **Por qué:** una captura sin explicación dice poco a una IA de texto; con su
  nota, aporta contexto real.

---

## B. Fiabilidad y calidad de la captura  *(que no se pierda contexto)*

### B1 · Corregir la transcripción antes de exportar  🟡
- **Qué:** editar el texto de una frase (arreglar palabras mal oídas, nombres).
- **Por qué:** la transcripción local se equivoca con nombres propios y términos
  técnicos. Corregir antes de mandar evita que la IA arrastre el error.

### B2 · Cambiar el hablante de una frase  🟢
- **Qué:** si una frase quedó como "Yo" siendo de "Los demás" (o al revés),
  poder corregirlo.
- **Por qué:** mantiene coherente quién dijo qué → la IA atribuye bien.

### B3 · Dividir / unir / eliminar frases  🟡
- **Qué:** partir una frase larga, juntar dos cortadas, o borrar ruido ("eh…",
  silencios mal transcritos).
- **Por qué:** menos ruido = contexto más legible y denso para la IA.

### B4 · Diagnóstico de audio antes de grabar  🟡
- **Qué:** un botón "Probar audio" que muestre si se oyen el micrófono y el
  sonido del sistema (medidores) antes de empezar.
- **Por qué:** evita el peor caso: grabar una hora y descubrir que una pista
  estaba muda → contexto perdido.

### B5 · Recuperación si la app se cierra a mitad  🔴
- **Qué:** si Helpmeet se cierra o falla durante una grabación, al volver a abrir
  ofrecer recuperar el audio ya grabado y transcribirlo.
- **Por qué:** ninguna reunión se pierde por un cierre inesperado. (Es la más
  costosa de las de esta lista, pero la que más protege tu trabajo.)

### B6 · Cancelar una transcripción en curso  🟢
- **Qué:** botón para cancelar mientras procesa (sin cerrar la app).
- **Por qué:** si elegiste mal el vídeo o la pista, no te quedas atrapado
  esperando.

---

## C. Organizar y elegir qué mandar a la IA

### C1 · Búsqueda avanzada con filtros  🟡
- **Qué:** la búsqueda ya existe; añadir filtros por iniciativa, fecha, hablante
  y tipo (frase / nota).
- **Por qué:** localizar rápido el material exacto que quieres incluir en el
  contexto.

### C2 · Etiquetas / temas por reunión  🟡
- **Qué:** poner etiquetas a una reunión (p. ej. *"presupuesto", "diseño"*) y
  poder exportar solo las de una etiqueta.
- **Por qué:** mandar a la IA un contexto enfocado en un tema en vez de todo
  mezclado.

### C3 · Exportar selección (rango de fechas o reuniones elegidas)  🟡
- **Qué:** elegir qué reuniones entran en el `contexto.md` (todas, las últimas N,
  un rango).
- **Por qué:** controlas el tamaño y el foco del contexto que entregas.

---

## D. Calidad de vida (flujo más cómodo)

### D1 · Botón "Copiar contexto" al portapapeles  🟢  ✅ HECHO
- **Qué:** copiar el `contexto.md` completo de un clic.
- **Por qué:** pegar directo en Claude Code sin abrir carpetas.

### D2 · Vista previa del contexto dentro de la app  🟡
- **Qué:** ver cómo quedará el `contexto.md` antes de exportar/copiar.
- **Por qué:** revisas que esté todo bien (nombres, destacados) sin salir de la
  app.

### D3 · Autoguardado y recuperación de sesión  🟡
- **Qué:** guardar el estado periódicamente (ya estaba anotado como pendiente).
- **Por qué:** robustez general; enlaza con B5.

### D4 · Indicador de "revisado / listo para exportar"  🟢
- **Qué:** marcar una reunión como revisada (transcripción corregida, hablantes
  ok).
- **Por qué:** saber de un vistazo qué contexto ya está pulido para la IA.

---

## Tabla resumen

| # | Mejora | Bloque | Esfuerzo | Impacto | Estado |
|---|--------|--------|----------|---------|--------|
| A1 | Nombres reales de hablantes | Contexto | 🟢 | ★★★ | |
| A2 | Cabecera de instrucciones para la IA | Contexto | 🟢 | ★★★ | ✅ |
| A3 | Objetivo de la iniciativa editable | Contexto | 🟢 | ★★ | ✅ |
| A4 | Puntos destacados (★) | Contexto | 🟡 | ★★★ | |
| A5 | Etiquetas Decisión/Tarea/Pregunta | Contexto | 🟡 | ★★★ | |
| A6 | Glosario editable con definiciones | Contexto | 🟡 | ★★ | |
| A7 | Texto de captura en el export | Contexto | 🟢 | ★★ | |
| B1 | Corregir transcripción | Fiabilidad | 🟡 | ★★★ | |
| B2 | Cambiar hablante | Fiabilidad | 🟢 | ★★ | |
| B3 | Dividir/unir/eliminar frases | Fiabilidad | 🟡 | ★★ | |
| B4 | Diagnóstico de audio | Fiabilidad | 🟡 | ★★ | |
| B5 | Recuperación tras cierre | Fiabilidad | 🔴 | ★★ | |
| B6 | Cancelar transcripción | Fiabilidad | 🟢 | ★ | |
| C1 | Búsqueda con filtros | Organización | 🟡 | ★ | |
| C2 | Etiquetas/temas por reunión | Organización | 🟡 | ★★ | |
| C3 | Exportar selección | Organización | 🟡 | ★★ | |
| D1 | Copiar contexto al portapapeles | UX | 🟢 | ★ | ✅ |
| D2 | Vista previa del contexto | UX | 🟡 | ★ | |
| D3 | Autoguardado | UX | 🟡 | ★ | |
| D4 | Marca "listo para exportar" | UX | 🟢 | ★ | |

---

## Lo que queda fuera a propósito (sería IA de pago)
- Resúmenes automáticos, extracción automática de decisiones/tareas, preguntas
  sugeridas, "insights".
- **Por qué fuera:** requieren un modelo de IA (coste). **Buena noticia:** las
  mejoras **A4** y **A5** te dan casi el mismo resultado marcando tú a mano —
  fiable y gratis. Ese trabajo lo hará igualmente la IA externa (Claude Code)
  cuando le pases el contexto.
