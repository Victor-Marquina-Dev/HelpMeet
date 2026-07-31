# Plan gratuito para llevar Helpmeet a celular

## Objetivo

Llevar Helpmeet al celular de la forma mas gratuita posible, sin romper la propuesta principal de la app: grabar y transcribir bien desde escritorio.

La recomendacion es crear una **PWA movil companera**:

```text
App desktop = graba, transcribe, procesa, organiza archivos
PWA movil = consulta, busca, lee resumenes, copia contexto, revisa proyectos
```

No conviene intentar que el celular haga todo lo que hace la app de Windows, porque hay limites tecnicos reales en navegador movil.

## Resumen corto

La mejor ruta gratis es:

1. Crear una version web/mobile del frontend.
2. Hacerla PWA instalable.
3. Empezar en modo "solo consulta".
4. Guardar datos en el navegador con IndexedDB.
5. Permitir importar/exportar paquetes `.json` o `.zip` desde la app desktop.
6. Mas adelante, si se quiere sync online, usar un backend free tier con limites.

## Que si se puede hacer gratis en celular

| Funcion | Viabilidad | Comentario |
|---|---|---|
| Ver proyectos | Alta | Datos locales o sincronizados |
| Ver reuniones | Alta | UI responsive |
| Leer transcripciones | Alta | Funciona perfecto como PWA |
| Buscar texto | Alta | Busqueda local en IndexedDB |
| Ver resumenes | Alta | Si ya vienen generados desde desktop |
| Ver tareas/decisiones | Alta | Si se guardan como datos estructurados |
| Copiar contexto | Alta | Copiar Markdown desde movil |
| Instalar icono en pantalla | Alta | PWA |
| Uso offline | Medio/alto | Con service worker + IndexedDB |
| Adjuntar notas manuales | Medio | Se puede guardar local y sincronizar luego |
| Grabar audio del microfono | Medio | Posible, pero limitado |
| Grabar Meet/Zoom completo | Bajo | En movil no es confiable |
| Capturar audio del sistema | Muy bajo | Navegador movil no lo permite como Windows |
| Whisper local en celular | Bajo | Pesado, lento y poco práctico |

## Que no conviene prometer en celular

No prometer en la version gratis movil:

- Capturar audio interno de Meet/Zoom/Teams.
- Grabar pantalla con audio del sistema de forma estable.
- Transcribir localmente con modelos Whisper grandes.
- Atajos globales.
- Guardar automáticamente en carpetas del sistema como en Windows.

El celular debe ser la extension de consulta y revision, no el motor principal de grabación.

## Modelo recomendado: PWA companera

### Nombre sugerido

```text
Helpmeet Mobile
```

O dentro del producto:

```text
Helpmeet Web Companion
```

### Funcion principal

La PWA debe responder a esta promesa:

> Consulta tus reuniones, resumenes y decisiones desde el celular sin instalar una app nativa.

## Arquitectura gratuita por fases

## Fase 1: PWA local/offline sin servidor

Esta es la opcion mas barata y segura.

### Como funciona

```text
Desktop Helpmeet
  exporta paquete
      |
      v
Archivo .json / .zip
      |
      v
PWA movil
  importa y guarda en IndexedDB
```

### Que incluye

- PWA estatica.
- `manifest.json`.
- `service-worker.js`.
- Base local en IndexedDB.
- Importar archivo exportado desde Helpmeet desktop.
- Pantallas responsive:
  - login local opcional;
  - proyectos;
  - reuniones;
  - transcripción;
  - resumen;
  - tareas/decisiones;
  - buscador.

### Ventajas

- Costo casi cero.
- No necesita backend.
- Funciona offline.
- No sube datos sensibles a la nube.
- Se puede desplegar gratis como sitio estatico.

### Desventajas

- No hay sincronizacion automatica.
- El usuario debe importar/exportar manualmente.
- Si cambia de celular, debe volver a importar.

### Uso ideal

Primera version mobile gratuita.

## Fase 2: Sync local por QR en la misma red

Esta fase mantiene privacidad y evita pagar nube.

### Como funciona

La app desktop levanta un servidor local temporal:

```text
PC con Helpmeet abierto
  http://192.168.x.x:PUERTO
        |
        | QR
        v
Celular conectado al mismo Wi-Fi
  abre PWA y sincroniza datos
```

### Flujo

1. En desktop: boton "Enviar al celular".
2. Helpmeet muestra QR.
3. El usuario escanea QR desde el celular.
4. El celular descarga proyectos/reuniones seleccionadas.
5. Los datos quedan guardados offline en la PWA.

### Ventajas

- Gratis.
- Privado.
- No requiere cuentas.
- No requiere base de datos cloud.
- Muy buena experiencia para uso personal.

### Desventajas

- PC y celular deben estar en la misma red.
- El PC debe estar encendido.
- Hay que proteger el enlace con token temporal.

### Seguridad mínima

- Token temporal de un solo uso.
- Expira en 5 minutos.
- Solo escucha en red local.
- Permitir elegir que proyecto/reunión compartir.
- No exponer rutas del disco directamente.

