# Africa Directo — sistema de gestión de proyectos

Este documento da contexto a quien desarrolle el sistema (persona o agente). Recoge lo decidido hasta ahora: la arquitectura general, los recursos disponibles y cómo funciona la ONG. **No es una especificación cerrada.** Dentro de estas líneas generales, toma las decisiones de detalle que mejor sirvan al objetivo. Si algo de aquí parece mala idea al implementarlo, propón la alternativa y explica por qué.

## La organización

Africa Directo es una ONG española que financia proyectos en varios países de África: aulas, escuelas, hospitales, dispensarios, pozos, placas solares, talleres de formación… Su lema es **"el 100 % llega"**: todo lo recaudado va al destino.

- **Todo son voluntarios.** No hay personal contratado; cada persona dedica tiempo irregular y la gente rota.
- **Coste cero.** La infraestructura debe ser gratuita o prácticamente gratuita. El único gasto aceptado es la IA, del orden de 1 $ al mes.
- **Usuarios de perfil no técnico.** La herramienta debe ser muy simple de usar.
- **Objetivo:** automatizar el papeleo para que los voluntarios solo decidan y revisen: organizar archivos, archivar correos, traducir, resumir, avisar y preparar borradores de informes con IA.

## Quién usa el sistema

| Usuario | Qué hace | Cómo accede |
| --- | --- | --- |
| Voluntarios | Revisan propuestas, buscan financiación, siguen la ejecución, aprueban informes | Web app con su cuenta de Google Workspace de la ONG |
| Contrapartes locales (normalmente congregaciones religiosas) | Envían la solicitud, documentos, fotos y avances | Enlace seguro sin cuenta, o por correo. Suelen escribir en francés, inglés o portugués, a menudo con conexión lenta o intermitente |
| Donantes (fundaciones, empresas, particulares, entidades públicas) | Reciben presentaciones e informes, a veces con su propia plantilla | Reciben documentos; no usan la app de momento |

## Flujo de un proyecto

1. Una **contraparte local comunica una necesidad**, normalmente por correo.
2. Un voluntario la registra y se envía a la contraparte un **formulario** con los datos del proyecto: ubicación, país, datos de la contraparte, descripción, presupuesto aproximado, documentos y fotos.
3. Al enviarlo, se crea una **propuesta de proyecto**.
4. Un **revisor** la valora: la valida, pide cambios a la contraparte (que corrige sobre el mismo formulario, generando una nueva versión) o la rechaza.
5. **Búsqueda de financiación.** Se contacta a donantes y se les envía una presentación o ficha del proyecto. Un proyecto puede financiarse entre varios donantes.
6. Cuando la financiación cubre el presupuesto, el proyecto queda **aprobado** y pasa por sus fases de ejecución: en ejecución, parado, completado, cerrado.
7. Durante la ejecución, la contraparte **envía fotos, documentos y correos** con avances o incidencias. Todo debe acabar ordenado en la carpeta del proyecto en Drive y en su cronología.
8. Los donantes piden **informes de seguimiento y final**, con su propia plantilla o con la de la ONG. La IA prepara borradores editables que un voluntario revisa antes de enviarlos.

Ciclo de estados acordado:

```
Solicitud → En revisión → Validada → Financiación → Aprobado → En ejecución → Completado → Cerrado
                ↓ (pide cambios: vuelve a Solicitud)                  ↕ Parado
            Rechazada                                   (Cancelado posible desde cualquier estado)
```

Se distinguen dos aprobaciones: la propuesta queda **Validada** tras la revisión interna, y el proyecto pasa a **Aprobado** cuando los donantes comprometen el 100 % del presupuesto. Cada cambio de estado guarda quién, cuándo y por qué.

### Ejemplo de principio a fin

Un aula para una escuela de Kinshasa, de 18.000 €, con dos donantes:

1. La hermana responsable escribe a proyectos@. Un voluntario da de alta la contraparte y la solicitud, y la app le envía el enlace al formulario en francés.
2. Ella lo rellena desde el móvil en varios días, subiendo presupuesto, plano y fotos.
3. La IA traduce y resume la solicitud y señala lo que falta. El revisor pide el desglose de la mano de obra, la contraparte lo añade y el revisor la valida.
4. Se genera la presentación para donantes. Dos fundaciones se comprometen con 12.000 € y 6.000 €, y el proyecto pasa a Aprobado.
5. Durante la obra llegan correos con fotos que se archivan solos en la cronología. Hay una incidencia por lluvias (proyecto parado y luego reanudado).
6. Se genera el informe intermedio con la plantilla de la primera fundación; un voluntario lo corrige en Google Docs y lo envía.
7. Al terminar llegan las fotos finales y los informes finales, y el proyecto se cierra.

## Recursos disponibles

