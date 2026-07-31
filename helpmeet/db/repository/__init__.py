"""Capa de acceso a datos (modulo de compatibilidad).

Las funciones estan organizadas en modulos especializados por entidad:
- initiative_repository.py
- meeting_repository.py
- utterance_repository.py
- participant_repository.py

Este archivo re-exporta todas las funciones publicas para mantener
compatibilidad con `from helpmeet.db import repository as repo`.
"""

from helpmeet.db.repository.initiative_repository import (
    create_initiative,
    list_initiatives,
    toggle_initiative_pin,
    list_archived,
    list_trash,
    archive_item,
    trash_item,
    restore_item,
    permanently_delete_item,
    rename_initiative,
    set_initiative_color,
    get_initiative,
    set_initiative_description,
)

from helpmeet.db.repository.meeting_repository import (
    list_meetings,
    list_meetings_by_initiative,
    utterance_counts,
    rename_meeting,
    set_meeting_context,
    move_meeting,
    start_meeting,
    end_meeting,
    get_meeting,
    add_capture,
    add_note,
)

from helpmeet.db.repository.utterance_repository import (
    add_utterance,
    add_utterances,
    get_utterance,
    update_utterance,
    toggle_utterance_highlight,
    delete_utterance,
    resolved_speaker_name,
)

from helpmeet.db.repository.participant_repository import (
    get_participant,
    list_participants,
    add_participants,
    rename_participant,
    delete_participant,
    set_me_participant,
    assign_utterance_participant,
)

from helpmeet.db.repository.search_repository import (
    search,
    _has_fts,
)

from helpmeet.db.repository._shared import get_capture
