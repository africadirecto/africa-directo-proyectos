import { modoDemo } from '../config';
import type { Almacen } from './tipos';

export type { Almacen, Consulta, Datos } from './tipos';

let instancia: Almacen | null = null;

/** Devuelve el almacén configurado: fichero local en modo demo, Firestore en el resto. */
export async function almacen(): Promise<Almacen> {
  if (!instancia) {
    instancia = modoDemo
      ? (await import('./local')).almacenLocal
      : (await import('./firestore')).almacenFirestore;
  }
  return instancia;
}
