'use server';

import { redirect } from 'next/navigation';
import { cerrarSesion, iniciarSesionDemo } from '../sesion';

/** Solo en modo demo: entra como el usuario elegido. */
export async function entrarDemo(fd: FormData) {
  const email = String(fd.get('email') ?? '').toLowerCase();
  if (!/^[a-z.]+@demo\.africadirecto$/.test(email)) throw new Error('Usuario de demo no válido');
  const u = await iniciarSesionDemo(email);
  redirect(u.estado === 'activo' ? '/' : '/acceso');
}

export async function salir() {
  await cerrarSesion();
  redirect('/acceso');
}
