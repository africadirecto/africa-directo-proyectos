// Financiación de un proyecto, como registros que reflejan lo que pasa de verdad, cada uno
// con su fecha y una nota opcional:
// - compromiso: un donante dice que pone X € (aportaciones/{id}, una por donante y proyecto);
// - cobro: llega a Africa Directo dinero de un donante (dentro de su aportación);
// - envío: Africa Directo transfiere dinero a la contraparte (en el proyecto, sin donante).
// Límites: no se cobra de un donante más de lo comprometido ni se envía más de lo cobrado.
// Todo en euros: la ONG financia en euros, aunque el presupuesto de la contraparte
// esté en su moneda (ver Proyecto.presupuestoEur).

import { almacen } from '../almacen';
import { dinero, fechaCorta } from '../formato';
import { cambiarEstado, actualizarProyecto, leerProyecto } from './proyectos';
import { anotarEvento } from './eventos';
import type { Aportacion, Cobro, Compromiso, Envio, Movimiento, Persona, Proyecto } from '../tipos';

export type AportacionConId = Aportacion & { id: string };

const suma = (lista: { importe: number }[]) => lista.reduce((s, x) => s + x.importe, 0);
const nuevoId = () => Math.random().toString(36).slice(2, 10);
const dia = (fecha: string) => fechaCorta(`${fecha}T12:00:00Z`);
const porFecha = <T extends Movimiento>(lista: T[]) => [...lista].sort((x, y) => x.fecha.localeCompare(y.fecha));

/** Totales del proyecto: lo comprometido y lo cobrado salen de las aportaciones; lo enviado, de los envíos. */
export function totales(aps: Pick<Aportacion, 'importe' | 'recibido' | 'donanteId'>[], envios: Pick<Envio, 'importe'>[] = []) {
  return {
    comprometido: suma(aps),
    recibido: aps.reduce((s, a) => s + a.recibido, 0),
    enviado: suma(envios),
    numDonantes: new Set(aps.filter((a) => a.importe > 0).map((a) => a.donanteId)).size,
  };
}

/**
 * Límites del dinero: no se cobra de un donante más de lo que ha comprometido, ni se envía
 * a la contraparte más de lo cobrado en el proyecto. Devuelven el mensaje de error, o null.
 * Los formularios hacen la misma comprobación antes de enviar.
 */
export function excedeCobro(a: Pick<Aportacion, 'importe' | 'recibido' | 'donanteNombre'>, importe: number): string | null {
  const queda = Math.max(0, a.importe - a.recibido);
  if (importe <= queda + 0.005) return null;
  return queda
    ? `A ${a.donanteNombre} solo le quedan ${dinero(queda)} por pagar. Si aporta más, registra antes su compromiso.`
    : `${a.donanteNombre} ya ha pagado todo lo comprometido. Si aporta más, registra antes su compromiso.`;
}

export function excedeEnvio(recibido: number, enviado: number, importe: number): string | null {
  const disponible = Math.max(0, recibido - enviado);
  if (importe <= disponible + 0.005) return null;
  return disponible ? `Solo hay ${dinero(disponible)} cobrados sin enviar.` : 'No hay dinero cobrado sin enviar a la contraparte.';
}

/** Importe de un formulario: positivo y con dos decimales como mucho. */
export function importeValido(n: number | null, que = 'el importe'): number {
  if (n == null || !Number.isFinite(n) || n <= 0) throw new Error(`Escribe ${que} en euros.`);
  return Math.round(n * 100) / 100;
}

/** Fecha AAAA-MM-DD de un formulario; vacía, hoy. No se admiten fechas futuras. */
export function fechaValida(f: string, hoy = new Date().toISOString().slice(0, 10)): string {
  if (!f) return hoy;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || Number.isNaN(Date.parse(f))) throw new Error('La fecha no es válida.');
  if (f > hoy) throw new Error('La fecha no puede ser futura: registra el movimiento cuando ocurra.');
  return f;
}

