// Plantillas de informe: un Google Doc o Slides de la unidad Plantillas con marcadores (ver
// marcadores.ts) más su registro en plantillas/{id} con las instrucciones para la IA. Las de
// la ONG (plantillasApp.ts) son plantillas como cualquier otra.
//
// «Sincronizar» lee el documento y guarda lo que tiene (campos, datos, tablas) y los avisos:
// así quien edite la plantilla en Google ve aquí si algo no va a funcionar.

import { almacen } from '../almacen';
import { config, modoDemo } from '../config';
import { drive } from '../drive';
import { ES_DOC, ES_PRESENTACION } from '../drive/tipos';
import { encontrarMarcadores, imagenesConMarcador, leerDoc } from '../drive/plantillaDocs';
import { encontrarMarcadoresSlides, imagenesConMarcadorSlides, leerSlides } from '../drive/plantillaSlides';
import { marcadoresHtml } from '../drive/plantillaHtml';
import { DATOS, TABLAS, leerMarcador, valeParaTipo } from './marcadores';
import type {
  CampoPlantilla,
  EstadoPlantilla,
  FormatoPlantilla,
  Idioma,
  InstruccionesPlantilla,
  Persona,
  Plantilla,
  TipoInforme,
  VersionPlantilla,
} from '../tipos';

export type PlantillaConId = Plantilla & { id: string };

export const TIPOS_PLANTILLA: Record<TipoInforme, string> = {
  seguimiento: 'Informe de seguimiento',
  final: 'Informe final',
  financiacion: 'Para buscar financiación',
  cartera: 'Varios proyectos',
  contraparte: 'Sobre una contraparte',
  donante: 'Para un donante',
};

export const ESTADOS_PLANTILLA: Record<EstadoPlantilla, string> = {
  procesando: 'Preparándose',
  borrador: 'Borrador',
  activa: 'Activa',
  archivada: 'Archivada',
  error: 'Con error',
};

/** Color de la etiqueta de cada estado (clases de globals.css). */
export const CLASE_ESTADO: Record<EstadoPlantilla, string> = { activa: 's-apr', borrador: 's-rev', archivada: 's-cer', procesando: 's-val', error: 's-par' };

export const FORMATOS_PLANTILLA: Record<FormatoPlantilla, string> = { docs: 'Documento', slides: 'Presentación' };

const ORDEN_TIPOS = Object.keys(TIPOS_PLANTILLA);

export async function listarPlantillas(): Promise<PlantillaConId[]> {
  const lista = await (await almacen()).consultar<Plantilla>('plantillas');
  return lista.sort((a, b) => ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo) || a.nombre.localeCompare(b.nombre, 'es'));
}

export async function leerPlantilla(id: string): Promise<PlantillaConId | null> {
  const p = await (await almacen()).leer<Plantilla>(`plantillas/${id}`);
  return p ? { ...p, id } : null;
}

export async function listarVersiones(id: string): Promise<(VersionPlantilla & { id: string })[]> {
  return (await almacen()).consultar<VersionPlantilla>(`plantillas/${id}/versiones`, { orden: ['version', 'desc'], limite: 20 });
}

// ── Lectura del documento ───────────────────────────────────────────────────

/** Un marcador leído del documento, sea cual sea su formato. */
export interface MarcadorLeido {
  original: string;
  /** Solo en su párrafo. */
  solo: boolean;
  enTabla: boolean;
  enEncabezado: boolean;
  /** En el texto alternativo de una imagen. */
  enAlt: boolean;
  /** Slides: es el único texto de su recuadro. */
  soloEnRecuadro?: boolean;
  caja?: { ancho: number; alto: number };
}

/** Formato de una plantilla según el tipo del archivo (en demo, las plantillas son HTML). */
export function formatoDeMime(mime: string): FormatoPlantilla | null {
  return mime === ES_DOC || mime === 'text/html' ? 'docs' : mime === ES_PRESENTACION ? 'slides' : null;
}

