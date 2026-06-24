# Diseño: Participantes

Fecha: 2026-06-23

## Objetivo

Permitir que cada reunión muestre **nombres reales de participantes** en lugar de
solo "Yo" / "Los demás", y que esos nombres aparezcan también en el contexto que
se exporta a Claude. Todo **sin IA**: la app no distingue voces, solo separa por
fuente de audio (micrófono = tú, sistema = los demás).

## Decisiones tomadas (brainstorming)

1. **Lista de participantes asignables** (no solo renombrar los dos hablantes).
2. **Ámbito por iniciativa**: la lista vive en la iniciativa y se reutiliza en
   todas sus reuniones.
3. **Asignación inicial**: tus frases (micrófono) se asignan a ti automáticamente;
   las de "Los demás" se etiquetan según las reglas de abajo.
4. **Sin IA**: detectar quién habla entre varias personas de "Los demás" requiere
   diarización por IA y queda fuera de alcance (posible fase futura).

## Reglas de asignación (la "detección" posible sin IA)

Para una frase, el nombre mostrado se calcula así (las asignaciones manuales mandan):

1. Si la frase tiene un participante asignado manualmente → ese nombre.
2. Si `speaker == "me"` → el participante marcado como "yo" (o "Yo" si no hay).
3. Si `speaker == "others"`:
   - Si la iniciativa tiene **exactamente un** participante distinto de "yo" →
     ese nombre (automático).
   - Si tiene **dos o más** → "Los demás" (el usuario reasigna a mano).

Este cálculo es en tiempo de lectura: cambiar la lista de participantes nunca
corrompe datos. La asignación manual se guarda y tiene prioridad sobre las reglas.

## Modelo de datos

**Nueva tabla `participants`:**

- `id` (PK)
- `initiative_id` (FK → initiatives)
- `name` (texto) — **nombre completo** (nombre + apellido, p. ej. "Víctor
  Marquina"), para distinguir a varias personas que comparten nombre de pila
  (en una reunión puede haber 3-4 "Víctor"). El nombre completo es la clave de
  unicidad dentro de la iniciativa.
- `is_me` (bool, por defecto False) — marca al participante que es el usuario.
  Como mucho uno por iniciativa con `is_me = True`.
- `created_at`

**Tabla `utterances`:** se añade

- `participant_id` (FK → participants, **nullable**) — asignación manual; si es
  NULL se aplican las reglas de cálculo.

**Migración**: añadir columna `participant_id` a `utterances` en bases existentes
(patrón de `_migrate_*` en `database.py`). La tabla `participants` la crea
`Base.metadata.create_all`.

## Backend (helpmeet/db/repository.py y helpmeet/ui/app.py)

Repositorio:

- `list_participants(session, initiative_id) -> list[Participant]`
- `add_participants(session, initiative_id, names: list[str]) -> list[Participant]`
  (acepta varios de golpe, para pegar en bloque; ignora vacíos y duplicados por nombre)
- `rename_participant(session, participant_id, name)`
- `delete_participant(session, participant_id)`
- `set_me_participant(session, initiative_id, participant_id | None)`
  (marca uno como "yo", desmarca los demás de esa iniciativa)
- `assign_utterance_participant(session, utterance_id, participant_id | None)`
- Helper de cálculo `resolved_speaker_name(utterance, participants)` para reusar en
  `get_transcript` y en el export.

Api (métodos expuestos a la UI):

- `list_participants(initiative_id)`
- `add_participants(initiative_id, names)` (names: lista o texto multi-línea)
- `rename_participant(id, name)`
- `delete_participant(id)`
- `set_me_participant(initiative_id, participant_id)`
- `assign_utterance_participant(utterance_id, participant_id)`

`get_transcript` añade a cada frase: `participant_id` (asignación manual) y
`display_name` (nombre ya resuelto con las reglas), además del `speaker` actual.
Devuelve también la lista de participantes de la iniciativa para poblar el selector.

## Interfaz (helpmeet/ui/web)

1. **Panel "Participantes" en la reunión**: en la fila superior, junto a
   *Abrir vídeo / Volver a transcribir / Abrir carpeta*. Muestra los participantes
   de la iniciativa como "chips", resaltando quién eres tú. Botón para abrir un
   editor donde:
   - Añadir nombres (uno a uno **o pegando varios**, uno por línea).
   - Renombrar / eliminar.
   - Marcar quién eres tú.
2. **Frases**: la cabecera de cada frase muestra el `display_name` en lugar de
   "YO / LOS DEMÁS".
3. **"Cambiar hablante"**: deja de ser un alternar y pasa a un **desplegable** con
   todos los participantes (+ opción "Los demás" para dejarla sin asignar). Al
   elegir, llama a `assign_utterance_participant`.

## Export (helpmeet/export/exporter.py)

El render de cada frase usa el `display_name` resuelto en lugar de "Yo / Los demás",
para que el contexto a Claude lleve los nombres reales. El glosario y el resto no
cambian.

## Fuera de alcance

- Detección automática de voces por IA (diarización) cuando hay 2+ invitados.
- Identificación de voz / enrolamiento.

## Pruebas

- Repositorio: alta en bloque, marcar "yo", asignación manual, borrado.
- Reglas de cálculo: caso "yo", caso 1 invitado (auto), caso 2+ (Los demás),
  override manual gana.
- Api / `get_transcript`: `display_name` correcto en los tres casos.
- Export: el markdown usa los nombres resueltos.
- Migración: base sin `participant_id` se actualiza sin perder datos.
