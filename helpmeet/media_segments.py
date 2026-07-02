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
