# Paquete de cliente — Gumroad

Genera el ZIP que descarga el comprador. **El mismo archivo se sube en los 3 planes**:
el instalador es idéntico y las funciones se habilitan con la Product Key.

## Contenido del ZIP

```
Helpmeet-Windows-3.2.0/
├── Helpmeet-Setup-3.2.0.exe
├── Guia-Rapida.pdf
├── Manual-de-Usuario.pdf
└── LEEME.txt
```

Nunca se incluye: Product Key genérica, credenciales, `.env`, claves privadas
ni acceso al panel de licencias. El script lo verifica al terminar.

## Cómo generarlo

```bash
# 1. Compilar la app
.\scripts\build_release.ps1

# 2. Generar el instalador
iscc /DMyAppVersion=3.2.0 installer\Helpmeet.iss

# 3. Armar el ZIP
python release/paquete-cliente/build_paquete.py
```

Resultado: `release/paquete-cliente/dist/Helpmeet-Windows-3.2.0.zip`

Para revisar solo los PDF sin compilar la app:

```bash
python release/paquete-cliente/build_paquete.py --sin-instalador
```

## Qué hace el script

1. Lee la versión de `helpmeet/version.py` (única fuente de verdad).
2. Copia el instalador.
3. Convierte `templates/guia-rapida.html` a PDF con Chrome headless.
4. Convierte `docs/MANUAL_USUARIO.md` a PDF **quitando la sección
   "Panel de administración (licencias)"**, que expone operativa interna,
   y corrige la versión del encabezado.
5. Copia `templates/LEEME.txt`.
6. Comprime y avisa si detecta algo sensible.

## Editar los documentos

| Quiero cambiar | Edito |
|---|---|
| Guía rápida | `templates/guia-rapida.html` |
| LEEME | `templates/LEEME.txt` |
| Manual | `docs/MANUAL_USUARIO.md` (raíz del proyecto) |
| Secciones a excluir del manual | `SECCIONES_INTERNAS` en `build_paquete.py` |

Al subir de versión solo se cambia `helpmeet/version.py`; el resto se ajusta solo,
salvo los textos que citan la versión dentro de `templates/`.

## Subida a Gumroad

En cada producto → pestaña **Content**:

1. Selector **Editing: Personal** → subir el ZIP
2. Cambiar a **Editing: Pro** → subir el mismo ZIP
3. Cambiar a **Editing: Team** → subir el mismo ZIP
4. **Save changes** en cada uno

Antes de publicar, verificar que el slug de cada producto coincide con
`PLAN_MAP` en `helpmeet-licenses/helpmeet_licenses/routers/gumroad.py`:

| Slug en Gumroad | Plan |
|---|---|
| `helpmeet_personal` | personal |
| `helpmeet_pro` | pro |
| `helpmeet_team` | team |

Si no coincide, el webhook usa `personal` por defecto y un comprador de Team
recibiría una licencia de 1 dispositivo.
