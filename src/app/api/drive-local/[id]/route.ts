// Solo en modo demo: sirve los archivos y carpetas del "Drive" local (.datos/drive).

import fs from 'node:fs';
import { modoDemo } from '@/lib/config';
import { usuarioActual } from '@/lib/sesion';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!modoDemo) return new Response('No disponible', { status: 404 });
  const u = await usuarioActual();
  if (!u || u.estado !== 'activo') return new Response('Sin acceso', { status: 403 });
  const { rutaLocal, hijosLocales } = await import('@/lib/drive/local');
  const { id } = await params;
  const a = rutaLocal(id);
  if (!a) return new Response('No encontrado', { status: 404 });

  if (a.meta.mime === 'application/vnd.google-apps.folder') {
    const hijos = hijosLocales(id);
    const lista = hijos.map((h) => `<li><a href="/api/drive-local/${h.id}">${h.nombre.replace(/</g, '&lt;')}</a></li>`).join('');
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>${a.meta.nombre}</title><body style="font-family:sans-serif;padding:24px"><p>Drive de demostración</p><h1>📁 ${a.meta.nombre.replace(/</g, '&lt;')}</h1><ul>${lista || '<li>Vacía</li>'}</ul></body>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  return new Response(fs.readFileSync(a.ruta), {
    headers: { 'Content-Type': a.meta.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(a.meta.nombre)}` },
  });
}
