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

- ✅ Encabezado enriquecido en `contexto.md`: por reunión, duración, nº de frases y hablantes presentes (y nº de capturas si las hay).
- ✅ Nueva función `export_initiative`: junta todas las reuniones de una iniciativa en un solo `contexto.md` cronológico, con cabecera de iniciativa (descripción, nº de reuniones, frases totales, periodo) y carpeta `capturas/` compartida (nombres con prefijo `rNN-` para no pisarse).
- ✅ Además del combinado, `export_initiative` escribe **un `.md` por reunión** con la fecha y hora en el nombre (`YYYY-MM-DD_HH-MM-SS_titulo.md`).
- ✅ Botón "Exportar iniciativa completa" en el panel lateral (al desplegar una iniciativa).
- ✅ 3 tests nuevos (encabezado enriquecido, orden cronológico, capturas sin colisión) — 19 tests verdes en total.

## Mejora C — Ver reuniones guardadas (panel lateral)

- ⬜ Panel izquierdo: iniciativas y, dentro, sus reuniones por fecha.
- ⬜ Nuevos métodos API: `list_meetings(initiative_id)`, `get_transcript(meeting_id)`.
- ⬜ Al hacer clic en una reunión, cargar su transcripción guardada en el centro.
- ⬜ Re-exportar una reunión pasada.
- ⬜ (Opcional) Editar/borrar frases mal transcritas.

## Mejora D — Calidad de transcripción (evolución)

Historial de la decisión (el usuario priorizó **velocidad** y luego **máxima calidad**):
- Se probó `medium` local → demasiado lento para el usuario.
- Se volvió a `small` local + `beam_size=1` + trozos de 6s → más rápido, pero perdía audio en los "huecos" entre trozos y fallaba con términos técnicos.
- Se quitó `initial_prompt` (se "colaba" como texto en silencios).
- ✅ **Decisión final: Replicate (Whisper en la nube) al terminar la reunión.**
  - Graba la reunión entera **sin cortes** (sin huecos) y la transcribe de una vez al parar.
  - El audio se **reduce a 16 kHz mono** antes de enviarlo → de 15 MB a 2.6 MB, de 143 s a **21 s**.
  - Token en `.env` (no versionado). Local sigue disponible con `USE_REPLICATE=False`.
- ✅ Limpieza ligera del texto (muletillas, espacios, puntuación) con 6 tests verdes.

## Mejora C — Panel de reuniones guardadas (hecha con el rediseño)

- ✅ Panel lateral con iniciativas y sus reuniones; clic en una carga su transcripción.
- ✅ Botón "Re-exportar" para volver a generar la carpeta de una reunión pasada.
- ✅ Panel **desplegable** con el botón ☰.

## Mejoras de interfaz (extra, pedidas durante las pruebas)

- ✅ Rediseño visual (estilo "premium" oscuro con tarjetas — opción C elegida por el usuario).
- ✅ Selector de **pantalla** (monitor) para las capturas.
- ✅ **Cronómetro** mientras transcribe ("Transcribiendo… Ns").
- ✅ Capturas ligadas a su **momento exacto** (`[MM:SS]`) en el documento exportado.

---

## Seguimiento

- ✅ Mejora A — Título y datos de reunión
- ✅ Mejora B — Mejor documento para Claude (encabezado enriquecido + exportar iniciativa completa)
- ✅ Mejora C — Panel de reuniones guardadas (con el rediseño)
- ✅ Mejora D — Calidad de transcripción (Replicate al terminar, rápido)
- ✅ Extras de interfaz — diseño, selector de pantalla, cronómetro, capturas con hora
