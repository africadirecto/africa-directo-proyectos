'use server';

import { revalidatePath } from 'next/cache';
import { permitido, persona } from '../sesion';
import { actualizarProyecto, asegurarCarpetas, cambiarEstado, leerProyecto } from '../dominio/proyectos';
import { recalcularFinanciacion } from '../dominio/aportaciones';
import { anotarEvento } from '../dominio/eventos';
import { marcarPublicable } from '../dominio/archivos';
import { ESTADOS } from '../estados';
import { MONEDAS, PAISES } from '../paises';
import { SECTORES } from '../formulario/textos';
import { intentar, numero, texto, type Resultado } from './resultado';
import type { CategoriaEvento, EstadoProyecto, Proyecto } from '../tipos';

function rutas(codigo: string) {
  revalidatePath(`/proyectos/${codigo}`);
  revalidatePath('/', 'layout');
}

export async function cambiarEstadoAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const estado = texto(fd, 'estado', 20) as EstadoProyecto;
    const motivo = texto(fd, 'motivo', 1000);
    if (!ESTADOS[estado]) throw new Error('Elige el nuevo estado.');
    if (motivo.length < 3) throw new Error('Explica brevemente el motivo del cambio.');
    await cambiarEstado(codigo, estado, motivo, persona(yo));
    rutas(codigo);
    return `Estado cambiado a «${ESTADOS[estado].nombre}».`;
  });
}

function fecha(fd: FormData, campo: string): string | undefined {
  const t = texto(fd, campo, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T12:00:00Z`).toISOString() : undefined;
}

export async function editarProyecto(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const p = await leerProyecto(codigo);
    if (!p) throw new Error('Proyecto no encontrado');
    const titulo = texto(fd, 'titulo', 200);
    if (!titulo) throw new Error('El título no puede quedar vacío.');
    const pais = texto(fd, 'pais', 2);
    const moneda = texto(fd, 'moneda', 3);
    const sector = texto(fd, 'sector', 40);
    const lat = numero(fd, 'lat');
    const lng = numero(fd, 'lng');
    if ((lat == null) !== (lng == null) || (lat != null && (Math.abs(lat) > 90 || Math.abs(lng!) > 180))) {
      throw new Error('Las coordenadas no son válidas (latitud y longitud en grados decimales).');
    }
    const presupuesto = numero(fd, 'presupuesto');
    if (presupuesto != null && presupuesto < 0) throw new Error('El presupuesto no puede ser negativo.');

    await actualizarProyecto(codigo, {
      titulo,
      sector: SECTORES[sector] ? sector : p.sector,
      pais: PAISES[pais] ? pais : p.pais,
      lugar: texto(fd, 'lugar', 200),
      lat,
      lng,
      moneda: MONEDAS.includes(moneda) ? moneda : p.moneda,
      presupuesto,
      descripcion: texto(fd, 'descripcion', 6000),
      beneficiarios: texto(fd, 'beneficiarios', 1000),
      fechas: { ...p.fechas, inicio: fecha(fd, 'inicio') ?? p.fechas.inicio, finPrevisto: fecha(fd, 'finPrevisto') },
    });
    // Un cambio de presupuesto puede completar la financiación.
    if (presupuesto !== p.presupuesto) await recalcularFinanciacion(codigo, persona(yo));
    rutas(codigo);
    return 'Datos guardados.';
  });
}

export async function anadirNota(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const nota = texto(fd, 'texto', 4000);
    const categoria = texto(fd, 'categoria', 20) as CategoriaEvento;
    if (!nota) throw new Error('Escribe la nota.');
    if (!(await leerProyecto(codigo))) throw new Error('Proyecto no encontrado');
    await anotarEvento(codigo, {
      tipo: 'nota',
      categoria: ['avance', 'incidencia', 'economico', 'otro'].includes(categoria) ? categoria : 'otro',
      autor: persona(yo),
      texto: nota,
    });
    // Una llamada o un WhatsApp de la contraparte también cuentan como noticia.
    if (fd.get('noticia') === 'on') await actualizarProyecto(codigo, { ultimaNoticia: new Date().toISOString() });
    rutas(codigo);
    return 'Nota añadida.';
  });
}

export async function crearCarpetaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    await asegurarCarpetas(codigo);
    rutas(codigo);
    return 'Carpeta creada en Drive.';
  });
}

export async function marcarPublicableAccion(codigo: string, id: string, nombre: string, publicable: boolean): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    if (!(await leerProyecto(codigo))) throw new Error('Proyecto no encontrado');
    await marcarPublicable(codigo, id, nombre.slice(0, 200), publicable, persona(yo));
    revalidatePath(`/proyectos/${codigo}`);
  });
}
