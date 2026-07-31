import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from helpmeet.db.models import Base


@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()


@pytest.fixture
def tmp_data_dir(tmp_path: Path) -> Path:
    """Directorio temporal que simula DATA_DIR para tests que tocan archivos."""
    data = tmp_path / "Helpmeet"
    data.mkdir(parents=True)
    return data


@pytest.fixture
def tmp_export_dir(tmp_path: Path) -> Path:
    """Directorio temporal para tests de exportacion."""
    export = tmp_path / "exports"
    export.mkdir(parents=True)
    return export


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "slow: tests that take more than 30 seconds",
    )
    config.addinivalue_line(
        "markers",
        "integration: tests that require full app environment",
    )
    config.addinivalue_line(
        "markers",
        "e2e: end-to-end tests (app startup, recording, export)",
    )
    config.addinivalue_line(
        "markers",
        "performance: tests that measure resource usage or throughput",
    )
