# Africa Directo · gestión de proyectos

Aplicación web para que los voluntarios de Africa Directo lleven los proyectos desde la solicitud de la contraparte hasta el cierre: registro, formulario para la contraparte (sin cuenta y en su idioma), revisión, búsqueda de financiación con varios donantes, estados y seguimiento. Los archivos viven en Google Drive; la app guarda los datos en Firestore.

El contexto completo (la ONG, el flujo y las decisiones de partida) está en [CLAUDE.md](CLAUDE.md) y el diseño de referencia en [design/](design/DESIGN.md). Documentación:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): cómo funciona el sistema, datos, seguridad y cómo funcionarán las plantillas de informes.
- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md): puesta en marcha paso a paso (Google Workspace, Firebase, Drive, Chat, OpenRouter y Vercel).
- [docs/INFORMES.md](docs/INFORMES.md): generar informes con IA y preparar plantillas propias en Google Docs.
- [docs/DRIVE.md](docs/DRIVE.md): estructura de carpetas de las unidades compartidas y permisos.
- [docs/CORREO.md](docs/CORREO.md): cómo llegan a la app los correos de las contrapartes, dado que el correo del dominio está en un hosting externo.

## Qué hace (fase 1: núcleo)

- **Acceso** con la cuenta de Google de la ONG. La primera vez queda en "acceso pendiente" hasta que un administrador lo aprueba. Tres permisos (lectura, edición, administración), comprobados siempre en el servidor.
- **Inicio**: avisos (sin noticias en más de 30 días, solicitudes por revisar, formularios sin responder), filtros de selección múltiple (estado, país, contraparte, año), tabla y mapa de OpenStreetMap con una tarjeta al pasar por cada punto.
- **Nueva solicitud**: da de alta la contraparte y el proyecto (código `P-AAAA-NNN`), crea su carpeta en Drive con las subcarpetas fijas y genera el enlace al formulario.
- **Proyecto añadido a mano** (al final de Proyectos): si la contraparte no puede usar el formulario, un voluntario rellena los mismos datos en un diálogo y el proyecto entra "En revisión" como una solicitud recibida (con su análisis y su PDF). La organización y el contacto salen de la contraparte; los documentos y fotos se añaden luego en la ficha.
- **Formulario de la contraparte** (`/f/<token>`): francés, inglés, portugués o español; una pista con ejemplo bajo cada casilla que puede dar dudas; país con bandera, que propone su moneda; presupuesto por líneas (concepto, descripción opcional e importe) y el total con su equivalente aproximado en euros; guardado automático en el dispositivo y en el servidor; fotos reducidas en el navegador; subida reanudable a Drive por trozos de 1 MiB.
- **Al enviarse**: nueva versión, paso a "En revisión", traducción y resumen con IA, aviso de lo que falta, PDF de la solicitud en `01_Solicitud` y aviso a Google Chat.
- **Revisión**: el revisor elige validar, pedir cambios (reabre el mismo enlace con los comentarios traducidos) o rechazar, y luego escribe el comentario, que cambia de sentido según la decisión. Mientras la contraparte no envíe otra versión, la última decisión se puede corregir (el comentario y su traducción) o deshacer. Las solicitudes solo se deciden desde Solicitudes: en la ficha, mientras son solicitud, solo se pueden cancelar.
- **Correos a las contrapartes**: la app no los envía. Prepara el texto en el idioma de la contraparte (enlace, cambios pedidos, rechazo) para que un voluntario lo copie y lo envíe desde el buzón de proyectos (ver [docs/CORREO.md](docs/CORREO.md)).
- **Ficha del proyecto**: resumen, archivos (carpetas, fotos publicables, informes y un diálogo para añadir archivos arrastrándolos), seguimiento (cronología y notas, con filtros por etiqueta y fechas), financiación (tres botones —compromiso, cobro recibido y envío a la contraparte— y lo comprometido, cobrado y enviado; pasa sola a "Aprobado" al cubrirse el presupuesto y vuelve a "Financiación" si deja de cubrirse) y versiones de la solicitud. Cada cambio de estado guarda quién, cuándo y por qué, y el último hecho a mano se puede deshacer (también Cancelado y Cerrado). Al pasar el ratón o tocar un estado se ve qué significa.
- **Informes con IA**: en Google Docs o Slides, a partir de plantillas de dos tipos: **informe de proyecto** (desde su ficha) y **resumen de proyectos** (desde Proyectos, con «Generar resumen»). Cada equipo crea las plantillas que necesite (seguimiento, final, la de un donante…), con las de la ONG como punto de partida; se revisan en Google y se descargan en PDF o Word para enviarlos (ver [docs/INFORMES.md](docs/INFORMES.md)). Desde Proyectos, también un libro de Google Sheets con los datos y resúmenes de los proyectos.
- **Donantes**: lista con filtros y analíticas (comprometido por donante y por tipo, cobrado y por cobrar, evolución por año) y ficha de cada donante con sus aportaciones y los informes que pide.
- **Contrapartes**: lista con filtros y analíticas y ficha de cada una con sus proyectos. Todos las ven; con permiso de edición se dan de alta y con administración se editan.
- **Analíticas**: en Proyectos, Donantes y Contrapartes, gráficas que siguen a los filtros; al pulsar una barra se filtra por ese valor.
- **Financiación como movimientos**: se registra lo que pasa —un donante se compromete, llega un cobro de un donante a AD, AD envía dinero a la contraparte—, con su fecha, y la app suma. Los cobros van por donante; los envíos, por proyecto (AD transfiere en sus propios plazos, sin atarlos a un donante). No se puede cobrar más de lo comprometido ni enviar más de lo cobrado. Todo se registra en euros y se comparan con el presupuesto en euros del proyecto (calculado con el cambio del día y corregible); el presupuesto de la solicitud se mantiene en su moneda.
- **Administración**: usuarios y permisos y estado de las integraciones y del uso de IA.
- **Cada noche**: copia de la base de datos en la unidad "Sistema" de Drive y, los lunes, resumen de pendientes en Google Chat.

