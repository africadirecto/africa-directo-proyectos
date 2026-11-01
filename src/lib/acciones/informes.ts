'use server';

// Pedir informes. El informe queda en cola y se hace en segundo plano (lib/trabajos/informe.ts):
// la acción responde enseguida con su ruta y la pantalla sigue su progreso. La hoja de cálculo
// de proyectos (sin IA) se hace en el momento.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { permitido, persona } from '../sesion';
import { generarHojaDeProyectos } from '../dominio/informesGenerales';
import { avanzarInforme, pedirInforme, reintentarInforme } from '../trabajos/informe';
import { MAX_ADJUNTOS, MAX_FOTOS } from '../trabajos/materiales';
import { materialesDelProyecto, type MaterialInforme } from '../dominio/archivos';
import { leerProyecto } from '../dominio/proyectos';
import { ESTADOS } from '../estados';
import { PAISES } from '../paises';
import { esIdioma } from '../formulario/textos';
import { intentar, texto, type Resultado } from './resultado';
import type { EstadoProyecto } from '../tipos';

export interface ResultadoPedido extends Resultado {
  /** Ruta del informe en cola, para seguir su progreso. */
  ruta?: string;
  /** Dirección del archivo, si ya está hecho (la hoja de cálculo). */
  url?: string;
}

const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
/** Rutas de informe válidas: proyectos/{codigo}/informes/{id} o informes/{id}. */
export const rutaValida = async (r: string) => /^(proyectos\/[A-Z0-9-]{1,30}\/)?informes\/[\w-]{1,40}$/.test(r);

export async function pedirInformeAccion(_: ResultadoPedido, fd: FormData): Promise<ResultadoPedido> {
  try {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 30);
    const plantilla = texto(fd, 'plantilla', 100);
    const estados = fd.getAll('estados').map(String).filter((e): e is EstadoProyecto => e in ESTADOS);
    const paises = fd.getAll('paises').map(String).filter((p) => p in PAISES);

    if (plantilla === 'sheets') {
      const i = await generarHojaDeProyectos({ estados, paises }, persona(yo));
      revalidatePath('/', 'layout');
      return { ok: true, mensaje: 'Hoja de cálculo creada.', url: i.url, vez: Date.now() };
    }
    const idioma = texto(fd, 'idioma', 2);
    const ruta = await pedirInforme(
      {
        plantillaId: plantilla,
        // Sin proyecto, es un resumen de los proyectos que cumplen los filtros.
        ...(codigo ? { codigo } : { resumen: { estados, paises } }),
        desde: fecha(texto(fd, 'desde', 10)),
        hasta: fecha(texto(fd, 'hasta', 10)),
        donanteId: texto(fd, 'donante', 100),
        idioma: esIdioma(idioma) ? idioma : 'es',
        indicaciones: texto(fd, 'indicaciones', 1500),
        // Si el voluntario abrió la lista de fotos, las que marcó; si no, las elige la app.
        fotos: fd.get('fotosElegidas') ? fd.getAll('fotos').map(String).slice(0, MAX_FOTOS) : null,
        adjuntos: fd.getAll('adjuntos').map(String).slice(0, MAX_ADJUNTOS),
        prueba: fd.get('prueba') === '1',
      },
      persona(yo),
    );
    // Se prepara al terminar la respuesta, sin hacer esperar al voluntario.
    after(() => avanzarInforme(ruta));
    revalidatePath(codigo && !fd.get('prueba') ? `/proyectos/${codigo}` : '/', codigo && !fd.get('prueba') ? 'page' : 'layout');
    return { ok: true, ruta, vez: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo pedir el informe.', vez: Date.now() };
  }
}

/** Fotos publicables y archivos del proyecto, para elegirlos en el diálogo (se piden al abrir esa parte). */
export async function materialesParaInformeAccion(codigo: string): Promise<{ fotos: MaterialInforme[]; archivos: MaterialInforme[]; error?: string }> {
  await permitido('edicion');
  const p = await leerProyecto(codigo);
  if (!p) return { fotos: [], archivos: [], error: 'Proyecto no encontrado.' };
  try {
    return await materialesDelProyecto(p);
  } catch (e) {
    console.error('Informe: no se pudieron listar los archivos', e);
    return { fotos: [], archivos: [], error: 'No se pudo leer la carpeta de Drive.' };
  }
}

export async function reintentarInformeAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    await permitido('edicion');
    const ruta = texto(fd, 'ruta', 200);
    if (!(await rutaValida(ruta))) throw new Error('Informe no válido.');
    await reintentarInforme(ruta);
    after(() => avanzarInforme(ruta));
    revalidatePath('/', 'layout');
    return 'En marcha otra vez.';
  });
}
