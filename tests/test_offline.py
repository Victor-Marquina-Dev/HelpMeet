"""Las funciones principales deben funcionar SIN internet (Fase 5).

Solo la descarga inicial del modelo Whisper necesita red; el resto (grabar,
guardar, exportar, diagnosticar) es totalmente local.
"""

import socket

import pytest

from helpmeet.db import repository as repo
from helpmeet.export.exporter import build_meeting_context
from helpmeet import diagnostics


@pytest.fixture
def no_network(monkeypatch):
    def _blocked(*args, **kwargs):
        raise OSError("Red deshabilitada en el test")
    monkeypatch.setattr(socket.socket, "connect", _blocked)


def test_core_and_export_work_offline(session, no_network):
    ini = repo.create_initiative(session, "Proyecto sin red")
    meeting = repo.start_meeting(session, ini.id, "Reunión")
    repo.add_utterance(session, meeting.id, "me", "esto funciona sin internet", 1.0, 2.0)
    repo.end_meeting(session, meeting.id)

    text = build_meeting_context(session, meeting.id)
    assert "esto funciona sin internet" in text


def test_diagnostics_work_offline(no_network, tmp_path):
    report = diagnostics.run_diagnostics(tmp_path, tmp_path / "export", "small")
    assert report["disk"]["total_gb"] > 0
    assert "status" in report["whisper"]
