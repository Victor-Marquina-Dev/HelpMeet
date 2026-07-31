"""Demo aislado: graba microfono + sistema y muestra la transcripcion de Vosk
EN VIVO, palabra a palabra, comparada con Whisper sobre el MISMO audio.

No toca la base de datos ni nada de la app real de Helpmeet — es standalone a
proposito, para poder juzgar velocidad Y precision antes de meter esto en la
app completa.

Como funciona la comparacion: cuando Vosk cierra una frase (detecta silencio),
se guarda el audio crudo de esa frase exacta y se manda a transcribir con
Whisper EN SEGUNDO PLANO (tarda ~3-4s, asi que aparece un momento despues, no
instantaneo). El texto de Vosk aparece de inmediato; el de Whisper se rellena
solo cuando esta listo, en la misma linea. Se puede desactivar con la casilla
si solo quieres ver la velocidad de Vosk sin la comparacion.

Uso:
    .venv/Scripts/python.exe scripts/vosk_bench/demo_vivo.py
    .venv/Scripts/python.exe scripts/vosk_bench/demo_vivo.py --lang en

Guarda ademas el WAV crudo de cada pista en scripts/vosk_bench/demo_grabaciones/
(gitignored), por si quieres reescucharlo o usarlo despues como corpus.
"""
import argparse
import json
import queue
import sys
import tempfile
import threading
import time
import tkinter as tk
import wave
from datetime import datetime
from pathlib import Path
from tkinter import scrolledtext

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np

from helpmeet.audio.capture import DualAudioRecorder
from helpmeet.transcription.vosk_engine import get_vosk_model

TARGET_RATE = 16000
POLL_INTERVAL = 0.3
LABELS = {"me": "Yo (microfono)", "others": "Sistema"}
FONT_UI = "Segoe UI"


def resample_mono_16k(data: bytes, src_rate: int, channels: int) -> bytes:
    if not data:
        return b""
    arr = np.frombuffer(data, dtype=np.int16).astype(np.float32)
    if channels > 1:
        arr = arr.reshape(-1, channels).mean(axis=1)
    if src_rate != TARGET_RATE and arr.size:
        n_out = max(1, int(arr.size * TARGET_RATE / src_rate))
        arr = np.interp(
            np.linspace(0, 1, n_out, endpoint=False),
            np.linspace(0, 1, arr.size, endpoint=False),
            arr,
        )
    return arr.astype(np.int16).tobytes()


