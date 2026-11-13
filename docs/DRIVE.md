# Google Drive: estructura y permisos

Drive es el almacén de archivos del sistema. La app crea las carpetas, sube lo que envían las contrapartes y enlaza a ellas; **no duplica archivos**. La base de datos guarda el **identificador** de cada carpeta, no su nombre: se pueden renombrar o reordenar sin romper nada, siempre que no salgan de su unidad compartida.

## Principios

- **Los archivos son de la ONG, no de las personas.** Todo vive en unidades compartidas; si un voluntario se va, nada se pierde.
- **Las contrapartes nunca entran en Drive.** Suben a través del formulario de la app.
- **Los donantes no reciben acceso a Drive.** Reciben el PDF o el Word que descarga y envía un voluntario.
- **Fotos de menores:** se guardan como cualquier foto, pero solo las marcadas como **publicables** en la app pueden ir a informes y presentaciones.
- **Pocos permisos y por grupos.** Se dan a grupos de Workspace, no a personas sueltas.

## Tres unidades compartidas

### `AD · Proyectos`

Una carpeta por proyecto, agrupadas por año. **La crea la app** al registrar una solicitud.

```
AD · Proyectos/
├── 1. Proyectos/
│   ├── 2026/                                      ← la app crea una por año
│   │   ├── P-2026-014 Aula escuela primaria/      ← una por proyecto (código + título)
│   │   │   ├── 01_Solicitud/        Lo que envía la contraparte con el formulario
│   │   │   │                        (presupuesto, planos, fotos) y el PDF de cada versión
│   │   │   ├── 02_Seguimiento/      Fotos, documentos y correos que llegan durante la obra
│   │   │   ├── 03_Informes/         Lo que va a los donantes: presentación para buscar
│   │   │   │                        financiación e informes de seguimiento y final
│   │   │   └── 04_Administración/   Convenios y cartas de los donantes, transferencias a la
│   │   │                            contraparte, facturas, justificantes y acta de cierre
│   │   └── P-2026-015 Dormitorio del internado/
│   └── 2025/
├── 2. Solicitudes/            ← reservada: la app todavía no la usa
├── 3. Reportes/               ← lo que se genera desde Proyectos, de varios proyectos a la vez
│   ├── Resúmenes/             resúmenes en Docs o Slides («Generar resumen»)
│   └── Hojas de cálculo/      libros de análisis en Google Sheets
└── 4. Eliminados/             ← carpetas de los proyectos eliminados (vuelven a su año al recuperarlos)
```

Estas carpetas numeradas las crea la app la primera vez que las necesita y guarda su identificador (`lib/dominio/carpetas.ts`), así que después se pueden renombrar. Para pasar una unidad con la estructura anterior a esta: `node scripts/drive/reorganizar.mjs` (simula) y `--aplicar` (lo hace).

Un proyecto eliminado sigue en la unidad de proyectos, visible para los voluntarios en Drive: la app no puede sacar carpetas a otra unidad siendo Gestor de contenido (haría falta ser Gestor).

**Qué hace la app en cada carpeta:**

| Carpeta | La app guarda sola | A mano |
| --- | --- | --- |
| `01_Solicitud` | Los archivos que sube la contraparte en el formulario y el PDF de cada versión («2026-10-30 Solicitud v1»). Si la contraparte quita un adjunto, va a la papelera | — |
| `02_Seguimiento` | Lo que se sube con **Añadir archivos** en la ficha (es la carpeta por defecto) | Fotos y documentos de avance |
| `03_Informes` | Los informes y presentaciones que se generan desde la ficha | Las versiones enviadas, si se quieren guardar |
| `04_Administración` | — | Convenios, cartas de compromiso, transferencias, facturas, justificantes, acta de cierre |

Para saber dónde va algo: ¿lo mandó la contraparte al pedir el proyecto? **01**. ¿Llega durante la obra? **02**. ¿Va a un donante? **03**. ¿Es papeleo de dinero o de acuerdos? **04**.

Todo va directamente en cada carpeta, sin subcarpetas: el prefijo de fecha ya los ordena. Las fotos de cualquier carpeta aparecen en la pestaña **Archivos** de la ficha, para marcar cuáles son publicables.

**Reglas para los voluntarios:**

