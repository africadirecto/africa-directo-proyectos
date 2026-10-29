// Aportaciones (aportaciones/{id}): relación proyecto–donante. Permite la
// cofinanciación y sirve de embudo de captación (ofrecida → … → recibida).

import { almacen } from '../almacen';
import { dinero } from '../formato';
import { cambiarEstado, actualizarProyecto, leerProyecto } from './proyectos';
import { anotarEvento } from './eventos';
import { ESTADOS_APORTACION } from '../estados';

export { ESTADOS_APORTACION };
import type { Aportacion, EstadoAportacion, EstadoProyecto, Persona } from '../tipos';

export type AportacionConId = Aportacion & { id: string };

/** Solo cuentan para financiar el proyecto las aportaciones comprometidas o recibidas. */
const CUENTAN: EstadoAportacion[] = ['comprometida', 'recibida'];

export function totales(aps: Pick<Aportacion, 'estado' | 'importeProyecto' | 'donanteId'>[]) {
  const validas = aps.filter((a) => CUENTAN.includes(a.estado));
  return {
    comprometido: validas.reduce((s, a) => s + a.importeProyecto, 0),
    recibido: validas.filter((a) => a.estado === 'recibida').reduce((s, a) => s + a.importeProyecto, 0),
    numDonantes: new Set(validas.map((a) => a.donanteId)).size,
  };
}

/** El proyecto pasa a Aprobado cuando lo comprometido cubre el presupuesto. */
export function cubrePresupuesto(estado: EstadoProyecto, presupuesto: number | null, comprometido: number): boolean {
  return estado === 'financiacion' && !!presupuesto && presupuesto > 0 && comprometido >= presupuesto;
}

export async function aportacionesDeProyecto(codigo: string): Promise<AportacionConId[]> {
  const lista = await (await almacen()).consultar<Aportacion>('aportaciones', { donde: [['proyecto', '==', codigo]] });
  return lista.sort((a, b) => b.importeProyecto - a.importeProyecto);
}

export async function aportacionesDeDonante(donanteId: string): Promise<AportacionConId[]> {
  const lista = await (await almacen()).consultar<Aportacion>('aportaciones', { donde: [['donanteId', '==', donanteId]] });
  return lista.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
}

/** Recalcula los totales del proyecto y aplica los cambios de estado automáticos. */
export async function recalcularFinanciacion(codigo: string, autor: Persona): Promise<void> {
  const aps = await aportacionesDeProyecto(codigo);
  let p = await actualizarProyecto(codigo, totales(aps));
  if (p.estado === 'validada' && aps.some((a) => a.estado !== 'descartada')) {
    p = await cambiarEstado(codigo, 'financiacion', 'Empieza la búsqueda de financiación (primera aportación registrada).', autor);
  }
  if (cubrePresupuesto(p.estado, p.presupuesto, p.comprometido)) {
    await cambiarEstado(
      codigo,
      'aprobado',
      `Financiación cubierta: ${dinero(p.comprometido, p.moneda)} comprometidos de ${dinero(p.presupuesto, p.moneda)}.`,
      autor,
    );
  }
}

export type DatosAportacion = Pick<Aportacion, 'donanteId' | 'donanteNombre' | 'importe' | 'moneda' | 'importeProyecto' | 'estado' | 'notas'>;

export async function crearAportacion(codigo: string, d: DatosAportacion, autor: Persona): Promise<void> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  const ahora = new Date().toISOString();
  const a: Aportacion = { ...d, proyecto: codigo, proyectoTitulo: p.titulo, creado: ahora, actualizado: ahora, actualizadoPor: autor };
  await (await almacen()).crear('aportaciones', { ...a });
  await anotarEvento(codigo, {
    tipo: 'aportacion',
    categoria: 'economico',
    autor,
    texto: `${d.donanteNombre}: ${dinero(d.importe, d.moneda)} (${ESTADOS_APORTACION[d.estado].nombre.toLowerCase()}).`,
  });
  await recalcularFinanciacion(codigo, autor);
}

export async function actualizarAportacion(
  id: string,
  cambios: Partial<Pick<Aportacion, 'importe' | 'importeProyecto' | 'estado' | 'notas'>>,
  autor: Persona,
): Promise<void> {
  const db = await almacen();
  const a = await db.leer<Aportacion>(`aportaciones/${id}`);
  if (!a) throw new Error('Aportación no encontrada');
  await db.guardar(`aportaciones/${id}`, { ...cambios, actualizado: new Date().toISOString(), actualizadoPor: autor }, { fusionar: true });
  if (cambios.estado && cambios.estado !== a.estado) {
    await anotarEvento(a.proyecto, {
      tipo: 'aportacion',
      categoria: 'economico',
      autor,
      texto: `${a.donanteNombre}: ${ESTADOS_APORTACION[a.estado].nombre.toLowerCase()} → ${ESTADOS_APORTACION[cambios.estado].nombre.toLowerCase()} (${dinero(cambios.importe ?? a.importe, a.moneda)}).`,
    });
  }
  await recalcularFinanciacion(a.proyecto, autor);
}

/** Mantiene el nombre copiado en las aportaciones cuando se renombra un donante. */
export async function renombrarDonanteEnAportaciones(donanteId: string, nombre: string): Promise<void> {
  const db = await almacen();
  for (const a of await aportacionesDeDonante(donanteId)) {
    if (a.donanteNombre !== nombre) await db.guardar(`aportaciones/${a.id}`, { donanteNombre: nombre }, { fusionar: true });
  }
}
