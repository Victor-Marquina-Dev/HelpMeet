from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker, Session
from helpmeet import config
from helpmeet.db.models import Base

_engine = None
_SessionFactory = None


def _migrate_archive_columns(engine) -> None:
    """Añade las columnas de archivo/papelera a bases creadas por versiones anteriores."""
    wanted = {
        "initiatives": ("archived_at", "deleted_at"),
        "meetings": ("archived_at", "deleted_at"),
    }
    with engine.begin() as connection:
        for table, columns in wanted.items():
            existing = {column["name"] for column in inspect(connection).get_columns(table)}
            for column in columns:
                if column not in existing:
                    connection.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {column} DATETIME"
                    )


def init_db():
    """Crea la carpeta de datos, el engine y las tablas. Idempotente."""
    global _engine, _SessionFactory
    config.ensure_dirs()
    _engine = create_engine(config.DATABASE_URL)
    Base.metadata.create_all(_engine)
    _migrate_archive_columns(_engine)
    _SessionFactory = sessionmaker(bind=_engine)
    return _engine


def get_session() -> Session:
    if _SessionFactory is None:
        init_db()
    return _SessionFactory()
