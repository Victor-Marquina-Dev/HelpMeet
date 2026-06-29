"""
Genera installer/version_info.txt con la versión actual de helpmeet/version.py.
Ejecutar desde la raíz del proyecto:
    python installer/gen_version.py
"""
import sys
from pathlib import Path

root = Path(__file__).parent.parent
sys.path.insert(0, str(root))
from helpmeet.version import __version__

parts = __version__.split(".")
while len(parts) < 4:
    parts.append("0")
major, minor, patch, build = parts[:4]
ver_tuple = f"({major}, {minor}, {patch}, {build})"
ver_str = f"{major}.{minor}.{patch}"

template = Path(__file__).parent / "version_info.txt"
content = template.read_text(encoding="utf-8")

# Replace version tuples and strings
import re
content = re.sub(r"filevers=\([^)]+\)", f"filevers={ver_tuple}", content)
content = re.sub(r"prodvers=\([^)]+\)", f"prodvers={ver_tuple}", content)
content = re.sub(r"(u'FileVersion',\s+u')[^']+(')", rf"\g<1>{ver_str}\g<2>", content)
content = re.sub(r"(u'ProductVersion',\s+u')[^']+(')", rf"\g<1>{ver_str}\g<2>", content)

template.write_text(content, encoding="utf-8")
print(f"version_info.txt actualizado a {ver_str}")
