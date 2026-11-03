// Aviso de OpenRouter cuando termina un lote (callback_url de la Batch API). Solo trae el id del
// lote: la app lee el lote ella misma, con su clave, así que un aviso falso no puede colar
// resultados; como mucho, hace que se compruebe antes. Si OPENROUTER_WEBHOOK_SECRETO está
// configurado (variable o Ajustes de IA), además se exige la firma.

import { NextResponse, after } from 'next/server';
import { firmaValida } from '@/lib/ia/lotes';
import { ajustesIa } from '@/lib/ia/ajustes';
import { dentroDelLimite, ipDe } from '@/lib/limites';
import { avanzarTrabajo, trabajosDelLote } from '@/lib/trabajos';

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!dentroDelLimite(`lotes:${ipDe(req)}`, 60)) return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 });
  const cuerpo = await req.text();
  const { secretoWebhook } = await ajustesIa();
  if (secretoWebhook && !firmaValida(req.headers.get('x-openrouter-signature'), cuerpo, secretoWebhook)) {
    return NextResponse.json({ error: 'Firma no válida' }, { status: 401 });
  }
  let lote = '';
  try {
    lote = String((JSON.parse(cuerpo) as { data?: { id?: unknown } }).data?.id ?? '');
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 });
  }
  if (!/^[\w-]{1,120}$/.test(lote)) return NextResponse.json({ error: 'Lote no válido' }, { status: 400 });
  const rutas = await trabajosDelLote(lote);
  after(async () => {
    for (const r of rutas) await avanzarTrabajo(r);
  });
  return NextResponse.json({ ok: true, informes: rutas.length });
}
