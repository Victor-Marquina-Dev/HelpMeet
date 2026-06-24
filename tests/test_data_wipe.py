from helpmeet import config


def test_wipe_data_dir_removes_personal_data_but_not_marker(tmp_path):
    # Datos personales simulados
    (tmp_path / "helpmeet.sqlite").write_bytes(b"db")
    (tmp_path / "settings.json").write_text("{}", encoding="utf-8")
    (tmp_path / "captures").mkdir()
    (tmp_path / "captures" / "CAP-1.png").write_bytes(b"img")
    (tmp_path / "recovery").mkdir()
    (tmp_path / "tmp_audio").mkdir()
    # El marcador de migración NO debe borrarse
    marker = tmp_path / ".legacy-migration-v1.json"
    marker.write_text("{}", encoding="utf-8")

    removed = config.wipe_data_dir(tmp_path)

    assert not (tmp_path / "helpmeet.sqlite").exists()
    assert not (tmp_path / "settings.json").exists()
    assert not (tmp_path / "captures").exists()
    assert not (tmp_path / "recovery").exists()
    assert not (tmp_path / "tmp_audio").exists()
    assert marker.exists()  # se conserva
    assert "helpmeet.sqlite" in removed and "captures/" in removed


def test_wipe_data_dir_on_empty_dir_is_safe(tmp_path):
    assert config.wipe_data_dir(tmp_path) == []
