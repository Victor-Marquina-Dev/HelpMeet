import threading

from helpmeet.audio.ring_buffer import AudioRingBuffer


def test_append_and_snapshot_roundtrip():
    buf = AudioRingBuffer(seconds=1.0, rate=100, channels=1, sampwidth=2)
    buf.append(b"\x01\x00" * 10)
    assert buf.snapshot() == b"\x01\x00" * 10


def test_caps_at_configured_seconds():
    # 100 Hz, mono, 16-bit -> 200 bytes por segundo; buffer de 1s = 200 bytes max
    buf = AudioRingBuffer(seconds=1.0, rate=100, channels=1, sampwidth=2)
    buf.append(b"\xaa" * 150)
    buf.append(b"\xbb" * 150)
    snap = buf.snapshot()
    assert len(snap) == 200
    # se descarta lo más viejo primero
    assert snap == b"\xaa" * 50 + b"\xbb" * 150


def test_seconds_available_reflects_content():
    buf = AudioRingBuffer(seconds=2.0, rate=100, channels=1, sampwidth=2)
    assert buf.seconds_available() == 0.0
    buf.append(b"\x00" * 100)  # 0.5s a 100Hz/mono/16-bit
    assert buf.seconds_available() == 0.5


def test_drain_returns_content_and_empties_buffer():
    buf = AudioRingBuffer(seconds=1.0, rate=100, channels=1, sampwidth=2)
    buf.append(b"\x01\x00" * 10)
    drained = buf.drain()
    assert drained == b"\x01\x00" * 10
    assert buf.snapshot() == b""
    assert buf.seconds_available() == 0.0


def test_drain_only_returns_audio_appended_since_last_drain():
    buf = AudioRingBuffer(seconds=1.0, rate=100, channels=1, sampwidth=2)
    buf.append(b"\xaa" * 20)
    buf.drain()
    buf.append(b"\xbb" * 20)
    assert buf.drain() == b"\xbb" * 20


def test_concurrent_append_and_snapshot_dont_crash_or_corrupt():
    buf = AudioRingBuffer(seconds=5.0, rate=1000, channels=1, sampwidth=2)
    stop = threading.Event()
    errors = []

    def writer():
        while not stop.is_set():
            buf.append(b"\x01\x02" * 64)

    def reader():
        while not stop.is_set():
            snap = buf.snapshot()
            if len(snap) % 2 != 0:
                errors.append("longitud impar: bytes cortados a mitad de muestra")

    threads = [threading.Thread(target=writer), threading.Thread(target=reader)]
    for t in threads:
        t.start()
    stop.wait(0.3)
    stop.set()
    for t in threads:
        t.join(timeout=2)
    assert not errors
