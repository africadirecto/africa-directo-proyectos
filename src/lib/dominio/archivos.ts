// Archivos de un proyecto. Drive es el almacén: aquí solo se listan sus carpetas
// y se guarda, por archivo, si una foto es publicable (proyectos/{codigo}/archivos/{driveId}).

import { almacen } from '../almacen';
import { drive, SUBCARPETAS, type ArchivoDrive, type Subcarpeta } from '../drive';
import { ES_CARPETA } from '../drive/tipos';
import { anotarEvento } from './eventos';
import type { ArchivoProyecto, Persona, Proyecto } from '../tipos';

export interface CarpetaResumen {
  clave: Subcarpeta;
  nombre: string;
  id: string;
  url: string;
  cuenta: number;
}

export interface FotoProyecto {
  id: string;
  nombre: string;
  fecha: string;
  publicable: boolean;
  url: string;
  miniatura: string;
}

export async function archivosDelProyecto(p: Proyecto): Promise<{ carpetas: CarpetaResumen[]; fotos: FotoProyecto[]; error?: string }> {
  if (!p.drive) return { carpetas: [], fotos: [] };
  const d = await drive();
  const sub = p.drive.subcarpetas;
  const registros = await (await almacen()).consultar<ArchivoProyecto>(`proyectos/${p.codigo}/archivos`);
  const porId = new Map(registros.map((r) => [r.id, r]));

  let enDrive: ArchivoDrive[] = [];
  let error: string | undefined;
  try {
    enDrive = await d.listar(Object.values(sub));
    // 04_Seguimiento se ordena en carpetas por mes (AAAA-MM): también se mira dentro.
    const meses = enDrive.filter((a) => a.mime === ES_CARPETA && a.carpetaId === sub.seguimiento).map((a) => a.id);
    if (meses.length) enDrive = [...enDrive, ...(await d.listar(meses))];
  } catch (e) {
    console.error('Drive: no se pudo listar', e);
    error = 'No se pudo leer la carpeta de Drive.';
  }

  const carpetas = (Object.entries(SUBCARPETAS) as [Subcarpeta, string][]).map(([clave, nombre]) => ({
    clave,
    nombre: nombre.replace('_', ' '),
    id: sub[clave],
    url: d.urlCarpeta(sub[clave]),
    cuenta: enDrive.filter((a) => a.carpetaId === sub[clave]).length,
  }));

  const ids = new Set<string>();
  const fotos: FotoProyecto[] = [];
  const anadir = (id: string, nombre: string, fecha: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    fotos.push({ id, nombre, fecha, publicable: !!porId.get(id)?.publicable, url: d.urlArchivo(id), miniatura: d.urlMiniatura(id) });
  };
  for (const a of enDrive) if (a.mime.startsWith('image/') && a.mime !== ES_CARPETA) anadir(a.id, a.nombre, a.creado);
  for (const r of registros) if (r.esFoto) anadir(r.id, r.nombre, r.fecha);
  fotos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { carpetas, fotos, error };
}

/** Carpeta donde guardar lo que se sube a una subcarpeta; en 04_Seguimiento, la del mes (AAAA-MM). */
export async function carpetaDestino(p: Proyecto, clave: Subcarpeta, fecha = new Date()): Promise<string> {
  if (!p.drive) throw new Error('El proyecto no tiene carpeta en Drive.');
  const id = p.drive.subcarpetas[clave];
  if (clave !== 'seguimiento') return id;
  return (await drive()).carpetaHija(fecha.toISOString().slice(0, 7), id);
}

/** Anota en la cronología un archivo que ha subido un voluntario y, si es foto, lo registra. */
export async function registrarSubida(p: Proyecto, a: ArchivoDrive, clave: Subcarpeta, autor: Persona): Promise<void> {
  const d = await drive();
  const esFoto = a.mime.startsWith('image/');
  if (esFoto) {
    const registro: ArchivoProyecto = {
      nombre: a.nombre,
      mime: a.mime,
      tamano: a.tamano,
      carpeta: clave,
      esFoto,
      publicable: false,
      origen: 'voluntario',
      fecha: a.creado || new Date().toISOString(),
    };
    await (await almacen()).guardar(`proyectos/${p.codigo}/archivos/${a.id}`, { ...registro });
  }
  await anotarEvento(p.codigo, {
    tipo: 'archivo',
    autor,
    texto: `${esFoto ? 'Foto añadida' : 'Archivo añadido'} en ${SUBCARPETAS[clave]}: ${a.nombre}`,
    enlaces: [{ texto: 'Abrir', url: d.urlArchivo(a.id) }],
  });
}

export async function marcarPublicable(codigo: string, id: string, nombre: string, publicable: boolean, autor: Persona): Promise<void> {
  const db = await almacen();
  const ruta = `proyectos/${codigo}/archivos/${id}`;
  const actual = await db.leer<ArchivoProyecto>(ruta);
  const registro: ArchivoProyecto = actual ?? {
    nombre,
    mime: 'image/jpeg',
    tamano: 0,
    carpeta: 'solicitud',
    esFoto: true,
    publicable: false,
    origen: 'voluntario',
    fecha: new Date().toISOString(),
  };
  // No va a la cronología para no llenarla de ruido; queda quién lo marcó.
  await db.guardar(ruta, { ...registro, publicable, marcadoPor: autor, marcadoEn: new Date().toISOString() });
}
