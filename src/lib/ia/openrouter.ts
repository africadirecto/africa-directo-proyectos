// Proveedor OpenRouter (API compatible con la de chat de OpenAI) con salida JSON estructurada.
// OpenRouter da acceso a modelos de varios proveedores con una sola clave y un solo saldo.
//
// Privacidad: solo se enruta a proveedores que no guardan las peticiones (zdr) ni las usan
// para entrenar (data_collection: deny), y que admiten todos los parámetros de la petición.
// Ver https://openrouter.ai/docs/features/provider-routing

import { config } from '../config';
import { almacen } from '../almacen';

type Tarea = 'rapida' | 'redaccion';

interface Peticion {
  tarea: Tarea;
  nombre: string;
  esquema: object;
  instrucciones: string;
  entrada: string;
  /** Límite de tokens de salida (por defecto, el del modelo). */
  maxTokens?: number;
}

type Respuesta = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number };
};

export async function pedirJson<T>(p: Peticion): Promise<T> {
  const modelo = p.tarea === 'rapida' ? config.ia.modeloRapido : config.ia.modeloRedaccion;
  const cuerpo = {
    model: modelo,
    messages: [
      { role: 'system', content: p.instrucciones },
      { role: 'user', content: p.entrada },
    ],
    response_format: { type: 'json_schema', json_schema: { name: p.nombre, strict: true, schema: p.esquema } },
    // Para estas tareas basta con poco razonamiento, que además gasta menos.
    reasoning: { effort: 'low' },
    ...(p.maxTokens ? { max_tokens: p.maxTokens } : {}),
    provider: { zdr: true, data_collection: 'deny', require_parameters: true },
  };

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ia.clave}`,
      'Content-Type': 'application/json',
      // Identifican la app en el panel de OpenRouter (opcional).
      'HTTP-Referer': config.appUrl,
      'X-Title': 'Africa Directo - Gestion de proyectos',
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(170_000),
  });
  const datos = (await res.json().catch(() => ({}))) as Respuesta;
  if (!res.ok || datos.error) throw new Error(`OpenRouter ${res.status}: ${datos.error?.message ?? ''}`);

  await anotarUso(datos.usage?.prompt_tokens ?? 0, datos.usage?.completion_tokens ?? 0, datos.usage?.cost ?? 0).catch(() => undefined);

  const texto = datos.choices?.[0]?.message?.content;
  if (!texto) throw new Error(`OpenRouter no devolvió texto (${datos.choices?.[0]?.finish_reason ?? 'sin motivo'})`);
  // Algunos modelos envuelven el JSON en un bloque de código.
  return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
}

/** Cuenta llamadas, tokens y coste por mes para vigilar el gasto (Administración › Ajustes). */
async function anotarUso(entrada: number, salida: number, coste: number) {
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
