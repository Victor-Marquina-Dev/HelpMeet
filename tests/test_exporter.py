from helpmeet.db import repository as repo
from helpmeet.export.exporter import export_meeting, export_initiative, meeting_export_dir


def test_export_creates_md_and_captures_folder(session, tmp_path):
    ini = repo.create_initiative(session, "Sistema de Login")
    meeting = repo.start_meeting(session, ini.id, "Endpoints")
    repo.add_utterance(session, meeting.id, "me", "¿revisamos el endpoint?", 1.0, 3.0)
    u2 = repo.add_utterance(session, meeting.id, "others", "sí, da error 500", 4.0, 6.0)
    img = tmp_path / "shot.png"
    img.write_bytes(b"PNG")
    repo.add_capture(session, meeting.id, str(img), near_utterance_id=u2.id)
    repo.end_meeting(session, meeting.id)

    out_dir = export_meeting(session, meeting.id, tmp_path / "out")

    md = out_dir / "contexto.md"
    assert md.exists()
    content = md.read_text(encoding="utf-8")
    assert "Sistema de Login" in content
    assert "Yo:" in content and "Los demás:" in content
    assert "error 500" in content
    assert (out_dir / "capturas").exists()
    assert any((out_dir / "capturas").iterdir())  # se copió la imagen
    assert "capturas/" in content  # referencia a la captura en el md


def test_export_orders_utterances_by_time(session, tmp_path):
    ini = repo.create_initiative(session, "X")
    meeting = repo.start_meeting(session, ini.id, "M")
    repo.add_utterance(session, meeting.id, "me", "segunda", 10.0, 11.0)
    repo.add_utterance(session, meeting.id, "others", "primera", 1.0, 2.0)
    out_dir = export_meeting(session, meeting.id, tmp_path / "out")
    content = (out_dir / "contexto.md").read_text(encoding="utf-8")
    assert content.index("primera") < content.index("segunda")


def test_export_meeting_includes_notes_at_their_time(session, tmp_path):
    ini = repo.create_initiative(session, "Con notas")
    meeting = repo.start_meeting(session, ini.id, "M")
    repo.add_utterance(session, meeting.id, "others", "hablamos de la base de datos", 5.0, 8.0)
    repo.add_note(session, meeting.id, "decisión: usar PostgreSQL")
    repo.end_meeting(session, meeting.id)

    out_dir = export_meeting(session, meeting.id, tmp_path / "out")
    content = (out_dir / "contexto.md").read_text(encoding="utf-8")
    assert "📝 Nota: decisión: usar PostgreSQL" in content


def test_export_meeting_has_enriched_header(session, tmp_path):
    ini = repo.create_initiative(session, "Login")
    meeting = repo.start_meeting(session, ini.id, "Endpoints")
    repo.add_utterance(session, meeting.id, "me", "hola", 1.0, 2.0)
    repo.add_utterance(session, meeting.id, "others", "qué tal", 3.0, 4.0)
    repo.end_meeting(session, meeting.id)

    out_dir = export_meeting(session, meeting.id, tmp_path / "out")
    content = (out_dir / "contexto.md").read_text(encoding="utf-8")
    assert "Frases: 2" in content
    assert "Hablantes:" in content
    assert "Duración:" in content


def test_export_initiative_combines_meetings_chronologically(session, tmp_path):
    ini = repo.create_initiative(session, "Proyecto X")
    m1 = repo.start_meeting(session, ini.id, "Primera")
    repo.add_utterance(session, m1.id, "me", "arrancamos el proyecto", 1.0, 2.0)
    repo.end_meeting(session, m1.id)
    m2 = repo.start_meeting(session, ini.id, "Segunda")
    repo.add_utterance(session, m2.id, "me", "seguimos avanzando", 1.0, 2.0)
    repo.end_meeting(session, m2.id)

    out_dir = export_initiative(session, ini.id, tmp_path / "out")
    content = (out_dir / "contexto.md").read_text(encoding="utf-8")
    assert "# Iniciativa: Proyecto X" in content
    assert "Reuniones: 2" in content
    # las dos reuniones aparecen en orden cronológico en el mismo documento
    assert content.index("arrancamos el proyecto") < content.index("seguimos avanzando")


def test_export_meeting_writes_contexto_and_dated_file(session, tmp_path):
    ini = repo.create_initiative(session, "Prueba 3")
    m = repo.start_meeting(session, ini.id, "R1")
    repo.add_utterance(session, m.id, "me", "hola", 1.0, 2.0)
    repo.end_meeting(session, m.id)

    out_dir = export_meeting(session, m.id, tmp_path / "out")
    assert (out_dir / "contexto.md").exists()
    dated = [p for p in out_dir.glob("*.md") if p.name != "contexto.md"]
    assert len(dated) == 1
    assert dated[0].name.startswith(f"{m.started_at:%Y-%m-%d_%H-%M-%S}")


def test_export_meeting_same_day_does_not_overwrite(session, tmp_path):
    ini = repo.create_initiative(session, "Prueba")
    m1 = repo.start_meeting(session, ini.id, "Uno")
    repo.add_utterance(session, m1.id, "me", "primera grabación", 1.0, 2.0)
    repo.end_meeting(session, m1.id)
    out1 = export_meeting(session, m1.id, tmp_path / "out")

    m2 = repo.start_meeting(session, ini.id, "Dos")
    repo.add_utterance(session, m2.id, "me", "segunda grabación", 1.0, 2.0)
    repo.end_meeting(session, m2.id)
    out2 = export_meeting(session, m2.id, tmp_path / "out")

    assert out1 == out2  # mismo día -> misma carpeta
    dated = [p for p in out2.glob("*.md") if p.name != "contexto.md"]
    assert len(dated) == 2  # las dos grabaciones se conservan, no se pisan


