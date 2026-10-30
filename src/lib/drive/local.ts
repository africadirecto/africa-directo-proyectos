// "Drive" en disco (.datos/drive) para el modo demo. Imita lo que la app usa de Drive.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ES_CARPETA, type ArchivoDrive, type Drive } from './tipos';

const DIR = path.join(process.cwd(), '.datos', 'drive');
const META = path.join(DIR, '_meta.json');

type Meta = {
  archivos: Record<string, ArchivoDrive & { papelera?: boolean }>;
  subidas: Record<string, { carpetaId: string; nombre: string; mime: string; tamano: number }>;
};

function leerMeta(): Meta {
  try {
    return JSON.parse(fs.readFileSync(META, 'utf8')) as Meta;
  } catch {
    return { archivos: {}, subidas: {} };
  }
}

function guardarMeta(m: Meta) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(META, JSON.stringify(m, null, 1));
}

const nuevoId = () => crypto.randomBytes(12).toString('base64url');
const rutaSubida = (sid: string) => path.join(DIR, '_subidas', sid);

function registrar(carpetaId: string, nombre: string, mime: string, tamano: number): ArchivoDrive {
  const m = leerMeta();
  const archivo = { id: nuevoId(), nombre, mime, tamano, carpetaId, creado: new Date().toISOString() };
  m.archivos[archivo.id] = archivo;
  guardarMeta(m);
  return archivo;
}

function idDeSesion(url: string): string {
  if (!url.startsWith('local:')) throw new Error('URL de subida no válida');
  return url.slice('local:'.length);
}

/** Ruta en disco de un archivo (para servirlo en /api/drive-local). */
export function rutaLocal(id: string): { meta: ArchivoDrive; ruta: string } | null {
  const meta = leerMeta().archivos[id];
  return meta && !meta.papelera ? { meta, ruta: path.join(DIR, id) } : null;
}

export function hijosLocales(carpetaId: string): ArchivoDrive[] {
  return Object.values(leerMeta().archivos).filter((a) => a.carpetaId === carpetaId && !a.papelera);
}

export const driveLocal: Drive = {
  raizProyectos: 'raiz-proyectos',
  raizSistema: 'raiz-sistema',

  async crearCarpeta(nombre, padreId) {
    return registrar(padreId, nombre, ES_CARPETA, 0).id;
  },

  async renombrar(id, nombre) {
    const m = leerMeta();
    if (m.archivos[id]) m.archivos[id].nombre = nombre;
    guardarMeta(m);
  },

  async subir(carpetaId, nombre, mime, contenido) {
    const a = registrar(carpetaId, nombre, mime, contenido.byteLength);
    fs.writeFileSync(path.join(DIR, a.id), contenido);
    return a;
  },

  async iniciarSubida({ carpetaId, nombre, mime, tamano }) {
    const sid = nuevoId();
    const m = leerMeta();
    m.subidas[sid] = { carpetaId, nombre, mime, tamano };
    guardarMeta(m);
    fs.mkdirSync(path.dirname(rutaSubida(sid)), { recursive: true });
    fs.writeFileSync(rutaSubida(sid), Buffer.alloc(0));
    return `local:${sid}`;
  },

  async enviarTrozo(url, trozo, inicio, total) {
    const sid = idDeSesion(url);
    const ruta = rutaSubida(sid);
    const actual = fs.statSync(ruta).size;
    if (inicio !== actual) return { recibido: actual };
    fs.appendFileSync(ruta, trozo);
    const recibido = actual + trozo.byteLength;
    if (recibido < total) return { recibido };
    const m = leerMeta();
    const s = m.subidas[sid];
    delete m.subidas[sid];
    guardarMeta(m);
    const archivo = registrar(s.carpetaId, s.nombre, s.mime, total);
    fs.renameSync(ruta, path.join(DIR, archivo.id));
    return { recibido, archivo };
  },

  async estadoSubida(url) {
    const ruta = rutaSubida(idDeSesion(url));
    return { recibido: fs.existsSync(ruta) ? fs.statSync(ruta).size : 0 };
  },

  async metadatos(id) {
    const a = leerMeta().archivos[id];
    return a && !a.papelera ? a : null;
  },

  async listar(carpetaIds) {
    return Object.values(leerMeta().archivos)
      .filter((a) => carpetaIds.includes(a.carpetaId) && !a.papelera)
      .sort((a, b) => b.creado.localeCompare(a.creado));
  },

  async aPapelera(id) {
    const m = leerMeta();
    if (m.archivos[id]) m.archivos[id].papelera = true;
    guardarMeta(m);
  },

  async htmlAPdf(html, carpetaId, nombre) {
    // En demo no hay conversión: se guarda el HTML tal cual.
    return this.subir(carpetaId, `${nombre}.html`, 'text/html', Buffer.from(html));
  },

  async htmlADoc(html, carpetaId, nombre) {
    return this.subir(carpetaId, `${nombre}.html`, 'text/html', Buffer.from(html));
  },

  async copiar(id, carpetaId, nombre) {
    const origen = rutaLocal(id);
    if (!origen) throw new Error('Archivo no encontrado');
    return this.subir(carpetaId, nombre, origen.meta.mime, fs.readFileSync(origen.ruta));
  },

  async carpetaHija(nombre, padreId) {
    const existente = hijosLocales(padreId).find((a) => a.mime === ES_CARPETA && a.nombre === nombre);
    return existente?.id ?? this.crearCarpeta(nombre, padreId);
  },

  async crearVacio() {
    throw new Error('En el modo demo no se pueden crear presentaciones: elige «Documento».');
  },

  // En demo no hay unidad de plantillas: solo se usan las plantillas de la app.
  async documentosDeUnidad() {
    return [];
  },

  urlCarpeta: (id) => `/api/drive-local/${id}`,
  urlArchivo: (id) => `/api/drive-local/${id}`,
  urlMiniatura: (id) => `/api/drive-local/${id}`,
  urlDocumento: (id) => `/api/drive-local/${id}`,
  urlPresentacion: (id) => `/api/drive-local/${id}`,
};
