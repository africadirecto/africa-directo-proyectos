# Informes con IA

La app prepara **borradores de informe (Google Docs) y presentaciones (Google Slides) para donantes** a partir de **plantillas**, y un libro de análisis de proyectos en Google Sheets. La IA redacta cada apartado con los datos del proyecto, siguiendo las instrucciones de la plantilla; un voluntario lo revisa y lo corrige en Google. **La app no envía nada**: lo descarga y lo envía una persona.

## Generar un informe

1. En la ficha del proyecto, pulsa **Generar informe**. Hace falta permiso de edición y que el proyecto tenga carpeta en Drive.
2. Elige:

   | Opción | Para qué sirve |
   | --- | --- |
   | **Plantilla** | Decide el tipo de informe (de seguimiento, final o para buscar financiación), si es documento o presentación, sus apartados y lo que se pide a la IA. Se propone la de por defecto según el estado del proyecto |
   | **Para el donante** | Rellena `{{donante.*}}` y orienta el texto (por ejemplo, el agradecimiento) |
   | **Idioma** | Por defecto, el de la plantilla. Si es otro, también se traduce el texto fijo de la plantilla |
   | **Desde / Hasta** | El periodo (no en el de financiación). Solo entra la cronología de esas fechas. Por defecto, desde el final del último informe |
   | **Indicaciones para la IA** | Lo que quieras destacar en este informe, en tus palabras |

3. **Generar.** El informe se hace **en segundo plano**:
   - Con la Batch API (en producción) suele tardar unos minutos, y como mucho un día. Puedes cerrar la ventana: aparece en **Archivos › Informes** con su progreso y se avisa en Google Chat al terminar.
   - Sin lotes (en local o con `IA_LOTES=0`) tarda segundos o pocos minutos.
   
   Si algo falla, el informe muestra el motivo y un botón **Reintentar**. Lo ya redactado no se repite.
4. Ábrelo en Google Docs o Slides y revísalo:
   - Completa lo **resaltado en amarillo**: es lo que no consta en la app (un dato, una cifra, una foto que falta). La IA no inventa datos.
   - En la app, bajo el informe, **«De dónde sale cada apartado»** dice qué eventos de la cronología o qué datos usó la IA para cada parte.
5. Descárgalo desde la lista: **PDF** y **Word** (documentos) o **PDF** y **PowerPoint** (presentaciones). La descarga sale del documento tal como esté en Google en ese momento.

## Informes de conjunto

Además del de cada proyecto, con **Generar informe** se pueden preparar, también a partir de plantillas:

| Dónde | Qué informe | Opciones propias |
| --- | --- | --- |
| **Proyectos** | Varios proyectos: cifras, panorama, avances, retos y la tabla de proyectos | Estados y países de los proyectos |
| **Contrapartes** y la ficha de cada una | Una contraparte (o todas): sus proyectos y lo más relevante | La contraparte y los estados |
| La ficha de cada **donante** | Lo que ha financiado ese donante y cómo van esos proyectos, para enviárselo | — |

Todos piden el periodo de las novedades, el idioma e indicaciones para la IA. Se guardan en `AD · Proyectos / _Informes generales` y aparecen bajo cada página. La IA ve el detalle de hasta 30 proyectos (los más recientes); el resto cuenta en las cifras.

### Hoja de cálculo de proyectos

En la página **Proyectos**, **Generar informe** ofrece también **Hoja de cálculo con los datos**: un libro de Google Sheets con los proyectos de los estados y países elegidos. **No usa IA** y se hace al momento.

| Hoja | Qué tiene |
| --- | --- |
| **Resumen** | Número de proyectos, presupuesto, comprometido, porcentaje financiado, lo que falta, países y contrapartes |
| **Proyectos** | Una fila por proyecto: código, título, país, lugar, sector, contraparte, estado, año, presupuesto y comprometido en euros, porcentaje y lo que falta, presupuesto en moneda local y fechas |
| **Por estado, país, sector, contraparte y año** | Número de proyectos, presupuesto, comprometido y porcentaje, con una gráfica de barras |

Los resúmenes son **fórmulas** sobre la hoja «Proyectos»: si se corrige un dato allí, se recalculan. El libro es una copia del momento en que se genera; no se actualiza con la app. Queda en `_Informes generales/Cartera` y se descarga en **Excel** o **PDF**.

## Qué datos usa la IA

Solo los del proyecto (o de los proyectos), y sin datos de contacto:

- **Ficha:** título, sector, país, lugar, contraparte, estado, descripción, resumen de la solicitud, beneficiarios, presupuesto, plazo y fechas, y el presupuesto detallado.
- **Financiación:** por donante, lo comprometido y lo cobrado; y los envíos a la contraparte, con su fecha.
- **Cronología del periodo:** notas, cambios de estado, archivos, correos y aportaciones. Se quitan correos y teléfonos. No entran los eventos internos (revisiones, enlaces).
- **Informe anterior:** su resumen, para dar continuidad.
- Las **instrucciones de la plantilla** y tus indicaciones.

