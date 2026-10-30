# Informes con IA

La app prepara **borradores de informe (Google Docs) y presentaciones (Google Slides) para donantes**, y un libro de análisis de proyectos en Google Sheets. La IA los redacta con los datos del proyecto; un voluntario los revisa y los corrige en Google. **La app no envía nada**: lo descarga y lo envía una persona.

## Generar un informe

1. En la ficha del proyecto, pulsa **Generar informe** (hace falta permiso de edición y que el proyecto tenga carpeta en Drive).
2. Elige:

   | Opción | Para qué sirve |
   | --- | --- |
   | **Formato** | **Informe** (Google Docs) o **Presentación** (Google Slides) |
   | **Tipo** | **Para buscar financiación** (presenta el proyecto a un posible donante: necesidad, qué se hará, beneficiarios, contraparte, presupuesto detallado y lo que falta por financiar), **de seguimiento** o **final**. Cambia los apartados y lo que se pide a la IA |
   | **Plantilla** | La de la app para ese formato, o cualquier Google Doc o Slides de la unidad `AD · Plantillas` |
   | **Para el donante** | Cualquier donante. Rellena `{{donante.*}}` y orienta el texto (por ejemplo, el agradecimiento) |
   | **Desde / Hasta** | El periodo (no en el de financiación). Solo entra la cronología de esas fechas. Por defecto, desde el final del último informe |
   | **Idioma** | Español, francés, inglés o portugués. Las notas para el voluntario van siempre en español |
   | **Extensión** | Breve, normal o detallada: multiplica las palabras de cada apartado (×0,6, ×1, ×1,6) |
   | **Fotos publicables** | Añade la lista de fotos marcadas como publicables, con su enlace |
   | **Indicaciones para la IA** | Lo que quieras destacar u orientar, en tus palabras |

3. **Generar.** Tarda de unos segundos a un minuto. El archivo queda en `03_Informes` y en la pestaña **Archivos › Informes**.
4. Ábrelo en Google Docs o Slides y revísalo:
   - Completa lo marcado como **`[PENDIENTE: …]`**: es lo que no consta en la app. La IA no inventa datos.
   - Al final hay unas **notas para la revisión** (en las presentaciones, una última diapositiva): lo pendiente y de qué evento de la cronología sale cada apartado. **Bórralas antes de enviar.** También se ven en la app, en «Notas para la revisión».
5. Descárgalo desde la lista de informes: **PDF** y **Word** (documentos) o **PDF** y **PowerPoint** (presentaciones). La descarga sale del documento tal como esté en Google en ese momento.

## Informes de conjunto

Además del de cada proyecto, con **Generar informe** se pueden preparar, también en Docs o Slides:

| Dónde | Qué informe | Opciones propias |
| --- | --- | --- |
| **Proyectos** | Varios proyectos: cifras, panorama, avances, retos y la tabla de proyectos | Estados y países de los proyectos |
| **Contrapartes** y la ficha de cada una | Una contraparte (o todas): sus proyectos y lo más relevante | La contraparte y los estados |
| La ficha de cada **donante** | Lo que ha financiado ese donante y cómo van esos proyectos, para enviárselo | — |

Todos piden el periodo de las novedades, el idioma, la extensión e indicaciones para la IA. Se guardan en `AD · Proyectos / _Informes generales` y aparecen bajo cada página para abrirlos y descargarlos. La IA ve el detalle de hasta 30 proyectos (los más recientes); el resto cuenta en las cifras.

### Hoja de cálculo de proyectos

En la página **Proyectos**, **Generar informe** ofrece también el formato **Hoja de cálculo**: un libro de Google Sheets con los proyectos de los estados y países elegidos. **No usa IA.**

| Hoja | Qué tiene |
| --- | --- |
| **Resumen** | Número de proyectos, presupuesto, comprometido, porcentaje financiado, lo que falta, países y contrapartes |
| **Proyectos** | Una fila por proyecto: código, título, país, lugar, sector, contraparte, estado, año, presupuesto y comprometido en euros, porcentaje y lo que falta, presupuesto en moneda local y fechas |
| **Por estado, país, sector, contraparte y año** | Número de proyectos, presupuesto, comprometido y porcentaje, con una gráfica de barras |

Los resúmenes son **fórmulas** sobre la hoja «Proyectos»: si se corrige un dato allí, se recalculan. El libro es una copia del momento en que se genera; no se actualiza con la app. Como los demás, queda en `_Informes generales/Cartera` y se descarga en **Excel** o **PDF**.

## Qué datos usa la IA

