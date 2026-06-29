import json
import os

import helpmeet.settings as settings


def _fake_secret_store(monkeypatch):
    box = {"value": ""}
    monkeypatch.setattr(settings.secret_store, "get_secret", lambda: box["value"])
    monkeypatch.setattr(settings.secret_store, "set_secret",
                        lambda value: box.update(value=(value or "").strip()))
    return box


def test_export_dir_default_and_set(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    settings.invalidate_cache()
    # por defecto, una subcarpeta 'exports'
    assert settings.get_export_dir().name == "exports"
    # tras elegir una carpeta, se guarda y se recuerda
    destino = tmp_path / "mis_exports"
    settings.set_export_dir(str(destino))
    assert settings.get_export_dir() == destino


def test_api_token_set_and_env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    settings.invalidate_cache()
    _fake_secret_store(monkeypatch)
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    settings.set_api_token("r8_test_token")
    assert settings.get_api_token() == "r8_test_token"
    # debe quedar también en la variable de entorno (efecto inmediato)
    assert os.environ["REPLICATE_API_TOKEN"] == "r8_test_token"


def test_apply_env_loads_saved_token(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    settings.invalidate_cache()
    _fake_secret_store(monkeypatch)
    settings.set_api_token("r8_guardado")
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    settings.apply_env()
    assert os.environ["REPLICATE_API_TOKEN"] == "r8_guardado"


def test_legacy_plaintext_token_is_moved_to_secure_store(monkeypatch, tmp_path):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"api_token": "r8_antiguo", "export_dir": "X:/docs"}))
    monkeypatch.setattr(settings, "SETTINGS_PATH", path)
    settings.invalidate_cache()
    box = _fake_secret_store(monkeypatch)

    assert settings.get_api_token() == "r8_antiguo"
    assert box["value"] == "r8_antiguo"
    assert "api_token" not in json.loads(path.read_text())


def test_transcription_preferences_are_persistent(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    settings.invalidate_cache()

    defaults = settings.get_transcription_settings()
    assert defaults["provider"] == "auto"
    assert defaults["default_mic_muted"] is False

    saved = settings.set_transcription_settings({
        "provider": "local",
        "default_mic_muted": True,
    })

    assert saved["provider"] == "local"
    assert saved["default_mic_muted"] is True
    assert settings.get_transcription_settings() == saved


def test_rejects_invalid_transcription_provider(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    settings.invalidate_cache()
    try:
        settings.set_transcription_settings({"provider": "desconocido"})
        assert False, "debió rechazar el proveedor"
    except ValueError:
        pass


def test_standard_tier_alias_maps_to_balanced(tmp_path, monkeypatch):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"transcription_tier": "standard"}), encoding="utf-8")
    monkeypatch.setattr(settings, "SETTINGS_PATH", path)
    settings.invalidate_cache()

    assert settings.get_transcription_tier() == "balanced"
    assert settings.get_transcription_model() == "small"


def test_set_transcription_settings_normalizes_tier_alias(tmp_path, monkeypatch):
    path = tmp_path / "settings.json"
    path.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(settings, "SETTINGS_PATH", path)
    settings.invalidate_cache()

    result = settings.set_transcription_settings({"tier": "standard"})

    assert result["tier"] == "balanced"
    assert json.loads(path.read_text(encoding="utf-8"))["transcription_tier"] == "balanced"
