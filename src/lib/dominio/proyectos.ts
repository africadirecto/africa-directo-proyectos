// Proyectos (proyectos/{codigo}): alta, carpetas en Drive, cambios y estados.

import { almacen } from '../almacen';
import { drive, SUBCARPETAS, type Subcarpeta } from '../drive';
import { ESTADOS, puedePasar } from '../estados';
import { nuevoIdEnlace } from '../enlaces';
import { actualizarIndice } from './indice';
import { anotarEvento } from './eventos';
import type { Contraparte, Enlace, EstadoProyecto, Persona, Proyecto } from '../tipos';

const CODIGO = /^P-\d{4}-\d{3,}$/;
const DIAS_ENLACE = 180;

export const esCodigo = (c: string) => CODIGO.test(c);

export async function leerProyecto(codigo: string): Promise<Proyecto | null> {
  if (!esCodigo(codigo)) return null;
  return (await almacen()).leer<Proyecto>(`proyectos/${codigo}`);
}

/** Código legible P-AAAA-NNN con un contador por año (en transacción para no repetir). */
async function nuevoCodigo(anio: number): Promise<string> {
  const db = await almacen();
  return db.transaccion(async (tx) => {
    const ruta = `contadores/proyectos-${anio}`;
    const n = ((await tx.leer<{ ultimo: number }>(ruta))?.ultimo ?? 0) + 1;
    tx.guardar(ruta, { ultimo: n });
    return `P-${anio}-${String(n).padStart(3, '0')}`;
  });
}

export function nombreCarpeta(p: Pick<Proyecto, 'codigo' | 'titulo' | 'contraparte'>): string {
  return `${p.codigo} ${p.titulo || p.contraparte.nombre}`.replace(/[\\/]+/g, '-').slice(0, 120);
}

/** Carpeta del año dentro de la unidad de proyectos (se crea la primera vez). */
async function carpetaAnio(anio: number): Promise<string> {
  const db = await almacen();
  const ajustes = (await db.leer<{ anios?: Record<string, string> }>('ajustes/drive')) ?? {};
  const existente = ajustes.anios?.[anio];
  if (existente) return existente;
  const d = await drive();
  const id = await d.crearCarpeta(String(anio), d.raizProyectos);
  await db.guardar('ajustes/drive', { anios: { [anio]: id } }, { fusionar: true });
  return id;
}

async function crearCarpetas(p: Proyecto): Promise<NonNullable<Proyecto['drive']>> {
  const d = await drive();
  const carpetaId = await d.crearCarpeta(nombreCarpeta(p), await carpetaAnio(p.anio));
  const pares = await Promise.all(
    (Object.entries(SUBCARPETAS) as [Subcarpeta, string][]).map(async ([clave, nombre]) => [clave, await d.crearCarpeta(nombre, carpetaId)] as const),
  );
  return { carpetaId, subcarpetas: Object.fromEntries(pares) as Record<Subcarpeta, string> };
}

/** Crea las carpetas si faltan (por ejemplo, si Drive falló al dar de alta el proyecto). */
export async function asegurarCarpetas(codigo: string): Promise<Proyecto> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  if (p.drive) return p;
  return actualizarProyecto(codigo, { drive: await crearCarpetas(p) });
}