/** Lo que puede venir guardado de versiones anteriores de la app. */
type Guardada = Partial<Aportacion> & Pick<Aportacion, 'proyecto' | 'donanteId' | 'donanteNombre' | 'creado' | 'actualizado'> & { id: string; estado?: string; notas?: string };

/**
 * Las aportaciones antiguas tenían un importe y un estado (ofrecida, interesado, comprometida,
 * recibida o descartada), y algunas un compromiso sin registros: se leen como registros.
 * Las que nunca llegaron a comprometerse no cuentan y no se muestran (ver conDinero).
 */
function normalizar(a: Guardada): AportacionConId {
  const { estado, notas, ...resto } = a;
  const importeAntiguo = a.importe ?? 0;
  const cuenta = estado === undefined || estado === 'comprometida' || estado === 'recibida';
  const compromisos: Compromiso[] = Array.isArray(a.compromisos)
    ? a.compromisos
    : cuenta && importeAntiguo > 0
      ? [{ id: 'k1', importe: importeAntiguo, fecha: a.creado.slice(0, 10), nota: notas ?? '' }]
      : [];
  const cobros: Cobro[] = Array.isArray(a.cobros)
    ? a.cobros
    : estado === 'recibida'
      ? [{ id: 'c1', importe: importeAntiguo, fecha: a.actualizado.slice(0, 10), nota: '' }]
      : [];
  return { proyectoTitulo: '', actualizadoPor: { id: '', nombre: '' }, ...resto, compromisos, cobros, importe: suma(compromisos), recibido: suma(cobros) } as AportacionConId;
}

const conDinero = (a: AportacionConId) => a.compromisos.length > 0 || a.cobros.length > 0;

/** Presupuesto que se financia, en euros. */
export function presupuestoEnEuros(p: Pick<Proyecto, 'presupuestoEur' | 'presupuesto' | 'moneda'>): number | null {
  return p.presupuestoEur ?? (p.moneda === 'EUR' ? p.presupuesto : null);
}

/** Si lo comprometido (en euros) cubre el presupuesto en euros: entonces el proyecto está Aprobado. */
export function cubrePresupuesto(presupuesto: number | null, comprometido: number): boolean {
  return !!presupuesto && presupuesto > 0 && comprometido >= presupuesto;
}

export function estaCubierto(p: Pick<Proyecto, 'presupuestoEur' | 'presupuesto' | 'moneda' | 'comprometido'>): boolean {
  return cubrePresupuesto(presupuestoEnEuros(p), p.comprometido);
}

export async function aportacionesDeProyecto(codigo: string): Promise<AportacionConId[]> {
  const lista = await (await almacen()).consultar<Guardada>('aportaciones', { donde: [['proyecto', '==', codigo]] });
  return lista.map(normalizar).filter(conDinero).sort((a, b) => b.importe - a.importe);
}

export async function aportacionesDeDonante(donanteId: string): Promise<AportacionConId[]> {
  const lista = await (await almacen()).consultar<Guardada>('aportaciones', { donde: [['donanteId', '==', donanteId]] });
  return lista.map(normalizar).filter(conDinero).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
}

/** Todas las aportaciones (para el panel de donantes). */
export async function todasLasAportaciones(): Promise<AportacionConId[]> {
  return (await (await almacen()).consultar<Guardada>('aportaciones')).map(normalizar).filter(conDinero);
}

async function leerAportacion(id: string): Promise<AportacionConId> {
  const a = await (await almacen()).leer<Guardada>(`aportaciones/${id}`);
  if (!a) throw new Error('Donante no encontrado en este proyecto.');
  return normalizar({ ...a, id });
}

/**
 * Recalcula los totales del proyecto y, antes de empezar la ejecución, lo pone en Aprobado o en
 * Financiación según cubra o no el presupuesto (también hacia atrás, si se quita un compromiso).
 */
