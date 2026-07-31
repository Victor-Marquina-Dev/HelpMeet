"""Graba un clip de prueba (microfono + sistema, pistas separadas) para el
corpus de referencia de la migracion a Vosk (TASK-001).

No pasa por la app: no toca la base de datos de produccion, no transcribe, no
mezcla ni borra nada al terminar. Guarda directo en la carpeta indicada.

Uso:
    python scripts/vosk_bench/grabar_clip.py "C:/Users/embi/Desktop/NuevoHelpmeet/limpio"
    python scripts/vosk_bench/grabar_clip.py "C:/Users/embi/Desktop/NuevoHelpmeet/ruido"
    python scripts/vosk_bench/grabar_clip.py "C:/Users/embi/Desktop/NuevoHelpmeet/tecnico"

Graba 3-5 minutos hablando de forma natural (para "tecnico", usa vocabulario
real de tu trabajo; para "ruido", grabalo con ruido de fondo real). Presiona
Enter para detener.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from helpmeet.audio.capture import DualAudioRecorder


def main():
    if len(sys.argv) < 2:
        print("Uso: python grabar_clip.py <carpeta_destino>")
        sys.exit(1)

    dest = Path(sys.argv[1])
    dest.mkdir(parents=True, exist_ok=True)

    rec = DualAudioRecorder(dest)
    rec.start()
    t0 = time.time()
    print(f"Grabando en: {dest}")
    print("Microfono + sistema por separado. Presiona Enter para detener...")
    input()
    rec.stop()
    elapsed = time.time() - t0

    me = dest / "me.wav"
    others = dest / "others.wav"
    if me.exists():
        me.rename(dest / "microfono.wav")
    if others.exists():
        others.rename(dest / "sistema.wav")

    print(f"Listo. Duracion: {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"Archivos: {dest / 'microfono.wav'}, {dest / 'sistema.wav'}")


if __name__ == "__main__":
    main()
