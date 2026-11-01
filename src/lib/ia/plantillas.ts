// IA para las plantillas de informe: cambiar sus instrucciones con una petición en palabras
// del voluntario («más formal», «que hable siempre del número de alumnos»…) o escribir las que
// faltan. Va por la vía directa (sin lotes): es corto y el voluntario espera la respuesta.

import { iaDisponible } from './index';
import { pedirJson } from './openrouter';
import { TIPOS_PLANTILLA } from '../dominio/plantillas';
import { DATOS, TABLAS, normalizarClave, valeParaTipo } from '../dominio/marcadores';
import { sinContactos } from '../dominio/informesComun';
import type { CampoPlantilla, FormatoPlantilla, Idioma, InstruccionesPlantilla, TipoInforme } from '../tipos';

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

// ── Plantilla a partir de un informe de ejemplo ─────────────────────────────

const ESQUEMA_EJEMPLO = {
  type: 'object',
  additionalProperties: false,
  required: ['idioma', 'general', 'campos', 'datos', 'tablas', 'dudas'],
  properties: {
    idioma: { type: 'string' },
    general: { type: 'string' },
    campos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clave', 'tipo', 'bloques', 'instruccion'],
        properties: { clave: { type: 'string' }, tipo: { type: 'string' }, bloques: { type: 'array', items: { type: 'string' } }, instruccion: { type: 'string' } },
      },
    },
    datos: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['bloque', 'buscar', 'marcador'], properties: { bloque: { type: 'string' }, buscar: { type: 'string' }, marcador: { type: 'string' } } },
    },
    tablas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tabla', 'marcador'], properties: { tabla: { type: 'string' }, marcador: { type: 'string' } } } },
    dudas: { type: 'array', items: { type: 'string' } },
  },
};

export interface BloqueEjemplo {
  id: string;
  tipo: string;
  texto: string;
  tabla?: { id: string; fila: number; columna: number };
}

export interface AnalisisEjemplo {
  idioma: Idioma;
  instrucciones: InstruccionesPlantilla;
  campos: { clave: string; tipo: 'ia' | 'foto' | 'fotos'; bloques: string[] }[];
  datos: { bloque: string; buscar: string; marcador: string }[];
  tablas: { tabla: string; marcador: string }[];
  dudas: string[];
}

/** La petición (para un lote o directa): bloques del ejemplo y catálogo de datos y tablas. */
export function peticionEjemplo(e: { bloques: BloqueEjemplo[]; tipo: TipoInforme; formato: FormatoPlantilla; donante: string }): { instrucciones: string; entrada: string } {
  const datos = Object.entries(DATOS).filter(([, d]) => valeParaTipo(d.ambito, e.tipo)).map(([k, d]) => ({ marcador: `{{${k}}}`, descripcion: d.descripcion }));
  const tablas = e.formato === 'docs' ? Object.entries(TABLAS).filter(([, t]) => valeParaTipo(t.ambito, e.tipo)).map(([k, t]) => ({ marcador: `{{tabla:${k}}}`, descripcion: t.descripcion })) : [];
  return {
    instrucciones: [
      'Conviertes un informe de ejemplo de la ONG Africa Directo en una plantilla. Recibes el documento en bloques numerados (títulos, párrafos, celdas de tabla, imágenes y tablas enteras) y decides qué es texto fijo de la plantilla y qué cambia en cada informe.',
      'Devuelve:',
      '- idioma: el del texto fijo del ejemplo (es, fr, en o pt).',
      '- campos: lo que redactará la IA en cada informe. Agrupa en un campo los párrafos seguidos de un mismo apartado (bajo un mismo título) que cuentan cosas de ese proyecto: actividades, resultados, necesidad, situación… «tipo»: «ia». Una celda de tabla con texto propio del proyecto es su propio campo. Las imágenes del proyecto son campos de tipo «foto» (una) o «fotos» (si hay varias seguidas, en una sola galería con todos sus bloques). «clave»: corta, en minúsculas y con «_» (avance, necesidad, fotos_obra…).',
      '- instruccion de cada campo: qué tiene que contar, a quién y con qué extensión aproximada, imitando el estilo y la estructura del ejemplo (p. ej. «en tres o cuatro frases», «con viñetas»). Nunca copies sus datos concretos (nombres, cifras, fechas, lugares): describe qué tipo de información va.',
      '- general: propósito del informe, a quién va dirigido, tono y estilo, en pocas frases.',
      '- datos: textos exactos del ejemplo que corresponden a un dato de la app (título del proyecto, país, presupuesto, fechas del periodo, donante…). «buscar» es el texto tal cual aparece en ese bloque y «marcador», uno de la lista de datos. Solo si encaja de verdad.',
      ...(tablas.length ? ['- tablas: tablas enteras (T1, T2…) que son una de las tablas de la lista (p. ej. el presupuesto detallado). El resto de tablas se queda (sus celdas pueden ser campos o datos).'] : ['- tablas: lista vacía.']),
      '- dudas: lo que no tengas claro, para que lo revise una persona (por ejemplo, un cuadro que parece que lo rellena una persona).',
      'El texto fijo (títulos de apartado, preguntas de un formulario, etiquetas de una tabla, textos legales) no se toca: no lo incluyas en ningún campo ni dato. Cada bloque va como mucho en un sitio.',
    ].join('\n'),
    entrada: JSON.stringify({
      tipoDeInforme: TIPOS_PLANTILLA[e.tipo],
      formato: e.formato === 'slides' ? 'presentación' : 'documento',
      ...(e.donante ? { donante: e.donante } : {}),
      datosDisponibles: datos,
      tablasDisponibles: tablas,
      bloques: e.bloques.map((b) => ({ id: b.id, tipo: b.tipo, texto: sinContactos(b.texto).slice(0, 1500), ...(b.tabla ? { tabla: b.tabla } : {}) })),
    }),
  };
}