export async function recalcularFinanciacion(codigo: string, autor: Persona): Promise<void> {
  const [aps, actual] = await Promise.all([aportacionesDeProyecto(codigo), leerProyecto(codigo)]);
  const p = await actualizarProyecto(codigo, totales(aps, actual?.envios ?? []));
  const cifras = `${dinero(p.comprometido)} comprometidos de ${dinero(presupuestoEnEuros(p))}`;
  if (p.estado === 'financiacion' && estaCubierto(p)) {
    await cambiarEstado(codigo, 'aprobado', `Financiación cubierta: ${cifras}.`, autor);
  } else if (p.estado === 'aprobado' && !estaCubierto(p)) {
    await cambiarEstado(codigo, 'financiacion', `La financiación ya no cubre el presupuesto: ${cifras}.`, autor);
  }
}

const anotar = (codigo: string, autor: Persona, texto: string) => anotarEvento(codigo, { tipo: 'aportacion', categoria: 'economico', autor, texto });
const detalle = (m: Omit<Movimiento, 'id'>) => `${dinero(m.importe)} (${dia(m.fecha)}).${m.nota ? ` ${m.nota}` : ''}`;

/** Guarda compromisos y cobros de una aportación; si se queda sin ninguno, la borra. */
async function guardarRegistros(a: AportacionConId, compromisos: Compromiso[], cobros: Cobro[], autor: Persona): Promise<void> {
  const db = await almacen();
  if (!compromisos.length && !cobros.length) {
    await db.borrar(`aportaciones/${a.id}`);
    return;
  }
  await db.guardar(
    `aportaciones/${a.id}`,
    { compromisos, cobros, importe: suma(compromisos), recibido: suma(cobros), actualizado: new Date().toISOString(), actualizadoPor: autor },
    { fusionar: true },
  );
}

/** Al quitar dinero cobrado, lo enviado a la contraparte no puede quedar por encima de lo cobrado. */
async function comprobarQueQuedaCobrado(codigo: string, quitar: number): Promise<void> {
  const [aps, p] = await Promise.all([aportacionesDeProyecto(codigo), leerProyecto(codigo)]);
  const enviado = suma(p?.envios ?? []);
  if (quitar > 0 && totales(aps).recibido - quitar < enviado - 0.005) {
    throw new Error(`No se puede quitar: ya se han enviado ${dinero(enviado)} a la contraparte y no quedarían cobrados. Quita antes el envío.`);
  }
}

// ── Compromisos ─────────────────────────────────────────────────────────────

/** Un donante se compromete. Si ya estaba en el proyecto, el compromiso se añade a los suyos. */
export async function registrarCompromiso(
  codigo: string,
  d: { donanteId: string; donanteNombre: string } & Omit<Compromiso, 'id'>,
  autor: Persona,
): Promise<'nuevo' | 'sumado'> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  const { donanteId, donanteNombre, ...c } = d;
  const compromiso = { ...c, id: nuevoId() };
  const existente = (await (await almacen()).consultar<Guardada>('aportaciones', { donde: [['proyecto', '==', codigo]] }))
    .map(normalizar)
    .find((a) => a.donanteId === donanteId);
  if (existente) {
    await guardarRegistros(existente, porFecha([...existente.compromisos, compromiso]), existente.cobros, autor);
    await anotar(codigo, autor, `${donanteNombre} amplía su compromiso: ${detalle(c)}`);
  } else {
    const ahora = new Date().toISOString();
    const a: Aportacion = {
      proyecto: codigo,
      proyectoTitulo: p.titulo,
      donanteId,
      donanteNombre,
      compromisos: [compromiso],
      cobros: [],
      importe: c.importe,
      recibido: 0,
      creado: ahora,
      actualizado: ahora,
      actualizadoPor: autor,
    };
    await (await almacen()).crear('aportaciones', { ...a });
    await anotar(codigo, autor, `${donanteNombre} se compromete: ${detalle(c)}`);
  }
  await recalcularFinanciacion(codigo, autor);
  return existente ? 'sumado' : 'nuevo';
}

