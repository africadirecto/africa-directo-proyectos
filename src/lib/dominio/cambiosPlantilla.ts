// «Cambiar con IA» de una plantilla: la IA puede cambiar sus instrucciones, su nombre y
// descripción y también el propio documento (añadir, quitar o renombrar apartados, poner o
// quitar marcadores, cambiar el texto fijo).
//
//   proponer ──▶ (el voluntario revisa la propuesta) ──▶ aplicar
//
// - proponer: lee el documento en bloques numerados (títulos, párrafos, celdas, imágenes), pide
//   a la IA los cambios (ia/plantillas.ts), los valida aquí y guarda la propuesta con la
//   revisión del documento en plantillas/{id}/trabajo/propuesta.
// - aplicar: si nadie ha tocado el documento desde entonces, escribe los cambios (Docs, Slides o,
//   en demo, HTML), lo vuelve a leer y guarda las instrucciones como una versión nueva.
//
// Los cambios en el documento se deshacen en Google (Archivo › Historial de versiones); los de
// las instrucciones, volviendo a una versión anterior en la app.

import crypto from 'node:crypto';
import { almacen } from '../almacen';
import { drive } from '../drive';
import { ES_DOC, ES_PRESENTACION } from '../drive/tipos';
import { aplicarCambiosDoc, bloquesDoc, leerDoc } from '../drive/plantillaDocs';
import { aplicarCambiosSlides, bloquesSlides, leerSlides } from '../drive/plantillaSlides';
import { aplicarCambiosHtml, bloquesHtml } from '../drive/plantillaHtml';
import { proponerCambiosIa } from '../ia/plantillas';
import { MARCADOR, leerMarcador } from './marcadores';
import { editarPlantilla, guardarInstrucciones, leerPlantilla, sincronizarPlantilla, type PlantillaConId } from './plantillas';
import type { InstruccionesPlantilla, Persona } from '../tipos';

/** Un cambio en el documento, sobre uno de sus bloques. */
export interface CambioDocumento {
  /** reemplazar: «buscar» por «texto» dentro del bloque. insertar: un párrafo nuevo tras el bloque. borrar: el bloque entero. */
  accion: 'reemplazar' | 'insertar' | 'borrar';
  bloque: string;
  buscar: string;
  texto: string;
  estilo: 'titulo' | 'parrafo';
}

/** Un cambio ya comprobado, con lo que hace explicado para la pantalla. */
export interface CambioVisible extends CambioDocumento {
  antes: string;
  /** El bloque donde está (o tras el que va), si ayuda a ubicarlo. */
  contexto: string;
}

/** Un bloque del documento tal como lo ve la IA, sea cual sea el formato. */
export interface BloquePlantilla {
  id: string;
  tipo: 'titulo' | 'parrafo' | 'celda' | 'imagen' | 'tabla';
  texto: string;
  /** Dónde está (segmento y celda en Docs, recuadro en Slides): un párrafo nuevo va en el mismo sitio. */
  contenedor: string;
  /** En las celdas, su tabla (si se quita la tabla, se van con ella). */
  tabla?: string;
  /** Las tablas solo se pueden quitar enteras en el cuerpo de un documento. */
  borrable: boolean;
  diapositiva?: number;
}

export interface PropuestaPlantilla {
  peticion: string;
  resumen: string;
  nombre: string;
  descripcion: string;
  instrucciones: InstruccionesPlantilla;
  cambios: CambioVisible[];
  avisos: string[];
  /** Revisión del documento cuando se hizo la propuesta. */
  revision: string;
  creado: string;
  creadoPor: Persona;
}

const recorte = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const enUnaLinea = (t: string) => t.replace(/\s*\n\s*/g, ' ').trim();

