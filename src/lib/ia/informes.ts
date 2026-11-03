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
import { parteImagen, pedirJson, pedirTexto } from './openrouter';
import { iaDisponible } from './index';
import { ajustesIa } from './ajustes';
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
  if (!textos.length || !(await iaDisponible())) return {};
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

// ── Fotos ───────────────────────────────────────────────────────────────────

/** Tipos de imagen que admiten los modelos (en demo las fotos de ejemplo son SVG: no se describen). */
export const IMAGEN_LEGIBLE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Describe una foto (vía directa, sin retención). `documento`: es un archivo adjunto (una factura,
 * un plano…): se transcribe su texto. La foto va en base64, nunca como enlace.
 */
export async function describirImagen(bytes: Buffer, mime: string, o: { pista: string; documento?: boolean }): Promise<string> {
  if (!IMAGEN_LEGIBLE.includes(mime) || !(await iaDisponible()) || !(await ajustesIa()).fotos) return '';
  const r = await pedirJson<{ descripcion: string }>({
    tarea: 'vision',
    nombre: 'descripcion_imagen',
    esquema: { type: 'object', additionalProperties: false, required: ['descripcion'], properties: { descripcion: { type: 'string' } } },
    instrucciones: o.documento
      ? 'Es un documento de un proyecto de una ONG (factura, presupuesto, plano, acta…). Transcribe en castellano lo importante que se lee (conceptos, cifras, fechas) y di qué es. Sin nombres de personas ni datos de contacto.'
      : 'Describe en castellano, en una o dos frases, lo que se ve en esta foto de un proyecto de una ONG en África: la obra o la actividad, el lugar, en qué fase está. No identifiques a nadie ni digas nombres; si hay menores, di solo «niños» o «alumnos».',
    entrada: [parteImagen(bytes, mime), { type: 'text', text: o.pista }],
    timeoutMs: 90_000,
  });
  return sinContactos(r.descripcion.trim());
}

export interface FotoDisponible {
  id: string;
  fecha: string;
  descripcion: string;
}

export interface HuecoFoto {
  clave: string;
  tipo: 'foto' | 'fotos';
  instruccion: string;
}

/** Fotos por galería, como mucho. */
export const MAX_GALERIA = 6;

/**
 * Qué foto va en cada hueco de la plantilla y su pie. Con IA, según las descripciones y las
 * instrucciones de cada hueco; sin IA (o si falla), en orden y sin pie.
 */
export async function asignarFotos(fotos: FotoDisponible[], huecos: HuecoFoto[], idioma: Idioma): Promise<Record<string, { id: string; pie: string }[]>> {
  const enOrden = () => {
    const r: Record<string, { id: string; pie: string }[]> = {};
    let n = 0;
    for (const h of huecos.filter((x) => x.tipo === 'foto')) if (fotos[n]) r[h.clave] = [{ id: fotos[n++].id, pie: '' }];
    for (const h of huecos.filter((x) => x.tipo === 'fotos')) r[h.clave] = fotos.slice(n, n + MAX_GALERIA).map((f) => ({ id: f.id, pie: '' }));
    return r;
  };
  if (!fotos.length || !huecos.length) return {};
  if (fotos.every((f) => !f.descripcion) || !(await iaDisponible())) return enOrden();
  try {
    const r = await pedirJson<{ huecos: { clave: string; fotos: { id: string; pie: string }[] }[] }>({
      tarea: 'rapida',
      nombre: 'asignacion_fotos',
      esquema: {
        type: 'object',
        additionalProperties: false,
        required: ['huecos'],
        properties: {
          huecos: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['clave', 'fotos'],
              properties: {
                clave: { type: 'string' },
                fotos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'pie'], properties: { id: { type: 'string' }, pie: { type: 'string' } } } },
              },
            },
          },
        },
      },
      instrucciones: [
        'Eliges las fotos de un informe de una ONG. Recibes las fotos disponibles (con su descripción y fecha) y los huecos de la plantilla.',
        `- En cada hueco de tipo «foto» va una sola foto; en uno de tipo «fotos» (galería), entre 2 y ${MAX_GALERIA}. Sigue la instrucción de cada hueco.`,
        '- No repitas una foto en dos huecos si hay otras. Deja un hueco sin fotos si ninguna encaja.',
        `- Para cada foto, un pie en ${IDIOMAS_ES[idioma].toLowerCase()} de como mucho 15 palabras que diga qué se ve, sin nombres de personas.`,
      ].join('\n'),
      entrada: JSON.stringify({ fotos, huecos }),
    });
    const validas = new Set(fotos.map((f) => f.id));
    const salida: Record<string, { id: string; pie: string }[]> = {};
    for (const h of r.huecos) {
      const hueco = huecos.find((x) => x.clave === h.clave);
      if (!hueco) continue;
      const elegidas = h.fotos.filter((f) => validas.has(f.id)).slice(0, hueco.tipo === 'foto' ? 1 : MAX_GALERIA);
      salida[hueco.clave] = elegidas.map((f) => ({ id: f.id, pie: sinContactos(f.pie.trim()) }));
    }
    return salida;
  } catch (e) {
    console.error('IA: no se pudieron asignar las fotos', e);
    return enOrden();
  }
}

/** Resumen en español del informe, para la lista y para dar continuidad al siguiente. */
export async function resumirInforme(textos: string[]): Promise<string> {
  const todo = textos.join('\n\n').slice(0, 8000);
  if (!todo.trim() || !(await iaDisponible())) return '';
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
