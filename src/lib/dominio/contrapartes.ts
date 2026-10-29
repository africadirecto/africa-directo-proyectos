// Contrapartes locales (contrapartes/{id}): congregaciones, diócesis, asociaciones…

import { almacen } from '../almacen';
import type { Contraparte } from '../tipos';

export type ContraparteConId = Contraparte & { id: string };

export async function listarContrapartes(): Promise<ContraparteConId[]> {
  const lista = await (await almacen()).consultar<Contraparte>('contrapartes');
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function leerContraparte(id: string): Promise<ContraparteConId | null> {
  if (!/^[\w-]+$/.test(id)) return null;
  const c = await (await almacen()).leer<Contraparte>(`contrapartes/${id}`);
  return c ? { ...c, id } : null;
}

export type DatosContraparte = Omit<Contraparte, 'creado' | 'actualizado'>;

export async function crearContraparte(d: DatosContraparte): Promise<ContraparteConId> {
  const ahora = new Date().toISOString();
  const c: Contraparte = { ...d, creado: ahora, actualizado: ahora };
  const id = await (await almacen()).crear('contrapartes', { ...c });
  return { ...c, id };
}

export async function actualizarContraparte(id: string, d: DatosContraparte): Promise<void> {
  await (await almacen()).guardar(`contrapartes/${id}`, { ...d, actualizado: new Date().toISOString() }, { fusionar: true });
}
