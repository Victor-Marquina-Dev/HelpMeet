# Política de privacidad — Helpmeet

_Última actualización: 2026-06-24_

Helpmeet es una aplicación de escritorio que graba reuniones y pantalla, las
transcribe y organiza el contenido. Esta política explica qué datos maneja y
dónde se guardan.

## Resumen

- **Todo se procesa y se guarda en tu propio equipo.** Helpmeet no tiene
  servidores propios ni envía tus grabaciones, transcripciones o notas a
  ningún sitio.
- La transcripción se hace **localmente** con Whisper (faster-whisper). La
  transcripción en la nube está **deshabilitada**.
- No hay cuentas, ni registro, ni telemetría, ni analítica.

## Qué datos maneja Helpmeet

- **Audio del micrófono y del sistema** durante una grabación.
- **Vídeo de pantalla**, si grabas la pantalla.
- **Capturas** que tomes durante una reunión.
- **Transcripciones, notas y nombres de participantes** que generes o edites.
- **Ajustes** de la aplicación.

## Dónde se guardan

Todos los datos personales se guardan en tu equipo, en:

```
%LOCALAPPDATA%\Helpmeet\
```

(base de datos `helpmeet.sqlite`, `settings.json`, `captures/`, `recovery/`).
Las exportaciones (Markdown, vídeos, paquetes ZIP) se guardan en la carpeta de
exportación que tú elijas.

Ningún dato sale de tu equipo a menos que **tú** lo compartas (por ejemplo, al
copiar el contexto para pegarlo en Claude, o al exportar a una carpeta).

## Grabación de otras personas

Grabar una conversación puede requerir el **consentimiento** de las demás
personas según las leyes de tu país o región. Eres responsable de obtener ese
consentimiento antes de grabar. Helpmeet te lo recuerda antes de tu primera
grabación.

## Control sobre tus datos

Desde **Ajustes → Privacidad y datos** puedes:

- **Crear una copia de seguridad** de tu contenido (base de datos y ajustes).
- **Borrar todos los datos locales** y dejar la app como recién instalada. Esta
  acción no se puede deshacer y no toca tu carpeta de exportación.

También puedes eliminar tus datos manualmente borrando la carpeta
`%LOCALAPPDATA%\Helpmeet`.

## Servicios de terceros

Helpmeet funciona **sin conexión** para sus funciones principales. Solo se
conecta a internet para descargar, una única vez, el modelo de transcripción
Whisper desde Hugging Face. No se envía ningún dato personal en esa descarga.

## Contacto

Para dudas sobre privacidad, contacta con el editor: **MimoTech**.
