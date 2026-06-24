from sqlalchemy import create_engine, inspect, event
from sqlalchemy.orm import sessionmaker, Session
from helpmeet import config
from helpmeet.db.models import Base

_engine = None
_SessionFactory = None


def _apply_pragmas(dbapi_connection, _record) -> None:
    """Ajustes de SQLite en CADA conexión (P-07):
    - WAL: lectores y un escritor concurrentes (grabar y consultar a la vez).
    - synchronous=NORMAL: seguro con WAL y mucho más rápido al escribir frases.
    - foreign_keys=ON: integridad referencial real.
    - busy_timeout: espera si la BD está ocupada en vez de fallar al instante.
    """
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=30000")
    finally:
        cursor.close()


def _ensure_indexes(engine) -> None:
    """Índices para las consultas más frecuentes (P-07). IF NOT EXISTS: idempotente."""
    statements = (
        "CREATE INDEX IF NOT EXISTS ix_meetings_initiative_started ON meetings(initiative_id, started_at)",
        "CREATE INDEX IF NOT EXISTS ix_meetings_archived_deleted ON meetings(archived_at, deleted_at)",
        "CREATE INDEX IF NOT EXISTS ix_utterances_meeting_start ON utterances(meeting_id, start_time)",
        "CREATE INDEX IF NOT EXISTS ix_utterances_participant ON utterances(participant_id)",
        "CREATE INDEX IF NOT EXISTS ix_captures_meeting_taken ON captures(meeting_id, taken_at)",
        "CREATE INDEX IF NOT EXISTS ix_captures_near_utt ON captures(near_utterance_id)",
        "CREATE INDEX IF NOT EXISTS ix_notes_meeting_created ON notes(meeting_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_participants_initiative_created ON participants(initiative_id, created_at)",
    )
    with engine.begin() as connection:
        for statement in statements:
            try:
                connection.exec_driver_sql(statement)
            except Exception:  # noqa: BLE001 - un índice no esencial no debe romper el arranque
                pass


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
    event.listen(_engine, "connect", _apply_pragmas)
    Base.metadata.create_all(_engine)
    _migrate_archive_columns(_engine)
    _migrate_utterance_highlight(_engine)
    _migrate_utterance_participant(_engine)
    _migrate_initiative_pin(_engine)
    _ensure_indexes(_engine)
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
