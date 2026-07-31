"""Importa un clip grabado con grabar_clip.py al corpus de referencia de la
migracion a Vosk (TASK-001/002): copia microfono.wav + sistema.wav, corre
Whisper para dejar un borrador de transcripcion (TASK-002 lo corrige a mano),
y escribe meta.json con la procedencia.

No toca la base de datos de produccion ni el resto de la app.

Uso:
    python scripts/vosk_bench/importar_grabacion.py \
        "C:/Users/embi/Desktop/NuevoHelpmeet/limpio" 01-limpio \
        --por-que "Grabado a proposito: voz clara, sin ruido de fondo"
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def fmt_time(s: float) -> str:
    m, sec = divmod(int(s), 60)
    return f"{m:02d}:{sec:02d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("origen", help="Carpeta con microfono.wav y sistema.wav (de grabar_clip.py)")
    ap.add_argument("perfil", help="Nombre del perfil en el corpus, ej: 01-limpio")
    ap.add_argument("--por-que", default="", help="Por que este clip representa el perfil")
    ap.add_argument("--track-transcribir", default="sistema", choices=["sistema", "microfono", "ambas"],
                     help="Que pista(s) transcribir con Whisper para el borrador")
    args = ap.parse_args()

    origen = Path(args.origen)
    mic_src = origen / "microfono.wav"
    sis_src = origen / "sistema.wav"
    if not mic_src.exists() or not sis_src.exists():
        print(f"ERROR: faltan microfono.wav o sistema.wav en {origen}")
        sys.exit(1)

    dest = Path(__file__).resolve().parent / "corpus" / args.perfil
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(mic_src, dest / "microfono.wav")
    shutil.copy2(sis_src, dest / "sistema.wav")

    print("Cargando el motor Whisper para generar el borrador (puede tardar unos segundos)...")
    from helpmeet.transcription.engine import TranscriptionEngine
    engine = TranscriptionEngine()

    tracks = []
    if args.track_transcribir in ("sistema", "ambas"):
        tracks.append(("sistema", dest / "sistema.wav"))
    if args.track_transcribir in ("microfono", "ambas"):
        tracks.append(("microfono", dest / "microfono.wav"))

    lines = [
        "# Borrador de transcripcion (Whisper, SIN corregir) - TASK-002 debe corregirlo a mano",
        f"# Fuente: grabacion nueva, dedicada al corpus de Vosk (perfil {args.perfil})",
        "",
    ]
    total_segs = 0
    for label, path in tracks:
        segs = engine.transcribe_file(str(path), quality="accurate")
        for seg in segs:
            lines.append(f"[{fmt_time(seg.start)}] {label}: {seg.text}")
        total_segs += len(segs)

    (dest / "transcripcion_whisper_borrador.txt").write_text("\n".join(lines), encoding="utf-8")

    meta = {
        "perfil": args.perfil,
        "por_que": args.por_que or "Grabado a proposito para este perfil (ver grabar_clip.py)",
        "fuente": "grabacion_dedicada",
        "origen_local": str(origen),
        "n_utterances_borrador": total_segs,
        "modelo_whisper": engine.model_name,
    }
    (dest / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Importado a {dest}: {total_segs} frases de borrador (modelo {engine.model_name})")


if __name__ == "__main__":
    main()