## Fase 3: Sync gratis con backend free tier

Esta fase sirve si quieres que el usuario consulte desde cualquier lugar.

### Opcion sugerida

```text
Frontend PWA: Cloudflare Pages o Vercel
Backend/database: Supabase free tier o tu backend existente
```

### Por que puede ser gratis al inicio

- Cloudflare Pages tiene plan gratuito para sitios estaticos y PWAs.
- Vercel tiene plan Hobby gratuito para proyectos personales.
- Supabase tiene plan gratuito con base de datos, Auth y Storage limitados.

Importante: estos planes cambian con el tiempo y tienen limites. Sirven para empezar, no para prometer costo cero permanente si el producto crece.

### Que se sincroniza

Sincronizar solo datos ligeros:

- proyectos;
- reuniones;
- transcripciones;
- resumenes;
- tareas;
- decisiones;
- notas;
- metadatos de video.

Evitar sincronizar gratis:

- videos completos;
- audios WAV;
- capturas pesadas sin comprimir.

Para archivos grandes, usar:

- exportación manual;
- compresion;
- limites por usuario;
- storage opcional de pago mas adelante.

## Fase 4: App movil nativa, solo si ya hay usuarios

No hacer al inicio.

Opciones:

- Capacitor: convierte PWA en app Android/iOS.
- React Native: mas trabajo, mas control.
- Flutter: redisenar mas.

Recomendacion: primero PWA. App nativa despues, si ya hay demanda real.

## Ruta tecnica recomendada

## Paso 1: Separar UI desktop de UI web

Hoy `app.js` habla con Python por `window.pywebview.api`.

Se necesita una capa adaptable:

```js
api.listInitiatives()
api.listMeetings()
api.getMeeting()
api.search()
```

Que pueda funcionar con:

```text
Desktop: pywebview.api
Mobile offline: IndexedDB
Mobile cloud: HTTP API
```

### Regla

Los botones de grabación deben ocultarse en mobile.

```text
Desktop: grabar, capturar, importar, transcribir
Mobile: consultar, buscar, copiar, marcar, comentar
```

## Paso 2: Crear modo mobile

Detectar modo:

```js
const IS_MOBILE_WEB = !window.pywebview && matchMedia('(max-width: 720px)').matches;
```

Pero mejor:

```js
STATE.platform = 'desktop' | 'web' | 'mobile';
```

## Paso 3: Crear layout responsive

### Mobile shell

```text
Topbar compacta
  Helpmeet
  buscar

Main
  lista/proyecto/reunión

Bottom nav
  Proyectos
  Buscar
  Favoritos
  Ajustes
```

### Cambios clave

- Sidebar desktop pasa a bottom nav.
- Actionbar inferior desktop se oculta o cambia a acciones contextuales.
- Modales grandes pasan a bottom sheets.
- Tablas/listas se vuelven cards compactas.

## Paso 4: Crear almacenamiento local mobile

Usar IndexedDB.

Estructura sugerida:

```text
db: helpmeet_mobile

stores:
  projects
  meetings
  utterances
  notes
  captures_meta
  summaries
  tasks
  decisions
  sync_log
```

No guardar videos grandes al inicio.

## Paso 5: Export desktop compatible

Agregar en desktop:

```text
Exportar para celular
```

Debe crear:

```text
helpmeet-mobile-export.zip
  manifest.json
  projects.json
  meetings.json
  utterances.json
  summaries.json
  tasks.json
  decisions.json
  captures/
```

Version simple:

```text
helpmeet-mobile-export.json
```

## Paso 6: Importar en PWA

En mobile:

```text
Importar archivo
Seleccionar .json/.zip
Guardar en IndexedDB
Mostrar proyectos
```

## Paso 7: Busqueda local

Primera version:

- busqueda por texto exacto;
- filtro por proyecto;
- filtro por fecha;
- favoritos.

Mas adelante:

- busqueda semantica en servidor;
- embeddings;
- preguntas tipo "que se decidio sobre X".

## Diseño mobile recomendado

### Pantalla inicio

Debe mostrar:

- Proyectos recientes.
- Reuniones recientes.
- Accion "Importar desde Helpmeet".
- Estado offline/actualizado.

### Proyecto

```text
Header:
  Avatar + nombre proyecto
  N reuniones

Tabs:
  Reuniones | Resumen | Tareas | Decisiones
```

### Reunion

```text
Titulo
Fecha
Resumen corto
Chips: decisiones, tareas, capturas
Transcripcion colapsable
Boton copiar contexto
```

### Buscar

```text
Input grande
Filtros chips
Resultados por reunión
```

### Bottom nav

```text
Proyectos | Buscar | Favoritos | Ajustes
```

## Funciones gratuitas de alto valor

1. **Leer reuniones en el celular**
   - Maximo valor inicial.

2. **Copiar contexto para WhatsApp/Correo/Claude**
   - Muy util en mobile.

3. **Favoritos**
   - Marcar reuniones importantes.

4. **Tareas/decisiones**
   - Revisar pendientes desde el celular.

5. **Compartir resumen**
   - Generar texto corto y copiarlo.

