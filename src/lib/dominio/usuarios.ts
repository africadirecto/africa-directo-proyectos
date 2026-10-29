// Voluntarios con acceso a la app (usuarios/{correo}).

import { almacen } from '../almacen';
import { config } from '../config';
import { avisarChat, enviarCorreo } from '../avisos';
import type { Permiso, Usuario } from '../tipos';

const ruta = (email: string) => `usuarios/${email.toLowerCase()}`;

export async function leerUsuario(email: string): Promise<Usuario | null> {
  return (await almacen()).leer<Usuario>(ruta(email));
}

/**
 * Se llama en cada inicio de sesión. La primera vez crea el usuario como "pendiente",
 * salvo que esté en ONG_ADMINS_INICIALES (para poder arrancar la app sin nadie dentro).
 */
export async function registrarAcceso(email: string, nombre: string): Promise<Usuario> {
  const db = await almacen();
  const ahora = new Date().toISOString();
  const actual = await db.leer<Usuario>(ruta(email));
  if (actual) {
    const cambios = { ultimoAcceso: ahora, nombre: actual.nombre || nombre };
    await db.guardar(ruta(email), cambios, { fusionar: true });
    return { ...actual, ...cambios };
  }
  const esAdminInicial = config.ong.adminsIniciales.includes(email.toLowerCase());
  const nuevo: Usuario = {
    email: email.toLowerCase(),
    nombre,
    permiso: esAdminInicial ? 'admin' : 'lectura',
    estado: esAdminInicial ? 'activo' : 'pendiente',
    creado: ahora,
    ultimoAcceso: ahora,
  };
  await db.guardar(ruta(email), { ...nuevo });
  if (!esAdminInicial) {
    await avisarChat(`🔑 ${nombre} (${email}) pide acceso a la gestión de proyectos. Apruébalo en ${config.appUrl}/admin`);
  }
  return nuevo;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const lista = await (await almacen()).consultar<Usuario>('usuarios');
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

async function quedaOtroAdmin(email: string): Promise<boolean> {
  const lista = await listarUsuarios();
  return lista.some((u) => u.email !== email && u.permiso === 'admin' && u.estado === 'activo');
}

export async function aprobarUsuario(email: string): Promise<void> {
  const u = await leerUsuario(email);
  if (!u) throw new Error('Usuario no encontrado');
  await (await almacen()).guardar(ruta(email), { estado: 'activo', permiso: 'lectura' }, { fusionar: true });
  await enviarCorreo({
    para: u.email,
    asunto: 'Ya puedes entrar en la gestión de proyectos de Africa Directo',
    texto: `Hola, ${u.nombre}:\n\nYa tienes acceso de lectura a la gestión de proyectos:\n${config.appUrl}\n\nUn saludo.`,
  });
}

export async function cambiarPermiso(email: string, permiso: Permiso, yo: string): Promise<void> {
  if (email === yo && permiso !== 'admin') throw new Error('No puedes quitarte el permiso de administración a ti mismo.');
  if (permiso !== 'admin' && !(await quedaOtroAdmin(email))) throw new Error('Tiene que quedar al menos un administrador.');
  await (await almacen()).guardar(ruta(email), { permiso }, { fusionar: true });
}

/** Rechaza una petición o quita el acceso. El usuario no se borra para que no vuelva a pedirlo sin control. */
export async function quitarAcceso(email: string, yo: string): Promise<void> {
  if (email === yo) throw new Error('No puedes quitarte el acceso a ti mismo.');
  if (!(await quedaOtroAdmin(email))) throw new Error('Tiene que quedar al menos un administrador.');
  await (await almacen()).guardar(ruta(email), { estado: 'rechazado' }, { fusionar: true });
}

/** Da acceso por adelantado: al entrar por primera vez ya tendrá el permiso indicado. */
export async function invitarUsuario(email: string, permiso: Permiso, por: string): Promise<void> {
  const limpio = email.trim().toLowerCase();
  if (!config.modoDemo && !limpio.endsWith(`@${config.ong.dominio}`)) {
    throw new Error(`El correo tiene que ser @${config.ong.dominio}.`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) throw new Error('Correo no válido.');
  const db = await almacen();
  const actual = await db.leer<Usuario>(ruta(limpio));
  await db.guardar(
    ruta(limpio),
    {
      email: limpio,
      nombre: actual?.nombre ?? '',
      permiso,
      estado: 'activo',
      creado: actual?.creado ?? new Date().toISOString(),
      invitadoPor: por,
    },
    { fusionar: true },
  );
  await enviarCorreo({
    para: limpio,
    asunto: 'Te han dado acceso a la gestión de proyectos de Africa Directo',
    texto: `Hola:\n\nYa puedes entrar con tu cuenta de Google de la ONG en:\n${config.appUrl}\n\nUn saludo.`,
  });
}
