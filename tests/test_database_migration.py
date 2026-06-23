from sqlalchemy import create_engine, inspect

from helpmeet.db.database import _migrate_archive_columns


def test_archive_migration_updates_existing_database(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.sqlite'}")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE initiatives (id INTEGER PRIMARY KEY, name VARCHAR(200))"
        )
        connection.exec_driver_sql(
            "CREATE TABLE meetings (id INTEGER PRIMARY KEY, initiative_id INTEGER)"
        )

    _migrate_archive_columns(engine)
    _migrate_archive_columns(engine)  # también debe ser idempotente

    initiative_columns = {c["name"] for c in inspect(engine).get_columns("initiatives")}
    meeting_columns = {c["name"] for c in inspect(engine).get_columns("meetings")}
    assert {"archived_at", "deleted_at"} <= initiative_columns
    assert {"archived_at", "deleted_at"} <= meeting_columns
