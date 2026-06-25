"""Benchmarks de rendimiento de Helpmeet (P-15).

Mide los puntos que la auditoría marca como críticos, sobre una base SQLite
temporal con datos sintéticos (NO toca tus datos reales). No se ejecuta en las
pruebas normales; lánzalo a mano para comparar antes/después de un cambio:

    python -m scripts.benchmark
    python -m scripts.benchmark --utterances 50000

Imprime la mediana de varias repeticiones para cada métrica.
"""
import argparse
import statistics
import sys
import tempfile
import time
from pathlib import Path

# La consola de Windows usa cp1252 y rompería con símbolos como "→".
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from helpmeet.db.models import Base
from helpmeet.db import repository as repo
from helpmeet.db.database import _apply_pragmas, _ensure_indexes, _ensure_fts
from sqlalchemy import event


def _timed(fn, repeats=5):
    """Mediana (ms) de ejecutar `fn` varias veces."""
    samples = []
    for _ in range(repeats):
        start = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - start) * 1000)
    return statistics.median(samples)


def _make_db(path):
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    event.listen(engine, "connect", _apply_pragmas)
    Base.metadata.create_all(engine)
    _ensure_indexes(engine)
    fts = _ensure_fts(engine)
    return engine, sessionmaker(bind=engine), fts


def run(n_utterances=10000, n_initiatives=20, repeats=5):
    print(f"== Benchmark Helpmeet ==  frases={n_utterances}  iniciativas={n_initiatives}\n")
    tmp = Path(tempfile.mkdtemp()) / "bench.db"
    engine, Session, fts = _make_db(tmp)
    print(f"FTS5 disponible: {fts}\n")
    session = Session()

    # Sembrar iniciativas y reuniones.
    inis = [repo.create_initiative(session, f"Iniciativa {i}") for i in range(n_initiatives)]
    meetings = [repo.start_meeting(session, inis[i % n_initiatives].id, f"Reunión {i}")
                for i in range(n_initiatives)]

    words = ("presupuesto reunión cliente decisión pendiente entrega objetivo "
             "riesgo alcance prioridad seguimiento contrato propuesta").split()
    rows = [{"speaker": "me" if k % 2 else "others",
             "text": f"{words[k % len(words)]} {words[(k * 7) % len(words)]} línea {k}",
             "start_time": float(k), "end_time": float(k) + 1.0}
            for k in range(n_utterances)]

    # 1) Persistencia: inserción en lote (P-02).
    target = meetings[0].id
    t_insert = _timed(lambda: repo.add_utterances(session, target, rows), repeats=1)
    print(f"Insertar {n_utterances} frases en lote   : {t_insert:8.1f} ms")

    # 2) Conteos agregados (P-06).
    ids = [m.id for m in meetings]
    print(f"Conteo de frases (COUNT GROUP BY)        : {_timed(lambda: repo.utterance_counts(session, ids), repeats):8.1f} ms")

    # 3) Arranque: reuniones de todas las iniciativas en una consulta (P-06).
    print(f"Reuniones agrupadas (1 consulta)         : {_timed(lambda: repo.list_meetings_by_initiative(session), repeats):8.1f} ms")

    # 4) Búsqueda: FTS5 vs LIKE, con una consulta común y otra selectiva (la que
    #    casa con muy pocas filas es donde FTS marca más diferencia).
    selective = f"línea {n_utterances - 3}"  # casa con 1 sola frase
    for label, term in (("común   ('presupuesto')", "presupuesto"),
                        ("selectiva (1 frase)     ", selective)):
        fts_ms = _timed(lambda t=term: repo._search_fts(session, t), repeats) if fts else None
        like_ms = _timed(lambda t=term: repo._search_like(session, t), repeats)
        line = f"Búsqueda {label}: LIKE {like_ms:7.1f} ms"
        if fts_ms is not None:
            line += f" | FTS5 {fts_ms:7.1f} ms | ~{like_ms / fts_ms:.1f}× más rápida"
        print(line)

    session.close()
    engine.dispose()
    print("\nHecho.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmarks de Helpmeet")
    parser.add_argument("--utterances", type=int, default=10000)
    parser.add_argument("--initiatives", type=int, default=20)
    parser.add_argument("--repeats", type=int, default=5)
    args = parser.parse_args()
    run(args.utterances, args.initiatives, args.repeats)
