// Capa propia de IA. El resto de la app llama a estas funciones y no sabe qué
// proveedor hay detrás. Hoy es OpenRouter (ver ./openrouter.ts); sin clave, se usa un
// sustituto que no inventa nada y se limita a las comprobaciones automáticas.
//
// Privacidad: a la IA solo se envían datos del proyecto, nunca nombres ni datos de contacto.

import { config } from '../config';
import { nombrePais } from '../paises';
import { IDIOMAS_ES, nombreSector } from '../formulario/textos';
import type { AnalisisSolicitud, FormatoInforme, Idioma, RespuestasSolicitud, TraduccionSolicitud } from '../tipos';
import { pedirJson } from './openrouter';

export const iaDisponible = () => !!config.ia.clave;

const ESQUEMA_ANALISIS = {
  type: 'object',
  additionalProperties: false,
  required: ['tituloEs', 'resumen', 'traduccion', 'falta'],
  properties: {
    tituloEs: { type: 'string' },
    resumen: { type: 'string' },
    traduccion: {
      type: 'object',
      additionalProperties: false,
      required: ['titulo', 'necesidad', 'beneficiarios', 'aportacionLocal', 'indicaciones', 'conceptos'],
      properties: {
        titulo: { type: 'string' },
        necesidad: { type: 'string' },
        beneficiarios: { type: 'string' },
        aportacionLocal: { type: 'string' },
        indicaciones: { type: 'string' },
        conceptos: { type: 'array', items: { type: 'string' } },
      },
    },
    falta: { type: 'array', items: { type: 'string' } },
  },
};

/** Traduce y resume una solicitud y señala lo que falta. `avisos` son las comprobaciones sin IA. */
export async function analizarSolicitud(
  r: RespuestasSolicitud,
  idioma: Idioma,
  avisos: string[],
): Promise<AnalisisSolicitud> {
  const sinIA: AnalisisSolicitud = {
    tituloEs: r.titulo,
    resumen: r.necesidad.length > 600 ? `${r.necesidad.slice(0, 600)}…` : r.necesidad,
    traduccion: null,
    falta: avisos,
    hechoPorIA: false,
  };
  if (!iaDisponible()) return sinIA;

  const entrada = {
    idioma: IDIOMAS_ES[idioma],
    titulo: r.titulo,
    sector: nombreSector(r.sector),
    pais: nombrePais(r.pais),
    lugar: r.lugar,
    indicaciones: r.indicaciones,
    necesidad: r.necesidad,
    beneficiarios: r.beneficiarios,
    numBeneficiarios: r.numBeneficiarios,
    plazoMeses: r.plazoMeses,
    aportacionLocal: r.aportacionLocal,
    moneda: r.moneda,
    presupuesto: r.lineas.filter((l) => l.concepto || l.importe).map((l) => ({ concepto: l.concepto, importe: l.importe })),
    comprobacionesYaHechas: avisos,
  };

  try {
    const res = await pedirJson<{ tituloEs: string; resumen: string; traduccion: TraduccionSolicitud; falta: string[] }>({
      tarea: 'rapida',
      nombre: 'analisis_solicitud',
      esquema: ESQUEMA_ANALISIS,
      instrucciones: [
        'Eres un asistente de la ONG española Africa Directo, que financia proyectos en África.',
        'Recibes en JSON una solicitud de proyecto escrita por una contraparte local, a menudo en francés, inglés o portugués. Devuelve, en castellano (español de España):',
        '- tituloEs: un título breve (máximo 8 palabras).',
        '- resumen: 3 a 5 frases claras y neutras. No inventes datos ni cifras que no estén en la solicitud.',
        '- traduccion: traducción fiel al castellano de cada campo de texto, con un estilo natural y claro; si ya está en castellano, cópialo. "conceptos" son los conceptos del presupuesto traducidos, en el mismo orden.',
        '- falta: lista breve de información importante que falta o es confusa para valorar el proyecto (desglose, beneficiarios, plazos, aportación local, permisos, mantenimiento…). Máximo 6 puntos, sin suposiciones. No incluyas nada de comprobacionesYaHechas, ni siquiera para decir que ya está señalado.',
        'No incluyas nombres de personas ni datos de contacto.',
      ].join('\n'),
      entrada: JSON.stringify(entrada),
    });
    return {
      tituloEs: res.tituloEs || r.titulo,
      resumen: res.resumen,
      traduccion: idioma === 'es' ? null : res.traduccion,
      // Por si la IA repite alguna comprobación automática con otras palabras («ya señalado…»).
      falta: [...avisos, ...res.falta.filter((f) => !avisos.includes(f) && !/ya (se ha |est[aá] )?señalad/i.test(f))],
      hechoPorIA: true,
    };
  } catch (e) {
    console.error('IA: error al analizar la solicitud', e);
    return sinIA;
  }
}

/** Traduce un mensaje de un voluntario al idioma de la contraparte. Sin IA, lo devuelve igual. */
export async function traducir(texto: string, idioma: Idioma): Promise<{ texto: string; traducido: boolean }> {
  if (!texto.trim() || idioma === 'es' || !iaDisponible()) return { texto, traducido: false };
  try {
    const res = await pedirJson<{ texto: string }>({
      tarea: 'rapida',
      nombre: 'traduccion',
      esquema: { type: 'object', additionalProperties: false, required: ['texto'], properties: { texto: { type: 'string' } } },
      instrucciones: `Traduce al ${IDIOMAS_ES[idioma].toLowerCase()} este mensaje de un voluntario de una ONG para una contraparte local en África. Mantén el sentido exacto, con un tono cordial y claro. Devuelve solo la traducción.`,
      entrada: texto,
    });
    return { texto: res.texto, traducido: true };
  } catch (e) {
    console.error('IA: error al traducir', e);
    return { texto, traducido: false };
  }
}

