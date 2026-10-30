# Africa Directo · gestión de proyectos

Aplicación web para que los voluntarios de Africa Directo lleven los proyectos desde la solicitud de la contraparte hasta el cierre: registro, formulario para la contraparte (sin cuenta y en su idioma), revisión, búsqueda de financiación con varios donantes, estados y seguimiento. Los archivos viven en Google Drive; la app guarda los datos en Firestore.

El contexto completo (la ONG, el flujo y las decisiones de partida) está en [CLAUDE.md](CLAUDE.md) y el diseño de referencia en [design/](design/DESIGN.md). Documentación:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): cómo funciona el sistema, datos, seguridad y cómo funcionarán las plantillas de informes.
- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md): puesta en marcha paso a paso (Google Workspace, Firebase, Drive, Apps Script, Chat, OpenAI y Vercel).
- [docs/DRIVE.md](docs/DRIVE.md): estructura de carpetas de las unidades compartidas y permisos.
- [docs/CORREO.md](docs/CORREO.md): cómo llegan a la app los correos de las contrapartes, dado que el correo del dominio está en un hosting externo.

## Qué hace (fase 1: núcleo)

- **Acceso** con la cuenta de Google de la ONG. La primera vez queda en "acceso pendiente" hasta que un administrador lo aprueba. Tres permisos (lectura, edición, administración), comprobados siempre en el servidor.
- **Inicio**: avisos (sin noticias en más de 30 días, solicitudes por revisar, formularios sin responder), filtros, tabla y mapa de OpenStreetMap.
- **Nueva solicitud**: da de alta la contraparte y el proyecto (código `P-AAAA-NNN`), crea su carpeta en Drive con las subcarpetas fijas y genera el enlace al formulario.
- **Formulario de la contraparte** (`/f/<token>`): francés, inglés, portugués o español; guardado automático en el dispositivo y en el servidor; fotos reducidas en el navegador; subida reanudable a Drive por trozos de 1 MiB.
- **Al enviarse**: nueva versión, paso a "En revisión", traducción y resumen con IA, aviso de lo que falta, PDF de la solicitud en `01_Solicitud` y aviso a Google Chat.
- **Revisión**: validar, pedir cambios (reabre el mismo enlace con los comentarios traducidos) o rechazar.
- **Ficha del proyecto**: resumen, seguimiento (cronología y notas), financiación (aportaciones por donante; pasa sola a "Aprobado" al cubrirse el presupuesto), archivos (carpetas y fotos publicables) y versiones de la solicitud. Cada cambio de estado guarda quién, cuándo y por qué.
- **Donantes**: ficha de cada donante con sus aportaciones e informes que pide.
- **Administración**: usuarios y permisos, contrapartes y estado de las integraciones y del uso de IA.
- **Cada noche**: copia de la base de datos en la unidad "Sistema" de Drive y, los lunes, resumen de pendientes en Google Chat.

Quedan para las siguientes fases: lectura del buzón de proyectos con Apps Script y bandeja de correos sin asignar (fase 2), informes y presentaciones con IA en Google Docs y Slides (fase 3), y la ficha para donantes y estadísticas (fase 4).

## Probarla en local (modo demo)

Necesitas [Node.js](https://nodejs.org) 24 (la misma versión que usa Vercel, fijada en `package.json`).

```bash
npm install
```

```bash
cp .env.example .env.local
```

En `.env.local`, pon `MODO_DEMO=1`. Luego:

```bash
npm run dev
```

Abre <http://localhost:3000>. En modo demo no hace falta Google ni Firebase: se entra eligiendo un usuario de ejemplo, los datos se guardan en la carpeta `.datos/` y Drive se imita con carpetas en disco. No se envían correos (se muestran en la consola). Para empezar de cero, borra `.datos/`.

Si además pones `OPENAI_API_KEY`, la traducción y el resumen funcionan de verdad.

## Comprobaciones

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

## Cómo está organizado

```
src/
  app/                 Pantallas y API (Next.js, App Router)
    (app)/             Pantallas internas: inicio, solicitudes, ficha, donantes, administración
    acceso/            Entrar con Google
    f/[token]/         Formulario público de la contraparte
    api/f/…            API del formulario (borrador, subidas, envío)
    api/sesion/        Abre la sesión tras entrar con Google
    api/cron/diario/   Copia nocturna y recordatorios (cron de Vercel)
  lib/
    almacen/           Acceso a datos: Firestore o fichero local (demo)
    drive/             Google Drive por su API REST, o disco (demo)
    ia/                IA detrás de una interfaz propia (hoy OpenAI)
    dominio/           Reglas de negocio: proyectos, solicitudes, aportaciones…
    acciones/          Acciones de servidor que llaman las pantallas
    formulario/        Textos en cuatro idiomas y validación del formulario
    sesion.ts          Sesión y permisos
    enlaces.ts         Enlaces firmados para las contrapartes
  componentes/         Piezas de interfaz compartidas
apps-script/           Código de Apps Script (envío de correos)
docs/DESPLIEGUE.md     Puesta en marcha paso a paso
```

Para cambiar de proveedor (por ejemplo, otra base de datos u otra IA) basta con añadir una implementación en `lib/almacen/`, `lib/drive/` o `lib/ia/`; el resto de la app no cambia.

## Decisiones que conviene conocer

- **Índice del panel en un solo documento** (`indices/proyectos`). El inicio, el mapa, los avisos y el contador de solicitudes salen de una única lectura, para no gastar la cuota diaria gratuita de Firestore (50.000 lecturas). Se actualiza con cada cambio de proyecto y se reconstruye cada noche.
- **Enlaces de las contrapartes firmados, no guardados.** El token es `id.firma` (HMAC con `ENLACES_SECRETO`). La base de datos guarda el id con su proyecto, caducidad (180 días) y revocación, pero no el token, y aun así la app puede volver a mostrar el enlace para reenviarlo. Cambiar el secreto invalida todos los enlaces.
- **Subida directa a Drive con plan B.** El servidor abre una sesión reanudable de Drive y el navegador intenta subir directo. Si el navegador no puede (CORS), los trozos pasan por la app, que nunca recibe más de 4 MiB por petición (límite de Vercel: 4,5 MB). Comprobado con Drive real (octubre de 2026): la subida directa desde el navegador funciona.
- **Donantes en el menú principal.** Las maquetas los ponen en Administración, pero los voluntarios con permiso de edición tienen que poder añadirlos al buscar financiación.
- **Sin IA no se inventa nada.** Si falta la clave de OpenAI o falla, el resumen es el principio del texto de la contraparte y los avisos de "falta información" son comprobaciones automáticas.
