// IA para las plantillas de informe: convertir un informe de ejemplo en plantilla y «Cambiar con
// IA», que con una petición en palabras del voluntario («más formal», «añade un apartado de
// sostenibilidad», «quita las fotos»…) propone cambios en el documento, sus instrucciones y sus
// datos (ver dominio/cambiosPlantilla.ts). «Cambiar con IA» va por la vía directa (sin lotes):
// el voluntario espera la respuesta.

import { iaDisponible } from './index';
import { pedirJson } from './openrouter';
import { TIPOS_PLANTILLA } from '../dominio/plantillas';
import { DATOS, TABLAS, normalizarClave, valeParaTipo } from '../dominio/marcadores';
import { sinContactos } from '../dominio/informesComun';
import type { CampoPlantilla, FormatoPlantilla, Idioma, InstruccionesPlantilla, TipoInforme } from '../tipos';
import type { BloquePlantilla, CambioDocumento } from '../dominio/cambiosPlantilla';

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
  if (!(await iaDisponible())) throw new Error('La IA no está configurada o está desactivada (Administración › Ajustes de IA).');
  const r = await pedirJson<object>({ tarea: 'plantillas', nombre: FORMATO_EJEMPLO.nombre, esquema: ESQUEMA_EJEMPLO, instrucciones: p.instrucciones, entrada: p.entrada, maxTokens: 16_000, timeoutMs: 240_000 });
  return validarAnalisis(JSON.stringify(r), bloques, tipo);
}

// ── «Cambiar con IA» ────────────────────────────────────────────────────────

const ESQUEMA_CAMBIOS = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen', 'nombre', 'descripcion', 'general', 'campos', 'cambios'],
  properties: {
    resumen: { type: 'string' },
    nombre: { type: 'string' },
    descripcion: { type: 'string' },
    general: { type: 'string' },
    campos: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['clave', 'instruccion'], properties: { clave: { type: 'string' }, instruccion: { type: 'string' } } },
    },
    cambios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['accion', 'bloque', 'buscar', 'texto', 'estilo'],
        properties: {
          accion: { type: 'string', enum: ['reemplazar', 'insertar', 'borrar'] },
          bloque: { type: 'string' },
          buscar: { type: 'string' },
          texto: { type: 'string' },
          estilo: { type: 'string', enum: ['titulo', 'parrafo'] },
        },
      },
    },
  },
};

/** Lo que devuelve la IA, sin comprobar (lo comprueba dominio/cambiosPlantilla.ts). */
export interface RespuestaCambios {
  resumen: string;
  nombre: string;
  descripcion: string;
  general: string;
  campos: { clave: string; instruccion: string }[];
  cambios: CambioDocumento[];
}

/**
 * Propuesta de cambios en una plantilla a partir de una petición del voluntario: en el documento
 * (apartados, marcadores, texto fijo), en sus instrucciones y en su nombre o descripción.
 */