export const FORMATO_EJEMPLO = { nombre: 'plantilla_desde_ejemplo', esquema: ESQUEMA_EJEMPLO };

/** Comprueba y limpia lo que devolvió la IA: bloques que existen, marcadores conocidos, claves únicas. */
export function validarAnalisis(texto: string, bloques: BloqueEjemplo[], tipo: TipoInforme): AnalisisEjemplo {
  type Crudo = { idioma: string; general: string; campos: { clave: string; tipo: string; bloques: string[]; instruccion: string }[]; datos: AnalisisEjemplo['datos']; tablas: AnalisisEjemplo['tablas']; dudas: string[] };
  const r = JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')) as Crudo;
  const porId = new Map(bloques.map((b) => [b.id, b]));
  const usados = new Set<string>();
  const claves = new Set<string>();
  const campos: AnalisisEjemplo['campos'] = [];
  const instrucciones: InstruccionesPlantilla = { general: sinContactos(r.general ?? '').trim(), campos: {} };
  for (const c of r.campos ?? []) {
    const tipoCampo = c.tipo === 'foto' || c.tipo === 'fotos' ? c.tipo : 'ia';
    const deImagen = tipoCampo !== 'ia';
    const ids = (c.bloques ?? []).filter((id) => {
      const b = porId.get(id);
      return b && !usados.has(id) && (deImagen ? b.tipo === 'imagen' : b.tipo !== 'imagen' && b.tipo !== 'tabla');
    });
    if (!ids.length) continue;
    let clave = normalizarClave(c.clave) || 'campo';
    for (let k = 2; claves.has(clave); k++) clave = `${normalizarClave(c.clave) || 'campo'}_${k}`;
    claves.add(clave);
    ids.forEach((id) => usados.add(id));
    campos.push({ clave, tipo: tipoCampo, bloques: ids });
    instrucciones.campos[clave] = sinContactos(c.instruccion ?? '').trim();
  }
  const datos = (r.datos ?? []).filter((d) => {
    const m = d.marcador?.match(/^\{\{\s*([a-z]+\.[a-z0-9_]+)\s*\}\}$/i);
    const b = porId.get(d.bloque);
    return m && DATOS[m[1].toLowerCase()] && valeParaTipo(DATOS[m[1].toLowerCase()].ambito, tipo) && b && !usados.has(d.bloque) && b.texto.includes(d.buscar) && d.buscar.trim();
  }).map((d) => ({ ...d, marcador: d.marcador.replace(/\s+/g, '').toLowerCase() }));
  const tablas = (r.tablas ?? []).filter((t) => {
    const m = t.marcador?.match(/^\{\{\s*tabla:([a-z_]+)\s*\}\}$/i);
    return m && TABLAS[m[1]] && valeParaTipo(TABLAS[m[1]].ambito, tipo) && porId.get(t.tabla)?.tipo === 'tabla';
  });
  return { idioma: (['es', 'fr', 'en', 'pt'].includes(r.idioma) ? r.idioma : 'es') as Idioma, instrucciones, campos, datos, tablas, dudas: (r.dudas ?? []).map((d) => sinContactos(d)).slice(0, 10) };
}

/** Por la vía directa (sin lote): en local, en demo o con IA_LOTES=0. */
export async function analizarEjemploDirecto(p: { instrucciones: string; entrada: string }, bloques: BloqueEjemplo[], tipo: TipoInforme): Promise<AnalisisEjemplo> {
  if (!iaDisponible()) throw new Error('La IA no está configurada (falta OPENROUTER_API_KEY).');
  const r = await pedirJson<object>({ tarea: 'redaccion', nombre: FORMATO_EJEMPLO.nombre, esquema: ESQUEMA_EJEMPLO, instrucciones: p.instrucciones, entrada: p.entrada, maxTokens: 16_000, timeoutMs: 240_000 });
  return validarAnalisis(JSON.stringify(r), bloques, tipo);
}

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
