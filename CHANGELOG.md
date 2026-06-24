# Changelog

Todas las versiones notables de Helpmeet. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y
[Versionado Semántico](https://semver.org/lang/es/).

## [0.1.0] — 2026-06-24

Primera versión empaquetada para Windows.

### Añadido
- **Grabación de reuniones**: micrófono y audio del sistema en pistas separadas.
- **Grabación de pantalla** con cambio de monitor en caliente y guardado del
  vídeo en **segundo plano** (no bloquea la app).
- **Transcripción local** con Whisper (faster-whisper); calidad seleccionable.
- **Participantes por iniciativa**: nombres reales en las frases, asignación de
  hablante y nombres también en el contexto exportado.
- **Organización** por iniciativa, mes y reunión; **anclar** iniciativas.
- **Edición** de la transcripción: editar texto, cambiar hablante, marcar frases
  importantes y eliminar.
- **Capturas** con miniatura y zoom, y **notas** ancladas al momento exacto.
- **Búsqueda** dentro de una transcripción y dentro de una iniciativa.
- **Exportación** del contexto a Markdown (y texto/paquete) para usar con Claude.
- **Recuperación** de grabaciones tras un cierre inesperado.
- **Pantalla de diagnóstico**: disco, modelo, micrófono, audio del sistema,
  WebView2 y carpeta de exportación.
- **Privacidad**: todo es local; copia de seguridad de la base, borrado total de
  datos y aviso de consentimiento antes de la primera grabación.
- **Instalador** de Windows por usuario (Inno Setup), con detección de WebView2.

### Seguridad
- La API key (uso futuro) se guarda en el Administrador de credenciales de
  Windows, no en texto plano.

### Notas
- La transcripción en la nube (Replicate) está **deshabilitada**: todo el
  procesamiento ocurre en tu equipo.
- El ejecutable aún **no está firmado**; Windows SmartScreen mostrará un aviso de
  "editor desconocido" la primera vez (ver `docs/GUIA_INSTALACION.md`).
