// Cronología de cada proyecto (proyectos/{codigo}/eventos).

import { almacen } from '../almacen';
import type { Evento } from '../tipos';

export async function anotarEvento(codigo: string, e: Omit<Evento, 'fecha'> & { fecha?: string }): Promise<void> {
  await (await almacen()).crear(`proyectos/${codigo}/eventos`, { ...e, fecha: e.fecha ?? new Date().toISOString() });
}

export async function listarEventos(codigo: string, limite = 100): Promise<(Evento & { id: string })[]> {
  return (await almacen()).consultar<Evento>(`proyectos/${codigo}/eventos`, { orden: ['fecha', 'desc'], limite });
}

/** Eventos de un periodo (fechas AAAA-MM-DD, ambas incluidas), del más reciente al más antiguo. */
export async function eventosEntre(codigo: string, desde: string, hasta: string, limite = 120): Promise<(Evento & { id: string })[]> {
  return (await almacen()).consultar<Evento>(`proyectos/${codigo}/eventos`, {
    donde: [
      ['fecha', '>=', desde],
      ['fecha', '<=', `${hasta}T23:59:59.999Z`],
    ],
    orden: ['fecha', 'desc'],
    limite,
  });
}
