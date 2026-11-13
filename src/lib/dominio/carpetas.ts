// Carpetas fijas de la unidad de proyectos (ver docs/DRIVE.md):
//
//   1. Proyectos/      una carpeta por año y, dentro, una por proyecto
//   2. Solicitudes/    reservada; la app todavía no la usa
//   3. Reportes/       Resúmenes (Docs y Slides) y Hojas de cálculo (Sheets) de varios proyectos
//   4. Eliminados/     carpetas de los proyectos eliminados
//
// La primera vez se buscan por nombre (o se crean) y su identificador queda en ajustes/drive,
// así que después se pueden renombrar en Drive sin romper nada.

import { almacen } from '../almacen';
import { drive } from '../drive';

const FIJAS = {
  proyectos: { nombre: '1. Proyectos', dentroDe: null },
  reportes: { nombre: '3. Reportes', dentroDe: null },
  resumenes: { nombre: 'Resúmenes', dentroDe: 'reportes' },
  hojas: { nombre: 'Hojas de cálculo', dentroDe: 'reportes' },
  eliminados: { nombre: '4. Eliminados', dentroDe: null },
} as const;

export type CarpetaFija = keyof typeof FIJAS;

export const nombreCarpetaFija = (clave: CarpetaFija) => FIJAS[clave].nombre;

export async function carpetaFija(clave: CarpetaFija): Promise<string> {
  const db = await almacen();
  const ajustes = (await db.leer<{ carpetas?: Partial<Record<CarpetaFija, string>>; eliminados?: string }>('ajustes/drive')) ?? {};
  // `eliminados` suelto: donde lo guardaba la primera versión del borrado de proyectos.
  const guardada = ajustes.carpetas?.[clave] ?? (clave === 'eliminados' ? ajustes.eliminados : undefined);
  if (guardada) return guardada;
  const d = await drive();
  const { nombre, dentroDe } = FIJAS[clave];
  const id = await d.carpetaHija(nombre, dentroDe ? await carpetaFija(dentroDe) : d.raizProyectos);
  await db.guardar('ajustes/drive', { carpetas: { [clave]: id } }, { fusionar: true });
  return id;
}
