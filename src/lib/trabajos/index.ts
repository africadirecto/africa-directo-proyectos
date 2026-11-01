// Trabajos en segundo plano: informes (./informe.ts) y plantillas desde un ejemplo (./plantilla.ts).
// Lo llaman el aviso de OpenRouter (/api/ia/lotes) y el cron nocturno.

import { almacen } from '../almacen';
import { avanzarInforme } from './informe';
import { avanzarPlantilla } from './plantilla';

export { borrarLotesAbandonados, trabajosDelLote } from './comun';

/** Hace avanzar el trabajo de esa ruta, sea un informe o una plantilla. */
export async function avanzarTrabajo(ruta: string): Promise<void> {
  const plantilla = ruta.match(/^plantillas\/([\w-]+)$/);
  if (plantilla) await avanzarPlantilla(plantilla[1]);
  else await avanzarInforme(ruta);
}

/** Lo llama el cron: avanza lo que se quedó a medias y da por fallido lo que lleva días sin terminar. */
export async function avanzarPendientes(): Promise<{ avanzados: number; caducados: number }> {
  const db = await almacen();
  let avanzados = 0;
  let caducados = 0;
  const inicio = Date.now();
  const limite = new Date(Date.now() - 4 * 86_400_000).toISOString();
  for (const t of await db.consultar<{ ruta: string; creado: string }>('trabajos')) {
    // La función del cron tiene 300 s; lo que no dé tiempo, la noche siguiente.
    if (Date.now() - inicio > 200_000) break;
    if (t.creado < limite) {
      await db.guardar(t.ruta, { estado: 'error', error: 'Lleva varios días sin terminar. Pulsa «Reintentar».', proceso: null }, { fusionar: true }).catch(() => undefined);
      await db.borrar(`trabajos/${t.id}`);
      caducados += 1;
    } else {
      await avanzarTrabajo(t.ruta);
      avanzados += 1;
    }
  }
  return { avanzados, caducados };
}
