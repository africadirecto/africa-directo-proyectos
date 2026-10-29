// Sesión de los voluntarios y comprobación de permisos (siempre en el servidor).
//
// Con Firebase: el navegador entra con Google y manda el token a /api/sesion, que
// crea una cookie de sesión de Firebase (14 días). En modo demo, la cookie lleva
// el correo firmado con SESION_SECRETO y se elige el usuario en la pantalla de acceso.

import crypto from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { config, modoDemo } from './config';
import { leerUsuario, registrarAcceso } from './dominio/usuarios';
import type { Permiso, Persona, Usuario } from './tipos';

const COOKIE = '__session';
const DURACION_MS = 14 * 24 * 60 * 60 * 1000;
const NIVEL: Record<Permiso, number> = { lectura: 1, edicion: 2, admin: 3 };

export class SinPermiso extends Error {
  constructor(mensaje = 'No tienes permiso para hacer esto.') {
    super(mensaje);
  }
}

function firmaDemo(email: string) {
  return crypto.createHmac('sha256', config.secretos.sesionDemo).update(email).digest('base64url');
}

async function auth() {
  const { getAuth } = await import('firebase-admin/auth');
  const { appFirebase } = await import('./almacen/firestore');
  return getAuth(appFirebase());
}

/** Correo de la sesión actual, o null. */
async function emailDeSesion(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return null;
  if (modoDemo) {
    const [email, firma] = valor.split('|');
    return email && firma === firmaDemo(email) ? email : null;
  }
  try {
    const datos = await (await auth()).verifySessionCookie(valor);
    return datos.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Usuario de la sesión (aunque esté pendiente), o null. Una lectura por petición. */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const email = await emailDeSesion();
  return email ? leerUsuario(email) : null;
});

export function tienePermiso(u: Pick<Usuario, 'permiso' | 'estado'> | null, p: Permiso): boolean {
  return !!u && u.estado === 'activo' && NIVEL[u.permiso] >= NIVEL[p];
}

/**
 * Para páginas: manda a /acceso si no hay sesión activa, y al inicio si no llega
 * el permiso (la interfaz ya oculta esos enlaces; solo pasa escribiendo la dirección).
 */
export async function requiere(p: Permiso = 'lectura'): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u || u.estado !== 'activo') redirect('/acceso');
  if (!tienePermiso(u, p)) redirect('/');
  return u;
}

/** Para acciones: igual que `requiere` pero sin redirigir. */
export async function permitido(p: Permiso): Promise<Usuario> {
  const u = await usuarioActual();
  if (!tienePermiso(u, p)) throw new SinPermiso();
  return u!;
}

export function persona(u: Usuario): Persona {
  return { id: u.email, nombre: u.nombre };
}

async function ponerCookie(valor: string) {
  (await cookies()).set(COOKIE, valor, {
    httpOnly: true,
    secure: !modoDemo,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_MS / 1000,
  });
}

/** Comprueba el token de Google (Firebase) y abre la sesión. Devuelve el usuario. */
export async function iniciarSesion(idToken: string): Promise<Usuario> {
  const a = await auth();
  const datos = await a.verifyIdToken(idToken);
  const email = datos.email?.toLowerCase() ?? '';
  if (!datos.email_verified || datos.firebase?.sign_in_provider !== 'google.com') throw new SinPermiso('Cuenta no válida.');
  if (!config.ong.dominio || !email.endsWith(`@${config.ong.dominio}`)) {
    throw new SinPermiso(`Solo se puede entrar con una cuenta @${config.ong.dominio}.`);
  }
  // Solo inicios de sesión recientes, como recomienda Firebase.
  if (Date.now() / 1000 - datos.auth_time > 5 * 60) throw new SinPermiso('Vuelve a entrar con Google.');
  const usuario = await registrarAcceso(email, (datos.name as string | undefined) ?? email.split('@')[0]);
  await ponerCookie(await a.createSessionCookie(idToken, { expiresIn: DURACION_MS }));
  return usuario;
}

export async function iniciarSesionDemo(email: string): Promise<Usuario> {
  if (!modoDemo) throw new SinPermiso();
  const nombre = email
    .split('@')[0]
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
  const usuario = await registrarAcceso(email, nombre);
  await ponerCookie(`${email}|${firmaDemo(email)}`);
  return usuario;
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}
