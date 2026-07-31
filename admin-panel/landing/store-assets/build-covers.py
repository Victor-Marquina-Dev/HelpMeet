"""Covers 1280x720 de Helpmeet (dark + light) para Gumroad y marketing.

Genera:
  - 3 covers de plan (Personal / Pro / Team) segun docs/GUIA_VENTA_GUMROAD.md
  - 4 covers de caracteristica (local, IA/Markdown, video, organizacion)

Paleta = tokens reales de la app:
  dark  -> components.css body[data-theme="dark"]  (MODO OSCURO CALIDO, marron)
  light -> tokens.css :root
Logo   = geometria oficial de helpmeet-app-icon.svg; el tile cambia segun modo.
Halo   = calido en dark (un halo verde tiñe el marron y lo vuelve verde-negro).
"""
import subprocess
from pathlib import Path

OUT = Path(__file__).parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
W, H = 1280, 720

DARK = {
    "bg": "#211d19", "surface": "#2a2521", "elevated": "#342e28",
    "border": "#4c443a", "border_lo": "#3b342c",
    "text": "#f3eee6", "text2": "#d4ccc0", "muted": "#a89f91", "faint": "#82796c",
    "accent": "#35c489", "soft": "rgba(53,196,137,.11)",
    "glow": "rgba(255,214,170,.07)",
    "tile": "#f0f2f1", "tile_edge": "rgba(255,250,240,.10)",
    "wave1": "#6FE3B5", "wave2": "#34C78A",
    "chip": "rgba(255,250,240,.05)",
}
LIGHT = {
    "bg": "#f6f8fc", "surface": "#ffffff", "elevated": "#ffffff",
    "border": "#d3d7de", "border_lo": "#e4e7ec",
    "text": "#15181b", "text2": "#3a3d40", "muted": "#5f6368", "faint": "#80868b",
    "accent": "#0a9268", "soft": "rgba(16,185,129,.12)",
    "glow": "rgba(16,185,129,.10)",
    "tile": "#141c18", "tile_edge": "rgba(20,28,24,.14)",
    "wave1": "#34C78A", "wave2": "#0a9268",
    "chip": "rgba(21,24,27,.04)",
}
G1, G2 = "#6FE3B5", "#34C78A"   # gradiente de marca: NO cambia entre modos

FONTS = ("https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800"
         "&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@500&display=swap")


def logo(px, t, uid):
    return f'''<svg class="mark" width="{px}" height="{px}" viewBox="0 0 64 64">
<defs><linearGradient id="g{uid}" x1="10" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
<stop stop-color="{G1}"/><stop offset="1" stop-color="{G2}"/></linearGradient></defs>
<rect width="64" height="64" rx="14" fill="{t['tile']}" stroke="{t['tile_edge']}" stroke-width="1"/>
<rect x="12" y="13" width="40" height="11" rx="5.5" fill="url(#g{uid})"/>
<rect x="12" y="27" width="40" height="11" rx="5.5" fill="url(#g{uid})"/>
<circle cx="21" cy="47" r="7" fill="url(#g{uid})"/></svg>'''


