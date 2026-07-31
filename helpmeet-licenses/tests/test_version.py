def test_version_endpoint_public(client, monkeypatch):
    from helpmeet_licenses.config import settings
    monkeypatch.setattr(settings, "latest_app_version", "9.9.9")
    monkeypatch.setattr(settings, "latest_app_url", "https://example.com/Helpmeet-Setup-9.9.9.exe")
    resp = client.get("/api/version")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == "9.9.9"
    assert data["url"].endswith(".exe")


def test_version_endpoint_empty_by_default(client):
    resp = client.get("/api/version")
    assert resp.status_code == 200
    data = resp.json()
    assert "version" in data and "url" in data
