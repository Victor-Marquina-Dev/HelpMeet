import re
import unicodedata

# Muletillas/interjecciones que se eliminan si aparecen como palabra suelta.
# Conservador: solo interjecciones claras, nunca palabras con significado.
_FILLERS = {"eh", "em", "ehm", "mmm", "mm", "uh", "um", "ah"}

# Frases "basura" típicas que Whisper inventa sobre silencio o música
# (sacadas de millones de vídeos de YouTube). Se descartan enteras.
_HALLUCINATION_EXACT = {
    "suscribete",
    "suscribete al canal",
    "suscribanse al canal",
    "gracias por ver el video",
    "gracias por ver",
    "gracias",
    "no te olvides de suscribirte",
    "dale like y suscribete",
    "hasta la proxima",
    "nos vemos en el proximo video",
    "muchas gracias",
}
_HALLUCINATION_CONTAINS = (
    "suscribete al canal",
    "amaraorg",                      # "amara.org" tras quitar la puntuación
    "subtitulos realizados por",
    "subtitulos por la comunidad",
)


def _normalize(text: str) -> str:
    """minúsculas, sin acentos y sin puntuación, para comparar de forma robusta."""
    text = text.strip().lower()
    text = "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )
    text = re.sub(r"[^\w\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def is_hallucination(text: str) -> bool:
    """True si el texto es una de las frases-basura típicas de Whisper."""
    n = _normalize(text)
    if not n:
        return True
    if n in _HALLUCINATION_EXACT:
        return True
    return any(marker in n for marker in _HALLUCINATION_CONTAINS)


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
