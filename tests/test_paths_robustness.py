"""Robustez ante rutas con espacios y acentos (Fase 5 — distribución)."""

from helpmeet.db import repository as repo
from helpmeet.export.exporter import export_meeting
from helpmeet import config


def test_export_to_path_with_accents_and_spaces(session, tmp_path):
    base = tmp_path / "Carpeta con acentos áéíóú ñ y espacios"
    base.mkdir()
    ini = repo.create_initiative(session, "Iniciativa Ñandú & Acción")
    meeting = repo.start_meeting(session, ini.id, "Reunión de diseño técnico")
    repo.add_utterance(session, meeting.id, "me", "¿Qué tal? probando", 1.0, 2.0)
    repo.end_meeting(session, meeting.id)

    out = export_meeting(session, meeting.id, base)

    assert out.exists()
    assert (out / "contexto.md").exists()
    # El contexto debe contener el texto con acentos intacto.
    text = (out / "contexto.md").read_text(encoding="utf-8")
    assert "¿Qué tal? probando" in text


def test_wipe_data_dir_with_accents_in_path(tmp_path):
    data = tmp_path / "datos áéí ñ con espacios"
    data.mkdir()
    (data / "helpmeet.sqlite").write_bytes(b"db")
    (data / "captures").mkdir()
    (data / "captures" / "CAP-1.png").write_bytes(b"x")

    removed = config.wipe_data_dir(data)

    assert "helpmeet.sqlite" in removed
    assert not (data / "helpmeet.sqlite").exists()
    assert not (data / "captures").exists()
