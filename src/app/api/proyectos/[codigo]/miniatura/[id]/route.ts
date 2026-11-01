// Miniatura de una foto del proyecto para verla en la app (pestaña Archivos y al elegir fotos
// de un informe). La lee la cuenta de servicio, así que se ve aunque el navegador no tenga
// sesión de Google con acceso a la unidad. Solo para voluntarios con acceso y solo imágenes de
// las carpetas de ese proyecto.

import { drive } from '@/lib/drive';
import { leerProyecto } from '@/lib/dominio/proyectos';
import { usuarioActual, tienePermiso } from '@/lib/sesion';

export const maxDuration = 60;

const NO = () => new Response('No encontrada', { status: 404 });

export async function GET(_: Request, { params }: { params: Promise<{ codigo: string; id: string }> }) {
  if (!tienePermiso(await usuarioActual(), 'lectura')) return new Response('Sin acceso', { status: 403 });
  const { codigo, id } = await params;
  if (!/^[A-Z0-9-]{1,30}$/.test(codigo) || !/^[\w-]{1,100}$/.test(id)) return NO();
  const p = await leerProyecto(codigo);
  if (!p?.drive) return NO();

  const d = await drive();
  const a = await d.metadatos(id);
  if (!a || !a.mime.startsWith('image/') || !Object.values(p.drive.subcarpetas).includes(a.carpetaId)) return NO();
  try {
    const { bytes, mime } = await d.imagen(id, 480);
    // La foto no cambia: el navegador la guarda un día (solo para quien la pidió).
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=86400' } });
  } catch (e) {
    console.error('Miniatura: no se pudo leer de Drive', id, e);
    return new Response('No disponible', { status: 503 });
  }
}