Solo los del proyecto, y sin datos de contacto:

- **Ficha:** título, sector, país, lugar, contraparte, estado, descripción, resumen de la solicitud, beneficiarios, presupuesto y fechas.
- **Financiación:** aportaciones comprometidas y recibidas, por donante.
- **Cronología del periodo:** notas, cambios de estado, archivos, correos y aportaciones. Se quitan correos y teléfonos. No entran los eventos internos (revisiones, enlaces).
- **Fotos publicables:** solo cuántas hay. Las fotos no se envían a la IA.
- **Informe anterior:** su resumen, para dar continuidad.

La IA va por OpenRouter, solo a proveedores que no guardan los datos ni los usan para entrenar (ver [DESPLIEGUE.md › Paso 8](DESPLIEGUE.md#paso-8-ia-con-openrouter)).

## Plantillas propias (Google Docs y Slides)

Cualquier **Google Doc o presentación de Google Slides** de la unidad `AD · Plantillas` (en cualquier subcarpeta) aparece en la lista de plantillas, agrupado por carpeta. Por ejemplo:

```
AD · Plantillas/
├── ONG/Informe de seguimiento con logo
└── Donantes/Fundación Horizonte/Informe intermedio
```

Para generar el informe, la app **copia la plantilla** en `03_Informes` y **sustituye los marcadores** sin tocar el formato: logos, tablas, estilos, encabezados y pies se mantienen.

Hace falta:

- La variable `DRIVE_UNIDAD_PLANTILLAS_ID` con el ID de la unidad.
- La cuenta de servicio como **Lector** (o más) de esa unidad.
- La **Google Docs API** (y la **Google Slides API** para las presentaciones) activadas en el proyecto de Google Cloud ([DESPLIEGUE.md › 3.6](DESPLIEGUE.md#36-activar-las-api-de-google)).

### Marcadores de datos

Se escriben tal cual en el documento, con llaves dobles:

| Marcador | Qué pone |
| --- | --- |
| `{{proyecto.codigo}}`, `{{proyecto.titulo}}` | Código y título |
| `{{proyecto.sector}}`, `{{proyecto.pais}}`, `{{proyecto.lugar}}` | Sector y país en el idioma del informe; lugar |
| `{{proyecto.contraparte}}`, `{{proyecto.beneficiarios}}`, `{{proyecto.estado}}` | Contraparte, beneficiarios, estado |
| `{{proyecto.presupuesto}}`, `{{proyecto.financiado}}`, `{{proyecto.recibido}}`, `{{proyecto.falta}}` | Cifras en euros (la financiación va en euros) |
| `{{proyecto.presupuesto_local}}`, `{{proyecto.moneda}}` | Presupuesto en la moneda de la solicitud, y esa moneda |
| `{{proyecto.inicio}}`, `{{proyecto.fin_previsto}}` | Fechas de la obra |
| `{{informe.fecha}}`, `{{informe.desde}}`, `{{informe.hasta}}`, `{{informe.periodo}}` | Fecha de hoy y periodo del informe |
| `{{donante.nombre}}`, `{{donante.importe}}` | El donante elegido y su aportación |

### Marcadores de IA

Cada uno es un apartado que redacta la IA:

| Forma | Ejemplo |
| --- | --- |
| `{{ia:clave}}` | `{{ia:avance}}` (unas 120 palabras) |
| `{{ia:clave\|N palabras}}` | `{{ia:avance\|200 palabras}}` |
| `{{ia:clave\|N palabras\|instrucción}}` | `{{ia:avance\|150 palabras\|Describe el avance de las obras en el periodo}}` |

La clave es un nombre corto sin espacios (`avance`, `incidencias`, `beneficiarios`…). Si la misma clave aparece varias veces, se usa el mismo texto. Los marcadores que la app no conoce se dejan tal cual y se avisa en las notas finales.

> Escribe cada marcador de una vez, sin cambiar el formato a mitad (por ejemplo, sin poner en negrita solo una parte), para que Google Docs lo guarde como un solo texto.

## Todavía no está hecho

- **Plantillas de donante en Word o Excel:** de momento hay que convertirlas a Google Docs a mano (abrir en Drive › Abrir con Google Docs) y escribir los marcadores. El mapeo asistido por IA está diseñado en [ARQUITECTURA.md](ARQUITECTURA.md#plantillas-e-informes-con-ia).
- **Fotos dentro del documento:** se añade la lista con enlaces; insertar las imágenes exige que Google pueda descargarlas, y las fotos no deben hacerse públicas.
- **Fotos dentro de las presentaciones**, por la misma razón.
