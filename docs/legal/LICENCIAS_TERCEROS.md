# Licencias de terceros — Helpmeet

Helpmeet se distribuye junto con software de terceros. Esta es la lista de las
dependencias principales y sus licencias. **Antes de publicar**, incluye los
textos completos de licencia en el instalador (carpeta `licenses/` o pantalla
"Acerca de") y revisa los puntos marcados con ⚠️.

_Revisado: 2026-06-24. Versiones según `requirements.txt`._

## Dependencias directas

| Componente | Versión | Licencia | Notas |
|---|---|---|---|
| faster-whisper | 1.0.3 | MIT | — |
| CTranslate2 | (transitiva) | MIT | motor de inferencia de faster-whisper |
| tokenizers | (transitiva) | Apache-2.0 | — |
| huggingface_hub | (transitiva) | Apache-2.0 | descarga del modelo |
| PyAV (`av`) | 12.3.0 | BSD-3-Clause | ⚠️ **incluye binarios de FFmpeg** (ver abajo) |
| numpy | 2.4.6 | BSD-3-Clause | — |
| SQLAlchemy | 2.0.30 | MIT | — |
| pywebview | 5.1 | BSD-3-Clause | usa el WebView2 del sistema |
| PyAudioWPatch | 0.2.12.7 | MIT | basado en PyAudio/PortAudio (MIT) |
| mss | 9.0.1 | MIT | captura de pantalla |
| pynput | 1.7.7 | ⚠️ **LGPL-3.0** | ver cumplimiento abajo |
| requests | 2.32.3 | Apache-2.0 | — |
| python-dotenv | 1.2.2 | BSD-3-Clause | — |
| replicate | 1.0.7 | Apache-2.0 | sin uso (nube deshabilitada) |

Solo para compilar (no se distribuyen con la app):

| Componente | Licencia | Notas |
|---|---|---|
| PyInstaller | GPL-2.0 con excepción de bootloader | la excepción permite distribuir el ejecutable empaquetado bajo cualquier licencia |
| pytest | MIT | solo pruebas |

## Puntos que requieren atención ⚠️

### FFmpeg (vía PyAV)
Las ruedas (`wheels`) de PyAV incluyen binarios de **FFmpeg**, normalmente bajo
**LGPL-2.1-or-later**. Para cumplir la LGPL al distribuir:

- Incluye el aviso de copyright y el texto de la licencia LGPL de FFmpeg.
- Permite la sustitución de la biblioteca (el enlace dinámico de PyAV ya lo
  facilita; no enlaces FFmpeg de forma estática y cerrada).
- **Verifica el build concreto**: si el FFmpeg incluido se compiló con
  componentes GPL (p. ej. `libx264`, `--enable-gpl`), entonces aplica **GPL** y
  Helpmeet tendría que cumplir la GPL. Las ruedas estándar de PyPI suelen ser
  LGPL sin componentes GPL.

### pynput (LGPL-3.0)
`pynput` es LGPL-3.0. Al distribuirlo: incluye su licencia y permite la
sustitución de la biblioteca. Como se usa como módulo de Python independiente,
el usuario puede reemplazarlo; eso satisface el requisito de la LGPL.

## Cómo regenerar esta lista

Para ver licencias de todo el árbol de dependencias instalado:

```bash
pip install pip-licenses
pip-licenses --format=markdown --with-urls --order=license
```

Revisa la salida y actualiza esta tabla antes de cada publicación.
