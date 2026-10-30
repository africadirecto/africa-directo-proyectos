# Correo: cómo llegan a la app los mensajes de las contrapartes

## La situación

- El dominio `africadirecto.org` tiene Google Workspace, pero **el correo no está en Gmail**: sus registros MX apuntan a un proveedor de hosting externo.
- Ese hosting tiene un número limitado de buzones y **no se pueden crear más**. Migrar el correo a Google no está previsto.
- Las cuentas de Workspace (`nombre@africadirecto.org`) existen y sirven para entrar en Google (Drive, Chat, la app), pero el correo que mandan desde fuera a esas direcciones va al hosting, no a Gmail.

El diseño original (CLAUDE.md) suponía un buzón `proyectos@` en Gmail leído por Apps Script. Eso no es posible tal cual. Por la misma razón, **la app no envía correos**: los prepara para que un voluntario los copie (ver [Correos a las contrapartes](#correos-a-las-contrapartes)).

## Opciones

### A. Subir los correos a mano desde la ficha del proyecto (siempre)

En cada proyecto, un botón **"Añadir correo"** con tres formas de hacerlo:

1. **Arrastrar el correo guardado como archivo.** Casi todos los programas lo permiten: en Outlook se arrastra el mensaje al escritorio (`.msg`), en Thunderbird *Guardar como* (`.eml`) y en el webmail del hosting (Roundcube) *Más › Descargar (.eml)*.
2. **Reenviarlo como adjunto** a la dirección de la app, si existe (opción B).
3. **Pegar el texto** y añadir los adjuntos (fotos, PDF) a mano, para quien no sepa guardar el correo.

La app lee remitente, fecha, asunto, texto y adjuntos; guarda el original y los adjuntos en `04_Seguimiento/AAAA-MM` del proyecto; añade el evento a la cronología con un resumen de IA y su tipo (avance, incidencia, económico); marca las fotos para decidir si son publicables, y actualiza la "última noticia".

- **Ventajas:** no necesita buzones, DNS ni cuentas nuevas. Funciona también con los correos que llegan a buzones personales de los voluntarios. El voluntario elige qué es relevante, así que no entra ruido.
- **Inconvenientes:** depende de que alguien lo haga. Para que no se olvide, la app ya avisa de los proyectos sin noticias en más de 30 días.

**Recomendación: hacerla en cualquier caso.** Es la base, cuesta poco y sirve como plan B de todo lo demás.

### B. Un subdominio de correo en Google Workspace (automática, recomendada si se puede tocar el DNS)

Se añade a Workspace un **subdominio solo para la app**, por ejemplo `correo.africadirecto.org`, y se apunta *solo ese subdominio* a Gmail. El correo del dominio principal sigue en el hosting, sin cambios.

- Se crea en Workspace un usuario `proyectos@correo.africadirecto.org` (las cuentas de Workspace for Nonprofits son gratuitas).
- Cada proyecto tiene su alias: `proyectos+P-2026-014@correo.africadirecto.org`. Gmail entrega las direcciones con `+` en el mismo buzón. Los voluntarios pueden ponerlo en copia o como dirección de respuesta al escribir a la contraparte.
- Cuando la contraparte **responde** a ese alias, el correo llega a Gmail y Apps Script lo **asigna solo** al proyecto. Es lo que más se repite durante la ejecución: fotos y avances.
- Los correos que lleguen al buzón actual del hosting se pueden **reenviar** a `proyectos@correo.africadirecto.org`: a mano, o de forma automática si el hosting permite un filtro o redirección que mande una copia. Las redirecciones no suelen ocupar buzón; hay que preguntarlo al proveedor.
- Apps Script revisa ese buzón cada pocos minutos y hace lo de la opción A sin que nadie intervenga. Lo que no sepa asignar va a la bandeja de "correos sin asignar", con la sugerencia de la IA.

Qué hace falta:

- Acceso al **DNS** del dominio, una vez y unos 15 minutos: un registro TXT de verificación y uno MX para el subdominio (`smtp.google.com`, prioridad 1), más SPF y DKIM del subdominio para que los envíos no acaben en spam. Pasos en [DESPLIEGUE.md](DESPLIEGUE.md#paso-4-dns-subdominio-de-correo-opcional-recomendado).
- Activar Gmail para el subdominio en la consola de administración de Workspace.

- **Ventajas:** gratis, dentro de la organización (mismo contrato y acuerdo de tratamiento de datos que el resto de Workspace), sin tocar el correo actual y sin buzones del hosting. Es el diseño original de CLAUDE.md con otra dirección.
- **Inconvenientes:** hay que pedir el cambio de DNS a quien lo gestione, y conviene que las contrapartes respondan a la dirección de la app, lo que ya consiguen los avisos.

### C. Leer una carpeta del buzón actual por IMAP (automática, sin DNS)

Si no se puede tocar el DNS, la app puede leer por IMAP una carpeta del buzón que ya existe en el hosting (por ejemplo `proyectos@africadirecto.org`).

- En ese buzón se crea una carpeta **"Para la app"**. Los voluntarios **mueven allí** los correos relevantes desde el webmail o desde Outlook, o se crea una regla del servidor que los copie.
- Apps Script llama cada 10 minutos a la app, que lee los mensajes nuevos de esa carpeta y hace lo mismo que la opción A.

- **Ventajas:** no hace falta DNS ni cuentas nuevas, y los voluntarios siguen trabajando en su programa de correo.
- **Inconvenientes:**
  - La contraseña del buzón tiene que guardarse en Vercel, como variable secreta.
  - Depende de que el hosting permita IMAP y de su fiabilidad.
  - Suma dos librerías (cliente IMAP y lector de correos) y unas 4.300 llamadas al mes a Vercel, dentro del plan gratuito.
  - Si alguien cambia la contraseña del buzón, se rompe sin avisar.

### D. Una cuenta de Gmail gratuita (posible, no recomendada)

Una cuenta `@gmail.com` (por ejemplo `africadirecto.proyectos@gmail.com`) haría de buzón de la app, igual que en la opción B.

- **Ventajas:** no hace falta DNS.
- **Inconvenientes:**
  - Es una cuenta personal fuera de la organización: queda fuera del acuerdo de tratamiento de datos de Workspace (RGPD), su recuperación depende de un teléfono y los administradores no la controlan.
  - Apps Script en cuentas gratuitas solo permite enviar a 100 destinatarios al día, frente a 1.500 en Workspace.
  - Una dirección `@gmail.com` da menos confianza a contrapartes y donantes.

Solo tiene sentido si no hay DNS ni IMAP.

### Descartada: que Gmail recoja el correo del hosting (POP)

Gmail ha retirado en 2026 la opción "Consultar el correo de otras cuentas" (POP) y Gmailify, así que ya no se puede traer a Gmail el correo de un buzón externo.

## Correos a las contrapartes

**La app no envía correos** (decisión del equipo, octubre de 2026). Cuando hay que escribir a una contraparte, la app prepara el correo en su idioma y el voluntario lo copia y lo envía desde el buzón de proyectos de siempre:

- **Enlace al formulario:** al crear la solicitud.
- **Cambios pedidos:** con los comentarios del revisor traducidos y el mismo enlace.
- **Rechazo:** con el motivo traducido.

Así los correos salen de una dirección que las contrapartes ya conocen. Además se evita el problema de entrega: si la app enviara desde Workspace con una dirección `@africadirecto.org`, el **SPF del dominio**, que es del hosting, no autorizaría a Google y los correos acabarían en spam.

Si algún día se quiere el envío automático, lo más limpio es enviar desde el subdominio de la opción B, que tiene su propio SPF y DKIM y no toca el correo principal.

## Recomendación

1. **Ahora (fase 2):** programar la opción A, *Añadir correo* en la ficha, con lectura de `.eml` y `.msg`, adjuntos a Drive y resumen de IA.
2. **En cuanto se pueda pedir el cambio de DNS:** opción B, subdominio `correo.africadirecto.org`, para la recepción automática de las respuestas.
3. Si el DNS no es posible, opción C para recibir.

## Fuentes

- [Gmail: funciones que dejan de estar disponibles (POP y Gmailify)](https://support.google.com/mail/answer/16604719)
- [Configurar registros MX para Google Workspace (también para subdominios)](https://support.google.com/a/answer/61158?hl=es)
- [Cuotas de Apps Script (destinatarios por día en cuentas gratuitas y de Workspace)](https://developers.google.com/apps-script/guides/services/quotas)
