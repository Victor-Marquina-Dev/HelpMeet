import wave
import threading
from pathlib import Path
import pyaudiowpatch as pyaudio


class DualAudioRecorder:
    """Graba micrófono ('me') y loopback del sistema ('others') en archivos WAV."""

    def __init__(self, dest_dir):
        self.dest_dir = Path(dest_dir)
        self.dest_dir.mkdir(parents=True, exist_ok=True)
        self._pa = pyaudio.PyAudio()
        self._running = False
        self._threads = []

    def _default_loopback(self):
        """Encuentra el dispositivo loopback asociado a la salida de audio por defecto."""
        wasapi = self._pa.get_host_api_info_by_type(pyaudio.paWASAPI)
        default_out = self._pa.get_device_info_by_index(wasapi["defaultOutputDevice"])
        for i in range(self._pa.get_device_count()):
            dev = self._pa.get_device_info_by_index(i)
            if dev.get("isLoopbackDevice") and default_out["name"] in dev["name"]:
                return dev
        return None

    def _record(self, device_info, label):
        rate = int(device_info["defaultSampleRate"])
        channels = int(device_info["maxInputChannels"]) or 2
        path = self.dest_dir / f"{label}.wav"
        wf = wave.open(str(path), "wb")
        wf.setnchannels(channels)
        wf.setsampwidth(self._pa.get_sample_size(pyaudio.paInt16))
        wf.setframerate(rate)
        stream = self._pa.open(
            format=pyaudio.paInt16, channels=channels, rate=rate,
            input=True, input_device_index=device_info["index"],
            frames_per_buffer=1024,
        )
        while self._running:
            wf.writeframes(stream.read(1024, exception_on_overflow=False))
        stream.stop_stream()
        stream.close()
        wf.close()

    def start(self):
        self._running = True
        mic = self._pa.get_device_info_by_index(
            self._pa.get_default_input_device_info()["index"]
        )
        loop = self._default_loopback()
        targets = [(mic, "me")]
        if loop:
            targets.append((loop, "others"))
        for dev, label in targets:
            t = threading.Thread(target=self._record, args=(dev, label), daemon=True)
            t.start()
            self._threads.append(t)

    def stop(self):
        self._running = False
        for t in self._threads:
            t.join(timeout=2)
        self._pa.terminate()
