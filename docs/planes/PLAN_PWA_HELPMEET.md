# Plan: convertir Helpmeet en una PWA (Progressive Web App)

**Fecha:** 2026-07-02
**Estado:** propuesta / para decidir
**Autor:** análisis técnico para Víctor

---

## 0. En una frase

Sí se puede llevar Helpmeet al navegador, **pero hay tres funciones del núcleo que un
navegador no puede hacer igual que la app de escritorio**. Este documento explica qué
es una PWA, qué se puede y qué no, tres caminos posibles, y cuál recomiendo.

---

## 1. ¿Qué es una PWA? (sin tecnicismos)

Una **PWA** es una página web que se comporta como una app:

- Se abre en el navegador (Chrome, Edge…) desde una dirección web.
- El usuario puede pulsar **"Instalar"** y le queda un icono en el escritorio o el móvil,
  como si fuera un programa normal.
- Funciona en Windows, Mac, Android e iPhone **sin instalar nada** desde el navegador.
- Puede funcionar parcialmente sin internet (guarda datos en el propio navegador).

**Analogía:** hoy Helpmeet es como un electrodoméstico que enchufas en tu casa (tu PC).
Una PWA sería como Netflix: entras a una web, y opcionalmente "la instalas" para tenerla
a mano, pero por dentro depende de un servidor.

---

## 2. El choque de fondo: qué hace Helpmeet que el navegador NO permite

Helpmeet no es una app "de formularios". Hace cosas de sistema. Estas son las piezas
que revisé en el código y su situación en un navegador:

| Función de Helpmeet | Cómo lo hace hoy (escritorio) | ¿Se puede en el navegador? |
|---|---|---|
| **Capturar el audio del sistema** (lo que dicen los demás en Meet) | `pyaudiowpatch` (loopback WASAPI de Windows) | ⚠️ **Muy limitado.** El navegador solo captura el micrófono. Para el audio de los demás hay que compartir la pestaña/pantalla con "compartir audio" activado, y solo funciona bien en Chrome/Edge de escritorio. En móvil, no. |
| **Transcribir con Whisper local** | `faster-whisper` + modelos de 145 MB a 3 GB en tu disco | ❌ **No en el navegador.** Los modelos grandes no corren dentro de una pestaña. Habría que transcribir en un **servidor en la nube** (coste por minuto) o con un modelo pequeño y lento en el navegador. |
| **Grabar video de la reunión** | Grabación de pantalla nativa | ⚠️ Se puede con permiso explícito del usuario **cada vez** (`getDisplayMedia`), menos cómodo. |
| **Atajo global para captura de pantalla** | Hotkey del sistema | ❌ Imposible: el navegador no deja capturar teclas globales fuera de su ventana. |
| **Guardar grabaciones y exportar a carpeta** | Escribe archivos WAV/exports en tu disco | ⚠️ Limitado: descargas manuales o "File System Access API" (solo Chrome/Edge). |
| **Base de datos local** (reuniones, proyectos) | SQLite en tu PC | ✅ Se reemplaza por base de datos en el navegador (IndexedDB) o en un servidor. |
| **Licencia por dispositivo** | Activación ligada al equipo | 🔄 Cambia: en web se ligaría a una cuenta con email/contraseña, no a un PC. |
| **La interfaz (pantallas, botones)** | HTML/CSS/JS servido por `pywebview` | ✅ **Esto es lo fácil:** la interfaz ya es web, se reaprovecha casi entera. |

**Conclusión de esta tabla:** lo visual (la parte más grande en horas de trabajo) ya está
hecho en web. Lo que rompe es **el corazón del producto**: capturar el audio de los demás
y transcribir en tu propio equipo con privacidad total.

---

## 3. Tres caminos posibles

### Camino A — PWA "pura" (todo en la nube)

Todo pasa a la web y a un servidor.

- **Cómo grabaría:** el usuario comparte la pestaña de Meet con audio; el navegador
  sube ese audio a un servidor; el servidor transcribe (p. ej. con el servicio que ya
  usáis, Replicate, o un backend propio con Whisper).
- **Ganas:** cero instalación, funciona en cualquier equipo, posible uso en móvil,
  actualizaciones instantáneas (subes una vez, todos tienen la última versión).
- **Pierdes:**
  - **Privacidad total** (hoy el audio no sale del PC; en la nube, sí sale).
  - Captura de audio robusta (depende de que el usuario comparta bien la pestaña).
  - Coste recurrente de servidor/transcripción por minuto de reunión.
- **Para quién tiene sentido:** si el objetivo es "que se use sin instalar y desde
  cualquier sitio, incluido móvil", y la privacidad local deja de ser el argumento de venta.

### Camino B — Híbrido (RECOMENDADO)

La app de escritorio sigue siendo la que **graba y transcribe** (donde está su fuerza),
y se añade una **PWA de consulta**.

- **Escritorio (como hoy):** captura audio del sistema, transcribe con Whisper local,
  graba video. Nada cambia en lo delicado.
- **PWA nueva (web):** un panel al que entras desde el navegador o el móvil para
  **ver, buscar y gestionar** las reuniones ya transcritas, leer resúmenes, copiar el
  contexto para Claude, gestionar proyectos y participantes.
- **Ganas:** consultas tus reuniones desde el móvil o cualquier PC sin perder la
  privacidad ni la calidad de la grabación. Reaprovechas casi toda la interfaz actual.
- **Pierdes:** poco; sigue habiendo una app que instalar para grabar (pero eso ya lo hay).
- **Para quién tiene sentido:** si quieres movilidad y comodidad **sin renunciar** a lo
  que hace único a Helpmeet.