6. **Modo offline**
   - Acceso sin internet a lo importado.

7. **QR local**
   - Sin nube, gratis y privado.

## Que evitar en la primera version

- Grabar reuniones desde el celular.
- Subir videos grandes.
- Chat con IA en mobile.
- Sincronizacion bidireccional compleja.
- Notificaciones push.
- App nativa en Play Store/App Store.
- Login si no hay backend.
- Multiusuario.

## Stack gratuito recomendado

### Sin nube

```text
Frontend: PWA estatica
Storage: IndexedDB
Deploy: Cloudflare Pages / Vercel / GitHub Pages
Sync: import/export o QR local
Costo: 0 mientras no uses backend pago
```

### Con nube free tier

```text
Frontend: Cloudflare Pages o Vercel
Auth + DB: Supabase free tier
Archivos: evitar videos; guardar solo datos ligeros
Backend: Supabase Edge Functions o backend existente en Railway
```

## Costos y limites a considerar

Aunque la meta sea gratis, hay que disenar con limites:

- Los planes gratis pueden cambiar.
- Si guardas videos, se llenara el storage rapido.
- Si agregas transcripción en nube, ya no sera gratis.
- Si agregas muchos usuarios, necesitaras plan pago.
- iOS tiene limitaciones mas estrictas para PWAs que Android.

## Privacidad

Tres modos posibles:

### Modo privado local

```text
Desktop exporta -> Celular importa
```

Los datos no salen a internet.

### Modo red local

```text
Desktop muestra QR -> Celular sincroniza por Wi-Fi
```

Los datos solo viajan dentro de la red local.

### Modo nube

```text
Desktop sube -> Servidor -> Celular descarga
```

Mas comodo, pero requiere politicas de privacidad claras.

## Seguridad mínima

Para PWA offline:

- Bloqueo opcional con PIN local.
- Boton "Borrar datos del celular".
- No guardar product keys ni tokens sensibles.

Para QR local:

- Token temporal.
- Expiracion.
- Confirmacion en desktop.
- Permitir cancelar sesión.

Para nube:

- Auth por email.
- HTTPS.
- Reglas por usuario.
- No exponer datos de otros clientes.
- Cifrar secretos.

## Roadmap recomendado

### Version 0.1 - Mobile offline gratis

- PWA instalable.
- Importar JSON.
- Ver proyectos.
- Ver reuniones.
- Ver transcripción.
- Buscar texto.
- Copiar contexto.

### Version 0.2 - Mobile mas util

- Favoritos.
- Resumen por reunión.
- Tareas/decisiones.
- Filtros por fecha/proyecto.
- Borrar datos locales.

### Version 0.3 - QR local

- Desktop genera QR.
- Celular importa desde PC.
- Token temporal.
- Seleccionar proyecto/reunión a enviar.

### Version 0.4 - Sync cloud opcional

- Cuenta de usuario.
- Subida automatica desde desktop.
- Consulta desde cualquier lugar.
- Limites por plan.

### Version 1.0 - Mobile companion oficial

- PWA pulida.
- Responsive completo.
- Offline.
- Sync manual/QR.
- Cloud opcional.

## Cambios necesarios en el proyecto actual

### Frontend

- Separar `api` en adaptadores:
  - `PywebviewAdapter`
  - `IndexedDbAdapter`
  - `HttpAdapter`
- Crear layout mobile.
- Ocultar funciones desktop.
- Agregar `manifest.json`.
- Agregar `service-worker.js`.
- Agregar pantalla "Importar datos".

### Backend desktop

- Agregar export mobile JSON.
- Agregar servidor QR local opcional.
- Crear endpoint local temporal:

```text
GET /mobile-export?token=...
```

### Datos

Definir contrato estable:

```json
{
  "version": 1,
  "exported_at": "2026-07-08T10:00:00",
  "projects": [],
  "meetings": [],
  "utterances": [],
  "summaries": [],
  "tasks": [],
  "decisions": []
}
```

## Criterios de exito

La primera version se considera buena si:

- Se instala como PWA en Android.
- Abre en iPhone Safari.
- Importa un archivo generado por desktop.
- Permite leer y buscar reuniones sin internet.
- Copia contexto en Markdown.
- No rompe la app desktop.
- No tiene costo fijo mensual.

## Recomendacion final

No intentes llevar todo Helpmeet al celular desde el inicio.

La mejor version gratuita es:

```text
Helpmeet desktop sigue siendo el motor.
Helpmeet mobile es una PWA de consulta offline.
```

Luego agregas sincronizacion por QR local. Solo despues, si hay usuarios reales que lo pidan, agregas nube.

Este camino mantiene:

- costo cero inicial;
- privacidad;
- menor complejidad;
- valor real en celular;
- posibilidad de crecer a cloud o app nativa despues.

## Fuentes a validar antes de desplegar

- Cloudflare Pages: plan gratuito para sitios estaticos/PWA.
- Vercel Hobby: plan gratuito para proyectos personales.
- Supabase Free: base de datos/Auth/Storage con limites.

Los limites exactos deben revisarse antes de publicar porque pueden cambiar.