/** Los bloques del documento de la plantilla y su revisión (en demo, una huella del HTML). */
export async function leerBloques(p: PlantillaConId): Promise<{ bloques: BloquePlantilla[]; revision: string; mime: string }> {
  const meta = await (await drive()).metadatos(p.archivoId);
  if (!meta) throw new Error('No se encuentra el documento de la plantilla en Drive.');
  if (meta.mime === ES_DOC) {
    const doc = await leerDoc(p.archivoId);
    const bloques = bloquesDoc(doc).map((b) => ({
      id: b.id,
      tipo: b.tipo,
      texto: b.texto,
      contenedor: `${b.seg}|${b.tabla ? `${b.tabla.id}:${b.tabla.fila}:${b.tabla.columna}` : ''}`,
      ...(b.tabla ? { tabla: b.tabla.id } : {}),
      borrable: b.tipo !== 'tabla' || !b.seg,
    }));
    return { bloques, revision: doc.revisionId ?? '', mime: meta.mime };
  }
  if (meta.mime === ES_PRESENTACION) {
    const pr = await leerSlides(p.archivoId);
    const bloques = bloquesSlides(pr).map((b) => ({
      id: b.id,
      tipo: b.tipo,
      texto: b.texto,
      contenedor: `${b.destino.objectId}:${b.destino.celda ? `${b.destino.celda.rowIndex}:${b.destino.celda.columnIndex}` : ''}`,
      borrable: true,
      diapositiva: b.diapositiva,
    }));
    return { bloques, revision: pr.revisionId ?? '', mime: meta.mime };
  }
  if (meta.mime === 'text/html') {
    const html = (await (await drive()).descargar(p.archivoId)).bytes.toString('utf8');
    const bloques = bloquesHtml(html).map((b) => ({ id: b.id, tipo: b.tipo, texto: b.texto, contenedor: b.tipo === 'celda' ? b.id : '', borrable: true }));
    return { bloques, revision: crypto.createHash('sha1').update(html).digest('hex'), mime: meta.mime };
  }
  throw new Error('La plantilla tiene que ser un Google Doc o una presentación de Google Slides.');
}

/**
 * Comprueba los cambios que propone la IA: bloques que existen, textos que están de verdad en su
 * bloque, nada sobre lo que se quita, y un párrafo nuevo tras un bloque que se queda (si su bloque
 * se quita, tras el anterior del mismo sitio). Lo que no vale queda como aviso.
 */
