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

/** La miniatura la sirve la app (ver api/proyectos/[codigo]/miniatura): la de Drive pide sesión de Google. */
const miniatura = (codigo: string, id: string) => `/api/proyectos/${codigo}/miniatura/${id}`;

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
  } catch (e) {
    console.error('Drive: no se pudo listar', e);
    error = 'No se pudo leer la carpeta de Drive.';
  }

  const carpetas = (Object.entries(SUBCARPETAS) as [Subcarpeta, string][]).filter(([clave]) => sub[clave]).map(([clave, nombre]) => ({
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
    fotos.push({ id, nombre, fecha, publicable: !!porId.get(id)?.publicable, url: d.urlArchivo(id), miniatura: miniatura(p.codigo, id) });
  };
  for (const a of enDrive) if (a.mime.startsWith('image/') && a.mime !== ES_CARPETA) anadir(a.id, a.nombre, a.creado);
  for (const r of registros) if (r.esFoto) anadir(r.id, r.nombre, r.fecha);
  fotos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { carpetas, fotos, error };
}

/** Una foto o un archivo del proyecto que se puede usar en un informe. */
export interface MaterialInforme {
  id: string;
  nombre: string;
  fecha: string;
  mime: string;
  carpeta: Subcarpeta;
  miniatura: string;
  medidas?: { ancho: number; alto: number };
  /** En las fotos: la descripción que hizo la IA (se guarda para no repetirla). */
  descripcion?: string;
}

/**
 * Lo que se puede usar al generar un informe: las fotos publicables (solo esas pueden aparecer
 * en un informe) y los demás archivos de las cuatro carpetas, más recientes primero.
 */
export async function materialesDelProyecto(p: Proyecto): Promise<{ fotos: MaterialInforme[]; archivos: MaterialInforme[] }> {
  if (!p.drive) return { fotos: [], archivos: [] };
  const d = await drive();
  const sub = p.drive.subcarpetas;
  const carpetaDe = new Map((Object.keys(sub) as Subcarpeta[]).map((k) => [sub[k], k]));
  const [registros, enDrive] = await Promise.all([
    (await almacen()).consultar<ArchivoProyecto & { ia?: { descripcion: string } }>(`proyectos/${p.codigo}/archivos`),
    d.listar(Object.values(sub)),
  ]);
  const porId = new Map(registros.map((r) => [r.id, r]));
  const fotos: MaterialInforme[] = [];
  const archivos: MaterialInforme[] = [];
  for (const a of enDrive) {
    if (a.mime === ES_CARPETA) continue;
    const r = porId.get(a.id);
    const m: MaterialInforme = { id: a.id, nombre: a.nombre, fecha: r?.fecha ?? a.creado, mime: a.mime, carpeta: carpetaDe.get(a.carpetaId) ?? 'seguimiento', miniatura: miniatura(p.codigo, a.id), ...(a.medidas ? { medidas: a.medidas } : {}), ...(r?.ia?.descripcion ? { descripcion: r.ia.descripcion } : {}) };
    if (a.mime.startsWith('image/')) {
      if (r?.publicable) fotos.push(m);
    } else archivos.push(m);
  }
  const reciente = (x: MaterialInforme, y: MaterialInforme) => y.fecha.localeCompare(x.fecha);
  return { fotos: fotos.sort(reciente), archivos: archivos.sort(reciente) };
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