Quedan para las siguientes fases: lectura del buzón de proyectos y bandeja de correos sin asignar (fase 2), presentaciones en Slides y plantillas de donante en Word o Excel (fase 3), y la ficha para donantes y estadísticas (fase 4).

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

Si además pones `OPENROUTER_API_KEY`, la traducción, el resumen y la redacción de informes funcionan de verdad.

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
    ia/                IA detrás de una interfaz propia (hoy OpenRouter)
    dominio/           Reglas de negocio: proyectos, solicitudes, aportaciones…
    acciones/          Acciones de servidor que llaman las pantallas
    formulario/        Textos en cuatro idiomas y validación del formulario
    sesion.ts          Sesión y permisos
    enlaces.ts         Enlaces firmados para las contrapartes
  componentes/         Piezas de interfaz compartidas (Desplegable: el selector de toda la app)
docs/DESPLIEGUE.md     Puesta en marcha paso a paso
```

Para cambiar de proveedor (por ejemplo, otra base de datos u otra IA) basta con añadir una implementación en `lib/almacen/`, `lib/drive/` o `lib/ia/`; el resto de la app no cambia.

## Decisiones que conviene conocer

- **Índice del panel en un solo documento** (`indices/proyectos`). El inicio, el mapa, los avisos y el contador de solicitudes salen de una única lectura, para no gastar la cuota diaria gratuita de Firestore (50.000 lecturas). Se actualiza con cada cambio de proyecto y se reconstruye cada noche.
- **Enlaces de las contrapartes firmados, no guardados.** El token es `id.firma` (HMAC con `ENLACES_SECRETO`). La base de datos guarda el id con su proyecto, caducidad (180 días) y revocación, pero no el token, y aun así la app puede volver a mostrar el enlace para reenviarlo. Cambiar el secreto invalida todos los enlaces.
- **Subida directa a Drive con plan B.** El servidor abre una sesión reanudable de Drive y el navegador intenta subir directo. Si el navegador no puede (CORS), los trozos pasan por la app, que nunca recibe más de 4 MiB por petición (límite de Vercel: 4,5 MB). Comprobado con Drive real (octubre de 2026): la subida directa desde el navegador funciona.
- **Donantes en el menú principal.** Las maquetas los ponen en Administración, pero los voluntarios con permiso de edición tienen que poder añadirlos al buscar financiación.
- **Sin IA no se inventa nada.** Si falta la clave de OpenRouter o falla, el resumen es el principio del texto de la contraparte y los avisos de "falta información" son comprobaciones automáticas.
- **`jwks-rsa` fijado en la versión 3 (`overrides` en `package.json`).** `firebase-admin` 14 trae `jwks-rsa` 4, que carga `jose` 6 (solo ESM) con `require()`. En Vercel eso falla con `ERR_REQUIRE_ESM` y no se puede entrar. La versión 3 usa `jose` 4, que sí funciona con `require()`, y la API que usa `firebase-admin` es la misma. Al actualizar `firebase-admin`, prueba `node --no-experimental-require-module -e "require('firebase-admin/auth')"`: si carga sin error, el override ya no hace falta.
