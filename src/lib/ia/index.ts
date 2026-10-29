// Capa propia de IA. El resto de la app llama a estas funciones y no sabe qué
// proveedor hay detrás. Hoy es OpenAI (ver ./openai.ts); sin clave, se usa un
// sustituto que no inventa nada y se limita a las comprobaciones automáticas.
//
// Privacidad: a la IA solo se envían datos del proyecto, nunca nombres ni datos de contacto.

import { config } from '../config';
import { nombrePais } from '../paises';
import { IDIOMAS_ES, nombreSector } from '../formulario/textos';
import type { AnalisisSolicitud, Idioma, RespuestasSolicitud, TraduccionSolicitud } from '../tipos';
import { pedirJson } from './openai';

export const iaDisponible = () => !!config.ia.openaiClave;

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
        'Recibes en JSON una solicitud de proyecto escrita por una contraparte local. Devuelve, en español de España:',
        '- tituloEs: un título breve (máximo 8 palabras).',
        '- resumen: 3 a 5 frases claras y neutras. No inventes datos ni cifras que no estén en la solicitud.',
        '- traduccion: traducción fiel al español de cada campo de texto; si ya está en español, cópialo. "conceptos" son los conceptos del presupuesto en el mismo orden.',
        '- falta: lista breve de información importante que falta o es confusa para valorar el proyecto (desglose, beneficiarios, plazos, aportación local, permisos, mantenimiento…). No repitas las comprobaciones ya hechas.',
        'No incluyas nombres de personas ni datos de contacto.',
      ].join('\n'),
      entrada: JSON.stringify(entrada),
    });
    return {
      tituloEs: res.tituloEs || r.titulo,
      resumen: res.resumen,
      traduccion: idioma === 'es' ? null : res.traduccion,
      falta: [...avisos, ...res.falta.filter((f) => !avisos.includes(f))],
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
