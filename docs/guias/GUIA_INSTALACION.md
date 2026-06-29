# Guía de instalación — Helpmeet

Guía breve para instalar y abrir Helpmeet en un PC con Windows.

## Requisitos

- **Windows 10 o 11 de 64 bits.**
- **Conexión a internet la primera vez** (para descargar el modelo de
  transcripción, ~480 MB). Después funciona sin conexión.
- **Micrófono** para grabar reuniones.
- Espacio en disco: ~1 GB para la app y el modelo, más lo que ocupen tus
  grabaciones (los vídeos pueden ser varios GB).

## Instalación

### Opción A — Instalador (recomendado)
1. Ejecuta `Helpmeet-Setup-<versión>.exe`.
2. Si falta WebView2, el instalador lo instala automáticamente.
3. Al terminar, abre Helpmeet desde el menú Inicio.

### Opción B — Carpeta portátil (ZIP)
1. Descomprime la carpeta `Helpmeet` donde quieras.
2. Abre `Helpmeet.exe`.
3. Si la interfaz no carga, instala el **WebView2 Runtime (Evergreen)** de
   Microsoft: https://developer.microsoft.com/microsoft-edge/webview2/

## Aviso de Windows al abrir (importante)

La primera vez, Windows puede mostrar una pantalla azul:

> **"Windows protegió tu PC"** · editor desconocido

Esto **no es un virus**: solo significa que el programa aún no está firmado con
un certificado. Para abrirlo:

1. Pulsa **"Más información"**.
2. Pulsa **"Ejecutar de todas formas"**.

## Primer uso

1. Abre Helpmeet y entra en **Diagnóstico** (en la pantalla de bienvenida) para
   comprobar que el micrófono, el audio del sistema y el disco están listos.
2. Crea una **iniciativa**, luego **graba** una reunión o la pantalla.
3. La primera transcripción descargará el modelo (una sola vez).

## Privacidad

Todo se guarda y se procesa **en tu equipo**. Helpmeet no envía tus grabaciones
ni transcripciones a ningún servidor. Tus datos están en
`%LOCALAPPDATA%\Helpmeet`. Consulta `docs/PRIVACIDAD.md`.
