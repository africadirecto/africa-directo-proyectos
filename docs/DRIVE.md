# Google Drive: estructura y permisos

Drive es el almacén de archivos del sistema. La app crea las carpetas, sube lo que envían las contrapartes y enlaza a ellas; **no duplica archivos**. La base de datos guarda el **identificador** de cada carpeta, no su nombre: se pueden renombrar o reordenar sin romper nada, siempre que no salgan de su unidad compartida.

## Principios

- **Los archivos son de la ONG, no de las personas.** Todo vive en unidades compartidas; si un voluntario se va, nada se pierde.
- **Las contrapartes nunca entran en Drive.** Suben a través del formulario de la app.
- **Los donantes no reciben acceso a Drive.** Reciben PDF o Word exportados y aprobados por un voluntario.
- **Fotos de menores:** se guardan como cualquier foto, pero solo las marcadas como **publicables** en la app pueden ir a informes y presentaciones.
- **Pocos permisos y por grupos.** Se dan a grupos de Workspace, no a personas sueltas.

## Tres unidades compartidas

### `AD · Proyectos`

Una carpeta por proyecto, agrupadas por año. **La crea la app** al registrar una solicitud.

```
AD · Proyectos/
├── 2026/                                      ← la app crea una por año
│   ├── P-2026-014 Aula escuela primaria/      ← una por proyecto (código + título)
│   │   ├── 01_Solicitud/      Formulario de la contraparte: PDF de cada versión,
│   │   │                      presupuesto, planos y fotos que subió
│   │   ├── 02_Propuesta/      Presupuesto validado, planos definitivos,
│   │   │                      ficha y presentación para donantes
│   │   ├── 03_Financiacion/   Convenios y cartas de compromiso de los donantes,
│   │   │                      correspondencia con ellos
│   │   ├── 04_Seguimiento/    Lo que llega durante la ejecución
│   │   │   ├── 2026-08/       ← una por mes (fase 2): correos (.eml y PDF),
│   │   │   └── 2026-09/          fotos y documentos de avance
│   │   ├── 05_Informes/       Borradores de IA (Google Docs) e informes enviados (PDF)
│   │   ├── 06_Economico/      Transferencias a la contraparte, facturas, justificantes
│   │   └── 07_Cierre/         Informe final, fotos finales, carta o acta de cierre
│   └── P-2026-015 Dormitorio del internado/
├── 2025/
└── _Sin asignar/              ← fase 2: adjuntos de correos aún sin proyecto
```

**Reglas para los voluntarios:**

- Los archivos llevan delante la fecha `AAAA-MM-DD`, por ejemplo `2026-10-24 Fotos cubierta.jpg`. La app ya lo hace con lo que sube.
- No muevas carpetas de proyecto **fuera** de `AD · Proyectos`: la app perdería el acceso. Dentro de la unidad, se pueden reorganizar.
- No hace falta duplicar en Drive lo que ya está en la app (estado, donantes, notas).
- Las subcarpetas numeradas se pueden renombrar, pero conviene no hacerlo: todo el mundo sabe dónde buscar.

### `AD · Plantillas`

Plantillas de informes y presentaciones, de la ONG y de cada donante. Cualquier Google Doc de esta unidad aparece al generar un informe (ver [INFORMES.md](INFORMES.md)). **Se crea a mano.**

```
AD · Plantillas/
├── ONG/
│   ├── Informe de seguimiento          (Google Docs, con marcadores {{…}})
│   ├── Informe final                   (Google Docs)
│   ├── Presentación para donantes      (Google Slides)
│   └── Ficha del proyecto              (Google Docs)
├── Donantes/
│   └── Fundación Horizonte/
│       ├── Original – Informe intermedio.docx   ← lo que envió el donante, sin tocar
│       └── Informe intermedio                    ← convertida a Google Docs, con marcadores
└── Imágenes/                           logo, firma, mapa de la ONG
```

### `AD · Sistema`

Solo para administradores. **Se crea a mano**; la carpeta de copias la crea la app.

```
AD · Sistema/
├── Copias de la base de datos/         ← la app guarda aquí un JSON cada noche
└── Exportaciones/                      ← opcional, para exportaciones puntuales
```

Contiene la base de datos completa, con datos personales de contactos: **nadie más que coordinación** debe tener acceso.

## Crear las unidades

Con la cuenta técnica `gestion@africadirecto.org`, en <https://drive.google.com>:

1. **Unidades compartidas** (menú izquierdo) **› Nueva** → `AD · Proyectos`. Repite con `AD · Plantillas` y `AD · Sistema`.
2. En `AD · Plantillas`, crea a mano las carpetas `ONG`, `Donantes` e `Imágenes`. En las otras dos no hace falta crear nada.
3. Copia el ID de `AD · Proyectos` y de `AD · Sistema`: lo que va tras `folders/` en la dirección. Son `DRIVE_UNIDAD_PROYECTOS_ID` y `DRIVE_UNIDAD_SISTEMA_ID`.

## Permisos

Los roles de las unidades compartidas, de más a menos:

| Rol en Drive | Qué puede hacer |
| --- | --- |
| **Gestor** | Todo, incluido añadir o quitar miembros y cambiar la configuración |
| **Gestor de contenido** | Añadir, editar, mover y eliminar archivos |
| **Colaborador** | Añadir y editar archivos, pero no eliminarlos ni moverlos |
| **Comentador** | Ver y comentar |
| **Lector** | Solo ver |