export function validarCambios(crudos: CambioDocumento[], bloques: BloquePlantilla[]): { cambios: CambioVisible[]; avisos: string[] } {
  const porId = new Map(bloques.map((b) => [b.id, b]));
  const avisos: string[] = [];
  const borrados = new Set<string>();
  const cambios: CambioVisible[] = [];
  const noExiste = (c: CambioDocumento) => avisos.push(`La IA propuso un cambio sobre una parte del documento que no existe (${c.bloque}): no se hará.`);

  for (const c of crudos.filter((x) => x.accion === 'borrar')) {
    const b = porId.get(c.bloque);
    if (!b) noExiste(c);
    else if (!b.borrable) avisos.push('Una tabla de un encabezado o pie no se puede quitar desde aquí: hazlo en Google.');
    else if (!borrados.has(b.id)) {
      borrados.add(b.id);
      if (b.tipo === 'tabla') for (const x of bloques) if (x.tabla === b.id) borrados.add(x.id);
      cambios.push({ ...c, buscar: '', texto: '', estilo: 'parrafo', antes: b.tipo === 'imagen' ? 'una imagen' : b.tipo === 'tabla' ? `la tabla «${recorte(b.texto, 60)}»` : b.texto, contexto: '' });
    }
  }

  const ocupados = new Map<string, [number, number][]>();
  for (const c of crudos.filter((x) => x.accion === 'reemplazar')) {
    const b = porId.get(c.bloque);
    if (!b) {
      noExiste(c);
      continue;
    }
    if (borrados.has(b.id) || b.tipo === 'imagen' || b.tipo === 'tabla') continue;
    const buscar = c.buscar ?? '';
    const k = buscar ? b.texto.indexOf(buscar) : -1;
    if (k < 0) {
      avisos.push(`No se encontró «${recorte(buscar, 60)}» en el documento: ese cambio no se hará.`);
      continue;
    }
    const texto = enUnaLinea(c.texto ?? '');
    const tramos = ocupados.get(b.id) ?? [];
    if (texto === buscar || tramos.some(([a, z]) => k < z && a < k + buscar.length)) continue;
    ocupados.set(b.id, [...tramos, [k, k + buscar.length]]);
    cambios.push({ accion: 'reemplazar', bloque: b.id, buscar, texto, estilo: 'parrafo', antes: buscar, contexto: buscar === b.texto ? '' : b.texto });
  }

  for (const c of crudos.filter((x) => x.accion === 'insertar')) {
    let b = porId.get(c.bloque);
    if (!b) {
      noExiste(c);
      continue;
    }
    // Tras lo que se quita, una imagen o una tabla, el párrafo va tras el bloque de texto anterior del mismo sitio.
    for (let i = bloques.indexOf(b); b && (borrados.has(b.id) || b.tipo === 'imagen' || b.tipo === 'tabla'); ) {
      const contenedor: string = b.contenedor;
      b = bloques.slice(0, i).reverse().find((x) => x.contenedor === contenedor && !borrados.has(x.id) && x.tipo !== 'imagen' && x.tipo !== 'tabla');
      i = b ? bloques.indexOf(b) : -1;
    }
    if (!b) {
      avisos.push(`No hay dónde poner «${recorte(c.texto ?? '', 60)}»: añádelo a mano en Google.`);
      continue;
    }
    for (const linea of (c.texto ?? '').split('\n').map((l) => l.trim()).filter(Boolean)) {
      cambios.push({ accion: 'insertar', bloque: b.id, buscar: '', texto: linea, estilo: c.estilo === 'titulo' ? 'titulo' : 'parrafo', antes: '', contexto: b.texto });
    }
  }
  if (cambios.length > 80) {
    avisos.push('La IA propuso demasiados cambios a la vez: pide algo más concreto.');
    return { cambios: [], avisos };
  }
  // En el orden del documento.
  const orden = (c: CambioVisible) => bloques.findIndex((b) => b.id === c.bloque) + (c.accion === 'insertar' ? 0.5 : 0);
  return { cambios: cambios.sort((a, b) => orden(a) - orden(b)), avisos };
}

/** Los campos (texto de la IA y fotos) que quedarán en el documento tras los cambios. */
export function camposTras(bloques: BloquePlantilla[], cambios: CambioDocumento[]): Map<string, 'ia' | 'foto' | 'fotos'> {
  const textos = new Map(bloques.map((b) => [b.id, b.texto]));
  for (const c of cambios) {
    if (c.accion === 'borrar') textos.delete(c.bloque);
    else if (c.accion === 'reemplazar' && textos.has(c.bloque)) textos.set(c.bloque, textos.get(c.bloque)!.replace(c.buscar, c.texto));
  }
  const todo = [...textos.values(), ...cambios.filter((c) => c.accion === 'insertar').map((c) => c.texto)].join('\n');
  const campos = new Map<string, 'ia' | 'foto' | 'fotos'>();
  for (const m of todo.matchAll(MARCADOR)) {
    const x = leerMarcador(m[1]);
    if (x && (x.tipo === 'ia' || x.tipo === 'foto' || x.tipo === 'fotos') && !campos.has(x.clave)) campos.set(x.clave, x.tipo);
  }
  return campos;
}

const rutaPropuesta = (id: string) => `plantillas/${id}/trabajo/propuesta`;

