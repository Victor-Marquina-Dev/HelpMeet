"""Arma el ZIP que se sube a Gumroad (mismo archivo para los 3 planes).

Salida:  release/paquete-cliente/dist/Helpmeet-Windows-<version>.zip

    Helpmeet-Windows-3.2.0/
      Helpmeet-Setup-3.2.0.exe
      Guia-Rapida.pdf
      Manual-de-Usuario.pdf
      LEEME.txt

Uso:
    python release/paquete-cliente/build_paquete.py
    python release/paquete-cliente/build_paquete.py --sin-instalador   # prueba

El instalador se genera antes con:
    iscc /DMyAppVersion=3.2.0 installer\\Helpmeet.iss
"""
import argparse
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TEMPLATES = HERE / "templates"
BUILD = HERE / "build"
DIST = HERE / "dist"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")

# Secciones del manual que NO deben llegar al cliente: exponen operativa interna.
SECCIONES_INTERNAS = ("Panel de administración (licencias)",
                      "Panel de administracion (licencias)")


def version() -> str:
    txt = (ROOT / "helpmeet" / "version.py").read_text(encoding="utf-8")
    m = re.search(r'__version__\s*=\s*"([^"]+)"', txt)
    if not m:
        sys.exit("No se pudo leer la version de helpmeet/version.py")
    return m.group(1)


def html_to_pdf(src_html: Path, dest_pdf: Path) -> bool:
    if not CHROME.exists():
        print(f"  ! Chrome no encontrado en {CHROME}")
        return False
    dest_pdf.parent.mkdir(parents=True, exist_ok=True)
    if dest_pdf.exists():
        dest_pdf.unlink()
    subprocess.run([
        str(CHROME), "--headless=new", "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={dest_pdf}", "--virtual-time-budget=10000",
        src_html.resolve().as_uri(),
    ], capture_output=True)
    return dest_pdf.exists()


def limpiar_manual(md: str, ver: str) -> str:
    """Quita secciones internas y corrige la version del manual."""
    lineas = md.splitlines()
    out, saltando = [], False
    for ln in lineas:
        if ln.startswith("## "):
            titulo = ln[3:].strip()
            titulo_sin_num = re.sub(r"^\d+\.\s*", "", titulo)
            saltando = any(s in titulo_sin_num for s in SECCIONES_INTERNAS)
        # El indice tambien enlaza la seccion interna: fuera.
        if not saltando and not any(s in ln for s in SECCIONES_INTERNAS):
            out.append(ln)
    txt = "\n".join(out)
    txt = re.sub(r"^Version:\s*[\d.]+", f"Version: {ver}", txt, count=1, flags=re.M)
    return txt


MANUAL_CSS = """
@page { size:A4; margin:16mm 20mm; }
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;color:#15181b;font-size:10pt;line-height:1.55;
 -webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{font-family:Syne,sans-serif;font-size:24pt;letter-spacing:-1px;margin-bottom:4px;
 padding-bottom:12px;border-bottom:2.5px solid #0a9268}
h2{font-family:Syne,sans-serif;font-size:15pt;letter-spacing:-.4px;margin:20px 0 8px;
 color:#0a9268;page-break-after:avoid}
h3{font-family:Syne,sans-serif;font-size:11.5pt;margin:13px 0 5px;page-break-after:avoid}
p{margin-bottom:7px}
ul,ol{margin:6px 0 8px 20px}
li{margin-bottom:3px}
table{width:100%;border-collapse:collapse;margin:9px 0;font-size:9pt;page-break-inside:avoid}
th{background:#f6f8fc;text-align:left;padding:6px 9px;font-weight:600;
 border-bottom:1.5px solid #d3d7de}
td{padding:5px 9px;border-bottom:1px solid #e4e7ec;vertical-align:top}
code{font-family:'JetBrains Mono',monospace;font-size:8.5pt;background:#eef2f6;
 padding:1.5px 5px;border-radius:4px}
pre{background:#f6f8fc;border:1px solid #e4e7ec;border-radius:7px;padding:10px 12px;
 margin:8px 0;overflow:hidden;page-break-inside:avoid}
pre code{background:none;padding:0;font-size:8.5pt;line-height:1.45}
hr{border:none;border-top:1px solid #e4e7ec;margin:16px 0}
a{color:#0a9268;text-decoration:none}
blockquote{border-left:3px solid #0a9268;background:#f6f8fc;padding:9px 13px;
 margin:9px 0;border-radius:0 7px 7px 0}
"""


