// Aportaciones (aportaciones/{id}): relación proyecto–donante. Permite la
// cofinanciación y sirve de embudo de captación (ofrecida → … → recibida).
// Todo en euros: la ONG financia en euros, aunque el presupuesto de la contraparte
// esté en su moneda (ver Proyecto.presupuestoEur).

import { almacen } from '../almacen';
import { dinero } from '../formato';
import { cambiarEstado, actualizarProyecto, leerProyecto } from './proyectos';
import { anotarEvento } from './eventos';
import { ESTADOS_APORTACION } from '../estados';

export { ESTADOS_APORTACION };
import type { Aportacion, EstadoAportacion, EstadoProyecto, Persona, Proyecto } from '../tipos';

export type AportacionConId = Aportacion & { id: string };

/** Solo cuentan para financiar el proyecto las aportaciones comprometidas o recibidas. */
const CUENTAN: EstadoAportacion[] = ['comprometida', 'recibida'];

export function totales(aps: Pick<Aportacion, 'estado' | 'importe' | 'donanteId'>[]) {
  const validas = aps.filter((a) => CUENTAN.includes(a.estado));
  return {
    comprometido: validas.reduce((s, a) => s + a.importe, 0),
    recibido: validas.filter((a) => a.estado === 'recibida').reduce((s, a) => s + a.importe, 0),
    numDonantes: new Set(validas.map((a) => a.donanteId)).size,
  };
}

/** Presupuesto que se financia, en euros. */
export function presupuestoEnEuros(p: Pick<Proyecto, 'presupuestoEur' | 'presupuesto' | 'moneda'>): number | null {
  return p.presupuestoEur ?? (p.moneda === 'EUR' ? p.presupuesto : null);
}

/** El proyecto pasa a Aprobado cuando lo comprometido (en euros) cubre el presupuesto en euros. */
export function cubrePresupuesto(estado: EstadoProyecto, presupuesto: number | null, comprometido: number): boolean {
  return estado === 'financiacion' && !!presupuesto && presupuesto > 0 && comprometido >= presupuesto;
}

export async function aportacionesDeProyecto(codigo: string): Promise<AportacionConId[]> {
  const lista = await (await almacen()).consultar<Aportacion>('aportaciones', { donde: [['proyecto', '==', codigo]] });
  return lista.sort((a, b) => b.importe - a.importe);
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
  const objetivo = presupuestoEnEuros(p);
  if (cubrePresupuesto(p.estado, objetivo, p.comprometido)) {
    await cambiarEstado(codigo, 'aprobado', `Financiación cubierta: ${dinero(p.comprometido)} comprometidos de ${dinero(objetivo)}.`, autor);
  }
}

export type DatosAportacion = Pick<Aportacion, 'donanteId' | 'donanteNombre' | 'importe' | 'estado' | 'notas'>;

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
    texto: `${d.donanteNombre}: ${dinero(d.importe)} (${ESTADOS_APORTACION[d.estado].nombre.toLowerCase()}).`,
  });
  await recalcularFinanciacion(codigo, autor);
}

export async function actualizarAportacion(
  id: string,
  cambios: Partial<Pick<Aportacion, 'importe' | 'estado' | 'notas'>>,
  autor: Persona,
): Promise<void> {
  const db = await almacen();
  const a = await db.leer<Aportacion>(`aportaciones/${id}`);
  if (!a) throw new Error('Aportación no encontrada');
  await db.guardar(`aportaciones/${id}`, { ...cambios, actualizado: new Date().toISOString(), actualizadoPor: autor }, { fusionar: true });
  const partes: string[] = [];
  if (cambios.estado && cambios.estado !== a.estado) {
    partes.push(`${ESTADOS_APORTACION[a.estado].nombre.toLowerCase()} → ${ESTADOS_APORTACION[cambios.estado].nombre.toLowerCase()}`);
  }
  if (cambios.importe != null && cambios.importe !== a.importe) partes.push(`importe ${dinero(a.importe)} → ${dinero(cambios.importe)}`);
  if (partes.length) {
    await anotarEvento(a.proyecto, { tipo: 'aportacion', categoria: 'economico', autor, texto: `${a.donanteNombre}: ${partes.join(', ')}.` });
  }
  await recalcularFinanciacion(a.proyecto, autor);
}

/** Elimina una aportación registrada por error (si el donante dice que no, mejor «descartada»). */
export async function eliminarAportacion(id: string, autor: Persona): Promise<string> {
  const db = await almacen();
  const a = await db.leer<Aportacion>(`aportaciones/${id}`);
  if (!a) throw new Error('Aportación no encontrada');
  await db.borrar(`aportaciones/${id}`);
  await anotarEvento(a.proyecto, {
    tipo: 'aportacion',
    categoria: 'economico',
    autor,
    texto: `Aportación eliminada: ${a.donanteNombre}, ${dinero(a.importe)} (${ESTADOS_APORTACION[a.estado].nombre.toLowerCase()}).`,
  });
  await recalcularFinanciacion(a.proyecto, autor);
  return a.proyecto;
}

/** Mantiene el nombre copiado en las aportaciones cuando se renombra un donante. */
export async function renombrarDonanteEnAportaciones(donanteId: string, nombre: string): Promise<void> {
  const db = await almacen();
  for (const a of await aportacionesDeDonante(donanteId)) {
    if (a.donanteNombre !== nombre) await db.guardar(`aportaciones/${a.id}`, { donanteNombre: nombre }, { fusionar: true });
  }
}