class DemoApp:
    def __init__(self, root, language: str):
        self.root = root
        self.language = language
        self.root.title(f"Demo Vosk en vivo — idioma: {language}")
        self.root.geometry("860x560")

        self.status = tk.Label(root, text="Presiona Grabar para empezar", font=(FONT_UI, 11), fg="#555")
        self.status.pack(pady=(10, 4))

        top = tk.Frame(root)
        top.pack(pady=4)
        self.btn = tk.Button(top, text="● Grabar", font=(FONT_UI, 13, "bold"),
                              bg="#2e7d32", fg="white", padx=20, pady=8, command=self.toggle)
        self.btn.pack(side="left", padx=6)
        self.compare_var = tk.BooleanVar(value=True)
        tk.Checkbutton(top, text="Comparar con Whisper (tarda ~3-4s por frase)",
                        variable=self.compare_var, font=(FONT_UI, 10)).pack(side="left", padx=10)

        tk.Label(root, text="Transcripción (frases cerradas) — Vosk en vivo, Whisper llega después",
                 font=(FONT_UI, 9), fg="#888").pack(pady=(10, 0))
        self.log = scrolledtext.ScrolledText(root, font=("Consolas", 10.5), wrap="word", height=16)
        self.log.pack(fill="both", expand=True, padx=10, pady=4)
        self.log.tag_config("vosk", foreground="#2e7d32")
        self.log.tag_config("whisper_pending", foreground="#999")
        self.log.tag_config("whisper_done", foreground="#c62828")
        self.log.tag_config("ts", foreground="#888")
        self.log.config(state="disabled")

        tk.Label(root, text="En vivo (parcial, todavía puede cambiar)", font=(FONT_UI, 9), fg="#888").pack()
        self.partial_var = tk.StringVar(value="")
        tk.Label(root, textvariable=self.partial_var, font=("Consolas", 11, "italic"),
                 fg="#1565c0", wraplength=820, justify="left", anchor="w").pack(fill="x", padx=10, pady=(0, 10))

        self._recording = False
        self._recorder = None
        self._recognizers = {}
        self._threads = []
        self._ui_queue = queue.Queue()
        self._partials = {"me": "", "others": ""}
        self._raw_buffer: dict[str, bytearray] = {}
        self._row_counter = 0
        self._whisper_engine = None
        self._whisper_loading = False
        self._whisper_lock = threading.Lock()
        self.root.after(80, self._drain_ui_queue)

    def toggle(self):
        if self._recording:
            self._stop()
        else:
            self._start()

    def _start(self):
        self.status.config(text="Cargando el modelo Vosk (primera vez descarga ~40 MB)...")
        self.root.update_idletasks()
        self._model = get_vosk_model(self.language)

        if self.compare_var.get():
            self._ensure_whisper_loading()

        dest = Path(__file__).resolve().parent / "demo_grabaciones" / datetime.now().strftime("%Y%m%d_%H%M%S")
        self._recorder = DualAudioRecorder(dest, preview_seconds=5.0)
        self._recorder.start()
        time.sleep(0.3)  # deja que preview_buffers se pueble antes de leerlo

        import vosk
        self._recognizers = {}
        self._threads = []
        self._raw_buffer = {label: bytearray() for label in self._recorder.preview_buffers}
        self._recording = True
        for label, buf in self._recorder.preview_buffers.items():
            rec = vosk.KaldiRecognizer(self._model, float(TARGET_RATE))
            rec.SetWords(True)
            self._recognizers[label] = rec
            t = threading.Thread(target=self._track_loop, args=(label, buf), daemon=True)
            t.start()
            self._threads.append(t)

        self.btn.config(text="■ Detener", bg="#c62828")
        self.status.config(text=f"Grabando... ({dest})")

    def _stop(self):
        self._recording = False
        for t in self._threads:
            t.join(timeout=3)
        if self._recorder:
            self._recorder.stop()
        self.btn.config(text="● Grabar", bg="#2e7d32")
        self.status.config(text="Detenido. Presiona Grabar para empezar de nuevo")
        self.partial_var.set("")

    # ---- Whisper (carga perezosa en segundo plano, no bloquea la UI) ----

    def _ensure_whisper_loading(self):
        if self._whisper_engine is not None or self._whisper_loading:
            return
        self._whisper_loading = True

        def load():
            from helpmeet.transcription.engine import TranscriptionEngine
            engine = TranscriptionEngine()
            with self._whisper_lock:
                self._whisper_engine = engine
            self._ui_queue.put(("status", None, "Whisper listo. Grabando..."))
        threading.Thread(target=load, daemon=True).start()

    def _transcribe_whisper_async(self, raw: bytes, rate: int, channels: int, sampwidth: int, tag: str):
        def run():
            # Espera a que Whisper termine de cargar si el usuario activo la
            # casilla despues de empezar a grabar.
            for _ in range(200):  # hasta ~20s
                with self._whisper_lock:
                    engine = self._whisper_engine
                if engine is not None:
                    break
                time.sleep(0.1)
            else:
                self._ui_queue.put(("whisper_result", tag, "(Whisper no cargo a tiempo)"))
                return
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                path = f.name
            try:
                with wave.open(path, "wb") as wf:
                    wf.setnchannels(channels)
                    wf.setsampwidth(sampwidth)
                    wf.setframerate(rate)
                    wf.writeframes(bytes(raw))
                with self._whisper_lock:  # CTranslate2 no admite llamadas concurrentes
                    segments = engine.transcribe_file(path, quality="fast")
                text = " ".join(s.text for s in segments).strip() or "(sin texto)"
            except Exception as exc:  # noqa: BLE001
                text = f"(error: {exc})"
            finally:
                Path(path).unlink(missing_ok=True)
            self._ui_queue.put(("whisper_result", tag, text))
        threading.Thread(target=run, daemon=True).start()

    # ---- Captura + Vosk ----

    def _track_loop(self, label, buf):
        rec = self._recognizers[label]
        while self._recording:
            time.sleep(POLL_INTERVAL)
            data = buf.drain()
            if not data:
                continue
            self._raw_buffer[label].extend(data)
            pcm = resample_mono_16k(data, buf.rate, buf.channels)
            if not pcm:
                continue
            if rec.AcceptWaveform(pcm):
                result = json.loads(rec.Result())
                text = (result.get("text") or "").strip()
                raw_segment = bytes(self._raw_buffer[label])
                self._raw_buffer[label] = bytearray()
                if text:
                    self._ui_queue.put(("final", label, (text, raw_segment, buf.rate, buf.channels, buf.sampwidth)))
            else:
                partial = json.loads(rec.PartialResult()).get("partial", "").strip()
                self._ui_queue.put(("partial", label, partial))

    # ---- UI ----

    def _drain_ui_queue(self):
        try:
            while True:
                kind, label, payload = self._ui_queue.get_nowait()
                if kind == "final":
                    text, raw_segment, rate, channels, sampwidth = payload
                    self._append_final(label, text, raw_segment, rate, channels, sampwidth)
                    self._partials[label] = ""
                    self._refresh_partial_line()
                elif kind == "partial":
                    self._partials[label] = payload
                    self._refresh_partial_line()
                elif kind == "whisper_result":
                    self._fill_whisper_result(payload_tag=label, text=payload)
                elif kind == "status":
                    self.status.config(text=payload)
        except queue.Empty:
            pass
        self.root.after(80, self._drain_ui_queue)

    def _append_final(self, label, text, raw_segment, rate, channels, sampwidth):
        self._row_counter += 1
        tag = f"row{self._row_counter}"
        ts = datetime.now().strftime("%H:%M:%S")

        self.log.config(state="normal")
        self.log.insert("end", f"[{ts}] ", "ts")
        self.log.insert("end", f"{LABELS.get(label, label)}\n")
        self.log.insert("end", f"  Vosk:    {text}\n", "vosk")
        if self.compare_var.get():
            start = self.log.index("end-1c")
            self.log.insert("end", "  Whisper: (procesando...)")
            end = self.log.index("end-1c")
            self.log.tag_add(tag, start, end)
            self.log.tag_add("whisper_pending", start, end)
            self.log.insert("end", "\n")
            self._transcribe_whisper_async(raw_segment, rate, channels, sampwidth, tag)
        self.log.insert("end", "\n")
        self.log.see("end")
        self.log.config(state="disabled")

    def _fill_whisper_result(self, payload_tag, text):
        ranges = self.log.tag_ranges(payload_tag)
        if not ranges:
            return
        start, end = ranges[0], ranges[1]
        self.log.config(state="normal")
        self.log.delete(start, end)
        self.log.insert(start, f"  Whisper: {text}", "whisper_done")
        self.log.config(state="disabled")

    def _refresh_partial_line(self):
        parts = [f"{LABELS.get(l, l)}: {t}" for l, t in self._partials.items() if t]
        self.partial_var.set("  |  ".join(parts))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="es", choices=["es", "en"])
    args = ap.parse_args()

    root = tk.Tk()
    app = DemoApp(root, args.lang)

    def on_close():
        if app._recording:
            app._stop()
        root.destroy()
    root.protocol("WM_DELETE_WINDOW", on_close)
    root.mainloop()


if __name__ == "__main__":
    main()
