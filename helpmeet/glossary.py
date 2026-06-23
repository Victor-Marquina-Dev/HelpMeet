"""Glosario: detecta los términos más repetidos de una iniciativa.

Heurística sencilla: cuenta las palabras (sin distinguir mayúsculas), descarta
las palabras vacías comunes del español y las muy cortas, y devuelve las que se
repiten. En reuniones técnicas, las palabras que más se repiten suelen ser los
términos del proyecto (endpoint, token, deploy, PostgreSQL…).
"""
import re
from collections import Counter

# Palabras vacías frecuentes del español (se excluyen del glosario).
_STOPWORDS = {
    "que", "los", "las", "del", "una", "uno", "unos", "unas", "por", "para",
    "con", "sin", "como", "más", "mas", "pero", "este", "esta", "estos", "estas",
    "ese", "esa", "esos", "esas", "esto", "eso", "aqui", "aquí", "ahi", "ahí",
    "alli", "allí", "muy", "ya", "porque", "cuando", "donde", "dónde", "quien",
    "quién", "cual", "cuál", "todo", "toda", "todos", "todas", "algo", "nada",
    "tambien", "también", "entonces", "luego", "tiene", "tienen", "tengo",
    "hacer", "hace", "hacen", "hago", "puede", "pueden", "puedo", "vamos",
    "voy", "vas", "van", "ser", "soy", "eres", "somos", "estar", "estoy",
    "esta", "están", "estan", "hay", "fue", "era", "han", "has", "haber",
    "sus", "sí", "no", "les", "nos", "mi", "tu", "su", "yo", "él", "el", "la",
    "lo", "le", "de", "en", "un", "se", "al", "es", "y", "o", "a", "e", "u",
    "si", "me", "te", "ha", "he", "asi", "así", "bien", "cosa", "cosas",
    "ahora", "aqui", "solo", "sólo", "cada", "otro", "otra", "otros", "otras",
    "mismo", "misma", "entre", "sobre", "hasta", "desde", "antes", "despues",
    "después", "porque", "sea", "ver", "vi", "dice", "dijo", "decir", "creo",
    "claro", "osea", "o sea", "este", "okay", "vale", "pues", "bueno", "buena",
}

_WORD_RE = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]+")


def glossary_from_meetings(meetings, min_count: int = 2, limit: int = 30) -> list[tuple[str, int]]:
    """Devuelve [(término, nº de apariciones)] ordenado por frecuencia."""
    counts: Counter = Counter()
    forms: dict[str, Counter] = {}  # minúscula -> formas originales (para mostrar la mejor)
    for meeting in meetings:
        for utt in meeting.utterances:
            for word in _WORD_RE.findall(utt.text):
                low = word.lower()
                if len(low) < 3 or low in _STOPWORDS:
                    continue
                counts[low] += 1
                forms.setdefault(low, Counter())[word] += 1

    result = []
    for low, count in counts.items():
        if count < min_count:
            continue
        best_form = forms[low].most_common(1)[0][0]
        result.append((best_form, count))
    result.sort(key=lambda tc: (-tc[1], tc[0].lower()))
    return result[:limit]


def build_glossary(session, initiative_id: int, min_count: int = 2,
                   limit: int = 30) -> list[tuple[str, int]]:
    """Glosario de una iniciativa (todas sus reuniones)."""
    from helpmeet.db.models import Initiative
    ini = session.get(Initiative, initiative_id)
    if ini is None:
        return []
    meetings = [m for m in ini.meetings
                if m.archived_at is None and m.deleted_at is None]
    return glossary_from_meetings(meetings, min_count=min_count, limit=limit)