### Camino C — Aclaración importante: "instalable" ≠ PWA

Mucha gente que pide "PWA" en realidad quiere **"que se instale fácil y funcione en
Mac también"**. Si ese es el objetivo real, la respuesta no es una PWA, sino cambiar el
envoltorio de escritorio (por ejemplo **Tauri** o **Electron**), manteniendo todas las
capacidades nativas. Ya existe un plan aparte para Mac
(`docs/planes/PLAN_HABILITAR_MACOS_HELPMEET.md`). **Esto conserva audio del sistema y
Whisper local**, cosa que la PWA no.

---

## 4. Arquitectura recomendada (Camino B, en dibujo)

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  App de escritorio (hoy)    │        │   PWA de consulta (nueva)     │
│  - Captura audio sistema    │        │   - Ver / buscar reuniones    │
│  - Whisper local            │  sube  │   - Leer resúmenes            │
│  - Graba video              │ ─────► │   - Copiar contexto Claude    │
│  - Genera transcripción     │  datos │   - Gestionar proyectos       │
└─────────────────────────────┘        └──────────────────────────────┘
              │                                        ▲
              │        ┌────────────────────┐          │
              └──────► │  Servidor / API     │ ─────────┘
                       │  (reuniones, users) │
                       │  ya tenéis Railway  │
                       └────────────────────┘
```

- El servidor puede ser el **mismo Railway** que ya usáis para licencias.
- La app de escritorio, al terminar una reunión, **sube el resultado** (transcripción,
  resumen, metadatos) al servidor.
- La PWA lee del servidor. **No graba ni transcribe**; solo muestra.

---

## 5. Pasos concretos (Camino B)

### Fase 0 — Preparar la interfaz para vivir fuera de `pywebview`
Hoy la interfaz habla con Python por un "puente" interno (`api.*`). Para que las mismas
pantallas funcionen en un navegador normal, ese puente debe poder ser también **llamadas
web (HTTP)**.

- [ ] Localizar todas las llamadas `api.*` en `helpmeet/ui/web/app.js`.
- [ ] Crear una capa que, según dónde corra, use el puente de escritorio **o** peticiones
      web al servidor.
- [ ] Marcar qué funciones son "solo escritorio" (grabar) y cuáles son "compartibles"
      (ver, buscar, gestionar).

### Fase 1 — Servidor: guardar y servir reuniones
- [ ] Añadir al backend (Railway) tablas/endpoints para reuniones, proyectos, resúmenes.
- [ ] Cuentas de usuario con email + contraseña (para entrar desde la web/móvil).
- [ ] Endpoint para que la app de escritorio **suba** una reunión terminada.

### Fase 2 — La PWA en sí
- [ ] Servir la interfaz web como sitio (no dentro de `pywebview`).
- [ ] Añadir los dos archivos que convierten una web en PWA:
  - **`manifest.json`** (nombre, icono, colores — ya tenéis el logo y la paleta sage).
  - **Service Worker** (permite instalarla y que cargue sin conexión).
- [ ] Pantalla de login web.
- [ ] Modo "solo lectura": ocultar los botones de grabar en la versión web.

### Fase 3 — Sincronización escritorio → web
- [ ] Que la app de escritorio suba automáticamente al terminar cada reunión.
- [ ] Manejar el caso "sin internet": subir cuando vuelva la conexión.

### Fase 4 — Pulido PWA
- [ ] Probar instalación en Windows, Mac, Android, iPhone.
- [ ] Adaptar el diseño a pantalla de móvil (responsive).
- [ ] Iconos e imagen de instalación.

---

## 6. Esfuerzo y riesgos (estimación gruesa)

| Camino | Esfuerzo | Riesgo principal |
|---|---|---|
| A (PWA pura) | **Alto** | Perder la privacidad local rompe el argumento de venta; coste de servidor por minuto. |
| B (híbrido) | **Medio** | Mantener dos frentes (escritorio + web) sincronizados. |
| C (Tauri/Electron) | **Medio** | No es PWA; es re-empaquetar. Conserva todo lo nativo. |

**Nota sobre privacidad:** hoy Helpmeet puede venderse como *"tu audio nunca sale de tu
PC"*. Los caminos A y (en parte) B suben datos a un servidor. Antes de decidir, conviene
tener claro si eso afecta a lo que prometéis a los clientes y a los documentos legales
(`docs/legal/PRIVACIDAD.md`).

---

## 7. Recomendación

1. **Si quieres movilidad y comodidad sin perder lo que hace único a Helpmeet → Camino B**
   (app de escritorio que graba + PWA para consultar). Es el mejor equilibrio.
2. **Si el objetivo real era "que se instale fácil y funcione en Mac" → Camino C**
   (Tauri/Electron), no una PWA.
3. **Camino A (PWA pura) solo si** aceptas transcribir en la nube y que la privacidad
   local deje de ser el foco.

---

## 8. Preguntas para decidir el rumbo

Antes de escribir una sola línea de código nuevo, conviene que respondas:

1. ¿Qué te importa más: **no instalar nada / usar desde el móvil**, o **mantener la
   privacidad de que el audio no salga del PC**?
2. ¿La PWA sería para **grabar reuniones** o solo para **consultar** las ya grabadas?
3. ¿Aceptarías un **coste mensual de servidor** por transcribir en la nube?
4. Cuando dijiste "PWA", ¿pensabas en *"web instalable"* o en *"que se instale fácil y
   funcione en Mac"* (que sería el Camino C)?

Con esas cuatro respuestas puedo convertir este documento en un plan de ejecución
detallado del camino elegido.