**Privacidad.** En producción, la redacción va en **lotes** de OpenRouter (Batch API): a mitad de precio y sin límite de tiempo, pero sin retención cero y por servidores de EE. UU. Por eso:
- solo se envía ese texto ya limpio, sin fotos;
- la app **borra cada lote en cuanto lo lee**;
- lo demás (traducir, resumir, «Cambiar con IA») va por la vía normal, a proveedores que no guardan los datos.

Detalles: [DESPLIEGUE.md › Paso 8](DESPLIEGUE.md#paso-8-ia-con-openrouter).

## Plantillas

Todas las plantillas están en la sección **Plantillas** de la app y funcionan igual, también las de la ONG. Cada plantilla tiene dos partes:
- un **Google Doc o Slides** en la unidad `AD · Plantillas`, con su formato (logos, tablas, estilos, encabezados) y unos **marcadores** que la app sustituye;
- sus **instrucciones para la IA**, en la app: una **general** (propósito, a quién va dirigido, tono) y una por **campo** (qué cuenta ese apartado y con qué extensión aproximada). Cada vez que se guardan queda una **versión**, y se puede volver a cualquiera.

En la ficha de cada plantilla:
- **Abrir en Google**: el formato y los marcadores se cambian en el documento.
- **Volver a leer el documento**: la app comprueba qué marcadores tiene y **avisa** de lo que no va a salir bien (un marcador desconocido, un dato que no vale para ese tipo de informe, una galería en mal sitio…). Lo hace sola al abrir la plantilla si el documento ha cambiado.
- **Cambiar con IA**: escribe lo que quieres («más formal», «que el resumen hable siempre del número de alumnos») y la IA propone las instrucciones nuevas. Ves qué cambia, la pasas al formulario y la guardas tú.
- **Activar, archivar y duplicar**. Solo las **activas** se ofrecen al generar informes. Administración elige la que se propone **por defecto** para cada tipo y formato, y puede borrar plantillas.

Para empezar, administración pulsa **Crear las plantillas de la ONG**: crea en `AD · Plantillas / ONG` un documento y una presentación para cada tipo de informe. Para usar otro documento, déjalo en la unidad (si es un Word, ábrelo antes con Google Docs), escribe en él los marcadores y pulsa **Añadir desde Drive**.

Hace falta:

- La variable `DRIVE_UNIDAD_PLANTILLAS_ID` con el ID de la unidad.
- La cuenta de servicio como **Gestor de contenido** de esa unidad.
- La **Google Docs API** y la **Google Slides API** activadas en el proyecto de Google Cloud ([DESPLIEGUE.md › 3.6](DESPLIEGUE.md#36-activar-las-api-de-google)).

### Marcadores

Se escriben tal cual en el documento, de una vez y sin cambiar el formato a mitad. El texto que los sustituye toma el estilo del marcador: su fuente, tamaño y color.

| Marcador | Qué pone |
| --- | --- |
| `{{ia:clave}}` | Un apartado redactado por la IA según la instrucción de ese campo. Solo en su párrafo, puede ser varios párrafos con viñetas; dentro de una frase, unas palabras. La clave es un nombre corto (`avance`, `incidencias`…) |
| `{{proyecto.titulo}}`, `{{proyecto.presupuesto}}`, `{{informe.periodo}}`, `{{donante.nombre}}`… | Un dato de la app. La lista completa está en la ficha de cada plantilla, en «Marcadores que se pueden usar» |
| `{{tabla:presupuesto}}`, `{{tabla:aportaciones}}`, `{{tabla:envios}}`, `{{tabla:datos}}` | Una tabla hecha por la app, con cifras exactas. En los informes de conjunto: `{{tabla:proyectos}}` y `{{tabla:cifras}}`. Va solo en su párrafo |
| `{{foto:clave}}` y `{{pie:clave}}` | Una foto publicable y su pie. También vale una imagen de la plantilla con el marcador en su **texto alternativo**: se cambia la foto y se conserva el marco |
| `{{fotos:clave}}` | Varias fotos en una tabla de dos columnas (solo en documentos) |

En **Slides**:
- las tablas salen como líneas de texto;
- una foto ocupa el recuadro cuyo único texto es su marcador;
- el texto no se reajusta solo al recuadro, así que conviene revisar que quepa.

El formato antiguo `{{ia:clave|150 palabras|instrucción}}` sigue funcionando: la instrucción se pasa una vez a las instrucciones del campo.

## Todavía no está hecho

- **Fotos dentro del informe:** el sistema ya inserta fotos (y se ha probado con Google), pero aún falta elegirlas al generar el informe. Mientras, los huecos de foto quedan resaltados o vacíos.
- **Archivos del proyecto como contexto** para la IA (opcional al generar).
- **Crear una plantilla a partir de un informe de ejemplo** en Word o PowerPoint: la app lo convertirá, propondrá los marcadores y escribirá las instrucciones.
