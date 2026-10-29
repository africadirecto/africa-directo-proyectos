// Tareas nocturnas (vercel.json › crons): copia de la base de datos a Drive,
// reconstrucción del índice del panel y resumen semanal de recordatorios.
// Vercel manda "Authorization: Bearer CRON_SECRET".

import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { tareasNocturnas } from '@/lib/dominio/copia';

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!config.secretos.cron || req.headers.get('authorization') !== `Bearer ${config.secretos.cron}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return NextResponse.json(await tareasNocturnas());
}
