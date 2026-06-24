# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
from PyInstaller.utils.hooks import collect_all


root = Path(SPECPATH)
datas = [(str(root / "helpmeet" / "ui" / "web"), "helpmeet/ui/web")]
binaries = []
hiddenimports = []

# Dependencias con DLL, datos o imports dinámicos que PyInstaller no siempre
# descubre por análisis estático.
for package in (
    "av", "ctranslate2", "faster_whisper", "huggingface_hub",
    "pyaudiowpatch", "replicate", "tokenizers", "webview",
):
    package_datas, package_binaries, package_hidden = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hidden

a = Analysis(
    [str(root / "helpmeet" / "main.py")],
    pathex=[str(root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Helpmeet",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon=str(root / "helpmeet" / "ui" / "web" / "assets" / "helpmeet.ico"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    name="Helpmeet",
)
