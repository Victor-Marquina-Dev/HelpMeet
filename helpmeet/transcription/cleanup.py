import re

# Muletillas/interjecciones que se eliminan si aparecen como palabra suelta.
# Conservador: solo interjecciones claras, nunca palabras con significado.
_FILLERS = {"eh", "em", "ehm", "mmm", "mm", "uh", "um", "ah"}


def clean_text(text: str) -> str:
    """Limpieza ligera y segura del texto transcrito."""
    if not text:
        return ""

    # 1) quitar muletillas sueltas (con su coma adyacente si la hay)
    tokens = text.split()
    kept = []
    for tok in tokens:
        bare = tok.strip(",.;:¿?¡!").lower()
        if bare in _FILLERS:
            continue
        kept.append(tok)
    text = " ".join(kept)

    # 2) colapsar espacios en blanco
    text = re.sub(r"\s+", " ", text).strip()

    # 3) quitar espacio antes de signos de puntuación
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)

    # 4) capitalizar la primera letra (sin tocar el resto)
    if text:
        text = text[0].upper() + text[1:]

    return text
