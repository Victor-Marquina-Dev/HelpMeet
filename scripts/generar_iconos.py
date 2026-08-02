"""Genera todos los archivos de icono de Helpmeet desde una única definición.

Por qué existe este script y no se exporta a mano desde un editor: los iconos
viven en seis archivos distintos (dos .ico multi-tamaño, dos .png y los .svg del
panel/landing) y hasta ahora cada uno se había exportado por separado. El
resultado fue que el símbolo de la app y el icono de la ventana tenían
geometrías distintas — las barras iguales en uno, desiguales en el otro. Con
este script hay una sola fuente de verdad: las constantes de abajo.

El logo se DIBUJA con Pillow en vez de rasterizar el SVG (no hay cairosvg en el
entorno, y para tres formas geométricas dibujar directo es más fiable que
depender de un rasterizador). Se dibuja a 8x y se reduce con LANCZOS: es lo que
da los bordes suaves en los tamaños chicos del .ico.

Uso:
    .venv/Scripts/python.exe scripts/generar_iconos.py
"""

from __future__ import annotations

import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

# ---------------------------------------------------------------- definición
# Las medidas van en un lienzo de 64 unidades, igual que el viewBox del SVG.
# Cambiar estos valores y volver a correr el script actualiza los seis archivos.
LIENZO = 64.0
RADIO_CAJA = 14.0            # ~22 % del lienzo: proporción de icono de Windows 11
# Dos parejas caja/verde, un mismo matiz (155°, el de la marca).
#
# El verde NO puede ser el mismo en las dos: cada uno funciona sobre una caja y
# se apaga en la otra.
#   #2B7D5B  sobre blanco 5,0:1   ·  sobre el marrón oscuro 3,2:1
#   #52C494  sobre blanco 2,2:1   ·  sobre el marrón oscuro 7,4:1
# Emparejarlos es el mismo criterio que ya sigue la paleta de la app y la del
# panel de administración: verde oscuro sobre claro, verde claro sobre oscuro.
#
# El marrón `#26201B` es el `--bg` del tema oscuro de la landing, para que el
# icono se apoye en el mismo tono que el sitio y no en un negro que la marca no
# tiene.
COLOR_CAJA_CLARA = "#FFFFFF"
COLOR_FORMA_CLARA = "#2B7D5B"
COLOR_CAJA_OSCURA = "#26201B"
COLOR_FORMA_OSCURA = "#52C494"

# Las tres formas en su tamaño de dibujo, SIN escalar. Antes estos números
# estaban ya multiplicados por la escala, así que cambiar el aire del icono
# obligaba a recalcular seis valores a mano. Ahora la escala es una constante y
# el encuadre se ajusta tocando solo ESCALA.
_BARRA_1 = (11.0, 6.0, 42.0, 14.0, 7.0)   # x, y, ancho, alto, radio
_BARRA_2 = (11.0, 24.0, 30.0, 14.0, 7.0)
_PUNTO = (19.0, 50.0, 8.0)                 # cx, cy, radio

# Cuánto del lienzo ocupa el símbolo. Venía en 0.80, que lo dejaba pegado a los
# bordes en la barra de tareas. Con 0.68 quedan márgenes cómodos sin que el
# símbolo se pierda dentro de la caja.
ESCALA = 0.68

# Las dos barras se alargan un poco más que el resto. El bloque original es más
# alto que ancho, así que a escala pareja sobraba margen a los lados (18,6) y
# faltaba arriba y abajo (15,4): se veía angosto. Alargando solo las barras el
# símbolo llena el ancho sin tocar el alto ni deformar nada — el radio depende
# del alto, que no cambia, así que los extremos siguen siendo semicírculos.
LARGO_BARRAS = 1.12