def shell(t, body, extra=""):
    return f'''<meta charset="utf-8"><link href="{FONTS}" rel="stylesheet"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{W}px;height:{H}px;overflow:hidden}}
body{{background:radial-gradient(circle at 24% 18%, {t['glow']}, rgba(0,0,0,0) 58%),{t['bg']};
 display:flex;align-items:center;justify-content:center;-webkit-font-smoothing:antialiased}}
.card{{position:relative;width:1200px;height:640px;background:{t['surface']};
 border:2px solid {t['border']};border-radius:40px;padding:56px 64px;
 display:flex;flex-direction:column;overflow:hidden}}
.rings{{position:absolute;right:-220px;top:-260px;width:820px;height:820px;pointer-events:none}}
.rings div{{position:absolute;border-radius:50%;border:2px solid {t['border_lo']};
 left:50%;top:50%;transform:translate(-50%,-50%)}}
.r1{{width:800px;height:800px}}.r2{{width:600px;height:600px}}.r3{{width:400px;height:400px}}
.brand{{display:flex;align-items:center;gap:18px;position:relative}}
.bname{{font-family:Syne,sans-serif;font-weight:800;font-size:34px;
 letter-spacing:-1px;color:{t['text']}}}
.ver{{font-family:'JetBrains Mono',monospace;font-size:14px;color:{t['faint']};
 border:1.5px solid {t['border']};border-radius:999px;padding:4px 12px;margin-left:4px}}
.label{{position:relative;display:flex;align-items:center;gap:14px;
 font-family:'JetBrains Mono',monospace;font-weight:500;font-size:16px;
 letter-spacing:4.5px;color:{t['accent']}}}
.label i{{display:block;width:28px;height:3px;background:{t['accent']};border-radius:2px}}
h1{{position:relative;font-family:Syne,sans-serif;font-weight:800;color:{t['text']};
 letter-spacing:-2px;line-height:1.05}}
h1 span{{color:{t['accent']}}}
p{{position:relative;font-family:'DM Sans',sans-serif;font-weight:300;
 color:{t['muted']};line-height:1.45}}
.foot{{position:relative;margin-top:auto;display:flex;align-items:center;gap:14px}}
.pill{{font-family:'DM Sans',sans-serif;font-weight:500;font-size:20px;color:{t['accent']};
 background:{t['soft']};border:2px solid {t['border']};border-radius:999px;
 padding:11px 24px;display:flex;align-items:center;gap:11px}}
.pill b{{width:9px;height:9px;border-radius:50%;background:{t['accent']};display:block}}
.wave{{position:absolute;display:flex;align-items:center;gap:12px}}
.wave i{{display:block;width:9px;border-radius:6px;
 background:linear-gradient(180deg,{t['wave1']},{t['wave2']});opacity:.9}}
{extra}</style>
<div class="card"><div class="rings"><div class="r1"></div><div class="r2"></div><div class="r3"></div></div>
{body}</div>'''


def wave(right=70, bottom=124, hs=(28, 58, 96, 44, 112, 74, 50, 24)):
    bars = "".join(f'<i style="height:{v}px"></i>' for v in hs)
    return f'<div class="wave" style="right:{right}px;bottom:{bottom}px">{bars}</div>'


def brand_row(t, uid, version=False):
    v = '<span class="ver">v3.2</span>' if version else ''
    return f'<div class="brand">{logo(60, t, uid)}<div class="bname">Helpmeet</div>{v}</div>'


# ---------------------------------------------------------------- PLAN COVER
PLAN_CSS = '''
.price{position:relative;display:flex;align-items:baseline;gap:14px;margin-top:22px}
.amount{font-family:Syne,sans-serif;font-weight:800;font-size:104px;letter-spacing:-4px}
.once{font-family:'DM Sans',sans-serif;font-weight:500;font-size:22px}
/* flex:1 hace que el bloque CREZCA hasta las pastillas y luego reparta las
   filas; con solo align-content el grid no se estira y queda banda muerta. */
.feats{position:relative;margin-top:28px;margin-bottom:28px;display:grid;
 grid-template-columns:1fr 1fr;gap:18px 34px;max-width:900px;
 flex:1;align-content:space-evenly}
.feat{font-family:'DM Sans',sans-serif;font-weight:400;font-size:21px;
 display:flex;align-items:center;gap:12px}
.tick{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;
 justify-content:center;flex:none;font-size:13px;font-weight:700}
.plan-tag{position:absolute;right:64px;top:56px;font-family:Syne,sans-serif;
 font-weight:800;font-size:26px;letter-spacing:-.5px;padding:12px 30px;border-radius:999px}
'''


def plan_cover(t, uid, plan, price, devices, feats, highlight=False):
    tag_style = (f"background:{t['accent']};color:{'#06281c' if t is DARK else '#ffffff'}"
                 if highlight else f"background:{t['soft']};color:{t['accent']};"
                 f"border:2px solid {t['border']}")
    items = "".join(
        f'<div class="feat" style="color:{t["text2"]}">'
        f'<span class="tick" style="background:{t["soft"]};color:{t["accent"]}">✓</span>{f}</div>'
        for f in feats)
    body = f'''{brand_row(t, uid)}
<div class="plan-tag" style="{tag_style}">{plan}</div>
<div class="price">
  <div class="amount" style="color:{t['text']}">${price}</div>
  <div class="once" style="color:{t['muted']}">pago único · {devices}</div>
</div>
<div class="feats">{items}</div>
{wave(right=64, bottom=52, hs=(22, 46, 76, 36, 88, 58, 40, 20))}
<div class="foot">
  <div class="pill"><b></b>Windows 10/11</div>
  <div class="pill"><b></b>Sin suscripciones</div>
  <div class="pill"><b></b>Actualizaciones 1 año</div>
</div>'''
    return shell(t, body, PLAN_CSS)


