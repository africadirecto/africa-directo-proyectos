// El permiso de cada voluntario en la app se aplica también a las unidades compartidas de Drive:
//
//   En la app        Proyectos y Plantillas     Sistema
//   Lectura          Lector                     —
//   Edición          Colaborador                —
//   Administración   Gestor de contenido        Gestor de contenido
//   Sin acceso       se le quita                se le quita
//
// Para poder hacerlo, la cuenta de servicio de la app tiene que ser «Gestor» de las unidades
// (ver docs/DRIVE.md). Si no lo es, o Drive falla, el permiso de la app se guarda igual y el
// fallo queda anotado en el usuario (`drive`) para verlo en Administración y reintentarlo.
//
// Lo que la app nunca toca: a quien es «Gestor» de una unidad (la cuenta técnica, coordinación),
// a los grupos, a quien no es usuario de la app y a quien aún está pendiente de aprobar.

import { almacen } from '../almacen';
import { config } from '../config';
import { drive } from '../drive';
import { ErrorDrive, type MiembroUnidad, type RolUnidad } from '../drive/tipos';
import { leerUsuario, listarUsuarios } from './usuarios';
import type { Permiso, Usuario } from '../tipos';

const ROL: Record<Permiso, RolUnidad> = { lectura: 'reader', edicion: 'writer', admin: 'fileOrganizer' };

/** El rol que le toca en una unidad; null: ninguno. */
export function rolEnDrive(u: Pick<Usuario, 'permiso' | 'estado'>, soloAdmin: boolean): RolUnidad | null {
  if (u.estado !== 'activo') return null;
  if (soloAdmin) return u.permiso === 'admin' ? 'fileOrganizer' : null;
  return ROL[u.permiso];
}

/** Qué hay que hacer con un usuario en una unidad, según el miembro que ya es (si lo es). */
export function cambioDeMiembro(deseado: RolUnidad | null, actual: MiembroUnidad | undefined): 'nada' | 'anadir' | 'cambiar' | 'quitar' {
  if (actual?.rol === 'organizer') return 'nada'; // a un Gestor no se le baja ni se le quita
  if (!deseado) return actual ? 'quitar' : 'nada';
  if (!actual) return 'anadir';
  return actual.rol === deseado ? 'nada' : 'cambiar';
}

async function unidades(): Promise<{ id: string; soloAdmin: boolean }[]> {
  const d = await drive();
  return [
    { id: d.raizProyectos, soloAdmin: false },
    { id: config.drive.unidadPlantillas, soloAdmin: false },
    { id: d.raizSistema, soloAdmin: true },
  ].filter((u) => u.id);
}

function mensaje(e: unknown): string {
  if (e instanceof ErrorDrive && e.status === 403) return 'La cuenta de la app tiene que ser «Gestor» de las unidades compartidas en Drive.';
  if (e instanceof ErrorDrive && e.status === 400) return 'Drive no acepta ese correo: tiene que ser una cuenta de Google.';
  return 'No se pudo actualizar Drive.';
}

/**
 * Aplica en Drive el permiso de estos usuarios y anota en cada uno cómo ha ido. No lanza errores:
 * devuelve cuántos han quedado sin actualizar y por qué.
 */
export async function aplicarAccesosDrive(usuarios: Usuario[]): Promise<{ fallos: number; error?: string }> {
  const db = await almacen();
  const d = await drive();
  // Las cuentas con las que la propia app entra en Drive no se tocan.
  const propias = [config.google.cuentaServicio, config.drive.usuario].filter(Boolean).map((c) => c.toLowerCase());
  const tratar = usuarios.filter((u) => u.estado !== 'pendiente' && !propias.includes(u.email));
  const errores = new Map<string, string>();
  try {
    for (const unidad of await unidades()) {
      const miembros = await d.miembros(unidad.id);
      for (const u of tratar) {
        const actual = miembros.find((m) => m.tipo === 'user' && m.email === u.email);
        const deseado = rolEnDrive(u, unidad.soloAdmin);
        try {
          const cambio = cambioDeMiembro(deseado, actual);
          if (cambio === 'quitar') await d.quitarMiembro(unidad.id, actual!.id);
          else if (cambio !== 'nada') await d.ponerMiembro(unidad.id, u.email, deseado!, actual?.id);
        } catch (e) {
          console.error('Drive: no se pudo actualizar el acceso', u.email, e);
          errores.set(u.email, mensaje(e));
        }
      }
    }
  } catch (e) {
    console.error('Drive: no se pudieron leer los miembros de las unidades', e);
    for (const u of tratar) errores.set(u.email, mensaje(e));
  }
  const fecha = new Date().toISOString();
  for (const u of tratar) {
    const error = errores.get(u.email);
    // Sin cambios que anotar: ya estaba bien y sigue bien.
    if (!error && u.drive?.ok) continue;
    await db.guardar(`usuarios/${u.email}`, { drive: { ok: !error, fecha, error: error ?? '' } }, { fusionar: true });
  }
  return { fallos: errores.size, error: [...errores.values()][0] };
}

/** Tras cambiar el permiso de alguien en la app. */
export async function aplicarAccesoDrive(email: string): Promise<{ fallos: number; error?: string }> {
  const u = await leerUsuario(email);
  return u ? aplicarAccesosDrive([u]) : { fallos: 0 };
}

export async function sincronizarAccesosDrive(): Promise<{ usuarios: number; fallos: number; error?: string }> {
  const usuarios = (await listarUsuarios()).filter((u) => u.estado !== 'pendiente');
  return { usuarios: usuarios.length, ...(await aplicarAccesosDrive(usuarios)) };
}