/** Los marcadores del documento, del formato que sea (Docs, Slides o, en demo, HTML). */
export async function leerMarcadores(archivoId: string, mime: string): Promise<MarcadorLeido[]> {
  if (mime === ES_DOC) {
    const doc = await leerDoc(archivoId);
    return [
      ...encontrarMarcadores(doc).map((h) => ({ original: h.original, solo: h.solo, enTabla: h.enTabla, enEncabezado: !h.enCuerpo, enAlt: false })),
      ...imagenesConMarcador(doc).map((i) => ({ original: `{{foto:${i.clave}}}`, solo: true, enTabla: false, enEncabezado: false, enAlt: true })),
    ];
  }
  if (mime === ES_PRESENTACION) {
    const p = await leerSlides(archivoId);
    return [
      ...encontrarMarcadoresSlides(p).map((h) => ({ original: h.original, solo: h.solo, enTabla: !!h.celda, enEncabezado: false, enAlt: false, soloEnRecuadro: h.soloEnRecuadro, caja: h.caja })),
      ...imagenesConMarcadorSlides(p).map((i) => ({ original: `{{foto:${i.clave}}}`, solo: true, enTabla: false, enEncabezado: false, enAlt: true })),
    ];
  }
  if (mime === 'text/html') {
    const html = (await (await drive()).descargar(archivoId)).bytes.toString('utf8');
    return marcadoresHtml(html).map((m) => ({ ...m, enEncabezado: false }));
  }
  throw new Error('La plantilla tiene que ser un Google Doc o una presentación de Google Slides.');
}

/**
 * Qué campos, datos y tablas tiene la plantilla, y avisos de lo que no va a salir bien.
 * `instrucciones`: las que ya hay, para conservar como «huérfanos» los campos que desaparecen.
 * `extras`: instrucciones escritas en el propio marcador (formato antiguo), por clave.
 */
export function analizarEstructura(
  leidos: MarcadorLeido[],
  tipo: TipoInforme,
  formato: FormatoPlantilla,
  instrucciones: InstruccionesPlantilla,
): { estructura: Plantilla['estructura']; avisos: string[]; extras: Record<string, string> } {
  const campos = new Map<string, CampoPlantilla>();
  const datos = new Set<string>();
  const tablas = new Set<string>();
  const pies = new Set<string>();
  const avisos = new Set<string>();
  const extras: Record<string, string> = {};
  const deConjunto = !['seguimiento', 'final', 'financiacion'].includes(tipo);

  for (const l of leidos) {
    const m = leerMarcador(l.original.slice(2, -2));
    if (!m) {
      avisos.add(`${l.original} no es un marcador que la app conozca: se quedará resaltado en el informe.`);
      continue;
    }
    if (m.tipo === 'dato') {
      const d = DATOS[m.clave];
      if (!d) avisos.add(`${l.original}: la app no conoce ese dato; se quedará resaltado.`);
      else if (!valeParaTipo(d.ambito, tipo)) avisos.add(`${l.original} es para informes ${d.ambito === 'proyecto' ? 'de un proyecto' : 'de conjunto'}: aquí saldrá vacío.`);
      datos.add(m.clave);
      continue;
    }
    if (m.tipo === 'tabla') {
      const t = TABLAS[m.clave];
      if (!t) avisos.add(`${l.original}: la app no conoce esa tabla.`);
      else if (!valeParaTipo(t.ambito, tipo)) avisos.add(`${l.original} es para informes ${t.ambito === 'proyecto' ? 'de un proyecto' : 'de conjunto'}: aquí saldrá vacía.`);
      // En Slides las tablas salen siempre como líneas de texto (se explica en la ayuda).
      if (formato === 'docs' && (!l.solo || l.enTabla || l.enEncabezado)) avisos.add(`${l.original} tiene que ir solo en su párrafo, en el cuerpo y fuera de otras tablas; si no, sale como líneas de texto.`);
      tablas.add(m.clave);
      continue;
    }
    if (m.tipo === 'pie') {
      pies.add(m.clave.split('#')[0]);
      continue;
    }
    if (m.tipo === 'foto' && formato === 'slides' && !l.enAlt && !l.soloEnRecuadro) {
      avisos.add(`En Slides, ${l.original} tiene que ser el único texto de un recuadro (la foto ocupa el recuadro) o ir en el texto alternativo de una imagen.`);
    }
    if (m.tipo === 'fotos') {
      if (formato === 'slides') avisos.add(`En Slides, una galería (${l.original}) pone solo la primera foto.`);
      else if (!l.solo || l.enTabla || l.enEncabezado) avisos.add(`${l.original} tiene que ir solo en su párrafo, en el cuerpo y fuera de tablas; si no, pone solo la primera foto.`);
    }
    const previo = campos.get(m.clave);
    if (previo && previo.tipo !== m.tipo) avisos.add(`La clave «${m.clave}» se usa para cosas distintas ({{${previo.tipo}:…}} y {{${m.tipo}:…}}): usa claves diferentes.`);
    const campo = previo ?? { clave: m.clave, tipo: m.tipo, veces: 0, enLinea: false };
    campo.veces += 1;
    if (m.tipo === 'ia' && !l.solo) campo.enLinea = true;
    if (l.caja && !campo.caja) campo.caja = { ancho: Math.round(l.caja.ancho), alto: Math.round(l.caja.alto) };
    campos.set(m.clave, campo);
    if (m.extra && !extras[m.clave]) extras[m.clave] = m.extra;
  }

  for (const p of pies) if (!campos.has(p)) avisos.add(`{{pie:${p}}} no tiene su foto: falta {{foto:${p}}} o {{fotos:${p}}}.`);
  if (![...campos.values()].some((c) => c.tipo === 'ia')) avisos.add('La plantilla no tiene ningún campo {{ia:…}}: la IA no redactará nada.');
  if (deConjunto && [...campos.values()].some((c) => c.tipo !== 'ia')) avisos.add('Los informes de conjunto no llevan fotos: sus huecos de foto quedarán vacíos.');

  // Los campos que ya no están conservan su instrucción por si vuelven.
  for (const clave of Object.keys(instrucciones.campos)) {
    if (!campos.has(clave) && instrucciones.campos[clave]?.trim()) campos.set(clave, { clave, tipo: 'ia', veces: 0, enLinea: false, huerfano: true });
  }
  return {
    estructura: { campos: [...campos.values()], datos: [...datos].sort(), tablas: [...tablas].sort() },
    avisos: [...avisos],
    extras,
  };
}

