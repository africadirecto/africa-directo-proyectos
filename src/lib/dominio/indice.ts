// Índice del panel: un único documento (indices/proyectos) con una fila por proyecto.
// El inicio, el mapa, los avisos y el contador de solicitudes se sirven con una
// sola lectura, en vez de leer todos los proyectos (cuota de Firestore Spark).
// La copia nocturna lo reconstruye por si alguna vez se desincroniza.

import { almacen } from '../almacen';
import type { FilaPanel, Proyecto } from '../tipos';

const RUTA = 'indices/proyectos';

export function filaDe(p: Proyecto): FilaPanel {
  return {
    codigo: p.codigo,
    titulo: p.titulo,
    sector: p.sector,
    pais: p.pais,
    lugar: p.lugar,
    lat: p.lat,
    lng: p.lng,
    estado: p.estado,
    moneda: p.moneda,
    presupuesto: p.presupuesto,
    comprometido: p.comprometido,
    contraparte: p.contraparte.nombre,
    contraparteId: p.contraparte.id,
    responsableId: p.responsable?.id ?? null,
    formulario: p.formulario.estado,
    formularioEnviadoEn: p.formulario.enviadoEn,
    ultimaNoticia: p.ultimaNoticia,
    anio: p.anio,
    actualizado: p.fechas.actualizado,
  };
}

export async function actualizarIndice(p: Proyecto): Promise<void> {
  await (await almacen()).guardar(RUTA, { items: { [p.codigo]: filaDe(p) } }, { fusionar: true });
}

export async function leerIndice(): Promise<FilaPanel[]> {
  const doc = await (await almacen()).leer<{ items?: Record<string, FilaPanel> }>(RUTA);
  return Object.values(doc?.items ?? {}).sort((a, b) => b.codigo.localeCompare(a.codigo));
}

export async function reconstruirIndice(): Promise<number> {
  const db = await almacen();
  const proyectos = await db.consultar<Proyecto>('proyectos');
  const items = Object.fromEntries(proyectos.map((p) => [p.codigo, filaDe(p)]));
  await db.guardar(RUTA, { items, reconstruido: new Date().toISOString() });
  return proyectos.length;
}
