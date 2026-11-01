// IA para las plantillas de informe: cambiar sus instrucciones con una petición en palabras
// del voluntario («más formal», «que hable siempre del número de alumnos»…) o escribir las que
// faltan. Va por la vía directa (sin lotes): es corto y el voluntario espera la respuesta.

import { iaDisponible } from './index';
import { pedirJson } from './openrouter';
import { TIPOS_PLANTILLA } from '../dominio/plantillas';
import type { CampoPlantilla, FormatoPlantilla, InstruccionesPlantilla, TipoInforme } from '../tipos';

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['general', 'campos', 'resumen'],
  properties: {
    general: { type: 'string' },
    campos: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['clave', 'instruccion'], properties: { clave: { type: 'string' }, instruccion: { type: 'string' } } },
    },
    resumen: { type: 'string' },
  },
};

export interface PropuestaInstrucciones {
  instrucciones: InstruccionesPlantilla;
  /** Qué ha cambiado, en una o dos frases. */
  resumen: string;
}

export async function editarInstrucciones(e: {
  nombre: string;
  tipo: TipoInforme;
  formato: FormatoPlantilla;
  actuales: InstruccionesPlantilla;
  campos: CampoPlantilla[];
  peticion: string;
}): Promise<PropuestaInstrucciones> {
  if (!iaDisponible()) throw new Error('La IA no está configurada (falta OPENROUTER_API_KEY).');
  const campos = e.campos.filter((c) => !c.huerfano);
  const res = await pedirJson<{ general: string; campos: { clave: string; instruccion: string }[]; resumen: string }>({
    tarea: 'rapida',
    nombre: 'instrucciones_plantilla',
    esquema: ESQUEMA,
    instrucciones: [
      'Ayudas a los voluntarios de la ONG Africa Directo a ajustar las instrucciones de una plantilla de informe. Con esas instrucciones, otra IA redacta cada campo del informe a partir de los datos del proyecto.',
      'Recibes en JSON la plantilla, sus campos, las instrucciones actuales y la petición del voluntario. Devuelve las instrucciones completas ya cambiadas, en castellano:',
      '- general: el propósito del informe, a quién va dirigido, el tono y el estilo. Unas pocas frases.',
      '- campos: una instrucción por cada campo de la lista, con la misma clave: qué tiene que contar ese campo y con qué extensión aproximada (por ejemplo «en pocas frases»), sin límites de palabras exactos. En los campos de tipo «foto» o «fotos», qué fotos convienen.',
      '- resumen: qué has cambiado, en una o dos frases.',
      'Cambia solo lo que pide el voluntario y deja el resto como está. No añadas reglas sobre no inventar datos, privacidad o formato: eso ya lo pone la app.',
      ...(e.formato === 'slides' ? ['Es una presentación: cada campo es una diapositiva, con muy poco texto.'] : []),
    ].join('\n'),
    entrada: JSON.stringify({
      plantilla: { nombre: e.nombre, tipo: TIPOS_PLANTILLA[e.tipo], formato: e.formato === 'slides' ? 'presentación' : 'documento' },
      campos: campos.map((c) => ({ clave: c.clave, tipo: c.tipo, dentroDeUnaFrase: c.enLinea, ...(c.caja ? { recuadroEnPuntos: c.caja } : {}) })),
      instruccionesActuales: { general: e.actuales.general, campos: campos.map((c) => ({ clave: c.clave, instruccion: e.actuales.campos[c.clave] ?? '' })) },
      peticion: e.peticion,
    }),
  });
  const validas = new Set(campos.map((c) => c.clave));
  return {
    instrucciones: {
      general: res.general.trim(),
      // Las claves que invente la IA se descartan; las que no devuelva conservan su instrucción.
      campos: { ...e.actuales.campos, ...Object.fromEntries(res.campos.filter((c) => validas.has(c.clave)).map((c) => [c.clave, c.instruccion.trim()])) },
    },
    resumen: res.resumen.trim(),
  };
}
