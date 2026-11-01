// Redacción de los informes con IA: una petición por campo de la plantilla. Las mismas
// peticiones valen para un lote (lotes.ts) o para la vía directa (pedirTexto).
//
// El texto sale en Markdown restringido (ver dominio/marcadores.ts › parsearTexto) con una
// última línea «FUENTES: …», sin salida JSON: así todas las peticiones de un lote comparten
// configuración, como exige la Batch API con algunos proveedores.
//
// Lo común (reglas y datos del proyecto) va primero y lo propio del campo, al final: los
// proveedores reutilizan el principio repetido entre peticiones y cobra menos.

import { IDIOMAS_ES } from '../formulario/textos';
import { sinContactos } from '../dominio/informesComun';
import { pedirJson, pedirTexto } from './openrouter';
import { iaDisponible } from './index';
import type { CampoPlantilla, FormatoPlantilla, Idioma } from '../tipos';
import type { PeticionLote } from './lotes';

const REGLAS = [
  'Eres un redactor de la ONG española Africa Directo, que financia proyectos en África con voluntarios. Redactas un campo de un informe a partir de los datos en JSON que se te dan y de las instrucciones de la plantilla.',
  'Reglas:',
  '- Usa solo los datos del JSON. No inventes cifras, fechas, nombres, cantidades ni hechos.',
  '- Si falta un dato imprescindible para lo que se pide, escribe [PENDIENTE: qué falta] (en español) en su lugar. Úsalo poco: solo cuando sin ese dato la frase quedaría incompleta; si algo no consta y no es imprescindible, simplemente no lo menciones.',
  '- No escribas nombres de personas ni datos de contacto, y nunca datos de menores.',
  '- Formato: texto sencillo en Markdown: párrafos separados por una línea en blanco, viñetas con «- » y **negrita** solo para algo puntual. Usa «### » solo si la instrucción del campo pide subtítulos. No repitas el título del campo ni pongas otros títulos.',
  '- Escribe solo el contenido del campo, sin introducciones ni comentarios sobre lo que haces.',
  '- Termina con una línea aparte «FUENTES: » seguida de los identificadores de los datos usados, separados por comas: los de los eventos (E1, E2…) y, si los usas, «ficha», «financiacion», «solicitud» o «adjunto». Si no usaste ninguno, «FUENTES: -».',
].join('\n');

export interface CampoPedido {
  clave: string;
  instruccion: string;
  enLinea: boolean;
  caja?: CampoPlantilla['caja'];
}

/** Petición para redactar un campo. `contexto` es el JSON con los datos (el mismo en todos los campos). */
export function peticionCampo(e: {
  contexto: string;
  tipo: string;
  formato: FormatoPlantilla;
  idioma: Idioma;
  general: string;
  campo: CampoPedido;
  otros: CampoPedido[];
  indicaciones: string;
}): PeticionLote {
  const c = e.campo;
  const forma = c.enLinea
    ? 'Este campo va dentro de una frase de la plantilla: escribe solo unas palabras o una frase corta, sin saltos de línea ni viñetas.'
    : e.formato === 'slides'
      ? `Es una diapositiva: pocas ideas muy breves, una por línea${c.caja ? `; cabe en un recuadro de unas ${Math.max(20, Math.round((c.caja.ancho * c.caja.alto) / 840))} palabras como mucho` : ''}.`
      : '';
  const entrada = [
    `DATOS (JSON):\n${e.contexto}`,
    `INFORME: ${e.tipo}. Idioma de lo que escribas: ${IDIOMAS_ES[e.idioma].toLowerCase()}.`,
    e.general ? `INSTRUCCIONES GENERALES DE LA PLANTILLA:\n${e.general}` : '',
    e.indicaciones ? `INDICACIONES DEL VOLUNTARIO PARA ESTE INFORME:\n${sinContactos(e.indicaciones)}` : '',
    e.otros.length ? `OTROS CAMPOS DEL INFORME (los redacta otra petición; no repitas lo suyo):\n${e.otros.map((o) => `- ${o.clave}: ${o.instruccion || 'sin instrucción'}`).join('\n')}` : '',
    `CAMPO QUE TIENES QUE REDACTAR: «${c.clave}».\n${c.instruccion || 'Sin instrucción propia: guíate por las instrucciones generales y por el nombre del campo.'}${forma ? `\n${forma}` : ''}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { id: c.clave, instrucciones: REGLAS, entrada };
}

/** Separa el texto de un campo, sus fuentes y lo que quedó pendiente. */
export function leerCampo(texto: string, campo: CampoPedido): { texto: string; fuentes: string[]; pendientes: string[] } {
  let t = texto.replace(/\r/g, '').trim();
  let fuentes: string[] = [];
  const m = t.match(/\n?[ \t*_]*FUENTES:?[ \t*_]*([^\n]*)\s*$/i);
  if (m) {
    fuentes = m[1].split(/[,;]/).map((s) => s.replace(/[*_`]/g, '').trim()).filter((s) => s && s !== '-');
    t = t.slice(0, m.index).trim();
  }
  // Si empieza por un título y el campo no pide subtítulos, es el título del campo repetido.
  const lineas = t.split('\n');
  if (lineas.length > 1 && /^#{1,6}\s/.test(lineas[0]) && !/###|subt[ií]tulo/i.test(campo.instruccion)) t = lineas.slice(1).join('\n').trim();
  if (campo.enLinea) t = t.replace(/\s*\n+\s*/g, ' ').replace(/^[-*•]\s+/, '');
  const pendientes = [...t.matchAll(/\[PENDIENTE:\s*([^\]]*)\]/gi)].map((x) => x[1].trim());
  return { texto: t, fuentes, pendientes };
}