- **Google Workspace for Nonprofits (edición gratuita):** Gmail con el dominio de la ONG, Drive con 100 TB compartidos y unidades compartidas, Docs, Sheets, Slides, Apps Script, Google Chat, AppSheet Core, y la app de Gemini y NotebookLM. Gemini dentro de Gmail y Docs no parece estar incluido en esta edición.
- **Vercel, plan Hobby (gratuito):** el equipo considera que una ONG sin ánimo de lucro encaja en su uso no comercial.
- **Firebase, plan Spark (gratuito):** Firestore y Firebase Auth.
- **API de OpenAI**, de pago por uso, con límite de gasto mensual.
- Hay un servidor casero, pero **el sistema no debe depender de él**: puede caerse en cualquier momento. Como mucho, puede guardar una segunda copia de seguridad.

## Arquitectura general

Arquitectura híbrida: una web app propia orquesta el flujo y Google Workspace hace de almacén de archivos, motor de documentos y buzón.

| Pieza | Papel |
| --- | --- |
| **Next.js en Vercel** | Interfaz, API y lógica de flujo. Única pieza con lógica propia. TypeScript. |
| **Firestore** | Base de datos. Acceso solo desde el servidor con la librería de administración de Firebase; reglas de seguridad que deniegan el acceso directo desde el navegador. Ubicación en Europa (no se puede cambiar después). |
| **Firebase Auth** | Login de voluntarios con Google, aceptando solo correos del dominio de la ONG. |
| **Google Drive** | Unidades compartidas con una carpeta estándar por proyecto. La app accede con una cuenta de servicio. |
| **Google Docs y Slides** | Plantillas e informes editables. Los borradores de IA se crean aquí para que los voluntarios los revisen. |
| **Apps Script** (cuenta técnica de la ONG) | Lee el buzón de proyectos, archiva correos y adjuntos en Drive y avisa a la app. También dispara las tareas frecuentes que el cron de Vercel Hobby no permite y envía correos salientes. |
| **API de OpenAI** | Clasificar, resumir y traducir correos y solicitudes (modelo pequeño); redactar informes y presentaciones (modelo intermedio). Detrás de una interfaz propia para poder cambiar de proveedor o de modelo. |
| **Google Chat** | Avisos a voluntarios mediante webhook (dirección de entrada de mensajes). |

Usar un solo proyecto de Google Cloud (el de Firebase) para Firestore, Auth y la cuenta de servicio, a nombre de una cuenta técnica de la ONG y no de un voluntario.

### Límites conocidos de los planes gratuitos

Comprueba las cifras actuales al implementar; cambian a menudo.

- **Vercel Hobby:**
  - Las funciones no aceptan cuerpos de petición de más de 4,5 MB, así que los archivos deben ir del navegador a Drive sin pasar por la app. La idea es que el servidor abra una sesión de subida reanudable de Drive y el navegador suba directamente; conviene probarlo pronto por posibles problemas de permisos entre dominios (CORS). Alternativa: subir por trozos pequeños a través de la app.
  - El cron solo se ejecuta una vez al día y en algún momento dentro de la hora indicada; vale para tareas nocturnas.
  - Las funciones tienen un máximo de 300 segundos, así que las tareas largas (informes) se trocean, por ejemplo una llamada por sección.
  - Si se supera un límite mensual, normalmente toca esperar hasta el reinicio.
- **Firestore (Spark):** 1 GiB, 50.000 lecturas, 20.000 escrituras y 20.000 borrados al día. Al agotar una cuota, el servicio deja de responder hasta el reinicio diario. Evitar escuchas en tiempo real sobre colecciones enteras, paginar, y guardar en cada proyecto los datos que necesita el panel.
- **Firebase Storage** exige el plan de pago desde febrero de 2026: no usarlo. Los archivos van a Drive.
- **Google Forms** obliga a iniciar sesión con Google para subir archivos, así que no sirve para las contrapartes. El formulario de solicitud es parte de la app, accesible por enlace.
- **Apps Script:** 6 minutos por ejecución, 6 horas al día de tareas programadas y 1.500 destinatarios de correo al día.
- **WhatsApp Business:** desde el 1 de octubre de 2026 Meta cobra también las respuestas dentro de la ventana de 24 horas. No es canal principal por ahora.

## Modelo de datos (punto de partida)

Orientativo; ajústalo si encuentras una forma mejor. La idea central: `proyectos` es la colección principal; lo que solo existe dentro de un proyecto va en subcolecciones, y lo que se consulta desde varios lados, en la raíz.

