import json

from helpmeet import config


def test_legacy_state_migration_keeps_large_media_in_place(tmp_path, monkeypatch):
    legacy = tmp_path / "legacy" / "data"
    target = tmp_path / "localappdata" / "Helpmeet"
    legacy.mkdir(parents=True)
    (legacy / "helpmeet.sqlite").write_bytes(b"sqlite")
    (legacy / "settings.json").write_text('{"export_dir":"D:/exports"}')
    (legacy / "exports").mkdir()
    (legacy / "exports" / "large.mp4").write_bytes(b"video")

    monkeypatch.setattr(config, "LEGACY_DATA_DIR", legacy)
    monkeypatch.setattr(config, "DATA_DIR", target)
    monkeypatch.setattr(config, "CAPTURES_DIR", target / "captures")

    assert config.migrate_legacy_state() is True
    assert (target / "helpmeet.sqlite").read_bytes() == b"sqlite"
    assert (target / "settings.json").exists()
    assert not (target / "exports").exists()
    marker = json.loads((target / ".legacy-migration-v1.json").read_text())
    assert marker["legacy_data_dir"] == str(legacy)
    assert config.migrate_legacy_state() is False