Asignación recomendada (en cada unidad, **Gestionar miembros**):

| Miembro | `AD · Proyectos` | `AD · Plantillas` | `AD · Sistema` |
| --- | --- | --- | --- |
| `gestion@` (cuenta técnica) | Gestor | Gestor | Gestor |
| `coordinacion@` (grupo de administradores) | Gestor | Gestor | Gestor |
| `voluntarios-proyectos@` (grupo) | **Colaborador** | Lector | — |
| Cuenta de servicio de la app | **Gestor de contenido** | Lector (copia las plantillas de informe) | **Gestor de contenido** |

**Por qué así:**

- Los voluntarios son **Colaboradores**: pueden subir y editar (también los borradores de informe en Google Docs), pero **no pueden borrar ni mover**. Así se evita que un despiste rompa la estructura. Si alguien necesita ordenar carpetas a menudo, súbelo a Gestor de contenido de forma individual.
- La **app** necesita ser Gestor de contenido: crea carpetas y manda a la papelera los archivos que la contraparte quita del formulario. La papelera de una unidad compartida se puede recuperar durante 30 días.
- En `AD · Sistema` solo entra coordinación: contiene todos los datos.
- Los permisos de la app (lectura, edición, administración) y los de Drive van por separado. Al dar de alta a un voluntario en la app, añádelo también al grupo `voluntarios-proyectos@`. Ver [DESPLIEGUE.md › Mantenimiento](DESPLIEGUE.md#paso-11-mantenimiento).

> **¿Y los voluntarios con permiso de lectura en la app?** Si se quiere que en Drive tampoco puedan editar, crea un segundo grupo `voluntarios-lectura@` con rol **Lector** en `AD · Proyectos`.

## Configuración de cada unidad

En cada unidad: clic derecho sobre su nombre **› Configuración de la unidad compartida**.

| Opción | Proyectos | Plantillas | Sistema |
| --- | --- | --- | --- |
| Permitir que personas ajenas a africadirecto.org accedan a los archivos | **No** (ver la nota sobre la cuenta de servicio) | No | No |
| Permitir que personas que no son miembros accedan a los archivos | **No** | No | No |
| Permitir que lectores y comentadores descarguen, impriman y copien | Sí | **Sí** (la app copia plantillas) | No |

Además, en la consola de Workspace (**Aplicaciones › Google Workspace › Drive y Documentos › Configuración de uso compartido**):

- Activa **"Avisar cuando los usuarios compartan archivos fuera de la organización"**.
- Si la ONG lo acepta, limita el uso compartido externo a **dominios permitidos**.

## Acceso de la app a Drive

La app usa la cuenta de servicio de Firebase (`firebase-adminsdk-…@….iam.gserviceaccount.com`). Para Google, es una **cuenta externa** a `africadirecto.org`. Hay dos formas de darle acceso.

### Opción 1 (recomendada): añadirla como miembro

1. En `AD · Proyectos` **› Gestionar miembros**, escribe el correo de la cuenta de servicio, elige **Gestor de contenido** y desmarca "Notificar". Repite en `AD · Sistema`.
2. Si Drive no te deja ("no puedes compartir con personas ajenas a tu organización"):
   - Activa en esa unidad "Permitir que personas ajenas a africadirecto.org accedan a los archivos".
   - Si sigue sin dejar, revisa en la consola de Workspace si el uso compartido externo está desactivado para todos.

   Activar esa opción permite a los miembros compartir fuera archivos de esa unidad: por eso conviene activar los avisos y la lista de dominios permitidos del apartado anterior.

Solo se da acceso a esas dos unidades, así que si la clave se filtrara, el daño se limita a ellas. Es la opción más segura.

### Opción 2: delegación de dominio

La cuenta de servicio actúa **en nombre de** `gestion@africadirecto.org`. No hace falta añadirla a las unidades ni abrir el uso compartido externo, y los archivos aparecen como creados por `gestion@`.

1. En el JSON de la clave, copia `client_id` (un número largo).
2. Consola de Workspace **› Seguridad › Acceso y control de datos › Controles de API › Gestionar la delegación de todo el dominio › Añadir nuevo**:
   - ID de cliente: el `client_id`.
   - Ámbito: `https://www.googleapis.com/auth/drive`.
3. En Vercel, añade `GOOGLE_DRIVE_USUARIO=gestion@africadirecto.org` y vuelve a desplegar.

> ⚠️ Con la delegación de dominio, **quien tenga la clave de la cuenta de servicio puede actuar sobre el Drive de cualquier usuario** del dominio, no solo sobre estas unidades. La clave solo debe estar en Vercel y en el gestor de contraseñas. Usa esta opción únicamente si la opción 1 no es posible.

## Compartir con donantes

- Lo normal: exportar el informe aprobado a PDF o Word desde la app y enviarlo por correo.
- Si un donante necesita ver una carpeta, comparte **solo esa carpeta o archivo**, como Lector y con **fecha de caducidad** (Compartir › nombre › ⋯ › Añadir fecha de caducidad). Nunca compartas fotos no publicables.

## Fuentes

- [Ayuda de Google Workspace: uso compartido externo y unidades compartidas](https://support.google.com/a/answer/60781?hl=es)
- [Comunidad de Google Cloud: cuentas de servicio en unidades compartidas con uso compartido externo restringido](https://www.googlecloudcommunity.com/gc/Workspace-Q-A/Google-Service-Account-can-t-be-added-to-sheet-in-shared-drive/m-p/843841)
