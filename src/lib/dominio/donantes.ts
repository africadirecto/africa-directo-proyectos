// Donantes (donantes/{id}): fundaciones, empresas, particulares y entidades públicas.

import { almacen } from '../almacen';
import type { Donante, TipoDonante } from '../tipos';

export type DonanteConId = Donante & { id: string };

export const TIPOS_DONANTE: Record<TipoDonante, string> = {
  fundacion: 'Fundación',
  empresa: 'Empresa',
  particular: 'Particular',
  publica: 'Entidad pública',
  otra: 'Otra',
};

export async function listarDonantes(): Promise<DonanteConId[]> {
  const lista = await (await almacen()).consultar<Donante>('donantes');
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function leerDonante(id: string): Promise<DonanteConId | null> {
  if (!/^[\w-]+$/.test(id)) return null;
  const d = await (await almacen()).leer<Donante>(`donantes/${id}`);
  return d ? { ...d, id } : null;
}

export type DatosDonante = Omit<Donante, 'creado' | 'actualizado'>;

export async function crearDonante(d: DatosDonante): Promise<DonanteConId> {
  const ahora = new Date().toISOString();
  const donante: Donante = { ...d, creado: ahora, actualizado: ahora };
  const id = await (await almacen()).crear('donantes', { ...donante });
  return { ...donante, id };
}

export async function actualizarDonante(id: string, d: DatosDonante): Promise<void> {
  await (await almacen()).guardar(`donantes/${id}`, { ...d, actualizado: new Date().toISOString() }, { fusionar: true });
}