def test_meeting_export_dir_matches_export_meeting(session, tmp_path):
    ini = repo.create_initiative(session, "Mi Proyecto")
    meeting = repo.start_meeting(session, ini.id, "R1")
    # la ruta calculada debe coincidir con la que crea export_meeting
    expected = meeting_export_dir(meeting, tmp_path)
    out = export_meeting(session, meeting.id, tmp_path)
    assert out == expected
    assert out.exists()


def test_export_initiative_writes_one_md_per_meeting(session, tmp_path):
    ini = repo.create_initiative(session, "Proyecto Y")
    m1 = repo.start_meeting(session, ini.id, "Kickoff")
    repo.add_utterance(session, m1.id, "me", "hola equipo", 1.0, 2.0)
    repo.end_meeting(session, m1.id)
    m2 = repo.start_meeting(session, ini.id, "Seguimiento")
    repo.add_utterance(session, m2.id, "me", "vamos bien", 1.0, 2.0)
    repo.end_meeting(session, m2.id)

    out_dir = export_initiative(session, ini.id, tmp_path / "out")

    # sigue existiendo el documento combinado (1 para todo)
    assert (out_dir / "contexto.md").exists()
    # además, un .md por reunión
    per_meeting = [p for p in out_dir.glob("*.md") if p.name != "contexto.md"]
    assert len(per_meeting) == 2
    # cada archivo lleva en el nombre la fecha y la hora de su reunión
    expected1 = f"{m1.started_at:%Y-%m-%d_%H-%M-%S}"
    assert any(p.name.startswith(expected1) for p in per_meeting)
    # y contiene SOLO el texto de su reunión
    kickoff = next(p for p in per_meeting if p.name.startswith(expected1))
    text = kickoff.read_text(encoding="utf-8")
    assert "hola equipo" in text
    assert "vamos bien" not in text


def test_export_initiative_merges_captures_without_collision(session, tmp_path):
    ini = repo.create_initiative(session, "Con capturas")
    m1 = repo.start_meeting(session, ini.id, "Uno")
    u1 = repo.add_utterance(session, m1.id, "me", "mira esto", 1.0, 2.0)
    img1 = tmp_path / "a.png"
    img1.write_bytes(b"PNG-A")
    repo.add_capture(session, m1.id, str(img1), near_utterance_id=u1.id)
    repo.end_meeting(session, m1.id)
    m2 = repo.start_meeting(session, ini.id, "Dos")
    u2 = repo.add_utterance(session, m2.id, "me", "y esto otro", 1.0, 2.0)
    img2 = tmp_path / "b.png"
    img2.write_bytes(b"PNG-B")
    repo.add_capture(session, m2.id, str(img2), near_utterance_id=u2.id)
    repo.end_meeting(session, m2.id)

    out_dir = export_initiative(session, ini.id, tmp_path / "out")
    captures = list((out_dir / "capturas").iterdir())
    # las dos capturas se copian con nombres distintos (no se pisan)
    assert len(captures) == 2


def test_export_includes_screen_recording_video_link(session, tmp_path):
    ini = repo.create_initiative(session, "Con video")
    meeting = repo.start_meeting(session, ini.id, "Grabación de pantalla")
    video = tmp_path / "grabacion.mp4"
    video.write_bytes(b"video")
    meeting.audio_path = str(video)
    session.commit()

    out_dir = export_meeting(session, meeting.id, tmp_path / "out")
    content = (out_dir / "contexto.md").read_text(encoding="utf-8")

    assert "Video:" in content
    assert "grabacion.mp4" in content


def test_initiative_export_dir_uses_slug_and_creates(session, tmp_path):
    from helpmeet.export.exporter import initiative_export_dir
    ini = repo.create_initiative(session, "Mi Proyecto Nuevo")
    out = initiative_export_dir(ini, tmp_path)
    assert out == tmp_path / "mi-proyecto-nuevo"
    assert out.exists() and out.is_dir()


def test_export_ignores_archived_and_trashed_meetings(session, tmp_path):
    ini = repo.create_initiative(session, "Proyecto limpio")
    active = repo.start_meeting(session, ini.id, "Visible")
    archived = repo.start_meeting(session, ini.id, "Archivada")
    trashed = repo.start_meeting(session, ini.id, "Eliminada")
    repo.add_utterance(session, active.id, "me", "contenido visible", 0, 1)
    repo.add_utterance(session, archived.id, "me", "contenido archivado", 0, 1)
    repo.add_utterance(session, trashed.id, "me", "contenido eliminado", 0, 1)
    repo.archive_item(session, "meeting", archived.id)
    repo.trash_item(session, "meeting", trashed.id)

    out = export_initiative(session, ini.id, tmp_path / "out")
    content = (out / "contexto.md").read_text(encoding="utf-8")
    assert "contenido visible" in content
    assert "contenido archivado" not in content
    assert "contenido eliminado" not in content