def _encuadrar():
    """Escala las tres formas y las centra en el lienzo.

    El centrado se calcula desde la caja real que ocupan las formas (no desde el
    lienzo de 64), porque el bloque no está centrado en su propio sistema de
    coordenadas: la barra larga llega a x=53 y el punto baja hasta y=58.
    """
    b1 = (_BARRA_1[0], _BARRA_1[1], _BARRA_1[2] * LARGO_BARRAS, _BARRA_1[3], _BARRA_1[4])
    b2 = (_BARRA_2[0], _BARRA_2[1], _BARRA_2[2] * LARGO_BARRAS, _BARRA_2[3], _BARRA_2[4])

    izq = min(b1[0], b2[0], _PUNTO[0] - _PUNTO[2])
    der = max(b1[0] + b1[2], b2[0] + b2[2], _PUNTO[0] + _PUNTO[2])
    arr = min(b1[1], b2[1], _PUNTO[1] - _PUNTO[2])
    aba = max(b1[1] + b1[3], b2[1] + b2[3], _PUNTO[1] + _PUNTO[2])

    dx = (LIENZO - (der - izq) * ESCALA) / 2 - izq * ESCALA
    dy = (LIENZO - (aba - arr) * ESCALA) / 2 - arr * ESCALA

    def barra(b):
        return (b[0] * ESCALA + dx, b[1] * ESCALA + dy,
                b[2] * ESCALA, b[3] * ESCALA, b[4] * ESCALA)

    return (barra(b1), barra(b2),
            (_PUNTO[0] * ESCALA + dx, _PUNTO[1] * ESCALA + dy, _PUNTO[2] * ESCALA))


BARRA_1, BARRA_2, PUNTO = _encuadrar()

SUPERMUESTREO = 8

RAIZ = Path(__file__).resolve().parent.parent
ASSETS = RAIZ / "helpmeet" / "ui" / "web" / "assets"
# El panel de administración se sirve aparte (admin-panel/) y tenía su propia
# copia del símbolo: con degradado, las dos barras iguales y el punto
# descentrado — la geometría de hace tres revisiones. Se escribe desde aquí para
# que no vuelva a quedarse atrás.
ASSETS_ADMIN = RAIZ / "admin-panel" / "assets"

# Tamaños que Windows pide para la barra de tareas, el alt-tab y el explorador.
TAMANOS_ICO = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]


def dibujar(lado: int, caja: str = COLOR_CAJA_CLARA, forma: str = COLOR_FORMA_CLARA) -> Image.Image:
    """Dibuja el icono a `lado` píxeles, con supermuestreo."""
    s = lado * SUPERMUESTREO
    k = s / LIENZO  # unidades del lienzo -> píxeles

    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=RADIO_CAJA * k, fill=caja)

    for x, y, an, al, r in (BARRA_1, BARRA_2):
        d.rounded_rectangle(
            [x * k, y * k, (x + an) * k, (y + al) * k],
            radius=r * k,
            fill=forma,
        )

    cx, cy, r = PUNTO
    d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=forma)

    return img.resize((lado, lado), Image.LANCZOS)


def svg(fondo: str, forma: str) -> str:
    """Versión SVG de la misma geometría, para el panel admin y la landing."""
    b1 = BARRA_1
    b2 = BARRA_2
    cx, cy, r = PUNTO
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">\n'
        "  <title id=\"title\">Helpmeet</title>\n"
        "  <!-- Generado por scripts/generar_iconos.py. No editar a mano: se\n"
        "       regenera desde ahí junto con los .ico y los .png, para que las seis\n"
        "       piezas no vuelvan a divergir. -->\n"
        f'  <rect width="64" height="64" rx="{RADIO_CAJA:g}" fill="{fondo}"/>\n'
        f'  <rect x="{b1[0]:g}" y="{b1[1]:g}" width="{b1[2]:g}" height="{b1[3]:g}" rx="{b1[4]:g}" fill="{forma}"/>\n'
        f'  <rect x="{b2[0]:g}" y="{b2[1]:g}" width="{b2[2]:g}" height="{b2[3]:g}" rx="{b2[4]:g}" fill="{forma}"/>\n'
        f'  <circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="{forma}"/>\n'
        "</svg>\n"
    )


