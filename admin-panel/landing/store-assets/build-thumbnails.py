"""Genera Cover (1280x720) y Thumbnail (1200x1200) de Helpmeet en dark y light.

Paleta tomada de los tokens reales de la app:
  dark  -> components.css body[data-theme="dark"]  (MODO OSCURO CALIDO, marron)
  light -> tokens.css :root                        (Gmail style)
Logo: geometria oficial de helpmeet-app-icon.svg (tile oscuro) y
      helpmeet-app-icon-dark.svg (tile claro). El simbolo verde es identico.
"""
import subprocess
from pathlib import Path

OUT = Path(__file__).parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# --- Tokens reales de la app ---------------------------------------------
DARK = {
    "bg":        "#211d19",   # --bg-app  marron-gris calido
    "surface":   "#2a2521",   # --bg-surface
    "elevated":  "#342e28",   # --bg-elevated
    "border":    "#4c443a",   # --border-strong
    "border_lo": "#3b342c",   # --border-subtle
    "text":      "#f3eee6",   # --text-primary  marfil calido
    "text2":     "#d4ccc0",   # --text-secondary
    "muted":     "#a89f91",   # --text-muted
    "accent":    "#35c489",   # --accent
    "soft":      "rgba(53,196,137,.11)",   # --accent-soft
    # Halo CALIDO (no verde): un halo verde tiñe el marron de fondo y lo
    # convierte justo en el verde-oscuro que hay que evitar.
    "glow":      "rgba(255,214,170,.07)",
    # tile del logo sobre fondo OSCURO -> variante -dark.svg (tile claro)
    "tile":      "#f0f2f1",
    "tile_edge": "rgba(255,250,240,.10)",
}

LIGHT = {
    "bg":        "#f6f8fc",   # --bg-app
    "surface":   "#ffffff",   # --bg-surface
    "elevated":  "#ffffff",
    "border":    "#d3d7de",   # --border-strong
    "border_lo": "#e4e7ec",   # --border-subtle
    "text":      "#15181b",   # --text-primary
    "text2":     "#3a3d40",   # --text-secondary
    "muted":     "#5f6368",   # --text-muted
    "accent":    "#0a9268",   # --accent (AA sobre blanco)
    "soft":      "rgba(16,185,129,.12)",   # --accent-soft
    "glow":      "rgba(16,185,129,.10)",
    # tile del logo sobre fondo CLARO -> variante app-icon.svg (tile oscuro)
    "tile":      "#141c18",
    "tile_edge": "rgba(20,28,24,.14)",
}

# Gradiente de marca: identico en ambos modos (no se toca) -> se usa SIEMPRE
# en el simbolo del logo. La onda decorativa sí se oscurece en modo claro,
# porque el verde claro sobre blanco queda lavado.
G1, G2 = "#6FE3B5", "#34C78A"
DARK["wave1"], DARK["wave2"] = G1, G2
LIGHT["wave1"], LIGHT["wave2"] = "#34C78A", "#0a9268"

FONTS = ("https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800"
         "&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@500&display=swap")


def logo(px, t):
    """Icono oficial: tile segun modo + simbolo con el gradiente de marca."""
    return f'''<svg class="mark" width="{px}" height="{px}" viewBox="0 0 64 64">
  <defs><linearGradient id="g{px}" x1="10" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
    <stop stop-color="{G1}"/><stop offset="1" stop-color="{G2}"/></linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="{t['tile']}" stroke="{t['tile_edge']}" stroke-width="1"/>
  <rect x="12" y="13" width="40" height="11" rx="5.5" fill="url(#g{px})"/>
  <rect x="12" y="27" width="40" height="11" rx="5.5" fill="url(#g{px})"/>
  <circle cx="21" cy="47" r="7" fill="url(#g{px})"/>
</svg>'''


def wave(t, n=8, h=(34, 68, 110, 52, 126, 84, 58, 28), w=10, gap=14):
    bars = "".join(f'<i style="height:{v}px"></i>' for v in h[:n])
    return f'<div class="wave" style="gap:{gap}px">{bars}</div>', w


def base_css(t, bar_w):
    return f'''
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{overflow:hidden}}
body{{background:
   radial-gradient(circle at 26% 20%, {t['glow']}, rgba(0,0,0,0) 58%),
   {t['bg']};
  -webkit-font-smoothing:antialiased;display:flex;align-items:center;justify-content:center}}
.card{{position:relative;background:{t['surface']};border:2px solid {t['border']};
  overflow:hidden;display:flex;flex-direction:column}}
.rings{{position:absolute;pointer-events:none}}
.rings div{{position:absolute;border-radius:50%;border:2px solid {t['border_lo']};
  left:50%;top:50%;transform:translate(-50%,-50%)}}
.brand{{display:flex;align-items:center;position:relative}}
.name{{font-family:Syne,sans-serif;font-weight:800;color:{t['text']}}}
.label{{position:relative;display:flex;align-items:center;
  font-family:'JetBrains Mono',monospace;font-weight:500;color:{t['accent']}}}
.label i{{display:block;background:{t['accent']};border-radius:2px}}
h1{{position:relative;font-family:Syne,sans-serif;font-weight:800;color:{t['text']}}}
h1 span{{color:{t['accent']}}}
p{{position:relative;font-family:'DM Sans',sans-serif;font-weight:300;color:{t['muted']}}}
.foot{{position:relative;margin-top:auto;display:flex;align-items:center}}
.pill{{font-family:'DM Sans',sans-serif;font-weight:500;color:{t['accent']};
  background:{t['soft']};border:2px solid {t['border']};border-radius:999px;
  display:flex;align-items:center}}
.pill b{{border-radius:50%;background:{t['accent']};display:block}}
.wave{{position:absolute;display:flex;align-items:center}}
.wave i{{display:block;width:{bar_w}px;border-radius:6px;
  background:linear-gradient(180deg,{t['wave1']},{t['wave2']});opacity:.9}}
'''


