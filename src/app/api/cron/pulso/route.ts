// Pulso frecuente para los trabajos en segundo plano (informes y plantillas desde un ejemplo):
// avanza lo que esté a medias. El cron de Vercel Hobby solo va una vez al día, así que con la IA
// en modo directo conviene que algo llame aquí cada pocos minutos; por ejemplo, un activador de
// Apps Script de la cuenta técnica (ver docs/INFORMES.md › Modo directo). Si no hay nada a
// medias, solo cuesta una consulta. Pide "Authorization: Bearer CRON_SECRET", como el cron.

import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { avanzarPendientes } from '@/lib/trabajos';

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!config.secretos.cron || req.headers.get('authorization') !== `Bearer ${config.secretos.cron}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return NextResponse.json(await avanzarPendientes());
}
