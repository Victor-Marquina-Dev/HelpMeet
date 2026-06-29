# Licencias de terceros — Helpmeet

Helpmeet incluye los siguientes componentes de código abierto.  
Generado con `pip-licenses` desde el entorno de desarrollo.

> **Nota sobre FFmpeg/PyAV:** Helpmeet usa PyAV (`av`) que enlaza dinámicamente con FFmpeg.  
> FFmpeg puede estar bajo LGPL 2.1 o GPL 2+ dependiendo del build. El build que usa Helpmeet es LGPL.  
> Confirmar antes de distribuir: `python -c "import av; print(av.__version__)"` y revisar el build de ffmpeg incluido.

---

## Dependencias principales

| Paquete | Versión | Licencia | URL |
|---|---|---|---|
| faster-whisper | 1.0.3 | MIT License | https://github.com/SYSTRAN/faster-whisper |
| ctranslate2 | 4.8.0 | MIT | https://opennmt.net |
| onnxruntime | 1.27.0 | MIT License | https://onnxruntime.ai |
| av (PyAV / FFmpeg) | 12.3.0 | BSD License | https://github.com/PyAV-Org/PyAV |
| pywebview | 5.1 | BSD License | https://pywebview.flowrl.com/ |
| pythonnet | 3.1.0 | MIT | https://pythonnet.github.io/ |
| PyAudioWPatch | 0.2.12.7 | Apache Software License | https://github.com/s0d3s/PyAudioWPatch/ |
| huggingface_hub | 1.20.1 | Apache Software License | https://github.com/huggingface/huggingface_hub |
| tokenizers | 0.23.1 | Apache Software License | https://github.com/huggingface/tokenizers |
| SQLAlchemy | 2.0.30 | MIT License | https://www.sqlalchemy.org |
| pydantic | 2.13.4 | MIT | https://github.com/pydantic/pydantic |
| numpy | 2.4.6 | BSD-3-Clause | https://numpy.org |
| mss | 9.0.1 | MIT License | https://github.com/BoboTiG/python-mss |
| pynput | 1.7.7 | LGPLv3 | https://github.com/moses-palmer/pynput |
| pillow | 12.2.0 | MIT-CMU | https://python-pillow.github.io |
| httpx | 0.28.1 | BSD License | https://github.com/encode/httpx |
| requests | 2.32.3 | Apache Software License | https://requests.readthedocs.io |
| certifi | 2026.6.17 | MPL 2.0 | https://github.com/certifi/python-certifi |
| tqdm | 4.68.3 | MPL-2.0 AND MIT | https://tqdm.github.io |
| rich | 15.0.0 | MIT License | https://github.com/Textualize/rich |
| typer | 0.25.1 | MIT | https://github.com/fastapi/typer |
| click | 8.4.1 | BSD-3-Clause | https://github.com/pallets/click/ |
| python-dotenv | 1.2.2 | BSD-3-Clause | https://github.com/theskumar/python-dotenv |
| PyYAML | 6.0.3 | MIT License | https://pyyaml.org/ |
| filelock | 3.29.4 | MIT | https://github.com/tox-dev/py-filelock |
| fsspec | 2026.6.0 | BSD-3-Clause | https://github.com/fsspec/filesystem_spec |
| bottle | 0.13.4 | MIT License | http://bottlepy.org/ |
| colorama | 0.4.6 | BSD License | https://github.com/tartley/colorama |
| cffi | 2.0.0 | MIT | https://cffi.readthedocs.io |
| pycparser | 3.0 | BSD-3-Clause | https://github.com/eliben/pycparser |
| pywin32-ctypes | 0.2.3 | BSD-3-Clause | https://github.com/enthought/pywin32-ctypes |
| six | 1.17.0 | MIT License | https://github.com/benjaminp/six |
| typing_extensions | 4.15.0 | PSF-2.0 | https://github.com/python/typing_extensions |
| greenlet | 3.5.2 | MIT AND PSF-2.0 | https://greenlet.readthedocs.io |
| anyio | 4.14.0 | MIT | https://anyio.readthedocs.io |
| h11 | 0.16.0 | MIT License | https://github.com/python-hyper/h11 |
| httpcore | 1.0.9 | BSD-3-Clause | https://www.encode.io/httpcore/ |
| idna | 3.18 | BSD-3-Clause | https://github.com/kjd/idna |
| urllib3 | 2.7.0 | MIT | https://github.com/urllib3/urllib3 |
| charset-normalizer | 3.4.7 | MIT | https://github.com/jawah/charset_normalizer |
| protobuf | 7.35.1 | 3-Clause BSD License | https://developers.google.com/protocol-buffers/ |
| flatbuffers | 25.12.19 | Apache Software License | https://google.github.io/flatbuffers/ |
| altgraph | 0.17.5 | MIT License | https://altgraph.readthedocs.io |
| pefile | 2024.8.26 | MIT | https://github.com/erocarrera/pefile |
| Pygments | 2.20.0 | BSD-2-Clause | https://pygments.org |
| markdown-it-py | 4.2.0 | MIT License | https://github.com/executablebooks/markdown-it-py |
| proxy_tools | 0.1.0 | MIT License | http://github.com/jtushman/proxy_tools |

---

## Nota sobre PyInstaller

PyInstaller (licencia GPLv2) es la herramienta de compilación. **No se distribuye** dentro del instalador final — solo se usa durante el proceso de build en el entorno de desarrollo.

---

## Nota sobre pynput (LGPLv3)

`pynput` usa LGPL v3. Se enlaza dinámicamente, lo que es compatible con distribución comercial siempre que el usuario pueda reemplazar la biblioteca. Los archivos `.dll` correspondientes están incluidos en el instalador.

---

*Para obtener los textos completos de cada licencia, visitar las URLs indicadas.*
