// Avisos salientes: mensajes a Google Chat (webhook) y correos a través de
// Apps Script, que los envía desde el buzón de proyectos de la ONG.

import { config } from './config';

/** Mensaje al espacio de Google Chat de los voluntarios. No falla si no está configurado. */
export async function avisarChat(texto: string): Promise<void> {
  if (!config.avisos.chatWebhook) {
    if (config.modoDemo) console.info(`[Chat] ${texto}`);
    return;
  }
  try {
    await fetch(config.avisos.chatWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: texto }),
    });
  } catch (e) {
    console.error('No se pudo avisar por Chat', e);
  }
}

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  /** Dirección para las respuestas, p. ej. proyectos+P-2026-014@dominio. */
  responderA?: string;
}

export const correoDisponible = () => !!config.avisos.appsScriptUrl;

/** Envía un correo con Apps Script. Devuelve false si no está configurado o falla. */
export async function enviarCorreo(c: Correo): Promise<boolean> {
  if (!correoDisponible()) {
    if (config.modoDemo) console.info(`[Correo a ${c.para}] ${c.asunto}\n${c.texto}`);
    return false;
  }
  try {
    const res = await fetch(config.avisos.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secreto: config.avisos.appsScriptSecreto, accion: 'enviarCorreo', ...c }),
      redirect: 'follow',
    });
    const datos = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!datos.ok) console.error('Apps Script no envió el correo', datos.error);
    return !!datos.ok;
  } catch (e) {
    console.error('No se pudo enviar el correo', e);
    return false;
  }
}

/** Alias de correo del proyecto: las respuestas a esta dirección se asignan solas al proyecto. */
export function aliasProyecto(codigo: string): string {
  const [usuario, dominio] = config.ong.correoProyectos.split('@');
  return usuario && dominio ? `${usuario}+${codigo}@${dominio}` : '';
}