def md_to_html(md: str, titulo: str) -> str:
    """Markdown -> HTML. Cubre lo que usa el manual: encabezados, tablas,
    listas, codigo, citas, enlaces, negrita/cursiva."""
    html, i = [], 0
    lineas = md.splitlines()
    en_lista = en_ol = False

    def inline(s: str) -> str:
        s = (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
        s = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<i>\1</i>", s)
        s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
        return s

    def cerrar():
        nonlocal en_lista, en_ol
        if en_lista:
            html.append("</ul>"); en_lista = False
        if en_ol:
            html.append("</ol>"); en_ol = False

    while i < len(lineas):
        ln = lineas[i]
        if ln.startswith("```"):
            cerrar()
            i += 1
            buf = []
            while i < len(lineas) and not lineas[i].startswith("```"):
                buf.append(lineas[i].replace("&", "&amp;")
                           .replace("<", "&lt;").replace(">", "&gt;"))
                i += 1
            html.append("<pre><code>" + "\n".join(buf) + "</code></pre>")
            i += 1
            continue
        # Tabla markdown
        if ln.startswith("|") and i + 1 < len(lineas) and re.match(r"^\|[\s:|-]+\|$", lineas[i + 1]):
            cerrar()
            cabecera = [c.strip() for c in ln.strip("|").split("|")]
            html.append("<table><tr>" + "".join(f"<th>{inline(c)}</th>" for c in cabecera) + "</tr>")
            i += 2
            while i < len(lineas) and lineas[i].startswith("|"):
                celdas = [c.strip() for c in lineas[i].strip("|").split("|")]
                html.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in celdas) + "</tr>")
                i += 1
            html.append("</table>")
            continue
        m = re.match(r"^(#{1,4})\s+(.*)", ln)
        if m:
            cerrar()
            n = len(m.group(1))
            html.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
            i += 1
            continue
        if re.match(r"^[-*]\s+", ln):
            if not en_lista:
                cerrar(); html.append("<ul>"); en_lista = True
            html.append(f"<li>{inline(re.sub(r'^[-*]  *', '', ln))}</li>")
            i += 1
            continue
        if re.match(r"^\d+\.\s+", ln):
            if not en_ol:
                cerrar(); html.append("<ol>"); en_ol = True
            html.append(f"<li>{inline(re.sub(r'^\d+\.  *', '', ln))}</li>")
            i += 1
            continue
        if ln.startswith(">"):
            cerrar()
            html.append(f"<blockquote>{inline(ln.lstrip('> '))}</blockquote>")
            i += 1
            continue
        if re.match(r"^---+$", ln):
            cerrar(); html.append("<hr>"); i += 1; continue
        if ln.strip():
            cerrar(); html.append(f"<p>{inline(ln)}</p>")
        i += 1
    cerrar()

    fonts = ("https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800"
             "&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400&display=swap")
    return (f'<meta charset="utf-8"><title>{titulo}</title>'
            f'<link href="{fonts}" rel="stylesheet">'
            f"<style>{MANUAL_CSS}</style>" + "\n".join(html))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sin-instalador", action="store_true",
                    help="arma el ZIP sin el .exe (para revisar los PDF)")
    args = ap.parse_args()

    ver = version()
    nombre = f"Helpmeet-Windows-{ver}"
    print(f"Helpmeet {ver} -> {nombre}.zip\n")

    shutil.rmtree(BUILD, ignore_errors=True)
    stage = BUILD / nombre
    stage.mkdir(parents=True)

    # 1. Instalador
    exe = ROOT / "dist" / "installer" / f"Helpmeet-Setup-{ver}.exe"
    if exe.exists():
        shutil.copy2(exe, stage / exe.name)
        print(f"  [1/4] instalador   {exe.name} ({exe.stat().st_size/1e6:.0f} MB)")
    elif args.sin_instalador:
        print("  [1/4] instalador   OMITIDO (--sin-instalador)")
    else:
        sys.exit(f"\nFALTA EL INSTALADOR: {exe}\n\n"
                 f"Generalo con:\n    iscc /DMyAppVersion={ver} installer\\Helpmeet.iss\n\n"
                 f"O usa --sin-instalador para revisar solo los PDF.")

    # 2. Guia rapida
    if html_to_pdf(TEMPLATES / "guia-rapida.html", stage / "Guia-Rapida.pdf"):
        print("  [2/4] guia rapida  Guia-Rapida.pdf")
    else:
        sys.exit("No se pudo generar Guia-Rapida.pdf")

    # 3. Manual (sin secciones internas)
    md = (ROOT / "docs" / "MANUAL_USUARIO.md").read_text(encoding="utf-8")
    limpio = limpiar_manual(md, ver)
    quitadas = len(md.splitlines()) - len(limpio.splitlines())
    tmp = BUILD / "_manual.html"
    tmp.write_text(md_to_html(limpio, f"Manual de Usuario - Helpmeet {ver}"), encoding="utf-8")
    if html_to_pdf(tmp, stage / "Manual-de-Usuario.pdf"):
        print(f"  [3/4] manual       Manual-de-Usuario.pdf ({quitadas} lineas internas quitadas)")
    else:
        sys.exit("No se pudo generar Manual-de-Usuario.pdf")
    tmp.unlink(missing_ok=True)

    # 4. LEEME
    shutil.copy2(TEMPLATES / "LEEME.txt", stage / "LEEME.txt")
    print("  [4/4] leeme        LEEME.txt")

    # ZIP
    DIST.mkdir(parents=True, exist_ok=True)
    zip_path = DIST / f"{nombre}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(stage.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(BUILD))

    # Comprobacion: nada sensible dentro
    PROHIBIDO = (".env", ".key", ".pem", "secret", "admin", "credential", "token")
    with zipfile.ZipFile(zip_path) as z:
        nombres = z.namelist()
        sospechoso = [n for n in nombres
                      if any(p in n.lower() for p in PROHIBIDO)]
    print(f"\nZIP: {zip_path}  ({zip_path.stat().st_size/1e6:.1f} MB)")
    for n in nombres:
        print(f"   {n}")
    if sospechoso:
        print("\n  AVISO - revisa estos archivos:")
        for n in sospechoso:
            print(f"   ! {n}")
    else:
        print("\n  OK: sin .env, claves ni material administrativo.")
    print("\nSube este mismo ZIP en Personal, Pro y Team.")


if __name__ == "__main__":
    main()
