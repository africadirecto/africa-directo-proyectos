// S1 · Batch API de OpenRouter, con datos inventados.
//   node scripts/pruebas/s1-lotes.mjs enviar [modelo]   → envía un lote de prueba y guarda su id
//   node scripts/pruebas/s1-lotes.mjs leer <id>         → estado y, si terminó, resultados
//   node scripts/pruebas/s1-lotes.mjs borrar <id>       → borra el lote (y sus datos en OpenRouter)
// Comprueba: si respeta response_format json_schema y max_tokens, fallos parciales, tiempos y borrado.

import { openrouter, guardar } from './comun.mjs';

const CONTEXTO = {
  proyecto: { titulo: 'Aula para la escuela de prueba', pais: 'País de prueba', presupuestoEur: 18000, comprometidoEur: 12000 },
  eventos: [
    { id: 'E1', fecha: '2026-03-02', texto: 'Empiezan los cimientos del aula.' },
    { id: 'E2', fecha: '2026-03-20', texto: 'Las lluvias paran la obra dos semanas.' },
  ],
};

const SISTEMA =
  'Redactas un apartado de un informe para un donante con los datos JSON que se te dan. No inventes nada: lo que no conste, escríbelo como [PENDIENTE: qué falta].';

function mensajes(instruccion) {
  return [
    { role: 'system', content: SISTEMA },
    { role: 'user', content: `${JSON.stringify(CONTEXTO)}\n\nApartado: ${instruccion}` },
  ];
}

const peticiones = [
  {
    custom_id: 'markdown',
    body: {
      messages: mensajes(
        'Avance de la obra. Escribe en Markdown (párrafos y viñetas con "- "). Termina con una línea aparte "FUENTES: " y los ids de los eventos usados, separados por comas.',
      ),
      max_tokens: 2000,
    },
  },
  {
    custom_id: 'json',
    body: {
      messages: mensajes('Avance de la obra, y número de alumnos (no consta).'),
      max_tokens: 2000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'campo',
          strict: true,
          schema: {
            type: 'object',
            properties: { texto: { type: 'string' }, fuentes: { type: 'array', items: { type: 'string' } } },
            required: ['texto', 'fuentes'],
            additionalProperties: false,
          },
        },
      },
    },
  },
  { custom_id: 'corto', body: { messages: mensajes('Avance de la obra, en detalle.'), max_tokens: 16 } },
];

// Variantes: PRUEBA=invalida añade una petición mal formada (resultado: el lote entero se
// rechaza al validar); PRUEBA=excesiva envía solo una con max_tokens por encima del máximo.
const variantes = {
  invalida: [...peticiones, { custom_id: 'invalida', body: { messages: [] } }],
  excesiva: [{ custom_id: 'excesiva', body: { messages: mensajes('Avance de la obra.'), max_tokens: 200000 } }],
  // Google exige la misma configuración de response_format en todo el lote:
  texto: peticiones.filter((p) => !p.body.response_format),
  json: [peticiones[1], { custom_id: 'json2', body: { ...peticiones[1].body, messages: mensajes('Incidencias del periodo.') } }],
  // ¿Se respeta `reasoning` en el lote? (el razonamiento se cobra como salida)
  razonamiento: [{ custom_id: 'razonamiento-bajo', body: { ...peticiones[0].body, reasoning: { effort: 'low' } } }],
};

const [accion, arg] = process.argv.slice(2);

if (accion === 'enviar') {
  const modelo = arg || 'google/gemini-3.7-flash';
  const requests = variantes[process.env.PRUEBA] ?? peticiones;
  const inicio = Date.now();
  const r = await openrouter('/batches', { metodo: 'POST', cuerpo: { endpoint: '/v1/chat/completions', model: modelo, completion_window: '24h', requests } });
  console.log('HTTP', r.status, `(${Date.now() - inicio} ms)`);
  console.log(JSON.stringify(r.json, null, 2).slice(0, 2000));
  if (r.json?.id) guardar(`s1-lote-${r.json.id}-envio.json`, { enviado: new Date().toISOString(), modelo, respuesta: r.json });
} else if (accion === 'leer') {
  const r = await openrouter(`/batches/${arg}`);
  const b = r.json;
  console.log('HTTP', r.status, 'estado:', b.status, 'proveedor:', b.provider ?? '-', 'cuentas:', JSON.stringify(b.request_counts ?? {}), 'coste:', JSON.stringify(b.usage ?? {}));
  if (['completed', 'failed', 'expired', 'cancelled'].includes(b.status)) {
    console.log('fichero:', guardar(`s1-lote-${arg}-resultado.json`, b));
    for (const x of b.results ?? []) {
      const c = x.response?.body?.choices?.[0];
      console.log(`\n── ${x.custom_id}: ${x.error ? `ERROR ${x.error.type}: ${x.error.message}` : `HTTP ${x.response?.status_code} · finish=${c?.finish_reason}`}`);
      if (c?.message?.content) console.log(c.message.content.slice(0, 1200));
    }
  }
} else if (accion === 'borrar') {
  const r = await openrouter(`/batches/${arg}`, { metodo: 'DELETE' });
  console.log('HTTP', r.status, JSON.stringify(r.json, null, 2));
  const despues = await openrouter(`/batches/${arg}`);
  console.log('GET después de borrar → HTTP', despues.status, JSON.stringify(despues.json).slice(0, 300));
} else {
  console.log('Uso: enviar [modelo] | leer <id> | borrar <id>');
}
