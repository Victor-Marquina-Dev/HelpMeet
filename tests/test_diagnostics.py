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
    (snap / "model.bin").write_bytes(b"x" * 2048)
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


def test_preflight_is_different_for_meeting_and_screen(tmp_path, monkeypatch):
    monkeypatch.setattr(diagnostics, "audio_devices", lambda: {
        "mic": {"status": "ok", "label": "Micrófono de prueba"},
        "loopback": {"status": "ok", "label": "Audio del sistema"},
    })
    monkeypatch.setattr(diagnostics, "whisper_model_status", lambda _: {
        "status": "ok", "label": "Modelo listo",
    })
    monkeypatch.setattr(diagnostics, "video_encoder_status", lambda: {
        "status": "ok", "label": "MP4 · H.264",
    })

    meeting = diagnostics.recording_preflight(
        "meeting", tmp_path / "data", tmp_path / "exports", "small"
    )
    screen = diagnostics.recording_preflight(
        "screen", tmp_path / "data", tmp_path / "exports", "small",
        monitor={"index": 2, "width": 1920, "height": 1080}, fps=30,
    )

    meeting_keys = {item["key"] for item in meeting["checks"]}
    screen_keys = {item["key"] for item in screen["checks"]}
    assert meeting["can_start"] is True
    # La reunión incluye el modelo (transcripción) pero NO datos de vídeo.
    assert {"disk", "data", "mic", "loopback", "model"} <= meeting_keys
    assert {"monitor", "encoder"} & meeting_keys == set()
    assert screen["can_start"] is True
    # La pantalla incluye monitor y códec de vídeo; la transcripción es posterior.
    assert {"monitor", "encoder", "disk", "destination", "mic", "loopback"} <= screen_keys
    assert "model" not in screen_keys
    assert "1920×1080" in next(x["label"] for x in screen["checks"]
                               if x["key"] == "monitor")


def test_preflight_blocks_when_required_microphone_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(diagnostics, "audio_devices", lambda: {
        "mic": {"status": "error", "label": "Sin micrófono"},
        "loopback": {"status": "warn", "label": "Sin loopback"},
    })
    monkeypatch.setattr(diagnostics, "whisper_model_status", lambda _: {
        "status": "warn", "label": "Se descargará después",
    })

    result = diagnostics.recording_preflight(
        "meeting", tmp_path / "data", tmp_path / "exports", "small"
    )

    assert result["can_start"] is False
