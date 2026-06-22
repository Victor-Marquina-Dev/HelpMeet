from helpmeet.db import repository as repo
from helpmeet.glossary import build_glossary


def test_glossary_counts_repeated_terms_and_excludes_stopwords(session):
    ini = repo.create_initiative(session, "Proyecto")
    m = repo.start_meeting(session, ini.id, "R1")
    repo.add_utterance(session, m.id, "others", "el endpoint de login usa un token", 1.0, 2.0)
    repo.add_utterance(session, m.id, "others", "el token del endpoint expira", 3.0, 4.0)
    repo.add_utterance(session, m.id, "me", "revisamos el endpoint", 5.0, 6.0)

    glos = build_glossary(session, ini.id)
    terms = {t.lower(): c for t, c in glos}

    assert terms.get("endpoint") == 3   # se repite 3 veces
    assert terms.get("token") == 2      # se repite 2 veces
    # las palabras vacías comunes no entran al glosario
    for sw in ("el", "de", "un", "del"):
        assert sw not in terms


def test_glossary_orders_by_frequency(session):
    ini = repo.create_initiative(session, "X")
    m = repo.start_meeting(session, ini.id, "M")
    repo.add_utterance(session, m.id, "me", "deploy deploy deploy token token", 1.0, 2.0)

    glos = build_glossary(session, ini.id)
    # el más frecuente primero
    assert glos[0][0].lower() == "deploy"
    assert glos[0][1] == 3