/** Pide a la IA la propuesta y la guarda para aplicarla. `instrucciones`: las del formulario (aún sin guardar, quizá). */
export async function proponerCambioPlantilla(id: string, peticion: string, instrucciones: InstruccionesPlantilla, autor: Persona): Promise<PropuestaPlantilla> {
  const p = await leerPlantilla(id);
  if (!p) throw new Error('Plantilla no encontrada.');
  if (p.estado === 'procesando') throw new Error('La plantilla aún se está preparando.');
  // Los campos que no estaban en el formulario (p. ej. los que ya no están en el documento) conservan su instrucción.
  const base = { general: instrucciones.general, campos: { ...p.instrucciones.campos, ...instrucciones.campos } };
  const { bloques, revision } = await leerBloques(p);
  const r = await proponerCambiosIa({ nombre: p.nombre, descripcion: p.descripcion, tipo: p.tipo, formato: p.formato, instrucciones: base, campos: p.estructura.campos, bloques, peticion });
  const { cambios, avisos } = validarCambios(r.cambios, bloques);
  const tras = camposTras(bloques, cambios);
  // Las instrucciones de los campos que quedan (las nuevas, de la IA); las de los que se van se
  // conservan por si vuelven, como al quitar un campo a mano.
  const campos = { ...base.campos };
  for (const c of r.campos) if (tras.has(c.clave) && c.instruccion.trim()) campos[c.clave] = c.instruccion.trim();
  const propuesta: PropuestaPlantilla = {
    peticion,
    resumen: r.resumen.trim(),
    nombre: r.nombre.trim().slice(0, 200) || p.nombre,
    descripcion: r.descripcion.trim().slice(0, 1000),
    instrucciones: { general: r.general.trim() || base.general, campos },
    cambios,
    avisos,
    revision,
    creado: new Date().toISOString(),
    creadoPor: autor,
  };
  await (await almacen()).guardar(rutaPropuesta(id), { ...propuesta });
  return propuesta;
}

export async function descartarPropuesta(id: string): Promise<void> {
  await (await almacen()).borrar(rutaPropuesta(id)).catch(() => undefined);
}

/** Aplica la propuesta guardada. Devuelve qué se ha hecho, para el mensaje. */
export async function aplicarPropuesta(id: string, autor: Persona): Promise<string> {
  const db = await almacen();
  const [p, prop] = await Promise.all([leerPlantilla(id), db.leer<PropuestaPlantilla>(rutaPropuesta(id))]);
  if (!p) throw new Error('Plantilla no encontrada.');
  if (!prop) throw new Error('La propuesta ya no está: vuelve a pedirla.');
  const hecho: string[] = [];

  if (prop.cambios.length) {
    const meta = await (await drive()).metadatos(p.archivoId);
    if (!meta) throw new Error('No se encuentra el documento de la plantilla en Drive.');
    const cambios: CambioDocumento[] = prop.cambios.map(({ accion, bloque, buscar, texto, estilo }) => ({ accion, bloque, buscar, texto, estilo }));
    if (meta.mime === ES_DOC) await aplicarCambiosDoc(p.archivoId, cambios, prop.revision);
    else if (meta.mime === ES_PRESENTACION) await aplicarCambiosSlides(p.archivoId, cambios, prop.revision);
    else {
      const d = await drive();
      const html = (await d.descargar(p.archivoId)).bytes.toString('utf8');
      if (crypto.createHash('sha1').update(html).digest('hex') !== prop.revision) throw new Error('El documento ha cambiado desde la propuesta: vuelve a pedirla.');
      await d.reemplazarContenido(p.archivoId, 'text/html', Buffer.from(aplicarCambiosHtml(html, cambios)));
    }
    hecho.push(`${prop.cambios.length} cambio${prop.cambios.length > 1 ? 's' : ''} en el documento`);
  }
  if (prop.nombre !== p.nombre || prop.descripcion !== p.descripcion) {
    await editarPlantilla(id, { nombre: prop.nombre, descripcion: prop.descripcion, tipo: p.tipo, idioma: p.idioma, donante: p.donante }, autor);
    hecho.push(prop.nombre !== p.nombre ? 'nombre nuevo' : 'descripción nueva');
  }
  const leida = await sincronizarPlantilla(id, autor, true);
  if (JSON.stringify(prop.instrucciones) !== JSON.stringify(leida.instrucciones)) {
    const v = await guardarInstrucciones(id, prop.instrucciones, `Con IA: ${prop.peticion}`, autor);
    hecho.push(`instrucciones en la versión ${v}`);
  }
  await descartarPropuesta(id);
  return hecho.length ? `Hecho: ${hecho.join(', ')}.` : 'No había nada que cambiar.';
}
