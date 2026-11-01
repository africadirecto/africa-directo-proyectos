// Cómo va un informe (lo consulta la pantalla mientras se hace). De paso, si nadie lo está
// procesando, lo hace avanzar: así sigue aunque se pierda el aviso de OpenRouter o en local,
// donde ese aviso no llega. Con lote, como mucho comprueba el lote una vez por minuto.

import { NextResponse, after } from 'next/server';
import { almacen } from '@/lib/almacen';
import { permitido } from '@/lib/sesion';
import { rutaValida } from '@/lib/acciones/informes';
import { avanzarInforme } from '@/lib/trabajos/informe';
import type { Informe } from '@/lib/tipos';

export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    await permitido('lectura');
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  const ruta = new URL(req.url).searchParams.get('r') ?? '';
  if (!(await rutaValida(ruta))) return NextResponse.json({ error: 'Informe no válido' }, { status: 400 });
  const i = await (await almacen()).leer<Informe>(ruta);
  if (!i) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const estado = i.estado ?? 'listo';
  const ahora = new Date().toISOString();
  const libre = !i.bloqueo || i.bloqueo < ahora;
  const esperandoLote = estado === 'redactando' && i.modo === 'lote' && i.lote && Date.now() - Date.parse(i.lote.comprobado) < 60_000;
  if (estado !== 'listo' && estado !== 'error' && libre && !esperandoLote) after(() => avanzarInforme(ruta));

  return NextResponse.json({
    estado,
    progreso: i.progreso ?? null,
    modo: i.modo ?? null,
    error: i.error ?? '',
    url: i.url,
    titulo: i.titulo,
    pendientes: i.pendientes,
  });
}