# ------------------------------------------------------------- FEATURE COVER
FEAT_CSS = '''
/* La ilustracion ocupa la banda derecha; el texto se limita a 660px para
   no pasar por debajo de ella. */
h1.big{margin-top:24px;font-size:58px;max-width:660px}
p.lead{margin-top:18px;font-size:24px;max-width:620px}
.chips{position:relative;margin-top:auto;display:flex;gap:12px;flex-wrap:wrap;
 max-width:700px}
.chip{font-family:'DM Sans',sans-serif;font-weight:500;font-size:18px;
 border-radius:12px;padding:11px 18px;display:flex;align-items:center;gap:10px}
.art{position:absolute;right:56px;top:50%;transform:translateY(-50%);
 width:340px;height:340px;pointer-events:none}
'''


def feature_cover(t, uid, kicker, title_html, lead, chips, art=""):
    cs = "".join(
        f'<div class="chip" style="background:{t["chip"]};color:{t["text2"]};'
        f'border:1.5px solid {t["border_lo"]}">'
        f'<span style="color:{t["accent"]};font-weight:700">▪</span>{c}</div>' for c in chips)
    body = f'''{brand_row(t, uid, version=True)}
<div class="label" style="margin-top:34px"><i></i>{kicker}</div>
<h1 class="big">{title_html}</h1>
<p class="lead">{lead}</p>
{art}
<div class="chips">{cs}</div>'''
    return shell(t, body, FEAT_CSS)


def art_tracks(t):
    """Dos pistas de audio (me / others): el diferencial real del producto."""
    def row(y, hs, lbl, col):
        bars = "".join(
            f'<rect x="{18 + i * 17}" y="{y + 46 - v / 2}" width="8" height="{v}" rx="4" fill="{col}"/>'
            for i, v in enumerate(hs))
        return (f'<text x="18" y="{y + 16}" font-family="JetBrains Mono,monospace" '
                f'font-size="15" fill="{t["muted"]}">{lbl}</text>{bars}')
    me = (26, 54, 38, 72, 44, 60, 30, 66, 40, 52, 34, 58, 28, 48)
    ot = (44, 30, 62, 36, 70, 42, 56, 32, 64, 38, 50, 26, 60, 34)
    return f'''<svg class="art" viewBox="0 0 280 280">
<rect x="0" y="10" width="280" height="118" rx="16" fill="{t['chip']}" stroke="{t['border_lo']}" stroke-width="1.5"/>
<rect x="0" y="146" width="280" height="118" rx="16" fill="{t['chip']}" stroke="{t['border_lo']}" stroke-width="1.5"/>
{row(24, me, "me · micrófono", t['accent'])}
{row(160, ot, "others · sistema", t['wave1'])}
</svg>'''


def art_markdown(t):
    lines = [(0, 150), (1, 110), (2, 175), (3, 95), (4, 160), (5, 130)]
    rows = "".join(
        f'<rect x="20" y="{62 + i * 26}" width="{w}" height="9" rx="4.5" '
        f'fill="{t["border"]}" opacity=".75"/>' for i, w in lines)
    return f'''<svg class="art" viewBox="0 0 280 280">
<rect x="0" y="14" width="240" height="236" rx="16" fill="{t['chip']}" stroke="{t['border_lo']}" stroke-width="1.5"/>
<text x="20" y="44" font-family="JetBrains Mono,monospace" font-size="16" fill="{t['accent']}">## reunion.md</text>
{rows}
<rect x="20" y="218" width="104" height="9" rx="4.5" fill="{t['accent']}" opacity=".55"/>
</svg>'''


def art_screen(t):
    return f'''<svg class="art" viewBox="0 0 280 280">
<rect x="6" y="46" width="268" height="160" rx="14" fill="{t['chip']}" stroke="{t['border_lo']}" stroke-width="1.5"/>
<rect x="6" y="46" width="268" height="30" rx="14" fill="{t['border_lo']}" opacity=".5"/>
<circle cx="30" cy="61" r="5" fill="{t['muted']}" opacity=".6"/>
<circle cx="48" cy="61" r="5" fill="{t['muted']}" opacity=".45"/>
<circle cx="66" cy="61" r="5" fill="{t['muted']}" opacity=".3"/>
<circle cx="140" cy="140" r="34" fill="none" stroke="{t['accent']}" stroke-width="4"/>
<circle cx="140" cy="140" r="13" fill="{t['accent']}"/>
<rect x="92" y="224" width="96" height="12" rx="6" fill="{t['border']}" opacity=".7"/>
</svg>'''


