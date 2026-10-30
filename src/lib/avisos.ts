// Avisos salientes: mensajes a Google Chat (webhook). La app no envía correos: los textos
// para las contrapartes se muestran listos para copiar y los envía un voluntario.

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

/** Alias de correo del proyecto: las respuestas a esta dirección se asignan solas al proyecto. */
export function aliasProyecto(codigo: string): string {
  const [usuario, dominio] = config.ong.correoProyectos.split('@');
  return usuario && dominio ? `${usuario}+${codigo}@${dominio}` : '';
}
