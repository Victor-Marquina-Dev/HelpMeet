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


def extract_audio_segments_to_wav(
    src_path: str,
    segments: list[tuple[float, float]],
    dest_path: str,
    rate: int = TARGET_RATE,
) -> str:
    """Extrae el audio de cada tramo (inicio, fin) y lo concatena en un WAV mono.

    `segments` es una lista de tuplas en segundos, ya normalizada. Usa seek para
    no decodificar el vídeo entero. Devuelve la ruta del WAV.
    """
    dest = Path(dest_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    container = av.open(src_path)
    if not container.streams.audio:
        container.close()
        raise ValueError("El archivo no tiene pista de audio.")
    audio_stream = container.streams.audio[0]
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

            if audio_stream.time_base:
                def to_pts(s):
                    return int(s / float(audio_stream.time_base))
            else:
                def to_pts(s):
                    return int(s * 1_000_000)

            for start, end in segments:
                container.seek(to_pts(start), stream=audio_stream,
                               backward=True, any_frame=False)
                for frame in container.decode(audio=0):
                    t = float(frame.pts * audio_stream.time_base) if frame.pts is not None else 0.0
                    if t < start:
                        continue
                    if t >= end:
                        break
                    write_frames(resampler.resample(frame))
            write_frames(resampler.resample(None))
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    finally:
        container.close()
    if not written:
        dest.unlink(missing_ok=True)
        raise ValueError("No se pudo extraer audio de los tramos indicados.")
    return str(dest)


def _mux_segment(inp, out, mapa, in_v, in_a, start: float, end: float):
    """Copia al contenedor de salida los paquetes de un tramo, sin recodificar.

    Devuelve `(paquetes_escritos, inicio_real)`.
    """
    inp.seek(int(start / in_v.time_base), stream=in_v, backward=True)
    offset: dict[int, int] = {}
    real_start = start
    esperando_keyframe = True
    escritos = 0

    entradas = [in_v] + ([in_a] if in_a is not None else [])
    for packet in inp.demux(entradas):
        if packet.dts is None or packet.pts is None:
            continue
        idx = packet.stream.index
        if idx not in mapa:
            continue
        t = float(packet.pts * packet.time_base)
        if t > end:
            if idx == in_v.index:
                break
            continue
        if esperando_keyframe:
            # El clip solo puede arrancar en un fotograma clave: los intermedios
            # no se pueden decodificar sin él. Hasta que llega uno se descarta
            # también el audio, o el clip empezaría con sonido sobre negro.
            if idx != in_v.index or not packet.is_keyframe:
                continue
            real_start = t
            esperando_keyframe = False
        # Los pts vienen del original —donde el tramo empieza en el minuto 8, por
        # ejemplo— y hay que bajarlos a cero, o el reproductor muestra negro
        # hasta llegar a esa marca.
        if idx not in offset:
            offset[idx] = packet.pts
        packet.pts -= offset[idx]
        packet.dts = packet.pts
        packet.stream = mapa[idx]
        out.mux(packet)
        escritos += 1

    return escritos, real_start


def cut_video_segments(
    src_path: str,
    segments: list[tuple[float, float]],
    dest_dir: str,
    stem: str = "clip",
) -> list[dict]:
    """Corta el vídeo en un archivo por tramo, copiando los flujos sin recomprimir.

    No decodifica ni vuelve a codificar: copia los paquetes tal cual, así que un
    clip sale en segundos y con la calidad intacta. El precio es que el corte
    solo puede empezar en un fotograma clave, de modo que el inicio real puede
    quedar algo ANTES del pedido. Cada clip devuelve su `real_start` para que la
    interfaz no prometa una precisión que el método no da.

    Devuelve una lista de dicts con `path`, `start`, `end` y `real_start`.
    """
    dest_root = Path(dest_dir)
    dest_root.mkdir(parents=True, exist_ok=True)
    salida: list[dict] = []

    for i, (start, end) in enumerate(segments, 1):
        if end - start <= 0:
            continue
        dest = dest_root / f"{stem}-{i}.mp4"
        escritos, real_start = 0, start
        inp = av.open(src_path)
        try:
            in_v = inp.streams.video[0] if inp.streams.video else None
            if in_v is None:
                raise ValueError("El archivo no tiene pista de vídeo.")
            in_a = inp.streams.audio[0] if inp.streams.audio else None

            out = av.open(str(dest), mode="w")
            try:
                mapa = {in_v.index: out.add_stream(template=in_v)}
                if in_a is not None:
                    mapa[in_a.index] = out.add_stream(template=in_a)
                escritos, real_start = _mux_segment(
                    inp, out, mapa, in_v, in_a, start, end
                )
            finally:
                out.close()
        except Exception:
            dest.unlink(missing_ok=True)
            raise
        finally:
            inp.close()

        if not escritos:
            dest.unlink(missing_ok=True)
            continue
        salida.append({
            "path": str(dest),
            "start": round(start, 2),
            "end": round(end, 2),
            "real_start": round(real_start, 2),
        })

    if not salida:
        raise ValueError("No se pudo cortar ningún tramo del vídeo.")
    return salida


def cut_audio_segments(
    src_path: str,
    segments: list[tuple[float, float]],
    dest_dir: str,
    stem: str = "clip",
) -> list[dict]:
    """Corta una grabación de solo audio en un archivo WAV por tramo.

    A diferencia del vídeo, aquí el corte es EXACTO: el audio no tiene
    fotogramas clave, así que cada tramo empieza justo donde se pidió. Por eso
    `real_start` coincide siempre con `start`; se devuelve igual para que quien
    consuma esto no tenga que distinguir entre las dos funciones.
    """
    dest_root = Path(dest_dir)
    dest_root.mkdir(parents=True, exist_ok=True)
    salida: list[dict] = []

    for i, (start, end) in enumerate(segments, 1):
        if end - start <= 0:
            continue
        dest = dest_root / f"{stem}-{i}.wav"
        try:
            extract_audio_segments_to_wav(src_path, [(start, end)], str(dest))
        except Exception:
            dest.unlink(missing_ok=True)
            raise
        salida.append({
            "path": str(dest),
            "start": round(start, 2),
            "end": round(end, 2),
            "real_start": round(start, 2),
        })

    if not salida:
        raise ValueError("No se pudo cortar ningún tramo del audio.")
    return salida