def art_projects(t):
    def card(y, w, dot):
        return (f'<rect x="0" y="{y}" width="260" height="52" rx="12" fill="{t["chip"]}" '
                f'stroke="{t["border_lo"]}" stroke-width="1.5"/>'
                f'<circle cx="26" cy="{y + 26}" r="7" fill="{dot}"/>'
                f'<rect x="46" y="{y + 15}" width="{w}" height="9" rx="4.5" fill="{t["border"]}" opacity=".8"/>'
                f'<rect x="46" y="{y + 30}" width="{w - 52}" height="7" rx="3.5" fill="{t["border"]}" opacity=".45"/>')
    return f'''<svg class="art" viewBox="0 0 280 280">
{card(16, 150, t['accent'])}{card(84, 122, t['wave1'])}{card(152, 164, t['muted'])}{card(220, 108, t['border'])}
</svg>'''


# ------------------------------------------------------------------ CATALOGO
def jobs():
    out = []
    plans = [
        ("personal", "PERSONAL", "49", "1 dispositivo", False,
         ["Transcripción 100% local", "Grabación de pantalla",
          "Audio + micrófono ilimitado", "Transcripción de video 10 h",
          "Capturas de pantalla", "Export Markdown + TXT"]),
        ("pro", "PRO", "99", "2 dispositivos", True,
         ["Todo lo de Personal", "Transcripción de video ilimitada",
          "Export ZIP con recursos", "Gestión de participantes",
          "Glosario de términos", "Recuperación de grabaciones"]),
        ("team", "TEAM", "199", "5 dispositivos", False,
         ["Todo lo de Pro", "5 dispositivos activos",
          "Soporte prioritario", "Ideal para equipos",
          "Licencias centralizadas", "Transcripción de video ilimitada"]),
    ]
    for slug, name, price, dev, hi, feats in plans:
        for mode, t in (("dark", DARK), ("light", LIGHT)):
            out.append((f"helpmeet-plan-{slug}-{mode}",
                        plan_cover(t, f"{slug}{mode}", name, price, dev, feats, hi)))

    feats = [
        ("local", "PRIVACIDAD POR DISEÑO",
         'Tu audio<br>nunca sale<br>de tu <span>equipo</span>',
         "Transcripción local con Whisper. Sin nube, sin cuentas, sin terceros.",
         ["Whisper local", "4 modelos", "Español e Inglés"],
         art_tracks),
        ("markdown", "CONTEXTO PARA IA",
         'De la reunión<br>a <span>Markdown</span>',
         "Exporta la transcripción lista para pegar en Claude, ChatGPT o tu IA.",
         ["Export .md y .txt", "Copiar transcripción", "ZIP con recursos"],
         art_markdown),
        ("video", "GRABACIÓN DE PANTALLA",
         'Graba pantalla,<br>micro y<br><span>sistema</span>',
         "Pistas separadas de tu voz y del audio del sistema, más video de la reunión.",
         ["720p · 1080p · nativo", "Multi-monitor", "Capturas al instante"],
         art_screen),
        ("proyectos", "TODO ORGANIZADO",
         'Reuniones por<br><span>proyecto</span>',
         "Agrupa por iniciativa, busca dentro de las transcripciones y archiva.",
         ["Proyectos y favoritos", "Búsqueda en transcripciones", "Calendario"],
         art_projects),
    ]
    for slug, kicker, title, lead, chips, art in feats:
        for mode, t in (("dark", DARK), ("light", LIGHT)):
            out.append((f"helpmeet-feature-{slug}-{mode}",
                        feature_cover(t, f"{slug}{mode}", kicker, title, lead, chips, art(t))))
    return out


for name, html in jobs():
    src = OUT / f"{name}.html"
    src.write_text(html, encoding="utf-8")
    png = OUT / f"{name}.png"
    if png.exists():
        png.unlink()
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={W},{H}",
        f"--screenshot={png}", "--virtual-time-budget=8000",
        src.resolve().as_uri(),
    ], capture_output=True)
    print(f"{'OK ' if png.exists() else 'FAIL'} {name}.png")
