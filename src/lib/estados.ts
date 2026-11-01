// Ciclo de vida de un proyecto: estados, etiquetas y transiciones permitidas.
//
// Solicitud → En revisión → Validada → Financiación → Aprobado → En ejecución → Completado → Cerrado
//                 ↓ (pide cambios: vuelve a Solicitud)                  ↕ Parado
//             Rechazada                                   (Cancelado posible desde cualquier estado)

import type { EstadoProyecto } from './tipos';

export const ESTADOS: Record<EstadoProyecto, { nombre: string; clase: string; color: string }> = {
  solicitud: { nombre: 'Solicitud', clase: 's-sol', color: '#6B6A63' },
  revision: { nombre: 'En revisión', clase: 's-rev', color: '#B26B00' },
  validada: { nombre: 'Validada', clase: 's-val', color: '#1F4E8C' },
  financiacion: { nombre: 'Financiación', clase: 's-fin', color: '#4F3A99' },
  aprobado: { nombre: 'Aprobado', clase: 's-apr', color: '#1D6B50' },
  ejecucion: { nombre: 'En ejecución', clase: 's-eje', color: '#0F5E66' },
  parado: { nombre: 'Parado', clase: 's-par', color: '#C0281C' },
  completado: { nombre: 'Completado', clase: 's-com', color: '#334155' },
  cerrado: { nombre: 'Cerrado', clase: 's-cer', color: '#9A9992' },
  rechazada: { nombre: 'Rechazada', clase: 's-par', color: '#C0281C' },
  cancelado: { nombre: 'Cancelado', clase: 's-cer', color: '#9A9992' },
};

/** Recorrido principal que se dibuja en la ficha. */
export const FASES: EstadoProyecto[] = [
  'solicitud',
  'revision',
  'validada',
  'financiacion',
  'aprobado',
  'ejecucion',
  'completado',
  'cerrado',
];

/** Estados en los que el proyecto sigue vivo (filtro "Activos"). */
export const ACTIVOS: EstadoProyecto[] = [
  'solicitud',
  'revision',
  'validada',
  'financiacion',
  'aprobado',
  'ejecucion',
  'parado',
  'completado',
];

/** Estados en los que se esperan noticias periódicas de la contraparte. */
export const EN_MARCHA: EstadoProyecto[] = ['aprobado', 'ejecucion', 'parado'];

const FINALES: EstadoProyecto[] = ['cerrado', 'rechazada', 'cancelado'];

export const TRANSICIONES: Record<EstadoProyecto, EstadoProyecto[]> = {
  solicitud: ['revision'],
  revision: ['validada', 'solicitud', 'rechazada'],
  validada: ['financiacion'],
  financiacion: ['aprobado', 'validada'],
  aprobado: ['ejecucion', 'financiacion'],
  ejecucion: ['parado', 'completado'],
  parado: ['ejecucion'],
  completado: ['cerrado', 'ejecucion'],
  cerrado: [],
  rechazada: [],
  cancelado: [],
};

export function transicionesDesde(estado: EstadoProyecto): EstadoProyecto[] {
  const base = TRANSICIONES[estado];
  return FINALES.includes(estado) ? base : [...base, 'cancelado'];
}

/**
 * Cambios que se pueden hacer a mano desde la ficha. Mientras es una solicitud, solo cancelar:
 * la contraparte la envía con el formulario y el revisor decide desde Solicitudes.
 */
export function estadosManuales(estado: EstadoProyecto): EstadoProyecto[] {
  const todos = transicionesDesde(estado);
  return estado === 'solicitud' || estado === 'revision' ? todos.filter((e) => e === 'cancelado') : todos;
}

export function puedePasar(de: EstadoProyecto, a: EstadoProyecto): boolean {
  return transicionesDesde(de).includes(a);
}

/** Índice de la fase actual en el recorrido (Parado cuenta como En ejecución). */
export function indiceFase(estado: EstadoProyecto): number {
  if (estado === 'parado') return FASES.indexOf('ejecucion');
  return FASES.indexOf(estado);
}

export function esFinal(estado: EstadoProyecto): boolean {
  return FINALES.includes(estado);
}