def escribir_ico(ruta: Path, imagenes: list[Image.Image]) -> None:
    """Escribe un .ico multi-tamaño con un fotograma PNG por tamaño.

    Se arma el contenedor a mano en vez de usar `Image.save(format="ICO")`
    porque ese camino toma UNA imagen y la reescala internamente: el parámetro
    `append_images` no existe para ICO, así que el archivo salía con un solo
    tamaño. Escribiéndolo así, cada tamaño lleva su propio dibujo hecho con
    supermuestreo, que es lo que mantiene el símbolo nítido a 16 y 20 píxeles.

    Los fotogramas van en PNG, admitido en .ico desde Windows Vista.
    """
    fotogramas = []
    for img in imagenes:
        buf = BytesIO()
        img.save(buf, format="PNG")
        fotogramas.append(buf.getvalue())

    # ICONDIR: campo reservado, tipo (1 para icono) y cantidad de imágenes.
    cabecera = struct.pack("<HHH", 0, 1, len(imagenes))
    # Las imágenes empiezan después de la tabla de entradas (16 bytes cada una).
    desplazamiento = 6 + 16 * len(imagenes)
    entradas, cuerpo = b"", b""
    for img, datos in zip(imagenes, fotogramas):
        # Un lado de 0 es como el formato representa 256 píxeles: el campo mide
        # un solo byte y 256 no entra.
        lado = 0 if img.width >= 256 else img.width
        entradas += struct.pack(
            "<BBBBHHII", lado, lado, 0, 0, 1, 32, len(datos), desplazamiento
        )
        cuerpo += datos
        desplazamiento += len(datos)

    ruta.write_bytes(cabecera + entradas + cuerpo)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    # Dos juegos con la misma geometría y el mismo verde: solo cambia la caja.
    # `app.py` (línea ~1626) ya elige entre helpmeet.ico y helpmeet-dark.ico
    # según el tema — hasta ahora esa elección no hacía nada, porque los dos
    # archivos se escribían idénticos.
    for nombre, caja, forma in (("helpmeet.ico", COLOR_CAJA_CLARA, COLOR_FORMA_CLARA),
                                ("helpmeet-dark.ico", COLOR_CAJA_OSCURA, COLOR_FORMA_OSCURA)):
        escribir_ico(ASSETS / nombre, [dibujar(n, caja, forma) for n in TAMANOS_ICO])
        print(f"  OK  {nombre}  ({len(TAMANOS_ICO)} tamaños)")

    dibujar(32).save(ASSETS / "helpmeet-favicon.png")
    print("  OK  helpmeet-favicon.png  (32px)")
    dibujar(256).save(ASSETS / "helpmeet-icon-256.png")
    print("  OK  helpmeet-icon-256.png  (256px)")
    dibujar(256, COLOR_CAJA_OSCURA, COLOR_FORMA_OSCURA).save(ASSETS / "helpmeet-icon-256-dark.png")
    print("  OK  helpmeet-icon-256-dark.png  (256px, caja oscura)")

    # Los SVG, en pares claro/oscuro. El símbolo grande (bienvenida, instalación
    # y pantalla de licencia) se mantenía a mano fuera de este script: justo la
    # divergencia que el script existe para evitar.
    for nombre, caja, forma in (("helpmeet-app-icon.svg", COLOR_CAJA_CLARA, COLOR_FORMA_CLARA),
                                ("helpmeet-app-icon-dark.svg", COLOR_CAJA_OSCURA, COLOR_FORMA_OSCURA),
                                ("helpmeet-symbol.svg", COLOR_CAJA_CLARA, COLOR_FORMA_CLARA),
                                ("helpmeet-symbol-dark.svg", COLOR_CAJA_OSCURA, COLOR_FORMA_OSCURA)):
        (ASSETS / nombre).write_text(svg(caja, forma), encoding="utf-8")
        print(f"  OK  {nombre}")

    # Copias para el panel de administración, que se sirve desde otra carpeta.
    if ASSETS_ADMIN.is_dir():
        for nombre in ("helpmeet-symbol.svg", "helpmeet-symbol-dark.svg",
                       "helpmeet-app-icon.svg", "helpmeet-app-icon-dark.svg"):
            (ASSETS_ADMIN / nombre).write_text((ASSETS / nombre).read_text(encoding="utf-8"), encoding="utf-8")
            print(f"  OK  admin-panel/assets/{nombre}")


if __name__ == "__main__":
    main()
