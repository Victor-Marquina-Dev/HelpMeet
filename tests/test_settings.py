import os
import helpmeet.settings as settings


def test_export_dir_default_and_set(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    # por defecto, una subcarpeta 'exports'
    assert settings.get_export_dir().name == "exports"
    # tras elegir una carpeta, se guarda y se recuerda
    destino = tmp_path / "mis_exports"
    settings.set_export_dir(str(destino))
    assert settings.get_export_dir() == destino


def test_api_token_set_and_env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    settings.set_api_token("r8_test_token")
    assert settings.get_api_token() == "r8_test_token"
    # debe quedar también en la variable de entorno (efecto inmediato)
    assert os.environ["REPLICATE_API_TOKEN"] == "r8_test_token"


def test_apply_env_loads_saved_token(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "SETTINGS_PATH", tmp_path / "settings.json")
    settings.set_api_token("r8_guardado")
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    settings.apply_env()
    assert os.environ["REPLICATE_API_TOKEN"] == "r8_guardado"