export async function proponerCambiosIa(e: {
  nombre: string;
  descripcion: string;
  tipo: TipoInforme;
  formato: FormatoPlantilla;
  instrucciones: InstruccionesPlantilla;
  campos: CampoPlantilla[];
  bloques: BloquePlantilla[];
  peticion: string;
}): Promise<RespuestaCambios> {
  if (!(await iaDisponible())) throw new Error('La IA no está configurada o está desactivada (Administración › Ajustes de IA).');
  const slides = e.formato === 'slides';
  const datos = Object.entries(DATOS).filter(([, d]) => valeParaTipo(d.ambito, e.tipo)).map(([k, d]) => ({ marcador: `{{${k}}}`, descripcion: d.descripcion }));
  const tablas = slides ? [] : Object.entries(TABLAS).filter(([, t]) => valeParaTipo(t.ambito, e.tipo)).map(([k, t]) => ({ marcador: `{{tabla:${k}}}`, descripcion: t.descripcion }));
  const campos = e.campos.filter((c) => !c.huerfano);
  const res = await pedirJson<RespuestaCambios>({
    tarea: 'plantillas',
    nombre: 'cambios_plantilla',
    esquema: ESQUEMA_CAMBIOS,
    maxTokens: 16_000,
    timeoutMs: 200_000,
    instrucciones: [
      'Ayudas a los voluntarios de la ONG Africa Directo a cambiar una plantilla de informe. La plantilla es un documento con texto fijo y marcadores que la app rellena en cada informe:',
      '- {{ia:clave}}: un texto que redacta otra IA siguiendo la instrucción de ese campo. Si está solo en su párrafo, puede ser largo; dentro de una frase, una sola frase.',
      '- {{foto:clave}} (una foto), {{fotos:clave}} (varias, en una galería) y {{pie:clave}} (el pie de esa foto). Su instrucción dice qué fotos convienen.',
      '- {{espacio.dato}}: un dato de la app, de la lista datosDisponibles. {{tabla:x}}: una tabla de la lista tablasDisponibles, sola en su párrafo.',
      'Recibes en JSON la plantilla, el documento en bloques numerados (B1, B2…; las tablas enteras son T1, T2…), las instrucciones actuales y la petición del voluntario. Devuelve:',
      '- cambios: los cambios en el documento que pida la petición, en orden. Cada uno:',
      '  · «reemplazar»: en el bloque «bloque», cambia el texto «buscar» (copiado exactamente del bloque, solo el trozo necesario) por «texto». Para renombrar un apartado, cambiar un texto fijo o poner, cambiar o quitar un marcador dentro de un párrafo. Un «texto» vacío lo quita.',
      '  · «insertar»: un párrafo nuevo con «texto» justo después del bloque «bloque»; «estilo» es «titulo» para el título de un apartado o «parrafo». Un apartado nuevo son dos: su título y un párrafo con solo su marcador, p. ej. {{ia:sostenibilidad}}. Para ponerlo al final de otro apartado, va tras el último bloque de ese apartado.',
      '  · «borrar»: quita el bloque entero. Para quitar un apartado, quita su título y sus párrafos.',
      '  En los campos que no use cada cambio, cadena vacía (y estilo «parrafo»). Si la petición no toca el documento, «cambios» va vacío.',
      '- campos: la instrucción de cada campo {{ia:…}}, {{foto:…}} o {{fotos:…}} que quede en el documento, incluidos los nuevos, con su clave: qué tiene que contar y con qué extensión aproximada (sin límites de palabras exactos), o qué fotos convienen.',
      '- general: el propósito del informe, a quién va dirigido, el tono y el estilo, en pocas frases.',
      '- nombre y descripcion: los de la plantilla; cámbialos solo si la petición lo pide o si los cambios los dejan desfasados.',
      '- resumen: qué has cambiado, en una o dos frases, para el voluntario.',
      'Reglas:',
      '- Cambia solo lo que pide el voluntario y deja el resto exactamente igual.',
      '- Claves nuevas: cortas, en minúsculas, con «_» y distintas de las que ya hay. Los marcadores, enteros y sin espacios dentro de las llaves. Datos y tablas, solo de las listas.',
      '- El texto fijo nuevo va en el idioma del documento.',
      slides
        ? '- Es una presentación: no se pueden añadir diapositivas, solo cambiar, añadir o quitar párrafos de los recuadros que ya hay (cada bloque indica su diapositiva). Cada campo va con muy poco texto.'
        : '- No se pueden cambiar colores, tipos de letra ni el diseño: si te lo piden, dilo en el resumen.',
      '- Si algo de la petición no se puede hacer con estos cambios, dilo en el resumen; no lo inventes.',
      '- No añadas reglas sobre no inventar datos, privacidad o formato: eso ya lo pone la app.',
    ].join('\n'),
    entrada: JSON.stringify({
      plantilla: { nombre: e.nombre, descripcion: e.descripcion, tipo: TIPOS_PLANTILLA[e.tipo], formato: slides ? 'presentación' : 'documento' },
      bloques: e.bloques.slice(0, 600).map((b) => ({ id: b.id, tipo: b.tipo, texto: sinContactos(b.texto).slice(0, 800), ...(b.diapositiva ? { diapositiva: b.diapositiva } : {}) })),
      camposActuales: campos.map((c) => ({ clave: c.clave, tipo: c.tipo, dentroDeUnaFrase: c.enLinea, ...(c.caja ? { recuadroEnPuntos: c.caja } : {}) })),
      instruccionesActuales: { general: e.instrucciones.general, campos: campos.map((c) => ({ clave: c.clave, instruccion: e.instrucciones.campos[c.clave] ?? '' })) },
      datosDisponibles: datos,
      tablasDisponibles: tablas,
      peticion: e.peticion,
    }),
  });
  return { ...res, campos: res.campos.map((c) => ({ clave: normalizarClave(c.clave), instruccion: c.instruccion })) };
}