def thumb_html(t):
    w, bar_w = wave(t)
    return f'''<meta charset="utf-8"><link href="{FONTS}" rel="stylesheet"><style>
html,body{{width:1200px;height:1200px}}
{base_css(t, bar_w)}
.card{{width:1088px;height:1088px;border-radius:52px;padding:96px 88px}}
.rings{{right:-260px;top:-200px;width:900px;height:900px}}
.r1{{width:880px;height:880px}}.r2{{width:660px;height:660px}}.r3{{width:440px;height:440px}}
.brand{{gap:34px}} .mark{{flex:none}}
.name{{font-size:74px;letter-spacing:-2px}}
.label{{margin-top:88px;gap:22px;font-size:24px;letter-spacing:6px}}
.label i{{width:40px;height:3px}}
h1{{margin-top:36px;font-size:92px;line-height:1.06;letter-spacing:-3px}}
p{{margin-top:40px;font-size:38px;line-height:1.45;max-width:820px}}
.foot{{gap:20px}}
.pill{{font-size:28px;padding:18px 34px;gap:16px}}
.pill b{{width:12px;height:12px}}
.wave{{right:88px;bottom:96px;height:130px}}
</style>
<div class="card">
  <div class="rings"><div class="r1"></div><div class="r2"></div><div class="r3"></div></div>
  <div class="brand">{logo(132, t)}<div class="name">Helpmeet</div></div>
  <div class="label"><i></i>REUNIONES 100% LOCALES</div>
  <h1>Graba,<br>transcribe y<br>entiende tus<br><span>reuniones</span></h1>
  <p>Todo procesado en tu equipo.<br>Sin nube, sin suscripciones.</p>
  {w}
  <div class="foot">
    <div class="pill"><b></b>Windows</div>
    <div class="pill"><b></b>Pago único</div>
  </div>
</div>'''


def cover_html(t):
    w, bar_w = wave(t, h=(30, 62, 100, 48, 116, 78, 54, 26), gap=13)
    return f'''<meta charset="utf-8"><link href="{FONTS}" rel="stylesheet"><style>
html,body{{width:1280px;height:720px}}
{base_css(t, bar_w)}
.card{{width:1200px;height:640px;border-radius:40px;padding:64px 72px}}
.rings{{right:-220px;top:-260px;width:820px;height:820px}}
.r1{{width:800px;height:800px}}.r2{{width:600px;height:600px}}.r3{{width:400px;height:400px}}
.brand{{gap:22px}} .mark{{flex:none}}
.name{{font-size:46px;letter-spacing:-1.5px}}
.label{{margin-top:38px;gap:16px;font-size:17px;letter-spacing:5px}}
.label i{{width:30px;height:3px}}
h1{{margin-top:20px;font-size:62px;line-height:1.06;letter-spacing:-2px}}
p{{margin-top:22px;font-size:26px;line-height:1.4;max-width:660px}}
.foot{{gap:14px}}
.pill{{font-size:21px;padding:12px 26px;gap:12px}}
.pill b{{width:10px;height:10px}}
.wave{{right:78px;bottom:132px;height:112px}}
</style>
<div class="card">
  <div class="rings"><div class="r1"></div><div class="r2"></div><div class="r3"></div></div>
  <div class="brand">{logo(84, t)}<div class="name">Helpmeet</div></div>
  <div class="label"><i></i>REUNIONES 100% LOCALES</div>
  <h1>Graba, transcribe y<br>entiende tus <span>reuniones</span></h1>
  <p>Todo procesado en tu equipo.<br>Sin nube, sin suscripciones.</p>
  {w}
  <div class="foot">
    <div class="pill"><b></b>Windows</div>
    <div class="pill"><b></b>Pago único</div>
    <div class="pill"><b></b>Sin nube</div>
  </div>
</div>'''


JOBS = [
    ("helpmeet-thumbnail-dark",  thumb_html(DARK),  1200, 1200),
    ("helpmeet-thumbnail-light", thumb_html(LIGHT), 1200, 1200),
    ("helpmeet-cover-dark",      cover_html(DARK),  1280, 720),
    ("helpmeet-cover-light",     cover_html(LIGHT), 1280, 720),
]

for name, html, w, h in JOBS:
    src = OUT / f"{name}.html"
    src.write_text(html, encoding="utf-8")
    png = OUT / f"{name}.png"
    if png.exists():
        png.unlink()
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={w},{h}",
        f"--screenshot={png}", "--virtual-time-budget=8000",
        src.resolve().as_uri(),
    ], capture_output=True)
    print(f"{name}.png  {'OK' if png.exists() else 'FAIL'}  {w}x{h}")
