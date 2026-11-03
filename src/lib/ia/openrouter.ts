// Proveedor OpenRouter (API compatible con la de chat de OpenAI) con salida JSON estructurada.
// OpenRouter da acceso a modelos de varios proveedores con una sola clave y un solo saldo.
//
// Privacidad: solo se enruta a proveedores que no guardan las peticiones (zdr) ni las usan
// para entrenar (data_collection: deny), y que admiten todos los parámetros de la petición.
// Ver https://openrouter.ai/docs/features/provider-routing

import { config } from '../config';
import { almacen } from '../almacen';
import { ajustesIa, gastoDelMes, type AjustesIaEfectivos, type TareaIa } from './ajustes';

type Tarea = TareaIa;

/** Parte de un mensaje con imágenes. Las imágenes van en base64 (data:…), nunca como enlace público. */
export type Parte = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

interface Peticion {
  tarea: Tarea;
  nombre: string;
  esquema: object;
  instrucciones: string;
  entrada: string | Parte[];
  /** Límite de tokens de salida (por defecto, el del modelo). */
  maxTokens?: number;
  /** Tiempo máximo de espera (por defecto 170 s, por debajo del límite de las páginas). */
  timeoutMs?: number;
}

/** Error de la IA. `reintentable`: un fallo pasajero (límite de peticiones, proveedor caído, tiempo agotado). */
export class ErrorIA extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
    readonly reintentable: boolean,
  ) {
    super(mensaje);
  }
}

/**
 * Los ajustes de la IA, si se puede usar: con clave, encendida y por debajo del límite de gasto
 * del mes. Si no, un error que no se reintenta.
 */
export async function ajustesParaLlamar(): Promise<AjustesIaEfectivos> {
  const a = await ajustesIa();
  if (!a.activa) throw new ErrorIA('La IA está desactivada (Administración › Ajustes de IA).', 0, false);
  if (!a.clave) throw new ErrorIA('La IA no está configurada: falta la clave de OpenRouter.', 0, false);
  if (a.limiteMensual > 0 && (await gastoDelMes()) >= a.limiteMensual) {
    throw new ErrorIA(`Se ha llegado al límite de gasto de la IA de este mes (${a.limiteMensual} $). Se puede subir en Administración › Ajustes de IA.`, 0, false);
  }
  return a;
}

const cabeceras = (clave: string) => ({
  Authorization: `Bearer ${clave}`,
  'Content-Type': 'application/json',
  // Identifican la app en el panel de OpenRouter (opcional).
  'HTTP-Referer': config.appUrl,
  'X-Title': 'Africa Directo - Gestion de proyectos',
});

type Respuesta = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number };
};

export async function pedirJson<T>(p: Peticion & { modelo?: string }): Promise<T> {
  const a = await ajustesParaLlamar();
  const cuerpo = {
    model: p.modelo || a.modelos[p.tarea],
    messages: [
      { role: 'system', content: p.instrucciones },
      { role: 'user', content: p.entrada },
    ],
    response_format: { type: 'json_schema', json_schema: { name: p.nombre, strict: true, schema: p.esquema } },
    // Para estas tareas basta con poco razonamiento, que además gasta menos (se cambia en los ajustes).
    reasoning: { effort: a.razonamiento },
    ...(p.maxTokens ? { max_tokens: p.maxTokens } : {}),
    provider: { zdr: true, data_collection: 'deny', require_parameters: true },
  };

  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: cabeceras(a.clave),
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(p.timeoutMs ?? 170_000),
    });
  } catch (e) {
    // Tiempo agotado o red caída.
    throw new ErrorIA(`OpenRouter no respondió: ${e instanceof Error ? e.message : e}`, 0, true);
  }
  const datos = (await res.json().catch(() => ({}))) as Respuesta;
  if (!res.ok || datos.error) {
    const status = datos.error?.code ?? res.status;
    throw new ErrorIA(`OpenRouter ${status}: ${datos.error?.message ?? ''}`, status, status === 408 || status === 429 || status >= 500);
  }

  await anotarUso(datos.usage?.prompt_tokens ?? 0, datos.usage?.completion_tokens ?? 0, datos.usage?.cost ?? 0).catch(() => undefined);

  const eleccion = datos.choices?.[0];
  const texto = eleccion?.message?.content;
  // Cortado por longitud no se arregla repitiendo; sin texto por otro motivo, quizá sí.
  if (!texto) throw new ErrorIA(`OpenRouter no devolvió texto (${eleccion?.finish_reason ?? 'sin motivo'})`, 200, eleccion?.finish_reason !== 'length');
  try {
    // Algunos modelos envuelven el JSON en un bloque de código.
    return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
  } catch {
    throw new ErrorIA('OpenRouter devolvió un JSON no válido', 200, eleccion?.finish_reason !== 'length');
  }
}

