// Ciclo de vida de un proyecto: estados, etiquetas y transiciones permitidas.
//
// Solicitud → En revisión → Financiación → Aprobado → En ejecución → Completado → Cerrado
//                 ↓ (pide cambios: vuelve a Solicitud)          ↕ Parado
//             Rechazada                         (Cancelado posible desde cualquier estado)
//
// Al validar la propuesta pasa a Financiación. Antes de empezar, Financiación y Aprobado los pone
// la app según el dinero comprometido (ver recalcularFinanciacion). Desde En ejecución se puede
// volver a antes de empezar, y el último cambio hecho a mano se puede deshacer (ver deshacerCambio).

import type { EstadoProyecto } from './tipos';

export const ESTADOS: Record<EstadoProyecto, { nombre: string; clase: string; color: string; descripcion: string }> = {
  solicitud: { nombre: 'Solicitud', clase: 's-sol', color: '#6B6A63', descripcion: 'La contraparte está rellenando el formulario de solicitud.' },
  revision: { nombre: 'En revisión', clase: 's-rev', color: '#B26B00', descripcion: 'La solicitud ha llegado y un voluntario la está revisando.' },
  financiacion: { nombre: 'Financiación', clase: 's-fin', color: '#4F3A99', descripcion: 'Propuesta validada: se buscan donantes hasta cubrir el presupuesto.' },
  aprobado: { nombre: 'Aprobado', clase: 's-apr', color: '#1D6B50', descripcion: 'Los compromisos de los donantes cubren el presupuesto: se puede enviar el dinero y empezar.' },
  ejecucion: { nombre: 'En ejecución', clase: 's-eje', color: '#0F5E66', descripcion: 'La obra o actividad está en marcha.' },
  parado: { nombre: 'Parado', clase: 's-par', color: '#C0281C', descripcion: 'La ejecución está detenida por una incidencia.' },
  completado: { nombre: 'Completado', clase: 's-com', color: '#334155', descripcion: 'La obra ha terminado; faltan los informes finales y el cierre.' },
  cerrado: { nombre: 'Cerrado', clase: 's-cer', color: '#9A9992', descripcion: 'Terminado del todo: informes entregados y cuentas cerradas.' },
  rechazada: { nombre: 'Rechazada', clase: 's-par', color: '#C0281C', descripcion: 'La solicitud no se va a financiar.' },
  cancelado: { nombre: 'Cancelado', clase: 's-cer', color: '#9A9992', descripcion: 'El proyecto se ha abandonado.' },
};

/** Recorrido principal que se dibuja en la ficha. */
export const FASES: EstadoProyecto[] = ['solicitud', 'revision', 'financiacion', 'aprobado', 'ejecucion', 'completado', 'cerrado'];

/** Estados en los que el proyecto sigue vivo (filtro "Activos"). */
export const ACTIVOS: EstadoProyecto[] = ['solicitud', 'revision', 'financiacion', 'aprobado', 'ejecucion', 'parado', 'completado'];

/** Estados en los que se esperan noticias periódicas de la contraparte. */
export const EN_MARCHA: EstadoProyecto[] = ['aprobado', 'ejecucion', 'parado'];

/** Antes de empezar: el estado lo decide el dinero comprometido. */
export const ANTES_DE_EMPEZAR: EstadoProyecto[] = ['financiacion', 'aprobado'];

const FINALES: EstadoProyecto[] = ['cerrado', 'rechazada', 'cancelado'];

export const TRANSICIONES: Record<EstadoProyecto, EstadoProyecto[]> = {
  solicitud: ['revision'],
  revision: ['financiacion', 'solicitud', 'rechazada'],
  financiacion: ['aprobado', 'ejecucion'],
  aprobado: ['financiacion', 'ejecucion'],
  ejecucion: ['parado', 'completado', 'financiacion', 'aprobado'],
  parado: ['ejecucion'],
  completado: ['cerrado', 'ejecucion'],
  cerrado: [],
  rechazada: [],
  cancelado: [],
};

/** Los datos antiguos pueden tener «validada», que ahora es Financiación. */
export function normalizarEstado(estado: string): EstadoProyecto {
  return estado === 'validada' ? 'financiacion' : (estado as EstadoProyecto);
}

export function transicionesDesde(estado: EstadoProyecto): EstadoProyecto[] {
  const base = TRANSICIONES[estado];
  return FINALES.includes(estado) ? base : [...base, 'cancelado'];
}

/** A qué estado se vuelve antes de empezar: Aprobado si lo comprometido cubre el presupuesto. */
export function antesDeEmpezar(cubierto: boolean): EstadoProyecto {
  return cubierto ? 'aprobado' : 'financiacion';
}

/**
 * Cambios que se pueden hacer a mano desde la ficha. Mientras es una solicitud, solo cancelar:
 * la contraparte la envía con el formulario y el revisor decide desde Solicitudes. Financiación y
 * Aprobado los pone la app según el dinero; a mano solo se vuelve a ellos desde En ejecución.
 */
export function estadosManuales(estado: EstadoProyecto, cubierto: boolean): EstadoProyecto[] {
  if (estado === 'solicitud' || estado === 'revision') return ['cancelado'];
  const previo = estado === 'ejecucion' ? antesDeEmpezar(cubierto) : null;
  return transicionesDesde(estado).filter((e) => !ANTES_DE_EMPEZAR.includes(e) || e === previo);
}

export function puedePasar(de: EstadoProyecto, a: EstadoProyecto): boolean {
  return transicionesDesde(de).includes(a);
}

/** Índice de la fase actual en el recorrido (Parado cuenta como En ejecución). */
export function indiceFase(estado: EstadoProyecto): number {
  if (estado === 'parado') return FASES.indexOf('ejecucion');
  return FASES.indexOf(estado);
}

/** Si el cambio lleva a una fase anterior del recorrido. */
export function esVueltaAtras(de: EstadoProyecto, a: EstadoProyecto): boolean {
  return FASES.includes(a) && indiceFase(a) < indiceFase(de);
}

export function esFinal(estado: EstadoProyecto): boolean {
  return FINALES.includes(estado);
}