- Los archivos llevan delante la fecha `AAAA-MM-DD`, por ejemplo `2026-10-24 Fotos cubierta.jpg`. La app ya lo hace con lo que sube.
- No muevas carpetas de proyecto **fuera** de `AD · Proyectos`: la app perdería el acceso. Dentro de la unidad, se pueden reorganizar.
- No hace falta duplicar en Drive lo que ya está en la app (estado, donantes, notas).
- Las subcarpetas numeradas se pueden renombrar, pero conviene no hacerlo: todo el mundo sabe dónde buscar.
- El nombre de la carpeta del proyecto sigue al título: la app la renombra al cambiar el título en la ficha.

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
├── Imágenes/                           logo, firma, mapa de la ONG
├── _Ejemplos/                          informes de ejemplo subidos desde la app (originales)
└── _Pruebas/                           informes de prueba de las plantillas (se pueden borrar)
```

Las plantillas creadas desde un ejemplo van a `ONG/` o a `Donantes/<donante>/`. En `AD · Sistema`, la app usa `_Temporal/` para las copias de los archivos adjuntos que convierte para leer su texto; van a la papelera al momento.

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
| Cuenta de servicio de la app | **Gestor** | **Gestor** (crea y copia las plantillas de informe) | **Gestor** |

Si la app gestiona los accesos (apartado siguiente), los voluntarios no hace falta añadirlos por grupo: los añade ella uno a uno.

**Por qué así:**

- Los voluntarios son **Colaboradores**: pueden subir y editar (también los borradores de informe en Google Docs), pero **no pueden borrar ni mover**. Así se evita que un despiste rompa la estructura. Si alguien necesita ordenar carpetas a menudo, súbelo a Gestor de contenido de forma individual.
- La **app** necesita al menos ser Gestor de contenido: crea carpetas y manda a la papelera los archivos que la contraparte quita del formulario. Para gestionar además los accesos de los voluntarios tiene que ser **Gestor**. La papelera de una unidad compartida se puede recuperar durante 30 días.
- En `AD · Sistema` solo entra coordinación: contiene todos los datos.
### La app aplica sus permisos en Drive

Si la cuenta de servicio de la app es **Gestor** de las tres unidades (y no solo Gestor de contenido), la app añade, cambia y quita a cada voluntario como miembro al darle acceso, cambiarle el permiso o quitárselo en **Administración › Usuarios** (`lib/dominio/accesosDrive.ts`). No envía correos de aviso.

| Permiso en la app | `AD · Proyectos` y `AD · Plantillas` | `AD · Sistema` |
| --- | --- | --- |
| Lectura | Lector | — |
| Edición | Colaborador | — |
| Administración | Gestor de contenido | Gestor de contenido |
| Sin acceso | se le quita | se le quita |

- **Cada noche** la app repasa a todos los usuarios (con las tareas nocturnas): así se ponen al día los que ya existían y se reintenta lo que falló. Mientras tanto, el usuario aparece en Administración › Usuarios como «Drive sin actualizar».
- **Lo que la app no toca:** a quien es **Gestor** de la unidad, a los grupos, a quien no es usuario de la app y a quien está pendiente de aprobar.
- **El rol de Drive sigue al de la app.** Si a alguien se le sube a mano en Drive, vuelve a su rol esa misma noche (salvo que sea Gestor).
- **Grupos:** quien esté además en un grupo con acceso (`voluntarios-proyectos@`) conserva el del grupo. Con este sistema el grupo sobra: quítalo de las unidades.
- **Mientras la app no sea Gestor,** los permisos de la app se guardan igual y Drive hay que llevarlo a mano; la app lo avisa en cada cambio.
- **Riesgo que se asume:** con el rol de Gestor, quien tuviera la clave de la cuenta de servicio podría dar acceso a las unidades a terceros. La clave solo debe estar en Vercel y en el gestor de contraseñas.

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

- Lo normal: descargar el informe en PDF o Word desde la app, ya revisado, y enviarlo por correo.
- Si un donante necesita ver una carpeta, comparte **solo esa carpeta o archivo**, como Lector y con **fecha de caducidad** (Compartir › nombre › ⋯ › Añadir fecha de caducidad). Nunca compartas fotos no publicables.

## Fuentes

- [Ayuda de Google Workspace: uso compartido externo y unidades compartidas](https://support.google.com/a/answer/60781?hl=es)
- [Comunidad de Google Cloud: cuentas de servicio en unidades compartidas con uso compartido externo restringido](https://www.googlecloudcommunity.com/gc/Workspace-Q-A/Google-Service-Account-can-t-be-added-to-sheet-in-shared-drive/m-p/843841)