export async function crearProyecto(o: {
  contraparte: Contraparte & { id: string };
  titulo: string;
  sector: string;
  responsable: Persona | null;
  autor: Persona;
}): Promise<{ proyecto: Proyecto; errorDrive?: string }> {
  const db = await almacen();
  const ahora = new Date();
  const iso = ahora.toISOString();
  const anio = ahora.getFullYear();
  const codigo = await nuevoCodigo(anio);
  const enlaceId = nuevoIdEnlace();

  const enlace: Enlace = {
    proyecto: codigo,
    accion: 'solicitud',
    creado: iso,
    creadoPor: o.autor,
    caduca: new Date(ahora.getTime() + DIAS_ENLACE * 86_400_000).toISOString(),
    revocado: false,
  };
  await db.guardar(`enlaces/${enlaceId}`, { ...enlace });

  const proyecto: Proyecto = {
    codigo,
    titulo: o.titulo.trim(),
    sector: o.sector,
    pais: o.contraparte.pais,
    lugar: '',
    lat: null,
    lng: null,
    estado: 'solicitud',
    moneda: 'EUR',
    presupuesto: null,
    comprometido: 0,
    recibido: 0,
    numDonantes: 0,
    descripcion: '',
    resumen: '',
    beneficiarios: '',
    contraparte: {
      id: o.contraparte.id,
      nombre: o.contraparte.nombre,
      contacto: o.contraparte.contactoNombre,
      idioma: o.contraparte.idioma,
      correo: o.contraparte.correos[0] ?? '',
    },
    responsable: o.responsable,
    revisor: null,
    drive: null,
    formulario: { enlaceId, estado: 'pendiente', version: 0, enviadoEn: iso, comentarios: null },
    fechas: { creado: iso, actualizado: iso },
    ultimaNoticia: iso,
    anio,
  };

  let errorDrive: string | undefined;
  try {
    proyecto.drive = await crearCarpetas(proyecto);
  } catch (e) {
    console.error('Drive: no se pudo crear la carpeta', e);
    errorDrive = 'No se pudo crear la carpeta en Drive. Puedes reintentarlo desde la ficha del proyecto.';
  }

  await db.guardar(`proyectos/${codigo}`, { ...proyecto });
  await actualizarIndice(proyecto);
  await anotarEvento(codigo, { tipo: 'sistema', autor: o.autor, texto: `Solicitud registrada para ${o.contraparte.nombre}.` });
  return { proyecto, errorDrive };
}

/** Aplica cambios (fusionando `fechas` y `formulario`) y actualiza el índice del panel. */
export async function actualizarProyecto(codigo: string, cambios: Partial<Proyecto>): Promise<Proyecto> {
  const db = await almacen();
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  const ahora = new Date().toISOString();
  const nuevo: Proyecto = {
    ...p,
    ...cambios,
    fechas: { ...p.fechas, ...cambios.fechas, actualizado: ahora },
    formulario: { ...p.formulario, ...cambios.formulario },
  };
  await db.guardar(`proyectos/${codigo}`, { ...cambios, fechas: nuevo.fechas, formulario: nuevo.formulario }, { fusionar: true });
  await actualizarIndice(nuevo);
  return nuevo;
}

export async function cambiarEstado(
  codigo: string,
  a: EstadoProyecto,
  motivo: string,
  autor: Persona | null,
): Promise<Proyecto> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  if (!puedePasar(p.estado, a)) {
    throw new Error(`No se puede pasar de «${ESTADOS[p.estado].nombre}» a «${ESTADOS[a].nombre}».`);
  }
  const ahora = new Date().toISOString();
  const fechas: Partial<Proyecto['fechas']> = {};
  if (a === 'validada') fechas.validada = ahora;
  if (a === 'aprobado') fechas.aprobado = ahora;
  if (a === 'ejecucion' && !p.fechas.inicio) fechas.inicio = ahora;
  if (a === 'cerrado' || a === 'cancelado' || a === 'rechazada') fechas.cierre = ahora;

  const cambios: Partial<Proyecto> = { estado: a, fechas: fechas as Proyecto['fechas'] };
  if (a === 'cerrado' || a === 'cancelado' || a === 'rechazada') {
    cambios.formulario = { ...p.formulario, estado: 'cerrado' };
  }
  const nuevo = await actualizarProyecto(codigo, cambios);
  await anotarEvento(codigo, {
    tipo: 'estado',
    autor,
    de: p.estado,
    a,
    texto: `${ESTADOS[p.estado].nombre} → ${ESTADOS[a].nombre}.${motivo.trim() ? ` ${motivo.trim()}` : ''}`,
  });
  return nuevo;
}
