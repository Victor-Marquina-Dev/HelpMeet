"""Extrae el audio de un archivo de video o audio a WAV 16 kHz mono.

Usa PyAV (ffmpeg embebido), así que acepta mp4, mkv, mov, avi, webm, mp3,
m4a, wav, ogg… Devuelve un WAV listo para transcribir.
"""
import wave
from pathlib import Path
from fractions import Fraction
import av
from av.audio.resampler import AudioResampler

TARGET_RATE = 16000


def make_thumbnail(src_path: str, dest_path: str, max_width: int = 480) -> str | None:
    """Genera una miniatura JPEG reducida de una imagen (P-09).

    Las tarjetas de capturas mostraban el PNG original completo (varios MB cada
    una) incrustado en base64. Aquí se crea una versión pequeña (ancho máximo
    `max_width`) que pesa una fracción, usando PyAV (ffmpeg embebido) para no
    añadir ninguna dependencia. Devuelve la ruta del thumb, o None si falla.
    """
    dest = Path(dest_path)
    try:
        container = av.open(src_path)
        try:
            frame = next(container.decode(video=0))
        finally:
            container.close()
        width = frame.width or max_width
        if width <= max_width:
            new_w, new_h = width, frame.height
        else:
            new_w = max_width
            new_h = max(2, int(round(frame.height * (max_width / width))))
        new_w -= new_w % 2
        new_h -= new_h % 2
        small = frame.reformat(width=new_w, height=new_h, format="yuvj420p")
        small.pts = 0
        small.time_base = Fraction(1, 1)

        dest.parent.mkdir(parents=True, exist_ok=True)
        out = av.open(str(dest), mode="w", format="mjpeg")
        try:
            stream = out.add_stream("mjpeg", rate=1)
            stream.width, stream.height = new_w, new_h
            stream.pix_fmt = "yuvj420p"
            stream.time_base = Fraction(1, 1)
            for packet in stream.encode(small):
                out.mux(packet)
            for packet in stream.encode():
                out.mux(packet)
        finally:
            out.close()
        return str(dest)
    except Exception:
        try:
            dest.unlink(missing_ok=True)
        except Exception:
            pass
        return None


def media_duration(src_path: str) -> float:
    """Duración en segundos de un archivo de audio/vídeo (0 si no se puede leer).

    Lee solo la cabecera del contenedor: no decodifica, así que es instantáneo
    incluso con vídeos largos."""
    try:
        container = av.open(src_path)
        try:
            if container.duration:  # microsegundos (av.time_base)
                return container.duration / 1_000_000
            stream = (container.streams.video or container.streams.audio or [None])[0]
            if stream is not None and stream.duration and stream.time_base:
                return float(stream.duration * stream.time_base)
        finally:
            container.close()
    except Exception:
        pass
    return 0.0


def extract_audio_to_wav(src_path: str, dest_path: str, rate: int = TARGET_RATE) -> str:
    """Extrae audio a WAV mono sin cargar el archivo completo en memoria.

    El procesamiento por streaming permite transcribir videos de varias horas sin
    crear picos de RAM proporcionales a su duración.
    """
    dest = Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    container = av.open(src_path)
    if not container.streams.audio:
        container.close()
        raise ValueError("El archivo no tiene pista de audio.")

    resampler = AudioResampler(format="s16", layout="mono", rate=rate)
    written = 0
    try:
        with wave.open(str(dest), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)

            def write_frames(frames):
                nonlocal written
                for frame in frames:
                    raw = frame.to_ndarray().tobytes()
                    wav.writeframesraw(raw)
                    written += len(raw)

            for decoded in container.decode(audio=0):
                write_frames(resampler.resample(decoded))
            write_frames(resampler.resample(None))  # vaciar el resampler
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    finally:
        container.close()
    if not written:
        dest.unlink(missing_ok=True)
        raise ValueError("No se pudo extraer audio utilizable del archivo.")
    return str(dest)
