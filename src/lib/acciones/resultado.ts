// Resultado común de las acciones de servidor, para mostrar el mensaje en el formulario.

import { unstable_rethrow } from 'next/navigation';

export interface Resultado {
  ok: boolean;
  mensaje?: string;
  /** Marca de tiempo para que el formulario sepa que hay un resultado nuevo. */
  vez?: number;
}

export const INICIAL: Resultado = { ok: false };

/** Ejecuta la acción y convierte los errores en un mensaje para el usuario. */
export async function intentar(fn: () => Promise<string | void>): Promise<Resultado> {
  try {
    const mensaje = await fn();
    return { ok: true, mensaje: mensaje || undefined, vez: Date.now() };
  } catch (e) {
    unstable_rethrow(e); // deja pasar redirect() y similares
    console.error(e);
    return { ok: false, mensaje: e instanceof Error ? e.message : 'Algo ha fallado.', vez: Date.now() };
  }
}

export function texto(fd: FormData, campo: string, max = 2000): string {
  const v = fd.get(campo);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function numero(fd: FormData, campo: string): number | null {
  const t = texto(fd, campo, 40).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
