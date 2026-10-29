# Puesta en marcha paso a paso

Guía para dejar la app funcionando con los servicios reales de la ONG. Está pensada para alguien con permisos de administración de Google Workspace, pero sin experiencia técnica especial: cada paso dice dónde pulsar y qué copiar.

- **Coste:** todo es gratuito salvo la API de OpenAI (del orden de 1 $ al mes, con límite).
- **Tiempo:** dos o tres tardes la primera vez, sobre todo por las esperas del DNS.
- **Documentos relacionados:**
  - [ARQUITECTURA.md](ARQUITECTURA.md): cómo funciona el sistema.
  - [DRIVE.md](DRIVE.md): carpetas y permisos de Drive.
  - [CORREO.md](CORREO.md): cómo llegan los correos de las contrapartes.

## Índice

0. [Antes de empezar](#paso-0-antes-de-empezar)
1. [Google Workspace: cuentas, grupos y ajustes](#paso-1-google-workspace-cuentas-grupos-y-ajustes)
2. [GitHub: el repositorio](#paso-2-github-el-repositorio)
3. [Firebase y Google Cloud](#paso-3-firebase-y-google-cloud)
4. [DNS: subdominio de correo (opcional, recomendado)](#paso-4-dns-subdominio-de-correo-opcional-recomendado)
5. [Google Drive: unidades compartidas](#paso-5-google-drive-unidades-compartidas)
6. [Apps Script: envío de correos](#paso-6-apps-script-envío-de-correos)
7. [Google Chat: avisos](#paso-7-google-chat-avisos)
8. [OpenAI](#paso-8-openai)
9. [Vercel: publicar la app](#paso-9-vercel-publicar-la-app)
10. [Primer arranque y comprobaciones](#paso-10-primer-arranque-y-comprobaciones)
11. [Mantenimiento](#paso-11-mantenimiento)
12. [Tabla de variables de entorno](#tabla-de-variables-de-entorno)
13. [Si algo falla](#si-algo-falla)

---

## Paso 0. Antes de empezar

Necesitas:

- Una persona con rol de **superadministrador** en la consola de Google Workspace (<https://admin.google.com>).
- Acceso al panel del **DNS** de `africadirecto.org` (normalmente en el hosting o en el registrador del dominio). Solo hace falta para el subdominio de la app y, si se elige, el de correo.
- Un **gestor de contraseñas** compartido por al menos dos administradores, por ejemplo Bitwarden, gratuito para organizaciones sin ánimo de lucro. Ahí se guardan la contraseña de la cuenta técnica y los secretos.
- Una tarjeta para cargar saldo en OpenAI (unos 10 $ duran meses).

Decisiones previas (pregúntalas al equipo):

| Decisión | Recomendación | Por qué |
| --- | --- | --- |
| Dirección de la app | `proyectos.africadirecto.org` | Fácil de recordar; se configura en el paso 9 |
| Correo de las contrapartes | Subdominio `correo.africadirecto.org` en Workspace | Ver [CORREO.md](CORREO.md). Si no se puede tocar el DNS, saltar el paso 4 |
| Repositorio público o privado | Público en una organización de GitHub de la ONG | Vercel Hobby no despliega repositorios privados de organizaciones (paso 2) |

---

## Paso 1. Google Workspace: cuentas, grupos y ajustes

Todo en <https://admin.google.com>, con una cuenta de superadministrador.

### 1.1. Cuenta técnica

Es la dueña de todos los servicios (Firebase, Vercel, OpenAI, GitHub y las unidades compartidas). Así nada depende del correo personal de un voluntario que se va.

La cuenta técnica es **`gestion@africadirecto.org`**, que ya existe y es superadministradora de Workspace. Asegúrate de que:

1. Su contraseña está en el gestor de contraseñas compartido.
2. En <https://myaccount.google.com/security>:
   - Activa la **verificación en dos pasos** con una llave o una app de autenticación que tengan al menos dos administradores (por ejemplo, el gestor de contraseñas compartido).
   - Añade como correo de recuperación el de otro administrador.

> Esta cuenta tiene un buzón de Gmail, pero no recibirá el correo que llega de fuera, porque el correo de `africadirecto.org` está en el hosting. No es un problema: la cuenta solo sirve para administrar servicios.

### 1.2. Cuentas de los voluntarios

Cada voluntario que vaya a usar la app necesita una cuenta de Workspace `nombre@africadirecto.org`, porque se entra con Google. Las cuentas de Workspace for Nonprofits son gratuitas.

- Si el voluntario ya tiene buzón en el hosting con esa misma dirección, la cuenta de Workspace convive con él: sirve para entrar en Google, y el correo sigue llegando al hosting.
- Si alguien no tiene cuenta, créala en **Directorio › Usuarios › Añadir usuario nuevo**.

### 1.3. Grupos

Los grupos permiten dar permisos en Drive de una vez. Créalos en **Directorio › Grupos › Crear grupo**:

| Grupo | Quién está | Para qué |
| --- | --- | --- |
| `coordinacion@africadirecto.org` | Los 2–3 administradores | Gestores de las unidades compartidas |
| `voluntarios-proyectos@africadirecto.org` | Todos los voluntarios que usan la app | Acceso a la unidad Proyectos |

Configura cada grupo así:

- **Quién puede unirse:** "Solo los usuarios invitados".
- **Permitir miembros externos:** no.
- **Quién puede publicar:** "Propietarios del grupo" (no son listas de correo; solo sirven para permisos).

> La app y Drive tienen permisos separados. Al aprobar a alguien en la app, añádelo también al grupo `voluntarios-proyectos@` para que pueda abrir las carpetas. Ver [Mantenimiento](#paso-11-mantenimiento).

### 1.4. Google Chat y webhooks

1. **Aplicaciones › Google Workspace › Google Chat**: comprueba que el servicio está **activado** para la organización.
2. En **Aplicaciones de Chat** (o "Configuración de aplicaciones de Chat"), activa **"Permitir que los usuarios añadan webhooks entrantes"**. Sin esto no se puede crear el webhook del paso 7.

### 1.5. Drive

En **Aplicaciones › Google Workspace › Drive y Documentos**:

1. **Unidades compartidas:** permite que los administradores las creen. Opcional: impide que las cree cualquier usuario, para evitar unidades sueltas.
2. **Configuración de uso compartido:** se trata en el [paso 5](#paso-5-google-drive-unidades-compartidas) y en [DRIVE.md](DRIVE.md).

---

## Paso 2. GitHub: el repositorio

### 2.1. Organización

1. Con la cuenta técnica, crea una cuenta en <https://github.com> (`gestion@africadirecto.org`, usuario `africadirecto-sistemas`).
2. **Your organizations › New organization › Free**. Nombre: `africadirecto`.
3. Invita como **Owner** a al menos dos voluntarios con su propia cuenta de GitHub. Activa la verificación en dos pasos obligatoria: **Settings › Authentication security › Require two-factor authentication**.
4. Opcional: solicita GitHub for Nonprofits, gratis con el plan Team.

### 2.2. ¿Público o privado?

**Vercel Hobby (gratuito) no despliega repositorios privados que pertenezcan a una organización de GitHub.** Hay tres salidas:

| Opción | Cómo | Ventajas | Inconvenientes |
| --- | --- | --- | --- |
| **A. Repositorio público en la organización** (recomendada) | Crear el repositorio como *Public* | Despliegue automático en cada cambio; otros pueden aprender o colaborar | El código es visible. No es un riesgo si nunca se suben secretos, y el `.gitignore` ya excluye `.env.local` y `.datos/` |
| B. Repositorio privado y despliegue con GitHub Actions | Un *workflow* que ejecuta `vercel deploy` con un token de la cuenta técnica | El código queda privado | Hay que mantener el *workflow* y el token |
| C. Repositorio privado en la cuenta personal de la cuenta técnica | Repositorio de `africadirecto-sistemas` | Despliegue automático | En Hobby, solo se despliegan los commits cuyo autor es el dueño de la cuenta de Vercel. No sirve si colaboran varias personas |

La opción A es la más sencilla. **Antes de hacerla pública, comprueba que no hay datos personales** en el repositorio: las maquetas de `design/` usan nombres de ejemplo y la demo usa direcciones `@example.org`.

### 2.3. Subir el código

1. En la organización: **New repository** → nombre `africa-directo-proyectos`, sin README (ya lo tiene).
2. Desde la carpeta del proyecto, en el ordenador de quien lo tenga:

   ```bash
   git remote add origin https://github.com/africadirecto/africa-directo-proyectos.git
   ```

   ```bash
   git push -u origin main
   ```

3. Opcional: en **Settings › Branches**, protege `main` para que los cambios entren por *pull request* revisado.

---

## Paso 3. Firebase y Google Cloud

Un solo proyecto de Google Cloud, creado desde Firebase, con la cuenta técnica. Entra en <https://console.firebase.google.com> como `gestion@africadirecto.org`.

### 3.1. Crear el proyecto

1. **Crear un proyecto** → nombre `africa-directo-proyectos`. Firebase propone un ID (por ejemplo `africa-directo-proyectos-1a2b3`): **anótalo**, es `FIREBASE_PROJECT_ID`.
2. Google Analytics: **no** (no hace falta y añade datos personales).
3. Si pregunta por una organización de Google Cloud, elige la de `africadirecto.org`.
4. El proyecto queda en el plan **Spark**, gratuito y sin tarjeta, así que no puede generar cargos.

### 3.2. Firestore (la base de datos)

1. Menú **Compilación › Firestore Database › Crear base de datos**.
2. ID de la base de datos: `(default)`. Edición: la estándar.
3. **Ubicación: Europa.** Elige `eur3 (Europe)`, multirregión, o `europe-southwest1 (Madrid)`. **No se puede cambiar después.**
4. Modo: **producción**.
5. En la pestaña **Reglas**, borra lo que haya, pega el contenido de [`firestore.rules`](../firestore.rules) y pulsa **Publicar**. Así se deniega todo acceso desde el navegador; la app accede solo desde el servidor, con permisos de administración.
6. No hace falta crear colecciones: la app las crea al usarse. Tampoco hacen falta índices compuestos.

### 3.3. Authentication (entrar con Google)

1. **Compilación › Authentication › Comenzar**.
2. Pestaña **Método de acceso › Google › Habilitar**. Correo de asistencia: `gestion@africadirecto.org`. Guardar.
3. Pestaña **Configuración › Dominios autorizados › Añadir dominio**: añade `proyectos.africadirecto.org` y, cuando lo tengas, el dominio de Vercel (`africa-directo-proyectos.vercel.app`). `localhost` viene ya incluido.

La app solo deja pasar cuentas `@africadirecto.org` con el correo verificado. Se comprueba en el servidor, no solo en la pantalla.

### 3.4. Registrar la app web

1. Rueda dentada **› Configuración del proyecto › General › Tus apps › icono web (`</>`)**.
2. Apodo: `web`. **No** marques Firebase Hosting.
3. Copia de la configuración que aparece:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (algo como `africa-directo-proyectos-1a2b3.firebaseapp.com`)
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

Estos tres valores son **públicos** (viajan al navegador); no son secretos.

### 3.5. Clave de la cuenta de servicio

La app usa la cuenta de servicio de Firebase (`firebase-adminsdk-xxxxx@…iam.gserviceaccount.com`), que ya tiene permisos sobre Firestore y Authentication, y también la usa para Drive.

1. **Configuración del proyecto › Cuentas de servicio › Firebase Admin SDK › Generar nueva clave privada**.
2. Se descarga un archivo JSON. De él:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_KEY` (entera, desde `-----BEGIN` hasta `END PRIVATE KEY-----\n`, con los `\n` tal cual)
3. Guarda el JSON en el gestor de contraseñas y **bórralo de Descargas**. Quien tenga ese archivo puede leer y escribir la base de datos.

> **Si Google no deja crear la clave** ("la creación de claves está inhabilitada"), es la política de organización `iam.disableServiceAccountKeyCreation`, activa por defecto en organizaciones de Google Cloud nuevas.
> 1. Un superadministrador de Workspace entra en <https://console.cloud.google.com> y elige el proyecto.
> 2. Va a **IAM y administración › Políticas de la organización**, busca *Disable service account key creation* y entra en **Gestionar política**.
> 3. Elige **Anular la política del superior**, aplica **Desactivado** y guarda. El cambio afecta solo a este proyecto.
> 4. Si no le deja, que se dé antes el rol *Administrador de políticas de la organización* en la organización.

### 3.6. Activar las API de Google

En <https://console.cloud.google.com>, con el proyecto elegido arriba, entra en **APIs y servicios › Biblioteca** y activa:

- **Google Drive API**: necesaria desde ya.
- **Google Docs API** y **Google Slides API**: para los informes de la fase 3. Puedes activarlas ya.

---

## Paso 4. DNS: subdominio de correo (opcional, recomendado)

Solo si se elige la opción B de [CORREO.md](CORREO.md). Permite recibir automáticamente las respuestas de las contrapartes y que los correos que envía la app no acaben en spam, **sin tocar el correo actual** del dominio.

> ⚠️ **No cambies los registros MX de `africadirecto.org`**: el correo de todos seguiría yendo a Google y dejaría de llegar al hosting. Todo lo de este paso es para el subdominio `correo.africadirecto.org`.

### 4.1. Añadir el subdominio a Workspace

1. Consola de administración **› Cuenta › Dominios › Gestionar dominios › Añadir un dominio**.
2. Escribe `correo.africadirecto.org` y elige **Dominio secundario** (para poder crear usuarios con él).
3. Google pide **verificarlo** con un registro TXT. En el panel del DNS crea:

   | Tipo | Nombre (host) | Valor |
   | --- | --- | --- |
   | TXT | `correo` | `google-site-verification=…` (el que indique Google) |

4. Vuelve a la consola y pulsa **Verificar**. El DNS tarda entre minutos y unas horas.

### 4.2. Registros de correo del subdominio

En el panel del DNS, añade:

| Tipo | Nombre (host) | Valor | Prioridad |
| --- | --- | --- | --- |
| MX | `correo` | `smtp.google.com` | 1 |
| TXT (SPF) | `correo` | `v=spf1 include:_spf.google.com ~all` | — |
| TXT (DMARC) | `_dmarc.correo` | `v=DMARC1; p=none; rua=mailto:gestion@africadirecto.org` | — |

Después, en la consola de Workspace, **Aplicaciones › Google Workspace › Gmail**, activa Gmail para `correo.africadirecto.org` si lo pide.

### 4.3. DKIM (firma de los correos)

1. **Aplicaciones › Google Workspace › Gmail › Autenticar correo electrónico**.
2. Elige el dominio `correo.africadirecto.org` → **Generar registro nuevo** (2048 bits).
3. Crea en el DNS el TXT que indica, con nombre `google._domainkey.correo`.
4. Espera una hora y pulsa **Iniciar autenticación**.

### 4.4. El buzón de la app

1. **Directorio › Usuarios › Añadir usuario nuevo**. Nombre: `Proyectos Africa Directo`. Correo: `proyectos` y, en el desplegable del dominio, `correo.africadirecto.org`.
2. Contraseña en el gestor; verificación en dos pasos como en el paso 1.1.
3. Comprobación: desde un correo personal, escribe a `proyectos+prueba@correo.africadirecto.org`. Debe llegar al Gmail de esa cuenta.

El valor de `CORREO_PROYECTOS` será `proyectos@correo.africadirecto.org`.

### 4.5. Copia automática desde el buzón actual (opcional)

Si las contrapartes escriben a un buzón del hosting (por ejemplo `proyectos@africadirecto.org`), pregunta al proveedor si puede crear un **reenvío** o un **filtro** que mande una copia de lo que llega a `proyectos@correo.africadirecto.org`. Los reenvíos no suelen ocupar buzón. Si no se puede, los voluntarios reenvían a mano los que importen, o los suben desde la ficha del proyecto.

### 4.6. Subdominio de la app

Se crea en el paso 9.4: Vercel indica el registro exacto, normalmente un CNAME `proyectos` → `cname.vercel-dns.com`.

---

## Paso 5. Google Drive: unidades compartidas

La estructura completa, los permisos y su porqué están en [DRIVE.md](DRIVE.md). Resumen:

1. Con la cuenta técnica, en <https://drive.google.com> **› Unidades compartidas › Nueva**, crea:
   - `AD · Proyectos`
   - `AD · Plantillas`
   - `AD · Sistema`
2. En cada una, **Gestionar miembros** con los roles de la tabla de [DRIVE.md › Permisos](DRIVE.md#permisos).
3. Ajusta la **configuración de cada unidad** como indica [DRIVE.md › Configuración de cada unidad](DRIVE.md#configuración-de-cada-unidad).
4. Da acceso a la app (la cuenta de servicio) de una de las dos formas descritas en [DRIVE.md › Acceso de la app](DRIVE.md#acceso-de-la-app-a-drive). Lo normal es añadirla como **Gestor de contenido**.
5. Copia los identificadores. Abre cada unidad: la dirección es `https://drive.google.com/drive/folders/0AbCdEf…`, y lo que va tras `folders/` es el ID.
   - `AD · Proyectos` → `DRIVE_UNIDAD_PROYECTOS_ID`
   - `AD · Sistema` → `DRIVE_UNIDAD_SISTEMA_ID`
   - `AD · Plantillas` se usará en la fase 3.

---

## Paso 6. Apps Script: envío de correos

Apps Script envía los correos de la app (formulario, cambios pedidos, rechazo, acceso concedido) desde una cuenta de Workspace. En la fase 2 también leerá el buzón.

**¿Con qué cuenta?**
- Si hiciste el paso 4: con `proyectos@correo.africadirecto.org`. Los correos salen desde el subdominio, con SPF y DKIM correctos.
- Si no: con `gestion@africadirecto.org`. Los correos saldrán de `@africadirecto.org` y probablemente lleguen como spam, porque el SPF del dominio es del hosting. Mientras tanto, usa el botón de la app que copia el texto del correo y envíalo desde el buzón de siempre. Más detalles en [CORREO.md](CORREO.md#correos-que-envía-la-app).

**Pasos:**

1. Entra con esa cuenta en <https://script.google.com> **› Nuevo proyecto**. Renómbralo como "Africa Directo – correo".
2. Borra el contenido de `Código.gs` y pega el de [`apps-script/Codigo.gs`](../apps-script/Codigo.gs).
3. **Configuración del proyecto** (rueda dentada):
   - Marca **"Mostrar el archivo de manifiesto appsscript.json"**. Vuelve al editor, abre `appsscript.json` y sustituye su contenido por el de [`apps-script/appsscript.json`](../apps-script/appsscript.json).
   - Zona horaria: Europa/Madrid (ya viene en el manifiesto).
   - En **Propiedades del script › Añadir propiedad**: nombre `SECRETO`, valor una cadena aleatoria larga, igual que `APPS_SCRIPT_SECRETO` en Vercel. Para generarla:

     ```bash
     openssl rand -base64 32
     ```

     Si no tienes `openssl`, vale cualquier generador de contraseñas de 40 caracteres.
4. En el editor, elige la función **`probarEnvio`** y pulsa **Ejecutar**. Acepta los permisos (enviar correo en tu nombre). Debe llegarte un correo de prueba.
5. **Implementar › Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Descripción: "v1".
   - Ejecutar como: **Yo** (la cuenta del paso 1 o del 4).
   - Quién tiene acceso: **Cualquier usuario**. La app se identifica con el secreto; sin él, el script no hace nada.
6. Copia la **URL de la aplicación web** (`https://script.google.com/macros/s/…/exec`) → `APPS_SCRIPT_URL`.

**Al cambiar el código:** **Implementar › Gestionar implementaciones ›** lápiz **› Versión: nueva versión › Implementar**. Así la URL no cambia.

**Límite:** 1.500 destinatarios al día con una cuenta de Workspace.

---

## Paso 7. Google Chat: avisos

La app avisa en un espacio de Chat de los accesos pendientes, las solicitudes recibidas, el resumen semanal de los lunes y los fallos de la copia nocturna.

1. En <https://chat.google.com>, **Nuevo chat › Crear un espacio** → nombre "Proyectos – avisos". Añade a los voluntarios, o al grupo `voluntarios-proyectos@`.
2. Pulsa el nombre del espacio **› Aplicaciones e integraciones › Webhooks › Añadir webhook**.
3. Nombre: "Gestión de proyectos"; avatar opcional (`https://…/logo-cara.svg` de la app). Guarda.
4. Copia la URL (`https://chat.googleapis.com/v1/spaces/…/messages?key=…&token=…`) → `GOOGLE_CHAT_WEBHOOK_URL`. Trátala como un secreto: quien la tenga puede escribir en el espacio.

---

## Paso 8. OpenAI

La IA traduce y resume las solicitudes y traduce los comentarios del revisor. En la fase 3 redactará borradores de informes.

1. Crea una cuenta en <https://platform.openai.com> con `gestion@africadirecto.org`. Organización: "Africa Directo".
2. **Settings › Organization › Members**: invita a un segundo administrador.
3. **Settings › Billing**: añade una tarjeta y compra **10 $ de crédito prepago**. Desactiva la **recarga automática**: así nunca se gasta más de lo cargado. El crédito caduca al año.
4. **Projects › Create project** → "Gestión de proyectos".
5. En el proyecto, **Limits**: pon un presupuesto mensual (por ejemplo 3 $) y un aviso por correo al 50 %.
6. En el proyecto, **API keys › Create new secret key**:
   - Nombre: "vercel-produccion".
   - Permisos: *Restricted*, con permiso de escritura solo en **Responses** (o *All* si no aparece).
   - Copia la clave (`sk-proj-…`) → `OPENAI_API_KEY`. Solo se muestra una vez.
7. Revisa en <https://platform.openai.com/docs/models> que los modelos de `OPENAI_MODELO_RAPIDO` (por defecto `gpt-5-mini`) y `OPENAI_MODELO_REDACCION` (`gpt-5`) existen. Si no, pon el modelo pequeño y el intermedio actuales.
8. **Privacidad:**
   - La API no entrena con los datos por defecto.
   - La app usa `store: false` y no envía nombres ni datos de contacto.
   - Para que los datos se procesen en Europa hay que pedir la **residencia de datos europea** a OpenAI (opcional; depende de su disponibilidad para cuentas pequeñas).

Sin `OPENAI_API_KEY`, la app funciona igual: no traduce, y el resumen es el principio del texto de la contraparte.

---

## Paso 9. Vercel: publicar la app

### 9.1. Cuenta

1. En <https://vercel.com/signup>, elige **Hobby** y **Continuar con GitHub**, con la cuenta de GitHub de la cuenta técnica (`africadirecto-sistemas`).
2. Autoriza a Vercel a leer la organización `africadirecto`. Si GitHub lo pide, hazlo desde **Configure › Organization access**.

> El plan Hobby es para uso no comercial. El equipo considera que una ONG sin ánimo de lucro encaja; si Vercel opinara otra cosa, el plan Pro cuesta unos 20 $/mes.

### 9.2. Importar el proyecto

1. **Add New › Project › Import** el repositorio `africadirecto/africa-directo-proyectos`.
2. Framework: **Next.js**, detectado solo. No cambies los comandos de compilación.
3. Abre **Environment Variables** y añade todas las de la [tabla](#tabla-de-variables-de-entorno) para el entorno **Production**. Para la clave privada, pega el valor tal cual, con los `\n`.
4. **Deploy**. Tarda 1–2 minutos.

### 9.3. Región y tareas programadas

- [`vercel.json`](../vercel.json) fija la región `fra1` (Fráncfort), cerca de Firestore en Europa, y el **cron diario** a las 2:00 UTC (`/api/cron/diario`). Compruébalo en **Settings › Cron Jobs**.
- Vercel envía `CRON_SECRET` en cada ejecución; la app rechaza las llamadas que no lo llevan.
- Hobby permite tareas programadas una vez al día. Las más frecuentes (leer el correo, fase 2) las dispara Apps Script.

### 9.4. Dominio

1. **Settings › Domains › Add** → `proyectos.africadirecto.org`.
2. Vercel muestra el registro que hay que crear, normalmente CNAME `proyectos` → `cname.vercel-dns.com`. Créalo en el panel del DNS.
3. Cuando Vercel lo marque como válido (y emita el certificado HTTPS):
   - Pon `APP_URL=https://proyectos.africadirecto.org` en las variables y vuelve a desplegar (**Deployments ›** ⋯ **› Redeploy**).
   - Añade el dominio a los **dominios autorizados de Firebase** (paso 3.3).

### 9.5. Despliegues automáticos

Cada cambio en `main` se publica solo. Las ramas y *pull requests* generan una vista previa, protegida por defecto con el inicio de sesión de Vercel. Las vistas previas usan las variables del entorno *Preview*: si no las configuras, fallarán al entrar con Google, y es lo esperado.

---

## Paso 10. Primer arranque y comprobaciones

1. Pon en `ONG_ADMINS_INICIALES` el correo de dos administradores, por ejemplo `ana.lopez@africadirecto.org,luis.gomez@africadirecto.org`.
2. Abre `https://proyectos.africadirecto.org` y **Entrar con Google** con una de esas cuentas. Entra directamente como administrador.
3. **Administración › Ajustes**: todas las integraciones deberían estar en verde ("Configurado"). Si alguna está en rojo, revisa su variable.
4. **Prueba de punta a punta** con una contraparte de prueba (tu correo personal):
   1. **Nueva solicitud** → contraparte nueva → Crear. Comprueba que en `AD · Proyectos/2026/` aparece la carpeta `P-2026-001 …` con sus 7 subcarpetas.
   2. Con el correo configurado, marca "Enviar ya el formulario" y comprueba que llega, y que no va a spam. Si no, copia el enlace.
   3. Abre el enlace **en el móvil**, rellena el formulario, sube una foto y un PDF y cierra la página a medias. Vuelve a abrirlo: lo escrito debe seguir ahí.
   4. **Comprueba cómo sube los archivos.** En un ordenador, con las herramientas del navegador abiertas (F12 › Red), sube un archivo:
      - Si los trozos van a `www.googleapis.com/upload/drive/…`, la subida directa funciona.
      - Si van a `/api/f/…/trozo`, la app está usando el plan B (también vale).
   5. Envía la solicitud. En 1–2 minutos debe aparecer en **Solicitudes**, con resumen de IA, el PDF en `01_Solicitud` y el aviso en Chat.
   6. **Pide cambios**, corrige desde el enlace, **valida**, añade dos aportaciones que cubran el presupuesto y comprueba que pasa a **Aprobado**.
5. Al día siguiente, comprueba que en `AD · Sistema/Copias de la base de datos/` hay una copia.
6. Pasa el proyecto de prueba a **Cancelado** (la app no borra proyectos; los códigos no se reutilizan) y, si quieres, borra su carpeta de Drive a mano.
7. Quita `ONG_ADMINS_INICIALES`; ya no hace falta.

---

## Paso 11. Mantenimiento

### Altas y bajas de voluntarios

| Qué | Dónde |
| --- | --- |
| **Alta** | La persona entra con Google y queda pendiente (llega un aviso a Chat). En **Administración › Usuarios**: "Dar acceso de lectura" y, si hace falta, cambiar a Edición. **Añadirla al grupo `voluntarios-proyectos@`** en la consola de Workspace, para Drive. |
| **Alta por adelantado** | **Administración › Dar acceso por correo** (no tendrá que esperar) y el grupo. |
| **Baja** | "Quitar acceso" en la app **y** sacarla del grupo. Si deja la ONG, suspende su cuenta de Workspace: lo que creó en las unidades compartidas sigue siendo de la ONG. |

### Rotar secretos (una vez al año o si se filtran)

| Secreto | Cómo rotarlo | Efecto |
| --- | --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Firebase › Cuentas de servicio › generar clave nueva, ponerla en Vercel, redesplegar y borrar la antigua en Google Cloud › IAM › Cuentas de servicio › Claves | Ninguno visible |
| `OPENAI_API_KEY` | Crear otra en OpenAI, cambiarla en Vercel y revocar la antigua | Ninguno visible |
| `APPS_SCRIPT_SECRETO` | Cambiarlo a la vez en la propiedad del script y en Vercel | Ninguno visible |
| `ENLACES_SECRETO` | Cambiarlo en Vercel | **Invalida todos los enlaces de las contrapartes**: hay que reenviarlos. Solo si se ha filtrado |
| `CRON_SECRET` | Cambiarlo en Vercel | Ninguno visible |

### Copias de seguridad

- Cada noche, `AD · Sistema/Copias de la base de datos/AAAA-MM-DD copia-base-de-datos.json`.
- Una vez al año, borra las copias de más de un año, dejando la del día 1 de cada mes.
- Si hay un servidor casero, puede descargar esas copias como segunda copia (con *rclone*, por ejemplo). La app no depende de él.
- **Restaurar:** cada clave del JSON es la ruta de un documento de Firestore. Hay que escribirlos de nuevo con un pequeño script; pide ayuda a alguien técnico.

### Actualizar la app

- Las dependencias se actualizan con *pull requests*. GitHub Dependabot puede proponerlos solo: actívalo en Settings › Code security.
- Antes de aceptar cambios:

  ```bash
  npm test
  ```

  ```bash
  npm run build
  ```

### Vigilar el gasto y las cuotas

- **OpenAI:** **Administración › Ajustes** muestra llamadas y tokens por mes; el gasto real se ve en platform.openai.com › Usage.
- **Firestore:** Firebase › Firestore › Uso. El límite es de 50.000 lecturas al día; la app gasta muy poco gracias al índice del panel.
- **Vercel:** Settings › Usage.

---

## Tabla de variables de entorno

Se ponen en Vercel (**Settings › Environment Variables**) y, para probar en local, en `.env.local`.

| Variable | De dónde sale | ¿Secreta? | Ejemplo |
| --- | --- | --- | --- |
| `APP_URL` | Paso 9.4 | No | `https://proyectos.africadirecto.org` |
| `ONG_DOMINIO` | Dominio de las cuentas de Google | No | `africadirecto.org` |
| `ONG_ADMINS_INICIALES` | Primeros administradores (solo al arrancar) | No | `ana.lopez@africadirecto.org` |
| `CORREO_PROYECTOS` | Buzón de la app (paso 4) | No | `proyectos@correo.africadirecto.org` |
| `FIREBASE_PROJECT_ID` | Paso 3.1 | No | `africa-directo-proyectos-1a2b3` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Paso 3.5 (`client_email`) | No | `firebase-adminsdk-xxxx@….iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Paso 3.5 (`private_key`) | **Sí** | `-----BEGIN PRIVATE KEY-----\n…` |
| `GOOGLE_DRIVE_USUARIO` | Solo si se usa delegación de dominio ([DRIVE.md](DRIVE.md#acceso-de-la-app-a-drive)) | No | `gestion@africadirecto.org` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Paso 3.4 | No (pública) | `AIza…` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Paso 3.4 | No | `….firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Paso 3.4 | No | igual que `FIREBASE_PROJECT_ID` |
| `DRIVE_UNIDAD_PROYECTOS_ID` | Paso 5 | No | `0AbCdEf…` |
| `DRIVE_UNIDAD_SISTEMA_ID` | Paso 5 | No | `0AxYz…` |
| `ENLACES_SECRETO` | `openssl rand -base64 32` | **Sí** | — |
| `CRON_SECRET` | `openssl rand -base64 32` | **Sí** | — |
| `OPENAI_API_KEY` | Paso 8 | **Sí** | `sk-proj-…` |
| `OPENAI_MODELO_RAPIDO` | Paso 8.7 | No | `gpt-5-mini` |
| `OPENAI_MODELO_REDACCION` | Paso 8.7 | No | `gpt-5` |
| `GOOGLE_CHAT_WEBHOOK_URL` | Paso 7 | **Sí** | `https://chat.googleapis.com/v1/spaces/…` |
| `APPS_SCRIPT_URL` | Paso 6 | No | `https://script.google.com/macros/s/…/exec` |
| `APPS_SCRIPT_SECRETO` | Paso 6 | **Sí** | — |
| `MODO_DEMO` | Solo en local | — | `1` (nunca en Vercel) |

---

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| Arriba sale "Falta configuración: …" | Faltan variables en Vercel | Añádelas y redesplegar |
| Al entrar con Google: "Solo se puede entrar con una cuenta @…" | La cuenta no es del dominio o `ONG_DOMINIO` está mal | Revisa la variable |
| La ventana de Google se cierra con error `auth/unauthorized-domain` | Falta el dominio en Firebase | Paso 3.3 |
| "No se pudo iniciar sesión" | Clave de la cuenta de servicio mal copiada (los `\n`) | Vuelve a pegarla entera |
| Nueva solicitud: "No se pudo crear la carpeta en Drive" | La cuenta de servicio no tiene acceso a `AD · Proyectos` o el ID está mal | [DRIVE.md](DRIVE.md#acceso-de-la-app-a-drive). Después, "Crear carpeta en Drive" en la ficha |
| Los correos de la app llegan como spam | SPF/DKIM del remitente | Paso 4 o [CORREO.md](CORREO.md#correos-que-envía-la-app) |
| Ajustes: "Envío de correos: sin configurar" | Faltan `APPS_SCRIPT_URL` o `APPS_SCRIPT_SECRETO` | Paso 6 |
| La IA no resume | Clave o modelo incorrectos, o crédito agotado | Mira los registros de Vercel (Deployments › Logs) y el saldo en OpenAI |
| Todo va lento o da error a partir de cierta hora | Cuota diaria de Firestore agotada | Esperar al reinicio (medianoche del Pacífico) y revisar qué consume |
| No llega la copia nocturna | `CRON_SECRET` o `DRIVE_UNIDAD_SISTEMA_ID` | Vercel › Settings › Cron Jobs › ver ejecuciones |

## Fuentes consultadas

- [Vercel – límites del plan Hobby](https://vercel.com/docs/limits)
- [Comunidad de Vercel: repositorios privados de organizaciones en Hobby](https://community.vercel.com/t/unable-to-deploy-from-organizational-private-repository/16334)
- [Google Workspace – registros MX (también para subdominios)](https://support.google.com/a/answer/61158?hl=es)
- [Cuotas de Apps Script](https://developers.google.com/apps-script/guides/services/quotas)
- [OpenAI – facturación prepago](https://help.openai.com/articles/8264644)
