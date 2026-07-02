"""Lógica pura de tramos de tiempo para el recorte de vídeo.

Un "tramo" es un par (inicio, fin) en segundos. Estas funciones no tocan
archivos ni PyAV: solo transforman listas de números, así que son fáciles de
probar y de razonar.
"""


def normalize_segments(segments, duration):
    """Devuelve tramos válidos, recortados a [0, duration], ordenados y fusionados.

    - Descarta tramos con fin <= inicio.
    - Recorta inicio a >= 0 y fin a <= duration.
    - Ordena por inicio y fusiona los que se solapan o se tocan.
    """
    cleaned = []
    for seg in segments:
        start = max(0.0, float(seg[0]))
        end = min(float(duration), float(seg[1]))
        if end > start:
            cleaned.append((start, end))
    cleaned.sort(key=lambda s: s[0])
    merged = []
    for start, end in cleaned:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def map_local_to_global(local_t, segments):
    """Convierte un tiempo del audio recortado al tiempo del vídeo original.

    `segments` debe estar ya normalizado (ver normalize_segments) y en el mismo
    orden con el que se concatenó el audio. Si `local_t` cae más allá del total,
    devuelve el fin del último tramo.
    """
    acc = 0.0
    for start, end in segments:
        dur = end - start
        if local_t < acc + dur:
            return start + (local_t - acc)
        acc += dur
    if segments:
        return segments[-1][1]
    return local_t
