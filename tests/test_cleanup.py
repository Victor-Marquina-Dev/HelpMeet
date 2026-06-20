from helpmeet.transcription.cleanup import clean_text


def test_collapses_whitespace():
    assert clean_text("hola    mundo") == "Hola mundo"


def test_removes_space_before_punctuation():
    assert clean_text("el endpoint , funciona") == "El endpoint, funciona"


def test_removes_filler_words():
    assert clean_text("eh, esto es una prueba") == "Esto es una prueba"
    assert clean_text("mmm no sé") == "No sé"


def test_keeps_real_words():
    # no debe tocar palabras técnicas ni el interior de la frase
    assert clean_text("revisa el API del backend") == "Revisa el API del backend"


def test_capitalizes_first_letter():
    assert clean_text("hola") == "Hola"


def test_empty_stays_empty():
    assert clean_text("   ") == ""
