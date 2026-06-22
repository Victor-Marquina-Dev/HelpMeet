# Helpmeet — Plan de mejoras (roadmap)

> Menú de ideas para seguir mejorando la app **después** de la Fase 1 y las Mejoras A–D
> (todas ya hechas). No es una lista para hacer todo de golpe: es para que **elijas**
> qué construir a continuación. Cuando elijas una, la diseñamos y la implementamos paso
> a paso (probándola contigo, como hasta ahora).

**Fecha:** 2026-06-21
**Estado actual:** app funcionando — transcribe con Replicate al terminar, organiza por
iniciativa, capturas con su minuto, exporta `contexto.md` para Claude Code, y ahora
también **exporta la iniciativa completa** (todas sus reuniones juntas).

---

## Cómo leer este documento

Cada idea tiene tres datos para que decidas fácil:

- **Qué hace** — en una frase, qué cambia para ti.
- **Por qué te sirve** — el beneficio real (sobre todo, mejor contexto para Claude Code).
- **Esfuerzo** — 🟢 bajo (un rato) · 🟡 medio (una sesión) · 🔴 alto (varias sesiones).

Las ideas están en 3 niveles. El **Nivel 1** es lo que yo te recomendaría hacer primero.

---

## Nivel 1 — Recomendadas ahora (mucho valor, esfuerzo contenido)

### 1. Resumen automático con IA ⭐ (mi favorita)
- **Qué hace:** al terminar una reunión, además de la transcripción, genera arriba del
  `contexto.md` un **resumen**: puntos clave, decisiones tomadas, tareas pendientes y
  términos técnicos mencionados.
- **Por qué te sirve:** es justo lo que Claude Code necesita para "entrar en contexto"
  rápido. En vez de leerse 40 minutos de charla, lee 10 líneas de resumen y ya sabe de
  qué va. Es el mayor salto de calidad para el objetivo de la app.
- **Esfuerzo:** 🟡 medio. Usa la API de Claude (tú ya tienes cuenta). Coste pequeño por
  reunión, parecido a Replicate.

### 2. Editar / corregir frases mal transcritas
- **Qué hace:** poder hacer clic en una frase y corregirla (o borrarla) cuando Whisper
  se equivoca con un término técnico o un nombre.
- **Por qué te sirve:** la transcripción nunca es perfecta con jerga técnica. Si Claude
  recibe "endpoint" bien escrito (y no "and point"), el contexto es más fiable.
- **Esfuerzo:** 🟡 medio.

### 3. Botón "Preparar para Claude Code" — ✅ HECHO (2026-06-21)
- **Qué hace:** al exportar (reunión, re-exportar o iniciativa completa), **abre sola la
  carpeta** del resultado en el Explorador de Windows. Ya no hay que copiar la ruta.
- **Por qué te sirve:** te ahorra buscar la carpeta a mano y te lleva directo a los
  archivos para arrastrarlos a Claude Code.
- **Esfuerzo:** 🟢 bajo. **Estado:** implementado (`open_path` en la API + apertura
  automática tras cada exportación).
- **Pendiente opcional (si lo quieres más adelante):** añadir también un texto sugerido
  listo para pegar en Claude Code.

### 4. Medidor de micrófono en vivo
- **Qué hace:** una barrita que se mueve mientras hablas, para ver **al instante** si el
  micro está entrando o está mudo (como pasó en las pruebas).
- **Por qué te sirve:** te avisa antes de grabar 40 minutos para descubrir luego que el
  micro estaba apagado. Pequeño detalle, gran tranquilidad.
- **Esfuerzo:** 🟢 bajo.

---

## Nivel 2 — Siguiente (valor alto, algo más de trabajo)

### 5. Búsqueda global — ✅ HECHO (2026-06-21)
- **Qué hace:** caja **🔎 Buscar en todo** en el panel lateral. Al pulsar Enter busca la
  palabra en **todas** las frases y notas de todas las reuniones; los resultados salen en
  tarjetas y, al hacer clic, abren la reunión.
- **Por qué te sirve:** cuando acumules muchas reuniones, encontrar algo a mano será
  imposible. Esto lo resuelve.
- **Esfuerzo:** 🟡 medio. **Estado:** implementado (`repo.search`, API `search`, caja +
  render de resultados, 1 test nuevo).

