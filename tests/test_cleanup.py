from helpmeet.transcription.cleanup import clean_text, is_hallucination


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


def test_is_hallucination_detects_youtube_filler():
    assert is_hallucination("¡Suscríbete al canal!")
    assert is_hallucination("Gracias por ver el video")
    assert is_hallucination("¡Gracias por ver el vídeo!")
    assert is_hallucination("Subtítulos realizados por la comunidad de Amara.org")
    assert is_hallucination("   ")  # vacío


def test_is_hallucination_keeps_real_speech():
    assert not is_hallucination("revisamos el endpoint de login")
    assert not is_hallucination("el error 500 viene de la validación")
    # una frase larga que casualmente contiene 'gracias' NO se descarta
    assert not is_hallucination("muchas gracias por mandarme el código del backend")
