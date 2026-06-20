# Helpmeet — Plan de mejoras (post Fase 1)

> Mejoras solicitadas tras verificar la Fase 1 funcionando. Se implementan una a una, probando con el usuario. ✅ = hecho, ⬜ = pendiente.

**Base:** Fase 1 completa y verificada (ver `2026-06-18-helpmeet-fase1.md`). Falta solo verificar el micrófono (hardware del usuario).

---

## Mejora A — Título y datos de cada reunión

- ✅ Al pulsar **Grabar**, preguntar el nombre de la reunión (en vez de "Reunión" fijo).
- ✅ `start_recording` devuelve `meeting_id`, `title` y `started_at`.
- ✅ Mostrar un encabezado en la transcripción con el título y la hora de inicio.
- ✅ Al parar, mostrar la duración.
- ✅ Fix: el cartel "Reunión finalizada" sale al final (stop espera al último trozo).

## Mejora B — Mejor documento para Claude

- ⬜ Encabezado enriquecido en `contexto.md`: fecha, duración, nº de frases, hablantes presentes.
- ⬜ Nueva función `export_initiative`: junta todas las reuniones de una iniciativa en un solo `contexto.md` cronológico.
- ⬜ Botón/opción en la app para "Exportar iniciativa completa".

## Mejora C — Ver reuniones guardadas (panel lateral)

- ⬜ Panel izquierdo: iniciativas y, dentro, sus reuniones por fecha.
- ⬜ Nuevos métodos API: `list_meetings(initiative_id)`, `get_transcript(meeting_id)`.
- ⬜ Al hacer clic en una reunión, cargar su transcripción guardada en el centro.
- ⬜ Re-exportar una reunión pasada.
- ⬜ (Opcional) Editar/borrar frases mal transcritas.

## Mejora D — Calidad de transcripción

- ✅ Modelo cambiado a `medium` (configurable en `config.py`). Selector en UI: opcional futuro.
- ✅ Vocabulario técnico (`initial_prompt`) para reconocer mejor términos de programación.
- ✅ Parámetros de calidad: `beam_size=5`, `condition_on_previous_text=True`.
- ✅ Limpieza ligera del texto (muletillas, espacios, puntuación) con 6 tests verdes.

---

## Seguimiento

- ✅ Mejora A — Título y datos de reunión
- ⬜ Mejora B — Mejor documento para Claude
- ⬜ Mejora C — Panel de reuniones guardadas
- 🟡 Mejora D — Calidad de transcripción (código hecho; falta probar en vivo con el usuario)
