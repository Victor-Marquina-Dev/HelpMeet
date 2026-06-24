from helpmeet.db import repository as repo
from helpmeet.export.exporter import (
    export_meeting, export_initiative, meeting_export_dir, month_folder_name,
    build_transcript_txt, transcript_filename,
    export_transcript_package, transcript_package_filename,
)


def test_plain_text_transcript_has_time_speaker_and_no_markdown(session):
    ini = repo.create_initiative(session, "Proyecto TXT")
    meeting = repo.start_meeting(session, ini.id, "Revisión técnica")
    repo.add_utterance(session, meeting.id, "others", "primera frase", 2.0, 4.0)
    important = repo.add_utterance(session, meeting.id, "me", "decisión final", 9.0, 11.0)
    important.highlighted = True
    session.commit()
    repo.end_meeting(session, meeting.id)

    content = build_transcript_txt(meeting)

    assert "Título: Revisión técnica" in content
    assert "[00:02] Los demás: primera frase" in content
    assert "[00:09] ★ Yo: decisión final" in content
    assert "# " not in content
    assert transcript_filename(meeting).endswith("revisión-técnica.txt")


def test_transcript_package_contains_txt_capture_and_video(session, tmp_path):
    import zipfile

    ini = repo.create_initiative(session, "Paquete")
    meeting = repo.start_meeting(session, ini.id, "Demo")
    repo.add_utterance(session, meeting.id, "me", "texto exportado", 1.0, 2.0)
    capture_path = tmp_path / "pantalla.png"
    capture_path.write_bytes(b"PNG")
    capture = repo.add_capture(session, meeting.id, str(capture_path))
    video = tmp_path / "demo.mp4"
    video.write_bytes(b"MP4")
    meeting.audio_path = str(video)
    session.commit()

    destination = tmp_path / transcript_package_filename(meeting)
    payload = export_transcript_package(meeting, destination)

    assert payload["captures"] == 1 and payload["files"] == 1
    with zipfile.ZipFile(destination) as package:
        names = package.namelist()
        assert "transcripcion.txt" in names
        assert f"capturas/{capture.code}.png" in names
        assert "archivos/demo.mp4" in names
        text = package.read("transcripcion.txt").decode("utf-8-sig")
        assert "texto exportado" in text
        assert f"capturas/{capture.code}.png" in text


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
    month_dir = out_dir / month_folder_name(meeting.started_at)
    assert (month_dir / "capturas").exists()
    assert any((month_dir / "capturas").iterdir())  # se copió la imagen
    assert f"{month_folder_name(meeting.started_at)}/capturas/" in content


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
    dated = [p for p in out_dir.rglob("*.md") if p.name != "contexto.md"]
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
    dated = [p for p in out2.rglob("*.md") if p.name != "contexto.md"]
    assert len(dated) == 2  # las dos grabaciones se conservan, no se pisan


def test_meeting_export_dir_matches_export_meeting(session, tmp_path):
    ini = repo.create_initiative(session, "Mi Proyecto")
    meeting = repo.start_meeting(session, ini.id, "R1")
    # La iniciativa conserva contexto.md en la raíz y la reunión vive en su mes.
    expected = meeting_export_dir(meeting, tmp_path)
    out = export_meeting(session, meeting.id, tmp_path)
    assert expected.parent == out
    assert out.exists()
    assert expected.exists()


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
    per_meeting = [p for p in out_dir.rglob("*.md") if p.name != "contexto.md"]
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
    month_dir = out_dir / month_folder_name(m1.started_at)
    captures = list((month_dir / "capturas").iterdir())
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


def test_export_includes_ai_instructions_and_objective(session, tmp_path):
    ini = repo.create_initiative(session, "Con objetivo")
    repo.set_initiative_description(session, ini.id, "Ayudar al cliente con su web.")
    m = repo.start_meeting(session, ini.id, "Kickoff")
    repo.add_utterance(session, m.id, "me", "empezamos", 1.0, 2.0)
    repo.end_meeting(session, m.id)

    out_dir = export_initiative(session, ini.id, tmp_path / "out")
    content = (out_dir / "contexto.md").read_text(encoding="utf-8")

    # cabecera de instrucciones para la IA (plantilla por defecto, siempre presente)
    assert "# Instrucciones para la IA" in content
    # objetivo de la iniciativa, antes del contenido de las reuniones
    assert "## Objetivo de esta iniciativa" in content
    assert "Ayudar al cliente con su web." in content
    assert content.index("# Instrucciones para la IA") < content.index("empezamos")


def test_build_meeting_context_has_header_and_only_that_meeting(session, tmp_path):
    from helpmeet.export.exporter import build_meeting_context
    ini = repo.create_initiative(session, "Proyecto Z")
    repo.set_initiative_description(session, ini.id, "Objetivo del proyecto Z.")
    m1 = repo.start_meeting(session, ini.id, "Primera")
    repo.add_utterance(session, m1.id, "me", "contenido de la primera", 1.0, 2.0)
    repo.end_meeting(session, m1.id)
    m2 = repo.start_meeting(session, ini.id, "Segunda")
    repo.add_utterance(session, m2.id, "others", "contenido de la segunda", 1.0, 2.0)
    repo.end_meeting(session, m2.id)

    text = build_meeting_context(session, m1.id)
    assert "# Instrucciones para la IA" in text
    assert "## Objetivo de esta iniciativa" in text
    assert "Objetivo del proyecto Z." in text
    assert "contenido de la primera" in text
    # solo esta reunión, no la otra
    assert "contenido de la segunda" not in text
    # no escribió nada en disco (no se le pasó carpeta de exportación)
    assert not list(tmp_path.iterdir())


def test_set_initiative_description_round_trip(session):
    ini = repo.create_initiative(session, "Sin objetivo")
    assert ini.description is None
    repo.set_initiative_description(session, ini.id, "  Objetivo nuevo  ")
    assert repo.get_initiative(session, ini.id).description == "Objetivo nuevo"
    # vaciar lo deja en None (vuelve a usar la plantilla por defecto en el export)
    repo.set_initiative_description(session, ini.id, "   ")
    assert repo.get_initiative(session, ini.id).description is None


def test_capture_exported_with_unique_code_name(session, tmp_path):
    ini = repo.create_initiative(session, "Con capturas con código")
    m = repo.start_meeting(session, ini.id, "R1")
    u = repo.add_utterance(session, m.id, "me", "mira esto", 1.0, 2.0)
    img = tmp_path / "shot.png"
    img.write_bytes(b"PNG")
    cap = repo.add_capture(session, m.id, str(img), near_utterance_id=u.id)
    repo.end_meeting(session, m.id)

    # el código es estable, único y no es un simple 1/2/3
    assert cap.code.startswith("CAP-")
    assert cap.code != "CAP-0001" or cap.id == 1  # depende del id real, pero con formato

    out_dir = export_initiative(session, ini.id, tmp_path / "out")
    content = (out_dir / "contexto.md").read_text(encoding="utf-8")
    # el archivo de la captura se llama con el código y el markdown lo referencia
    assert f"{cap.code}.png" in content
    month_dir = out_dir / month_folder_name(m.started_at)
    assert (month_dir / "capturas" / f"{cap.code}.png").exists()


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
