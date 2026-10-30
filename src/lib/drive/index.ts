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

/**
 * Subcarpetas fijas de cada proyecto. La base de datos guarda sus identificadores, no sus nombres.
 * - Solicitud: lo que envía la contraparte con el formulario y el PDF de cada versión.
 * - Seguimiento: fotos, documentos y correos de la ejecución (todo junto, con fecha delante).
 * - Informes: lo que va a los donantes (los informes y presentaciones que hace la app).
 * - Administración: convenios y cartas de donantes, transferencias, facturas, justificantes y cierre.
 */
export const SUBCARPETAS = {
  solicitud: '01_Solicitud',
  seguimiento: '02_Seguimiento',
  informes: '03_Informes',
  administracion: '04_Administración',
} as const;

export type Subcarpeta = keyof typeof SUBCARPETAS;

/** Prefijo de fecha AAAA-MM-DD para los nombres de archivo. */
export function conFecha(nombre: string, fecha = new Date()): string {
  const limpio = nombre.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return `${fecha.toISOString().slice(0, 10)} ${limpio}`;
}
