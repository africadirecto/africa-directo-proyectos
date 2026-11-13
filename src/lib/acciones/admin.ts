'use server';

import { revalidatePath } from 'next/cache';
import { permitido } from '../sesion';
import { aprobarUsuario, cambiarPermiso, invitarUsuario, quitarAcceso } from '../dominio/usuarios';
import { actualizarContraparte, crearContraparte } from '../dominio/contrapartes';
import { aplicarAccesoDrive } from '../dominio/accesosDrive';
import { esIdioma } from '../formulario/textos';
import { PAISES } from '../paises';
import { intentar, texto, type Resultado } from './resultado';
import type { Permiso } from '../tipos';

const PERMISOS: Permiso[] = ['lectura', 'edicion', 'admin'];

/** Aplica en Drive el permiso recién guardado; si Drive falla, el mensaje lo dice (y queda anotado en el usuario). */
async function conDrive(email: string, mensaje: string): Promise<string> {
  const { error } = await aplicarAccesoDrive(email.trim().toLowerCase());
  return error ? `${mensaje} En Drive no se ha podido aplicar: ${error}` : mensaje;
}

export async function aprobarAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('admin');
    const email = texto(fd, 'email', 200);
    await aprobarUsuario(email);
    const mensaje = await conDrive(email, 'Acceso de lectura concedido.');
    revalidatePath('/admin');
    return mensaje;
  });
}

export async function quitarAccesoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const email = texto(fd, 'email', 200);
    await quitarAcceso(email, yo.email);
    const mensaje = await conDrive(email, 'Acceso retirado.');
    revalidatePath('/admin');
    return mensaje;
  });
}

export async function cambiarPermisoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const permiso = texto(fd, 'permiso', 20) as Permiso;
    if (!PERMISOS.includes(permiso)) throw new Error('Permiso no válido.');
    const email = texto(fd, 'email', 200);
    await cambiarPermiso(email, permiso, yo.email);
    const mensaje = await conDrive(email, 'Permiso cambiado.');
    revalidatePath('/admin');
    return mensaje;
  });
}

export async function invitarAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const permiso = texto(fd, 'permiso', 20) as Permiso;
    if (!PERMISOS.includes(permiso)) throw new Error('Permiso no válido.');
    const email = texto(fd, 'email', 200);
    await invitarUsuario(email, permiso, yo.email);
    const mensaje = await conDrive(email, 'Acceso concedido. Ya puede entrar con su cuenta de Google.');
    revalidatePath('/admin');
    return mensaje;
  });
}

/** Dar de alta: permiso de edición. Cambiar una contraparte existente: administración. */
export async function guardarContraparteAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const id = texto(fd, 'id', 100);
    await permitido(id ? 'admin' : 'edicion');
    const nombre = texto(fd, 'nombre', 200);
    const pais = texto(fd, 'pais', 2);
    const idioma = texto(fd, 'idioma', 2);
    const correos = texto(fd, 'correos', 1000)
      .split(/[\s,;]+/)
      .map((c) => c.toLowerCase())
      .filter(Boolean);
    if (!nombre) throw new Error('Escribe el nombre.');
    if (!PAISES[pais]) throw new Error('Elige el país.');
    if (!esIdioma(idioma)) throw new Error('Elige el idioma.');
    if (correos.some((c) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c))) throw new Error('Hay algún correo no válido.');
    const datos = {
      nombre,
      tipo: texto(fd, 'tipo', 100),
      pais,
      contactoNombre: texto(fd, 'contactoNombre', 200),
      correos,
      telefono: texto(fd, 'telefono', 50),
      idioma,
      notas: texto(fd, 'notas', 4000),
    };
    if (id) await actualizarContraparte(id, datos);
    else await crearContraparte(datos);
    revalidatePath('/contrapartes', 'layout');
    return id ? 'Contraparte guardada. Los proyectos existentes conservan los datos que tenían.' : 'Contraparte añadida.';
  });
}
