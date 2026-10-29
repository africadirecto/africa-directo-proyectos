// Cronología de cada proyecto (proyectos/{codigo}/eventos).

import { almacen } from '../almacen';
import type { Evento } from '../tipos';

export async function anotarEvento(codigo: string, e: Omit<Evento, 'fecha'> & { fecha?: string }): Promise<void> {
  await (await almacen()).crear(`proyectos/${codigo}/eventos`, { ...e, fecha: e.fecha ?? new Date().toISOString() });
}

export async function listarEventos(codigo: string, limite = 100): Promise<(Evento & { id: string })[]> {
  return (await almacen()).consultar<Evento>(`proyectos/${codigo}/eventos`, { orden: ['fecha', 'desc'], limite });
}
