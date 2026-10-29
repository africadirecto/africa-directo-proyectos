// Proveedor OpenAI (API de Responses) con salida JSON estructurada.
// `store: false` evita que OpenAI conserve las respuestas en su plataforma.

import { config } from '../config';
import { almacen } from '../almacen';

type Tarea = 'rapida' | 'redaccion';

interface Peticion {
  tarea: Tarea;
  nombre: string;
  esquema: object;
  instrucciones: string;
  entrada: string;
}

type Respuesta = {
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

export async function pedirJson<T>(p: Peticion): Promise<T> {
  const modelo = p.tarea === 'rapida' ? config.ia.modeloRapido : config.ia.modeloRedaccion;
  const cuerpo: Record<string, unknown> = {
    model: modelo,
    instructions: p.instrucciones,
    input: p.entrada,
    store: false,
    text: { format: { type: 'json_schema', name: p.nombre, schema: p.esquema, strict: true } },
  };
  // Los modelos de razonamiento gastan menos con poco esfuerzo; para estas tareas basta.
  if (/^(gpt-5|o\d)/.test(modelo)) cuerpo.reasoning = { effort: 'low' };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.ia.openaiClave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(120_000),
  });
  const datos = (await res.json()) as Respuesta;
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${datos.error?.message ?? ''}`);

  await anotarUso(datos.usage?.input_tokens ?? 0, datos.usage?.output_tokens ?? 0).catch(() => undefined);

  const texto = datos.output
    ?.flatMap((o) => o.content ?? [])
    .find((c) => c.type === 'output_text')?.text;
  if (!texto) throw new Error('OpenAI no devolvió texto');
  return JSON.parse(texto) as T;
}

/** Cuenta llamadas y tokens por mes para vigilar el gasto (Administración › Ajustes). */
async function anotarUso(entrada: number, salida: number) {
  const mes = new Date().toISOString().slice(0, 7);
  const db = await almacen();
  await db.transaccion(async (tx) => {
    const doc = (await tx.leer<{ meses?: Record<string, { llamadas: number; entrada: number; salida: number }> }>('ajustes/ia')) ?? {};
    const meses = doc.meses ?? {};
    const m = meses[mes] ?? { llamadas: 0, entrada: 0, salida: 0 };
    meses[mes] = { llamadas: m.llamadas + 1, entrada: m.entrada + entrada, salida: m.salida + salida };
    tx.guardar('ajustes/ia', { ...doc, meses });
  });
}
