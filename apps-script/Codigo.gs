/**
 * Apps Script de Africa Directo, en la cuenta del buzón de proyectos (proyectos@).
 *
 * Fase 1: envía los correos de la app a las contrapartes (formulario, cambios pedidos,
 * rechazo) y a los voluntarios (acceso concedido), desde el buzón de la ONG y con
 * el alias del proyecto como dirección de respuesta (proyectos+P-2026-014@...).
 *
 * Fase 2 (pendiente): leer el buzón cada pocos minutos, archivar correos y adjuntos
 * en la carpeta del proyecto y avisar a la app.
 *
 * Instalación: ver docs/DESPLIEGUE.md, paso "Apps Script".
 *   - Propiedad del script SECRETO = el mismo valor que APPS_SCRIPT_SECRETO en Vercel.
 *   - Implementar como aplicación web: "Ejecutar como: yo" y "Acceso: cualquier usuario".
 */

var NOMBRE_REMITENTE = 'Africa Directo';

function doPost(e) {
  var datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return respuesta({ ok: false, error: 'JSON no válido' });
  }
  var secreto = PropertiesService.getScriptProperties().getProperty('SECRETO');
  if (!secreto || datos.secreto !== secreto) {
    return respuesta({ ok: false, error: 'No autorizado' });
  }
  try {
    if (datos.accion === 'enviarCorreo') return respuesta(enviarCorreo(datos));
    return respuesta({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    console.error(err);
    return respuesta({ ok: false, error: String(err) });
  }
}

/** Envía un correo de texto. Límite de Workspace: 1.500 destinatarios al día. */
function enviarCorreo(d) {
  if (!d.para || !d.asunto || !d.texto) return { ok: false, error: 'Faltan datos' };
  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, error: 'Cuota diaria de correo agotada' };
  var opciones = { name: NOMBRE_REMITENTE };
  if (d.responderA) opciones.replyTo = d.responderA;
  MailApp.sendEmail(d.para, d.asunto, d.texto, opciones);
  return { ok: true, restantes: MailApp.getRemainingDailyQuota() };
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Para probar desde el editor (Ejecutar › probarEnvio): se envía un correo a ti mismo. */
function probarEnvio() {
  var yo = Session.getActiveUser().getEmail();
  Logger.log(enviarCorreo({ para: yo, asunto: 'Prueba de Africa Directo', texto: 'Si lees esto, el envío funciona.' }));
}
