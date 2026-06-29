# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules


root = Path(SPECPATH)
datas = [(str(root / "helpmeet" / "ui" / "web"), "helpmeet/ui/web")]
binaries = []
hiddenimports = []

# Dependencias con DLL, datos o imports dinámicos que PyInstaller no siempre
# descubre por análisis estático. Evitamos collect_all(): arrastra tests,
# dist-info, conversores, documentación y paquetes de nube no usados en runtime.
for package in ("av", "ctranslate2", "pyaudiowpatch", "tokenizers", "webview"):
    binaries += collect_dynamic_libs(package)

# faster-whisper necesita sus assets de VAD; huggingface_hub necesita plantillas
# y datos mínimos para descargar/cargar modelos locales.
datas += collect_data_files(
    "faster_whisper",
    includes=["assets/*"],
    excludes=["**/__pycache__/**", "**/*.pyc", "**/tests/**"],
)
datas += collect_data_files(
    "huggingface_hub",
    excludes=[
        "**/__pycache__/**", "**/*.pyc", "**/tests/**", "**/commands/**",
        "**/templates/**", "**/*.md", "**/*.rst", "**/*.txt",
    ],
)

hiddenimports += collect_submodules("faster_whisper")
hiddenimports += collect_submodules("tokenizers")
hiddenimports += collect_submodules("ctranslate2")
hiddenimports += collect_submodules("httpx")
hiddenimports += collect_submodules("huggingface_hub")
hiddenimports += [
    "onnxruntime.capi._pydll",
    "onnxruntime.capi.onnxruntime_validation",
]

# Imports dinámicos usados por pywebview/pythonnet en Windows.
hiddenimports += [
    "webview.platforms.edgechromium",
    "clr",
]

def _is_noise(entry):
    """Filtra archivos que no hacen falta en la app compilada."""
    source = str(entry[0]).replace("\\", "/").lower()
    dest = str(entry[1]).replace("\\", "/").lower() if len(entry) > 1 else ""
    haystack = source + "/" + dest
    noise_parts = (
        "/__pycache__/", ".pyc", ".pyo", "/tests/", "/test/",
        ".dist-info/", ".egg-info/", "/docs/", "/examples/", "/benchmarks/",
        "/converters/", "/commands/",
    )
    if any(part in haystack for part in noise_parts):
        return True
    # Paquetes de nube/dev que no se usan en runtime.
    if any(part in haystack for part in ("/replicate/", "/dotenv/", "/hf_xet/")):
        return True
    return False

datas = [entry for entry in datas if not _is_noise(entry)]
binaries = [entry for entry in binaries if not _is_noise(entry)]
hiddenimports = sorted({
    name for name in hiddenimports
    if not (
        name.startswith("huggingface_hub.commands")
        or name.startswith("huggingface_hub.cli")
        or name.startswith("huggingface_hub.inference._mcp")
        or name.startswith("onnxruntime.tools")
        or name.startswith("replicate")
        or name.startswith("dotenv")
        or name.startswith("hf_xet")
    )
})

a = Analysis(
    [str(root / "helpmeet" / "main.py")],
    pathex=[str(root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "pytest", "unittest", "doctest", "pdb",
        "replicate", "dotenv",
        "hf_xet",
        "matplotlib", "PIL", "pandas", "scipy",
        "torch", "tensorflow",
        "onnxruntime.tools", "huggingface_hub.commands",
    ],
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
    upx=True,   # upx=False si PyInstaller + UPX genera falsos positivos de antivirus
    console=False,
    icon=str(root / "helpmeet" / "ui" / "web" / "assets" / "helpmeet.ico"),
    version_file=str(root / "installer" / "version_info.txt"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    name="Helpmeet",
)