/**
 * Lee el documento si ha cambiado desde la última vez (o siempre, con `forzar`) y guarda lo
 * que tiene. Las instrucciones escritas en marcadores antiguos ({{ia:x|…|instrucción}}) se
 * importan una vez a los campos que no tienen.
 */
export async function sincronizarPlantilla(id: string, autor: Persona, forzar = false): Promise<PlantillaConId> {
  const db = await almacen();
  const p = await leerPlantilla(id);
  if (!p) throw new Error('Plantilla no encontrada.');
  const ahora = new Date().toISOString();
  const meta = await (await drive()).metadatos(p.archivoId);
  if (!meta) {
    const sincronizado = { modificado: '', fecha: ahora, avisos: ['No se encuentra el documento en Drive: puede que lo hayan borrado o movido fuera de la unidad.'] };
    await db.guardar(`plantillas/${id}`, { sincronizado }, { fusionar: true });
    return { ...p, sincronizado };
  }
  if (!forzar && p.sincronizado?.modificado && p.sincronizado.modificado === meta.modificado) return p;

  const { estructura, avisos, extras } = analizarEstructura(await leerMarcadores(p.archivoId, meta.mime), p.tipo, p.formato, p.instrucciones);
  const sincronizado = { modificado: meta.modificado ?? ahora, fecha: ahora, avisos };
  await db.guardar(`plantillas/${id}`, { estructura, sincronizado }, { fusionar: true });

  const importadas = Object.entries(extras).filter(([clave]) => !p.instrucciones.campos[clave]?.trim());
  if (importadas.length) {
    const instrucciones = { ...p.instrucciones, campos: { ...p.instrucciones.campos, ...Object.fromEntries(importadas) } };
    await guardarInstrucciones(id, instrucciones, 'Instrucciones tomadas de los marcadores del documento', autor);
    return { ...p, estructura, sincronizado, instrucciones, version: p.version + 1 };
  }
  return { ...p, estructura, sincronizado };
}

// ── Instrucciones y versiones ───────────────────────────────────────────────

/** Guarda una nueva versión de las instrucciones (la anterior queda en el historial). */
export async function guardarInstrucciones(id: string, instrucciones: InstruccionesPlantilla, nota: string, autor: Persona): Promise<number> {
  const db = await almacen();
  const ahora = new Date().toISOString();
  return db.transaccion(async (tx) => {
    const p = await tx.leer<Plantilla>(`plantillas/${id}`);
    if (!p) throw new Error('Plantilla no encontrada.');
    const version = (p.version ?? 0) + 1;
    const v: VersionPlantilla = { version, instrucciones, nota: nota.slice(0, 300), creado: ahora, creadoPor: autor };
    tx.guardar(`plantillas/${id}/versiones/${String(version).padStart(5, '0')}`, { ...v });
    tx.guardar(`plantillas/${id}`, { ...p, instrucciones, version, actualizado: ahora, actualizadoPor: autor });
    return version;
  });
}

