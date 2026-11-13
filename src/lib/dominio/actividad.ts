// Actividad de toda la app, para Administración › Actividad: la cronología de cada proyecto
// (proyectos/{codigo}/eventos) y lo que no es de ningún proyecto (actividad/{id}), que por ahora
// son los cambios de acceso de los usuarios.
//
// Se lee por periodo, con una consulta por proyecto: las lecturas son los eventos de ese periodo.

import { almacen } from '../almacen';
import { eventosEntre } from './eventos';
import { leerIndice } from './indice';
import { listarEliminados } from './proyectos';
import type { Evento, Persona } from '../tipos';

/** Una fila de la tabla de actividad. */
export interface Actividad extends Evento {
  id: string;
  /** null: no es de ningún proyecto. */
  proyecto: { codigo: string; titulo: string; eliminado: boolean } | null;
}

/** Como mucho, por proyecto y periodo (los más recientes). */
const MAX_POR_PROYECTO = 300;

/** Anota algo que no es de ningún proyecto. Si falla, no interrumpe lo que se estaba haciendo. */
export async function registrarActividad(autor: Persona, texto: string): Promise<void> {
  try {
    await (await almacen()).crear('actividad', { tipo: 'sistema', fecha: new Date().toISOString(), autor, texto });
  } catch (e) {
    console.error('No se pudo anotar la actividad', e);
  }
}

/** Todo lo ocurrido en los últimos `dias` días, de lo más reciente a lo más antiguo. */
export async function actividadReciente(dias: number): Promise<Actividad[]> {
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - dias * 86_400_000).toISOString().slice(0, 10);
  const hasta = hoy.toISOString().slice(0, 10);
  const [filas, eliminados] = await Promise.all([leerIndice(), listarEliminados()]);
  const proyectos = [
    ...filas.map((f) => ({ codigo: f.codigo, titulo: f.titulo || `Solicitud de ${f.contraparte}`, eliminado: false })),
    ...eliminados.map((p) => ({ codigo: p.codigo, titulo: p.titulo || `Solicitud de ${p.contraparte.nombre}`, eliminado: true })),
  ];
  const [porProyecto, generales] = await Promise.all([
    Promise.all(proyectos.map(async (p) => (await eventosEntre(p.codigo, desde, hasta, MAX_POR_PROYECTO)).map((e) => ({ ...e, id: `${p.codigo}/${e.id}`, proyecto: p })))),
    (await almacen()).consultar<Evento>('actividad', { donde: [['fecha', '>=', desde]], orden: ['fecha', 'desc'], limite: MAX_POR_PROYECTO }),
  ]);
  return [...porProyecto.flat(), ...generales.map((e) => ({ ...e, proyecto: null }))].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
