// Lo común de los trabajos en segundo plano (informes y plantillas desde un ejemplo).
//
// Cada trabajo a medias se apunta en trabajos/{ruta con «~»} con el lote que espera, si lo hay:
// así el aviso de OpenRouter encuentra a quién despertar y el cron, lo que se quedó a medias.

import { almacen } from '../almacen';
import { config } from '../config';
import { borrarLote } from '../ia/lotes';
import { ErrorIA } from '../ia/openrouter';

export const claveTrabajo = (ruta: string) => ruta.replace(/\//g, '~');

export async function apuntarTrabajo(ruta: string, tipo: 'informe' | 'plantilla'): Promise<void> {
  await (await almacen()).guardar(`trabajos/${claveTrabajo(ruta)}`, { ruta, tipo, lote: '', creado: new Date().toISOString() });
}

export async function apuntarLote(ruta: string, lote: string): Promise<void> {
  await (await almacen()).guardar(`trabajos/${claveTrabajo(ruta)}`, { lote }, { fusionar: true });
}

export async function quitarTrabajo(ruta: string): Promise<void> {
  await (await almacen()).borrar(`trabajos/${claveTrabajo(ruta)}`).catch(() => undefined);
}

/** Lotes solo si la app tiene una dirección pública a la que OpenRouter pueda avisar (en local y en demo, no). */
export function usarLotes(): boolean {
  return config.ia.lotes && /^https:\/\//.test(config.appUrl) && !/localhost|127\.0\.0\.1/.test(config.appUrl);
}

/** Dirección a la que OpenRouter avisa al terminar un lote. */
export const urlAviso = () => `${config.appUrl.replace(/\/$/, '')}/api/ia/lotes`;

/** Recién creado, OpenRouter tarda un poco en poder consultar un lote (responde 404): sigue en curso. */
export const loteReciente = (enviado: string, e: unknown) => e instanceof ErrorIA && e.status === 404 && Date.now() - Date.parse(enviado) < 10 * 60_000;

/** Un lote que ya no se va a leer: se borra en OpenRouter ahora o, si aún está en curso, en el cron. */
export async function lotePorBorrar(id: string): Promise<void> {
  try {
    await borrarLote(id);
  } catch {
    await (await almacen()).guardar(`lotesPorBorrar/${id}`, { creado: new Date().toISOString() });
  }
}

/** Lo llama el cron: borra en OpenRouter los lotes abandonados (cuando ya han terminado). */
export async function borrarLotesAbandonados(): Promise<number> {
  const db = await almacen();
  let borrados = 0;
  for (const l of await db.consultar('lotesPorBorrar')) {
    try {
      await borrarLote(l.id);
      await db.borrar(`lotesPorBorrar/${l.id}`);
      borrados += 1;
    } catch (e) {
      // 404: ya no existe. Otro error (p. ej. aún en curso): se intenta la noche siguiente.
      if (e instanceof ErrorIA && e.status === 404) await db.borrar(`lotesPorBorrar/${l.id}`);
    }
  }
  return borrados;
}

/** Rutas de los trabajos que esperan a un lote (para el aviso de OpenRouter). */
export async function trabajosDelLote(lote: string): Promise<string[]> {
  return (await (await almacen()).consultar<{ ruta: string }>('trabajos', { donde: [['lote', '==', lote]] })).map((t) => t.ruta);
}