// ── Informes ────────────────────────────────────────────────────────────────

export interface ApartadoPedido {
  clave: string;
  /** Título orientativo; la IA lo devuelve en el idioma del informe. */
  titulo: string;
  palabras: number;
  instruccion: string;
}

export interface ApartadoRedactado {
  clave: string;
  titulo: string;
  texto: string;
  /** Ids de los eventos u otras fuentes ("ficha", "aportaciones") de donde sale el texto. */
  fuentes: string[];
}

export interface Redaccion {
  apartados: ApartadoRedactado[];
  /** Un texto breve por proyecto, en los informes de varios proyectos. */
  proyectos: { codigo: string; texto: string }[];
  pendientes: string[];
  resumen: string;
  hechoPorIA: boolean;
}

const ESQUEMA_INFORME = {
  type: 'object',
  additionalProperties: false,
  required: ['apartados', 'proyectos', 'pendientes', 'resumen'],
  properties: {
    proyectos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['codigo', 'texto'],
        properties: { codigo: { type: 'string' }, texto: { type: 'string' } },
      },
    },
    apartados: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clave', 'titulo', 'texto', 'fuentes'],
        properties: {
          clave: { type: 'string' },
          titulo: { type: 'string' },
          texto: { type: 'string' },
          fuentes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    pendientes: { type: 'array', items: { type: 'string' } },
    resumen: { type: 'string' },
  },
};

/**
 * Redacta los apartados de un informe para un donante a partir de los datos del proyecto
 * (`contexto`, ya sin datos de contacto). Lo que no consta queda como [PENDIENTE: …].
 * Sin IA, devuelve cada apartado marcado como pendiente para que lo escriba un voluntario.
 */
export async function redactarInforme(
  contexto: object,
  apartados: ApartadoPedido[],
  idioma: Idioma,
  instrucciones: string,
  opciones: { formato?: FormatoInforme; porProyecto?: string[] } = {},
): Promise<Redaccion> {
  const diapositivas = opciones.formato === 'slides';
  const porProyecto = opciones.porProyecto ?? [];
  const sinIA: Redaccion = {
    apartados: apartados.map((a) => ({ clave: a.clave, titulo: a.titulo, texto: `[PENDIENTE: ${a.instruccion}]`, fuentes: [] })),
    proyectos: [],
    pendientes: ['La IA no está configurada: hay que redactar todos los apartados.'],
    resumen: '',
    hechoPorIA: false,
  };
  if (!iaDisponible() || (!apartados.length && !porProyecto.length)) return sinIA;

  const palabras = apartados.reduce((s, a) => s + a.palabras, 0) + porProyecto.length * 60;
  const res = await pedirJson<Omit<Redaccion, 'hechoPorIA'>>({
    tarea: 'redaccion',
    nombre: 'informe',
    esquema: ESQUEMA_INFORME,
    maxTokens: Math.min(16_000, 2000 + palabras * 4),
    instrucciones: [
      'Eres un voluntario experto de la ONG española Africa Directo, que financia proyectos en África con el lema «el 100 % llega».',
      `Redacta, en ${IDIOMAS_ES[idioma].toLowerCase()}, los apartados de ${diapositivas ? 'una presentación' : 'un informe'} para donantes, con tono profesional, cercano y honesto.`,
      'Reglas:',
      '- Usa SOLO los datos del JSON. No inventes cifras, fechas, nombres ni hechos, ni des por hecho lo que no consta (por ejemplo, que una obra parada se ha reanudado o que unos fondos se han recibido).',
      '- Si un dato necesario no consta, escribe en el texto «[PENDIENTE: qué falta]» (siempre en español) para que lo complete un voluntario.',
      diapositivas
        ? '- Es para diapositivas: cada apartado son de 3 a 5 ideas cortas (máximo 18 palabras cada una), una por línea, sin guiones ni símbolos delante. Sin Markdown.'
        : '- Cada apartado, aproximadamente con las palabras indicadas. Texto plano: párrafos separados por una línea en blanco, sin títulos, viñetas ni Markdown.',
      porProyecto.length
        ? `- "proyectos": para cada código de ${porProyecto.join(', ')}, ${diapositivas ? '2 o 3 ideas cortas, una por línea' : 'un párrafo de unas 60 palabras'} con lo más importante de ese proyecto en el periodo.`
        : '- "proyectos": déjalo vacío.',
      '- "titulo": el título del apartado traducido al idioma del informe.',
      '- "fuentes": los ids de los eventos que usas (por ejemplo "E3"), o "ficha", "aportaciones" o "solicitud".',
      '- No incluyas datos de contacto ni nombres de beneficiarios concretos; nunca identifiques a menores.',
      '- "pendientes": lista en español de lo que el voluntario debería completar o comprobar.',
      '- "resumen": dos frases en español que resuman el informe.',
      'Devuelve los apartados en el mismo orden y con la misma "clave" que se piden.',
      instrucciones ? `Indicaciones del voluntario: ${instrucciones}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    entrada: JSON.stringify({ ...contexto, apartadosPedidos: apartados }),
  });
  // Se respeta el orden pedido y no se pierde ningún apartado aunque la IA lo omita.
  const porClave = new Map(res.apartados.map((a) => [a.clave, a]));
  return {
    apartados: apartados.map((a) => porClave.get(a.clave) ?? { clave: a.clave, titulo: a.titulo, texto: `[PENDIENTE: ${a.instruccion}]`, fuentes: [] }),
    proyectos: res.proyectos.filter((x) => porProyecto.includes(x.codigo)),
    pendientes: res.pendientes,
    resumen: res.resumen,
    hechoPorIA: true,
  };
}