### 6. Marcar momento + nota rápida durante la reunión — ✅ HECHO (2026-06-21)
- **Qué hace:** botón **📝 Nota** (junto a 📷 Captura) para escribir una nota corta
  anclada al momento actual. Aparece en el documento exportado como `[MM:SS] 📝 Nota: …`.
- **Por qué te sirve:** a veces lo importante no es una imagen, es una idea ("ojo, aquí
  acordamos cambiar la base de datos"). Queda anclado en el contexto.
- **Esfuerzo:** 🟢🟡 bajo-medio. **Estado:** implementado (tabla `notes`, `repo.add_note`,
  render en el exportador, 2 tests nuevos).

### 7. Glosario de términos técnicos
- **Qué hace:** detecta los términos técnicos que más se repiten y los lista; además
  puede usarlos para que la **próxima** transcripción los reconozca mejor.
- **Por qué te sirve:** mejora la calidad con el tiempo y le da a Claude un vocabulario
  del proyecto.
- **Esfuerzo:** 🟡 medio.

### 8. Auto-guardado y recuperación ante cierre
- **Qué hace:** si la app o el PC se cierran a mitad de una grabación, al volver a abrir
  recupera el audio grabado hasta ese momento y lo puede transcribir.
- **Por qué te sirve:** robustez. Hoy, un cierre inesperado te haría perder la reunión.
- **Esfuerzo:** 🟡 medio.

---

## Nivel 3 — Más adelante (fases ya previstas o más complejas)

### 9. Diarización — separar quién habla (Fase 2, ya planificada)
- **Qué hace:** en lugar de solo "Yo / Los demás", distingue **cada** participante
  ("Persona 1", "Persona 2"…).
- **Por qué te sirve:** contexto mucho más rico; Claude entiende quién propuso qué.
- **Esfuerzo:** 🔴 alto.

### 10. Reconocer voces concretas (Fase 3, ya planificada)
- **Qué hace:** aprender la voz de personas habituales y ponerles su **nombre real**
  automáticamente.
- **Por qué te sirve:** el contexto pasa de "Persona 2" a "Marta, la de backend".
- **Esfuerzo:** 🔴 alto.

### 11. Captura por región / captura automática
- **Qué hace:** capturar solo una zona de la pantalla, o detectar sola cuando aparece
  código/tabla/diagrama y capturar sin que pulses.
- **Por qué te sirve:** menos trabajo manual, capturas más limpias.
- **Esfuerzo:** 🔴 alto (sobre todo la automática).

---

## Tabla resumen (valor vs esfuerzo)

| # | Mejora | Valor | Esfuerzo |
|---|--------|-------|----------|
| 1 | Resumen automático con IA ⭐ | Muy alto | 🟡 |
| 2 | Editar frases mal transcritas | Alto | 🟡 |
| 3 | Botón "Preparar para Claude Code" | Alto | 🟢 |
| 4 | Medidor de micrófono | Medio | 🟢 |
| 5 | Búsqueda global | Alto (a futuro) | 🟡 |
| 6 | Marcar momento + nota | Medio-alto | 🟢🟡 |
| 7 | Glosario de términos | Medio | 🟡 |
| 8 | Auto-guardado / recuperación | Medio (robustez) | 🟡 |
| 9 | Diarización (Fase 2) | Muy alto | 🔴 |
| 10 | Reconocer voces (Fase 3) | Alto | 🔴 |
| 11 | Captura por región / automática | Medio | 🔴 |

---

## Mi recomendación

Empezar por el **Nivel 1**, y dentro de él en este orden:

1. **Resumen automático con IA** (#1) — el mayor salto para tu objetivo (mejor contexto).
2. **Editar frases** (#2) — sube la calidad de todo lo demás.
3. **Botón "Preparar para Claude Code"** (#3) y **Medidor de micrófono** (#4) — rápidas
   y muy cómodas en el día a día.

La **diarización (Fase 2)** sigue siendo un gran salto, pero es la más costosa; tiene
sentido dejarla para cuando el flujo del Nivel 1 esté pulido.

---

## Siguiente paso

Dime **qué número(s)** te interesan y empezamos por uno. Lo diseñamos primero (qué hará
y cómo), te lo enseño, y solo entonces lo programo y lo probamos juntos — igual que hemos
hecho hasta ahora.
