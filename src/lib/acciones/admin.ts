'use server';

import { revalidatePath } from 'next/cache';
import { permitido } from '../sesion';
import { aprobarUsuario, cambiarPermiso, invitarUsuario, quitarAcceso } from '../dominio/usuarios';
import { actualizarContraparte, crearContraparte } from '../dominio/contrapartes';
import { esIdioma } from '../formulario/textos';
import { PAISES } from '../paises';
import { intentar, texto, type Resultado } from './resultado';
import type { Permiso } from '../tipos';

const PERMISOS: Permiso[] = ['lectura', 'edicion', 'admin'];

export async function aprobarAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('admin');
    await aprobarUsuario(texto(fd, 'email', 200));
    revalidatePath('/admin');
    return 'Acceso de lectura concedido.';
  });
}

export async function quitarAccesoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    await quitarAcceso(texto(fd, 'email', 200), yo.email);
    revalidatePath('/admin');
    return 'Acceso retirado.';
  });
}

export async function cambiarPermisoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const permiso = texto(fd, 'permiso', 20) as Permiso;
    if (!PERMISOS.includes(permiso)) throw new Error('Permiso no válido.');
    await cambiarPermiso(texto(fd, 'email', 200), permiso, yo.email);
    revalidatePath('/admin');
    return 'Permiso cambiado.';
  });
}

export async function invitarAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const permiso = texto(fd, 'permiso', 20) as Permiso;
    if (!PERMISOS.includes(permiso)) throw new Error('Permiso no válido.');
    await invitarUsuario(texto(fd, 'email', 200), permiso, yo.email);
    revalidatePath('/admin');
    return 'Acceso concedido. Ya puede entrar con su cuenta de Google.';
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
