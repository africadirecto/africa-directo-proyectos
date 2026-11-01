// Lotes de la Batch API de OpenRouter: el trabajo se queda en el proveedor sin límite de tiempo
// (suele tardar minutos; como mucho, un día) y cuesta la mitad. Al terminar, OpenRouter avisa a
// /api/ia/lotes (ver motor de informes en lib/trabajos/informe.ts).
//
// Privacidad: los lotes no admiten retención cero y van por EE. UU.; OpenRouter guarda peticiones y
// resultados hasta 30 días o hasta que se borra el lote. Por eso solo se envía texto ya limpio
// (sin datos de contacto ni fotos) y la app borra cada lote en cuanto lee sus resultados.
//
// Comprobado en scripts/pruebas (S1):
// - Una sola petición mal formada hace que se rechace el lote entero: se validan antes.
// - Con Google, todas las peticiones deben compartir la misma configuración de salida: aquí
//   todas van sin response_format (texto) y con los mismos parámetros.

import crypto from 'node:crypto';
import { config } from '../config';
import { anotarUso, ErrorIA } from './openrouter';

const API = 'https://openrouter.ai/api/v1/batches';

export interface PeticionLote {
  /** Identificador propio (en los informes, la clave del campo). */
  id: string;
  instrucciones: string;
  entrada: string;
}

/** Salida máxima por petición: holgada, porque el razonamiento también cuenta. */
const MAX_TOKENS = 12_000;

async function llamar<T>(url: string, init: RequestInit = {}): Promise<{ status: number; datos: T }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${config.ia.clave}`, 'Content-Type': 'application/json', 'X-Title': 'Africa Directo - Gestion de proyectos', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    throw new ErrorIA(`OpenRouter no respondió: ${e instanceof Error ? e.message : e}`, 0, true);
  }
  const datos = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new ErrorIA(`OpenRouter (lotes) ${res.status}: ${datos.error?.message ?? ''}`, res.status, res.status === 429 || res.status >= 500);
  return { status: res.status, datos };
}

/** Envía las peticiones como un lote y devuelve su id. `aviso`: dirección a la que OpenRouter avisa al terminar. */
export async function enviarLote(peticiones: PeticionLote[], aviso?: string): Promise<string> {
  if (!peticiones.length) throw new Error('El lote está vacío.');
  const ids = new Set<string>();
  for (const p of peticiones) {
    if (!p.id || ids.has(p.id)) throw new Error(`Petición de lote con id repetido o vacío: «${p.id}».`);
    if (!p.instrucciones.trim() || !p.entrada.trim()) throw new Error(`La petición «${p.id}» está vacía.`);
    ids.add(p.id);
  }
  const { datos } = await llamar<{ id?: string }>(API, {
    method: 'POST',
    body: JSON.stringify({
      endpoint: '/v1/chat/completions',
      model: config.ia.modeloLotes,
      completion_window: '24h',
      ...(aviso ? { callback_url: aviso } : {}),
      ...(config.ia.proveedoresLotes.length ? { provider: { only: config.ia.proveedoresLotes, allow_fallbacks: false } } : {}),
      requests: peticiones.map((p) => ({
        custom_id: p.id,
        body: {
          messages: [
            { role: 'system', content: p.instrucciones },
            { role: 'user', content: p.entrada },
          ],
          max_tokens: MAX_TOKENS,
        },
      })),
    }),
  });
  if (!datos.id) throw new ErrorIA('OpenRouter no devolvió el id del lote', 200, true);
  return datos.id;
}

export interface EstadoLote {
  estado: 'en_curso' | 'terminado' | 'fallido';
  /** Por id de petición: el texto, o el error si esa petición falló. */
  resultados: Record<string, { texto?: string; error?: string }>;
  error?: string;
}

type Lote = {
  status?: string;
  error?: { message?: string } | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number } | null;
  results?: { custom_id: string; response?: { status_code?: number; body?: { choices?: { message?: { content?: string }; finish_reason?: string }[] } } | null; error?: { message?: string } | null }[] | null;
};

export async function leerLote(id: string): Promise<EstadoLote> {
  const { datos: l } = await llamar<Lote>(`${API}/${encodeURIComponent(id)}`);
  if (l.status === 'failed' || l.status === 'expired' || l.status === 'cancelled') {
    return { estado: 'fallido', resultados: {}, error: l.error?.message || `El lote ha terminado como «${l.status}».` };
  }
  if (l.status !== 'completed') return { estado: 'en_curso', resultados: {} };
  if (l.usage) await anotarUso(l.usage.prompt_tokens ?? 0, l.usage.completion_tokens ?? 0, l.usage.cost ?? 0).catch(() => undefined);
  const resultados: EstadoLote['resultados'] = {};
  for (const r of l.results ?? []) {
    const c = r.response?.body?.choices?.[0];
    if (r.error || !c?.message?.content) resultados[r.custom_id] = { error: r.error?.message || `Sin texto (${c?.finish_reason ?? r.response?.status_code ?? 'sin motivo'})` };
    else resultados[r.custom_id] = { texto: c.message.content };
  }
  return { estado: 'terminado', resultados };
}

/** Borra el lote y sus datos en OpenRouter (y en el proveedor). Solo se puede con lotes terminados. */
export async function borrarLote(id: string): Promise<void> {
  await llamar(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Comprueba la firma de un aviso de OpenRouter: cabecera «t=<segundos>,v1=<hex>», HMAC-SHA256 del
 * texto «<t>,<cuerpo>» con el secreto, y como mucho 5 minutos de diferencia.
 */
export function firmaValida(cabecera: string | null, cuerpo: string, secreto: string, ahora = Date.now()): boolean {
  if (!cabecera || !secreto) return false;
  const partes = Object.fromEntries(cabecera.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(partes.t);
  if (!t || !partes.v1 || Math.abs(ahora / 1000 - t) > 300) return false;
  const esperada = Buffer.from(crypto.createHmac('sha256', secreto).update(`${t},${cuerpo}`).digest('hex'));
  const recibida = Buffer.from(partes.v1);
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
}
