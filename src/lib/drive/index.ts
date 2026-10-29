import { modoDemo } from '../config';
import type { Drive } from './tipos';

export type { ArchivoDrive, Drive, EstadoSubida } from './tipos';

let instancia: Drive | null = null;

export async function drive(): Promise<Drive> {
  if (!instancia) {
    instancia = modoDemo ? (await import('./local')).driveLocal : (await import('./google')).driveGoogle;
  }
  return instancia;
}

/** Subcarpetas fijas de cada proyecto. La base de datos guarda sus identificadores, no sus nombres. */
export const SUBCARPETAS = {
  solicitud: '01_Solicitud',
  propuesta: '02_Propuesta',
  financiacion: '03_Financiacion',
  seguimiento: '04_Seguimiento',
  informes: '05_Informes',
  economico: '06_Economico',
  cierre: '07_Cierre',
} as const;

export type Subcarpeta = keyof typeof SUBCARPETAS;

/** Prefijo de fecha AAAA-MM-DD para los nombres de archivo. */
export function conFecha(nombre: string, fecha = new Date()): string {
  const limpio = nombre.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return `${fecha.toISOString().slice(0, 10)} ${limpio}`;
}