/** Redacta un campo por la vía directa (sin lote): en demo, con IA_LOTES=0 o sin dirección pública. */
export async function redactarDirecto(p: PeticionLote): Promise<string> {
  return pedirTexto({ tarea: 'redaccion', instrucciones: p.instrucciones, entrada: p.entrada, maxTokens: 12_000, timeoutMs: 200_000 });
}

/** Traduce los textos fijos de una plantilla. Conserva los {{marcadores}}; devuelve original → traducción. */
export async function traducirTextos(textos: string[], de: Idioma, a: Idioma): Promise<Record<string, string>> {
  if (!textos.length || !iaDisponible()) return {};
  const salida: Record<string, string> = {};
  for (let i = 0; i < textos.length; i += 120) {
    const tanda = textos.slice(i, i + 120);
    const r = await pedirJson<{ textos: string[] }>({
      tarea: 'rapida',
      nombre: 'traduccion_plantilla',
      esquema: { type: 'object', additionalProperties: false, required: ['textos'], properties: { textos: { type: 'array', items: { type: 'string' } } } },
      instrucciones: `Traduce del ${IDIOMAS_ES[de].toLowerCase()} al ${IDIOMAS_ES[a].toLowerCase()} los textos fijos de una plantilla de informe de una ONG (títulos, etiquetas, frases). Devuelve la lista en el mismo orden y con el mismo número de elementos. No traduzcas ni cambies lo que va entre llaves dobles ({{…}}), los números ni los nombres propios.`,
      entrada: JSON.stringify(tanda),
    });
    // Solo se aceptan si conservan los marcadores; si no, se queda el original.
    tanda.forEach((t, k) => {
      const tr = r.textos[k]?.trim();
      const marcas = (s: string) => (s.match(/\{\{[^{}]+\}\}/g) ?? []).sort().join();
      if (tr && marcas(tr) === marcas(t)) salida[t] = tr;
    });
  }
  return salida;
}

/** Resumen en español del informe, para la lista y para dar continuidad al siguiente. */
export async function resumirInforme(textos: string[]): Promise<string> {
  const todo = textos.join('\n\n').slice(0, 8000);
  if (!todo.trim() || !iaDisponible()) return '';
  try {
    const r = await pedirJson<{ resumen: string }>({
      tarea: 'rapida',
      nombre: 'resumen_informe',
      esquema: { type: 'object', additionalProperties: false, required: ['resumen'], properties: { resumen: { type: 'string' } } },
      instrucciones: 'Resume en castellano, en 2 o 3 frases, este borrador de informe de una ONG: qué cuenta y en qué punto está el proyecto o los proyectos.',
      entrada: todo,
    });
    return r.resumen.trim();
  } catch (e) {
    console.error('IA: no se pudo resumir el informe', e);
    return '';
  }
}
