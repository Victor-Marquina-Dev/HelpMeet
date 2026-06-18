from helpmeet.db import repository as repo
from helpmeet.export.exporter import export_meeting


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