export async function restaurarVersion(id: string, version: number, autor: Persona): Promise<number> {
  const v = await (await almacen()).leer<VersionPlantilla>(`plantillas/${id}/versiones/${String(version).padStart(5, '0')}`);
  if (!v) throw new Error('Esa versión ya no existe.');
  return guardarInstrucciones(id, v.instrucciones, `Vuelta a la versión ${version}`, autor);
}

// ── Alta, cambios y baja ────────────────────────────────────────────────────

/** Carpeta de la unidad Plantillas (en demo, una carpeta «Plantillas» del Drive local). */
export async function carpetaPlantillas(nombre: string): Promise<string> {
  const d = await drive();
  if (config.drive.unidadPlantillas) return d.carpetaHija(nombre, config.drive.unidadPlantillas);
  if (modoDemo) return d.carpetaHija(nombre, await d.carpetaHija('Plantillas', d.raizSistema));
  throw new Error('Falta configurar la unidad de plantillas (DRIVE_UNIDAD_PLANTILLAS_ID).');
}

export interface DatosPlantilla {
  nombre: string;
  descripcion: string;
  tipo: TipoInforme;
  idioma: Idioma;
  donante: { id: string; nombre: string } | null;
}

/** Registra un documento de Drive como plantilla y lo lee. */
export async function registrarPlantilla(
  archivoId: string,
  datos: DatosPlantilla & { origen: Plantilla['origen']; estado: EstadoPlantilla; instrucciones?: InstruccionesPlantilla; ejemplo?: Plantilla['ejemplo'] },
  autor: Persona,
): Promise<PlantillaConId> {
  const d = await drive();
  const meta = await d.metadatos(archivoId);
  const formato = meta && formatoDeMime(meta.mime);
  if (!meta || !formato) throw new Error('El archivo tiene que ser un Google Doc o una presentación de Google Slides.');
  const db = await almacen();
  if ((await db.consultar('plantillas', { donde: [['archivoId', '==', archivoId]], limite: 1 })).length) throw new Error('Ese documento ya es una plantilla.');
  const ahora = new Date().toISOString();
  const { instrucciones, ejemplo, ...resto } = datos;
  const p: Plantilla = {
    ...resto,
    formato,
    porDefecto: false,
    archivoId,
    url: formato === 'slides' ? d.urlPresentacion(archivoId) : d.urlDocumento(archivoId),
    ejemplo: ejemplo ?? null,
    // Las instrucciones se guardan como versión 1, para poder volver a ellas.
    version: 0,
    instrucciones: { general: '', campos: {} },
    estructura: { campos: [], datos: [], tablas: [] },
    sincronizado: null,
    creado: ahora,
    creadoPor: autor,
    actualizado: ahora,
    actualizadoPor: autor,
  };
  const id = await db.crear('plantillas', { ...p });
  if (instrucciones) await guardarInstrucciones(id, instrucciones, 'Primera versión', autor);
  return sincronizarPlantilla(id, autor, true);
}

/** Documentos de la unidad Plantillas que aún no son plantillas (para añadirlos). */
export async function documentosSinRegistrar(): Promise<{ id: string; nombre: string; ruta: string; formato: FormatoPlantilla }[]> {
  if (!config.drive.unidadPlantillas) return [];
  const [docs, plantillas] = await Promise.all([(await drive()).documentosDeUnidad(config.drive.unidadPlantillas), listarPlantillas()]);
  const usados = new Set(plantillas.map((p) => p.archivoId));
  return docs
    .filter((x) => !usados.has(x.id) && !x.ruta.split(' / ').some((c) => c.startsWith('_')))
    .map((x) => ({ id: x.id, nombre: x.nombre, ruta: x.ruta, formato: formatoDeMime(x.mime) ?? 'docs' }))
    .sort((a, b) => `${a.ruta}/${a.nombre}`.localeCompare(`${b.ruta}/${b.nombre}`, 'es'));
}

export async function editarPlantilla(id: string, datos: DatosPlantilla, autor: Persona): Promise<void> {
  const p = await leerPlantilla(id);
  if (!p) throw new Error('Plantilla no encontrada.');
  await (await almacen()).guardar(`plantillas/${id}`, { ...datos, actualizado: new Date().toISOString(), actualizadoPor: autor }, { fusionar: true });
  if (datos.nombre !== p.nombre) await (await drive()).renombrar(p.archivoId, datos.nombre).catch((e) => console.error('Plantilla: no se pudo renombrar en Drive', e));
  // Otro tipo cambia qué datos valen: se vuelven a revisar los avisos.
  if (datos.tipo !== p.tipo) await sincronizarPlantilla(id, autor, true);
}