/** Quita un compromiso registrado por error. Lo comprometido no puede quedar por debajo de lo cobrado. */
export async function quitarCompromiso(id: string, compromisoId: string, autor: Persona): Promise<string> {
  const a = await leerAportacion(id);
  const c = a.compromisos.find((x) => x.id === compromisoId);
  if (!c) throw new Error('Compromiso no encontrado.');
  const compromisos = a.compromisos.filter((x) => x.id !== compromisoId);
  if (suma(compromisos) < a.recibido - 0.005) {
    throw new Error(`Ya se han cobrado ${dinero(a.recibido)} de ${a.donanteNombre}: lo comprometido no puede quedar por debajo. Quita antes el cobro.`);
  }
  await guardarRegistros(a, compromisos, a.cobros, autor);
  await anotar(a.proyecto, autor, `Se quita el compromiso de ${a.donanteNombre} de ${detalle(c)}`);
  await recalcularFinanciacion(a.proyecto, autor);
  return a.proyecto;
}

// ── Cobros ──────────────────────────────────────────────────────────────────

export async function registrarCobro(id: string, c: Omit<Cobro, 'id'>, autor: Persona): Promise<string> {
  const a = await leerAportacion(id);
  const error = excedeCobro(a, c.importe);
  if (error) throw new Error(error);
  await guardarRegistros(a, a.compromisos, porFecha([...a.cobros, { ...c, id: nuevoId() }]), autor);
  await anotar(a.proyecto, autor, `Cobro de ${a.donanteNombre}: ${detalle(c)}`);
  await recalcularFinanciacion(a.proyecto, autor);
  return a.proyecto;
}

export async function quitarCobro(id: string, cobroId: string, autor: Persona): Promise<string> {
  const a = await leerAportacion(id);
  const c = a.cobros.find((x) => x.id === cobroId);
  if (!c) throw new Error('Cobro no encontrado.');
  await comprobarQueQuedaCobrado(a.proyecto, c.importe);
  await guardarRegistros(a, a.compromisos, a.cobros.filter((x) => x.id !== cobroId), autor);
  await anotar(a.proyecto, autor, `Se quita el cobro de ${a.donanteNombre} de ${detalle(c)}`);
  await recalcularFinanciacion(a.proyecto, autor);
  return a.proyecto;
}

// ── Envíos a la contraparte ─────────────────────────────────────────────────

export async function registrarEnvio(codigo: string, e: Omit<Envio, 'id'>, autor: Persona): Promise<void> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  const { recibido } = totales(await aportacionesDeProyecto(codigo));
  const error = excedeEnvio(recibido, suma(p.envios ?? []), e.importe);
  if (error) throw new Error(error);
  const envios = porFecha([...(p.envios ?? []), { ...e, id: nuevoId() }]);
  await actualizarProyecto(codigo, { envios, enviado: suma(envios) });
  await anotar(codigo, autor, `Envío a la contraparte: ${detalle(e)}`);
}

export async function quitarEnvio(codigo: string, envioId: string, autor: Persona): Promise<void> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  const e = (p.envios ?? []).find((x) => x.id === envioId);
  if (!e) throw new Error('Envío no encontrado.');
  const envios = (p.envios ?? []).filter((x) => x.id !== envioId);
  await actualizarProyecto(codigo, { envios, enviado: suma(envios) });
  await anotar(codigo, autor, `Se quita el envío a la contraparte de ${detalle(e)}`);
}

/** Mantiene el nombre copiado en las aportaciones cuando se renombra un donante. */
export async function renombrarDonanteEnAportaciones(donanteId: string, nombre: string): Promise<void> {
  const db = await almacen();
  for (const a of await (await db.consultar<Guardada>('aportaciones', { donde: [['donanteId', '==', donanteId]] })).map(normalizar)) {
    if (a.donanteNombre !== nombre) await db.guardar(`aportaciones/${a.id}`, { donanteNombre: nombre }, { fusionar: true });
  }
}