- `contrapartes`: nombre, tipo, país, persona de contacto, correos, idioma.
- `proyectos`:
  - Campos: código legible (por ejemplo P-AAAA-NNN), título, sector, país, ubicación con coordenadas, estado, presupuesto con moneda, total comprometido, carpeta de Drive, responsable y fechas.
  - Lleva copiados los datos que muestra el panel.
  - Subcolecciones:
    - `solicitudes`: cada versión enviada del formulario.
    - `revisiones`: decisiones del revisor.
    - `eventos`: la cronología de correos, fotos, documentos, incidencias, cambios de estado y notas, con su resumen de IA.
    - `archivos`: referencias a Drive, con su uso interno o publicable.
    - `informes`: estado del borrador y enlace al documento.
- `donantes`: datos, plantilla de informe y calendario de informes que piden.
- `aportaciones`: relación proyecto–donante con importe, moneda y estado (ofrecida, interesado, comprometida, recibida, descartada). Permite la cofinanciación y funciona como embudo de captación.
- `plantillas`: informes y presentaciones de la ONG o de cada donante, con el mapeo de sus campos.
- `enlaces`: accesos sin cuenta para contrapartes y donantes (token guardado solo como hash, ligado a proyecto y acción, con caducidad y revocable).
- `usuarios`: voluntarios con su permiso.

## Organización en Drive

- **Unidades compartidas** (los archivos son de la ONG, no de un voluntario):
  - Proyectos.
  - Plantillas.
  - Sistema: copias de la base de datos, solo para administradores.
- **Carpeta por proyecto**, creada por la app con subcarpetas fijas: `01_Solicitud`, `02_Propuesta`, `03_Financiacion`, `04_Seguimiento` (correos y fotos por mes), `05_Informes`, `06_Economico` y `07_Cierre`.
- La base de datos guarda el **identificador** de cada carpeta, no su nombre, para que renombrar o mover no rompa nada.
- Los archivos llevan un prefijo de fecha AAAA-MM-DD.
- Las contrapartes nunca entran en Drive: suben a través de la app.

## Automatizaciones previstas

- **Alta de solicitud:**
  - Crear el proyecto, su carpeta y el enlace al formulario.
  - Al enviarse, guardar la versión y el PDF de la solicitud, traducir y resumir con IA, señalar lo que falta y avisar al revisor.
- **Revisión:** "pedir cambios" reabre el mismo enlace con los comentarios traducidos.
- **Financiación:**
  - Generar la presentación y la ficha para donantes.
  - Recalcular el total comprometido al cambiar una aportación y pasar a Aprobado al cubrirse el presupuesto.
- **Correo de seguimiento.** Apps Script revisa el buzón cada pocos minutos, archiva correo y adjuntos en la carpeta del proyecto y avisa a la app; la IA resume y clasifica (avance, incidencia, económico). Para asignar cada correo a su proyecto, por este orden:
  1. Alias del proyecto: Gmail entrega en el mismo buzón las direcciones con sufijo, como proyectos+P-2026-014@. Los avisos a la contraparte salen con ese alias como dirección de respuesta, así sus respuestas se asignan solas.
  2. Remitente conocido con un único proyecto activo.
  3. Bandeja de "sin asignar" con la sugerencia de la IA.
- **Recordatorios:** proyectos sin noticias en un tiempo, informes que vencen y formularios sin responder.
- **Copia nocturna** de la base de datos a Drive.

## Informes y presentaciones con IA

- **Plantillas en Google Docs y Slides** con marcadores. Por ejemplo, `{{proyecto.titulo}}` inserta un dato y `{{ia:avance_obras|150 palabras}}` pide un texto con una instrucción. La sintaxis concreta queda a tu criterio.
- **Plantillas de donante en Word o Excel:** se importan a Google; la IA propone una vez qué dato o instrucción va en cada campo y un voluntario valida ese mapeo, que queda guardado.
- **Contexto de la IA:** solo datos del proyecto (ficha, eventos del periodo, aportaciones, fotos publicables e informe anterior).
- **Salida estructurada:** cada párrafo indica de qué eventos sale, y lo que no consta se marca como `[PENDIENTE: …]` en vez de inventarse.
- **Resultado:** un Google Doc en `05_Informes`. El voluntario lo edita, lo aprueba en la app y lo exporta a PDF o Word.
- **Ningún documento sale hacia un donante sin aprobación humana.**

## Accesos y permisos

- **Solo con login y autorización.** Quien entra con Google por primera vez queda en "acceso pendiente" hasta que un administrador lo aprueba.
- **Tres permisos:**
  - Lectura (el inicial): ver todo.
  - Edición: además revisar solicitudes, cambiar estados, gestionar donantes y notas, y generar y aprobar informes.
  - Administración: además gestionar usuarios, contrapartes, donantes y plantillas.
- En la interfaz, lo que el usuario no puede hacer se oculta, pero **los permisos se comprueban siempre en el servidor**.

## Interfaz

Ver `design/DESIGN.md` y las maquetas de `design/mockups/`, que se abren en el navegador. Son una referencia de tono y estructura, no un diseño a copiar píxel a píxel.

