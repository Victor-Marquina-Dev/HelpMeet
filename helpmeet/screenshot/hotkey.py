from pynput import keyboard
from helpmeet import config


class HotkeyListener:
    """Escucha un atajo global y llama a un callback. No bloquea el hilo principal."""

    def __init__(self, on_trigger, hotkey: str = config.SCREENSHOT_HOTKEY):
        self._listener = keyboard.GlobalHotKeys({hotkey: on_trigger})

    def start(self):
        self._listener.start()

    def stop(self):
        self._listener.stop()