export async function cambiarEstadoPlantilla(id: string, estado: 'activa' | 'borrador' | 'archivada', autor: Persona): Promise<void> {
  const cambios: Partial<Plantilla> = { estado, actualizado: new Date().toISOString(), actualizadoPor: autor };
  // Una plantilla que no está activa no puede ser la que se propone.
  if (estado !== 'activa') cambios.porDefecto = false;
  await (await almacen()).guardar(`plantillas/${id}`, cambios, { fusionar: true });
}

/** La marca como la que se propone para su tipo y formato (y desmarca la que lo era). */
export async function marcarPorDefecto(id: string, autor: Persona): Promise<void> {
  const db = await almacen();
  const p = await leerPlantilla(id);
  if (!p) throw new Error('Plantilla no encontrada.');
  const ahora = new Date().toISOString();
  const otras = await db.consultar<Plantilla>('plantillas', { donde: [['tipo', '==', p.tipo]] });
  for (const o of otras) if (o.id !== id && o.porDefecto && o.formato === p.formato) await db.guardar(`plantillas/${o.id}`, { porDefecto: false }, { fusionar: true });
  await db.guardar(`plantillas/${id}`, { porDefecto: true, estado: 'activa', actualizado: ahora, actualizadoPor: autor }, { fusionar: true });
}

/** Copia el documento en la misma carpeta y la registra como borrador, con las mismas instrucciones. */
export async function duplicarPlantilla(id: string, nombre: string, autor: Persona): Promise<PlantillaConId> {
  const p = await leerPlantilla(id);
  if (!p) throw new Error('Plantilla no encontrada.');
  const d = await drive();
  const meta = await d.metadatos(p.archivoId);
  if (!meta) throw new Error('No se encuentra el documento de la plantilla en Drive.');
  const copia = await d.copiar(p.archivoId, meta.carpetaId, nombre);
  return registrarPlantilla(
    copia.id,
    { nombre, descripcion: p.descripcion, tipo: p.tipo, idioma: p.idioma, donante: p.donante, origen: 'drive', estado: 'borrador', instrucciones: p.instrucciones },
    autor,
  );
}

/**
 * Quita la plantilla de la app con su historial. El documento va a la papelera de Drive si lo
 * creó la app (las de la ONG o las hechas desde un ejemplo); si se añadió desde Drive, se queda.
 */
export async function borrarPlantilla(id: string): Promise<'papelera' | 'conservado'> {
  const db = await almacen();
  const p = await leerPlantilla(id);
  if (!p) throw new Error('Plantilla no encontrada.');
  for (const v of await db.consultar(`plantillas/${id}/versiones`)) await db.borrar(`plantillas/${id}/versiones/${v.id}`);
  await db.borrar(`plantillas/${id}`);
  if (p.origen === 'drive') return 'conservado';
  await (await drive()).aPapelera(p.archivoId).catch((e) => console.error('Plantilla: no se pudo mandar a la papelera', e));
  return 'papelera';
}

/** Una plantilla para elegir al generar un informe. */
export interface OpcionPlantilla {
  id: string;
  nombre: string;
  tipo: TipoInforme;
  formato: FormatoPlantilla;
  porDefecto: boolean;
  idioma: Idioma;
  donante: { id: string; nombre: string } | null;
}

/** Las plantillas activas de esos tipos, primero las propuestas por defecto. */
export async function plantillasActivas(tipos: TipoInforme[]): Promise<OpcionPlantilla[]> {
  return (await listarPlantillas())
    .filter((p) => p.estado === 'activa' && tipos.includes(p.tipo))
    .sort((a, b) => Number(b.porDefecto) - Number(a.porDefecto))
    .map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, formato: p.formato, porDefecto: p.porDefecto, idioma: p.idioma, donante: p.donante }));
}

/** Campos que la IA rellena y aún no tienen instrucción (para avisar en la lista). */
export const camposSinInstruccion = (p: Pick<Plantilla, 'estructura' | 'instrucciones'>) =>
  p.estructura.campos.filter((c) => !c.huerfano && c.tipo === 'ia' && !p.instrucciones.campos[c.clave]?.trim()).map((c) => c.clave);