- Pantallas: acceso, proyectos (inicio con avisos, filtros, tabla y mapa), solicitudes (bandeja y revisión), ficha de proyecto con pestañas y administración.
- Identidad: tipografía Quicksand, acento `#E54611` (con tonos más oscuros para texto y botones por contraste), logo en `design/assets/`.
- Muy simple y legible para voluntarios sin experiencia; que funcione también en móvil.
- El formulario para contrapartes debe ser ligero, con guardado automático, compresión de fotos en el navegador y subida reanudable. Debe estar en el idioma de la contraparte (francés, inglés, portugués, español).
- Mapa: una librería gratuita como Leaflet o MapLibre con mapas de OpenStreetMap, respetando su política de uso.

## Seguridad y protección de datos

- **RGPD (Reglamento General de Protección de Datos):** la ONG es responsable del tratamiento; Google, Vercel y OpenAI actúan como encargados. Minimizar los datos personales y crear Firestore en Europa.
- **Fotos de menores:** solo las marcadas como publicables entran en informes y presentaciones.
- **IA:**
  - Enviar solo lo necesario, sin datos de contacto ni de beneficiarios concretos.
  - La API de OpenAI no entrena con los datos por defecto, pero guarda registros hasta 30 días: usar `store: false` en la API de Responses.
  - La residencia de datos en Europa requiere solicitarla a OpenAI.
- **Secretos** solo en variables de entorno, nunca en el repositorio. Límite de peticiones en los enlaces públicos.
- **Continuidad:**
  - Repositorio en una organización de GitHub de la ONG.
  - Cuentas (Vercel, Firebase, OpenAI) a nombre de la cuenta técnica, con al menos dos administradores.

## Orden de trabajo sugerido

Cada fase debería entregar algo útil por sí sola. Es una sugerencia; reordénala si tiene sentido.

1. **Núcleo:** autenticación y permisos, contrapartes, proyectos y donantes, creación de carpetas en Drive, formulario por enlace con subida a Drive, revisión, estados y panel.
2. **Seguimiento:** ingesta de correo con Apps Script, cronología, bandeja de sin asignar, avisos y página de subida de fotos.
3. **Documentos con IA:** plantillas, informe por defecto, presentación de captación, mapeo de plantillas de donante y aprobación.
4. **Mejoras:** ficha de solo lectura para donantes, estadísticas, formulario instalable sin conexión, WhatsApp si compensa.

## Principios de trabajo

- **Mantenible por voluntarios:** poco código, pocas dependencias, un solo lenguaje y documentación junto al código, con instrucciones claras de despliegue y configuración.
- **Portable:** acceso a datos y a la IA detrás de capas propias, para poder cambiar de proveedor si cambian las capas gratuitas.
- **Prueba primero lo incierto** (subida directa a Drive, generación de documentos) antes de construir encima.
- **Ante una decisión que afecte a coste, privacidad o forma de trabajo de la ONG,** consulta antes de implementarla.

## Preguntas abiertas

Confirmar con el equipo:

- Dominio de la ONG y subdominio de la app.
- Número de voluntarios con acceso y de proyectos al año.
- Idiomas reales de las contrapartes y si usan más el correo o WhatsApp.
- Si hace falta control económico (desembolsos, justificantes, tipo de cambio).
- Qué donantes tienen plantilla propia y en qué formato.
- Qué datos existentes (hojas de cálculo, carpetas) hay que migrar.

## Estado de la implementación

La fase 1 (núcleo) está hecha; ver `README.md` para qué hace, cómo probarla en local (`MODO_DEMO=1`) y las decisiones tomadas, y `docs/DESPLIEGUE.md` para ponerla en marcha. Lo que falta por comprobar con los servicios reales de Google (subida directa a Drive por CORS, conversión del PDF de la solicitud, sesión con Firebase) está señalado allí.

**Correo (cambio respecto a lo previsto arriba):** el correo de `africadirecto.org` está en un hosting externo con buzones limitados y no se migrará a Gmail, así que no hay un `proyectos@` en Gmail que Apps Script pueda leer. **La app no envía correos**: prepara el texto para que un voluntario lo copie y lo envíe. Los proyectos **no tienen responsable** asignado.

**IA (cambio respecto a lo previsto arriba):** se usa **OpenRouter** en lugar de la API de OpenAI directamente (`lib/ia/openrouter.ts`), con proveedores sin retención de datos. Los informes con IA (fase 3) ya funcionan con plantillas de Google Docs: ver `docs/INFORMES.md`. Las opciones (subida manual de correos en la ficha, subdominio de correo en Workspace, IMAP del buzón actual) y la recomendación están en `docs/CORREO.md`. La arquitectura y el diseño de plantillas, en `docs/ARQUITECTURA.md`; la estructura de Drive, en `docs/DRIVE.md`.
