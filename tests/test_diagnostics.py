from helpmeet import diagnostics


def test_disk_space_reports_free_and_total(tmp_path):
    res = diagnostics.disk_space(tmp_path)
    assert res["status"] in {"ok", "warn"}
    assert res["total_gb"] > 0
    assert res["free_gb"] >= 0
    assert "GB" in res["label"]


def test_disk_space_on_missing_path_uses_existing_parent(tmp_path):
    # Una carpeta de datos que aún no existe no debe romper el diagnóstico.
    res = diagnostics.disk_space(tmp_path / "no" / "existe" / "todavia")
    assert res["status"] in {"ok", "warn"}
    assert res["total_gb"] > 0


def test_whisper_model_status_not_downloaded(tmp_path, monkeypatch):
    # Forzamos una caché vacía: el modelo aparece como "se descargará".
    fake_cache = tmp_path / "hub"
    fake_cache.mkdir()
    monkeypatch.setattr("huggingface_hub.constants.HF_HUB_CACHE", str(fake_cache))
    res = diagnostics.whisper_model_status("small")
    assert res["downloaded"] is False
    assert res["status"] == "warn"


def test_whisper_model_status_downloaded(tmp_path, monkeypatch):
    fake_cache = tmp_path / "hub"
    snap = fake_cache / "models--Systran--faster-whisper-small" / "snapshots" / "abc"
    snap.mkdir(parents=True)
    (snap / "model.bin").write_bytes(b"x")
    monkeypatch.setattr("huggingface_hub.constants.HF_HUB_CACHE", str(fake_cache))
    res = diagnostics.whisper_model_status("small")
    assert res["downloaded"] is True
    assert res["status"] == "ok"


def test_run_diagnostics_has_all_sections(tmp_path):
    report = diagnostics.run_diagnostics(tmp_path, tmp_path / "export", "small")
    for key in ("webview2", "disk", "whisper", "mic", "loopback", "export_dir", "processing"):
        assert key in report
        assert "status" in report[key]
    assert report["processing"]["status"] == "ok"