/**
 * Texto libre (sin salida JSON), para redactar un campo de informe por la vía directa: el
 * mismo formato que en los lotes (ver lotes.ts), así el resultado se lee igual.
 */
export async function pedirTexto(p: { tarea: Tarea; instrucciones: string; entrada: string; maxTokens?: number; timeoutMs?: number }): Promise<string> {
  const a = await ajustesParaLlamar();
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: cabeceras(a.clave),
      body: JSON.stringify({
        model: a.modelos[p.tarea],
        messages: [
          { role: 'system', content: p.instrucciones },
          { role: 'user', content: p.entrada },
        ],
        reasoning: { effort: a.razonamiento },
        ...(p.maxTokens ? { max_tokens: p.maxTokens } : {}),
        provider: { zdr: true, data_collection: 'deny', require_parameters: true },
      }),
      signal: AbortSignal.timeout(p.timeoutMs ?? 170_000),
    });
  } catch (e) {
    throw new ErrorIA(`OpenRouter no respondió: ${e instanceof Error ? e.message : e}`, 0, true);
  }
  const datos = (await res.json().catch(() => ({}))) as Respuesta;
  if (!res.ok || datos.error) {
    const status = datos.error?.code ?? res.status;
    throw new ErrorIA(`OpenRouter ${status}: ${datos.error?.message ?? ''}`, status, status === 408 || status === 429 || status >= 500);
  }
  await anotarUso(datos.usage?.prompt_tokens ?? 0, datos.usage?.completion_tokens ?? 0, datos.usage?.cost ?? 0).catch(() => undefined);
  const texto = datos.choices?.[0]?.message?.content;
  if (!texto) throw new ErrorIA(`OpenRouter no devolvió texto (${datos.choices?.[0]?.finish_reason ?? 'sin motivo'})`, 200, datos.choices?.[0]?.finish_reason !== 'length');
  return texto;
}

/** Una imagen como parte de un mensaje (en base64: la imagen no queda accesible desde fuera). */
export const parteImagen = (bytes: Buffer, mime: string): Parte => ({ type: 'image_url', image_url: { url: `data:${mime};base64,${bytes.toString('base64')}` } });

/** Cuenta llamadas, tokens y coste por mes para vigilar el gasto (Administración › Ajustes de IA). */
export async function anotarUso(entrada: number, salida: number, coste: number) {
  const mes = new Date().toISOString().slice(0, 7);
  const db = await almacen();
  await db.transaccion(async (tx) => {
    type Mes = { llamadas: number; entrada: number; salida: number; coste?: number };
    const doc = (await tx.leer<{ meses?: Record<string, Mes> }>('ajustes/ia')) ?? {};
    const meses = doc.meses ?? {};
    const m = meses[mes] ?? { llamadas: 0, entrada: 0, salida: 0, coste: 0 };
    meses[mes] = { llamadas: m.llamadas + 1, entrada: m.entrada + entrada, salida: m.salida + salida, coste: (m.coste ?? 0) + coste };
    tx.guardar('ajustes/ia', { ...doc, meses });
  });
}
