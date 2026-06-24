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


def _migrate_utterance_highlight(engine) -> None:
    """Añade la columna `highlighted` (★ Importante) a bases anteriores."""
    with engine.begin() as connection:
        existing = {column["name"] for column in inspect(connection).get_columns("utterances")}
        if "highlighted" not in existing:
            connection.exec_driver_sql(
                "ALTER TABLE utterances ADD COLUMN highlighted BOOLEAN DEFAULT 0"
            )


def _migrate_utterance_participant(engine) -> None:
    """Añade la columna `participant_id` (asignación de hablante) a bases anteriores."""
    with engine.begin() as connection:
        existing = {column["name"] for column in inspect(connection).get_columns("utterances")}
        if "participant_id" not in existing:
            connection.exec_driver_sql(
                "ALTER TABLE utterances ADD COLUMN participant_id INTEGER"
            )


def _migrate_initiative_pin(engine) -> None:
    """Añade la columna `pinned_at` (iniciativa anclada) a bases anteriores."""
    with engine.begin() as connection:
        existing = {column["name"] for column in inspect(connection).get_columns("initiatives")}
        if "pinned_at" not in existing:
            connection.exec_driver_sql(
                "ALTER TABLE initiatives ADD COLUMN pinned_at DATETIME"
            )


def init_db():
    """Crea la carpeta de datos, el engine y las tablas. Idempotente."""
    global _engine, _SessionFactory
    config.ensure_dirs()
    # check_same_thread=False: la transcripción en segundo plano corre en un hilo
    # worker y usa la sesión de su grabación. timeout: espera si la BD está
    # bloqueada (grabar y transcribir a la vez) en lugar de fallar al instante.
    _engine = create_engine(
        config.DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(_engine)
    _migrate_archive_columns(_engine)
    _migrate_utterance_highlight(_engine)
    _migrate_utterance_participant(_engine)
    _migrate_initiative_pin(_engine)
    _SessionFactory = sessionmaker(bind=_engine)
    return _engine


def get_session() -> Session:
    if _SessionFactory is None:
        init_db()
    return _SessionFactory()


def dispose_engine() -> None:
    """Cierra el engine y libera el archivo SQLite (para poder borrarlo o
    restaurar una copia). Tras esto hay que volver a llamar a `init_db`."""
    global _engine, _SessionFactory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionFactory = None
