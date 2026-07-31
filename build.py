"""
Script de build para Helpmeet.

Genera dos artefactos:
  1. Portable (onedir): carpeta Helpmeet-portable/ lista para distribuir como ZIP
  2. Ejecutable (onefile): Helpmeet.exe autocontenido

Uso:
    python build.py              → ambos
    python build.py portable     → solo portable
    python build.py exe          → solo .exe
"""
import sys
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
SPEC = ROOT / "Helpmeet.spec"


def clean():
    """Limpia builds anteriores."""
    for d in (ROOT / "build", DIST, ROOT / "__pycache__"):
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
    for f in ROOT.glob("*.spec"):
        if f.name != "Helpmeet.spec":
            f.unlink(missing_ok=True)


def build_portable():
    """Portable: carpeta con .exe + dependencias (onedir)."""
    print("\n=== Construyendo version PORTABLE (onedir) ===\n")
    import PyInstaller.__main__
    args = [
        str(SPEC),
        "--noconfirm",
        "--clean",
        "--distpath", str(DIST / "portable"),
        "--workpath", str(ROOT / "build" / "portable"),
    ]
    PyInstaller.__main__.run(args)
    src = DIST / "portable" / "Helpmeet"
    if src.exists():
        dest = DIST / "Helpmeet-portable"
        if dest.exists():
            shutil.rmtree(dest)
        shutil.move(str(src), str(dest))
        print(f"\nPortable listo: {dest}")
    else:
        print("\nERROR: No se genero la carpeta portable.")


def build_exe():
    """Ejecutable standalone (onefile)."""
    print("\n=== Construyendo version EJECUTABLE (onefile) ===\n")
    import PyInstaller.__main__

    # Copiar el spec y modificar para onefile (quitar COLLECT)
    onefile_spec = ROOT / "Helpmeet-onefile.spec"
    content = SPEC.read_text(encoding="utf-8")

    # Reemplazar COLLECT por EXE con binaries+datas (onefile)
    # El spec original termina con:
    #   coll = COLLECT(exe, a.binaries, a.datas, ...)
    # Para onefile necesitamos que EXE incluya binaries+datas
    import re
    # Quitar la seccion COLLECT completa
    content = re.sub(r'\ncoll = COLLECT\(.*?\n\)', '', content, flags=re.DOTALL)
    # Modificar EXE para onefile: agregar a.binaries y a.datas
    content = content.replace(
        "exclude_binaries=True,",
        "exclude_binaries=False,"
    )
    # Agregar a.binaries y a.datas al EXE (estaban en COLLECT)
    content = content.replace(
        "    icon=str(root / ",
        "    binaries=a.binaries,\n    datas=a.datas,\n    icon=str(root / ",
    )

    onefile_spec.write_text(content, encoding="utf-8")

    try:
        PyInstaller.__main__.run([
            str(onefile_spec),
            "--noconfirm",
            "--clean",
            "--distpath", str(DIST / "exe"),
            "--workpath", str(ROOT / "build" / "exe"),
        ])
        src = DIST / "exe" / "Helpmeet.exe"
        if src.exists():
            dest = DIST / "Helpmeet.exe"
            if dest.exists():
                dest.unlink()
            shutil.move(str(src), str(dest))
            size_mb = dest.stat().st_size / (1024 * 1024)
            print(f"\nEjecutable listo: {dest} ({size_mb:.1f} MB)")
        else:
            print("\nERROR: No se genero el ejecutable.")
    finally:
        onefile_spec.unlink(missing_ok=True)


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "all"

    if target in ("all", "clean"):
        clean()

    if target in ("all", "portable"):
        build_portable()

    if target in ("all", "exe"):
        build_exe()

    if target == "all":
        print("\n=== Build completo ===")
        portable = DIST / "Helpmeet-portable"
        exe = DIST / "Helpmeet.exe"
        if portable.exists():
            print(f"  Portable: {portable}")
        if exe.exists():
            size_mb = exe.stat().st_size / (1024 * 1024)
            print(f"  EXE:      {exe} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
