'use server';

// Pedir informes. El informe queda en cola y se hace en segundo plano (lib/trabajos/informe.ts):
// la acción responde enseguida con su ruta y la pantalla sigue su progreso. La hoja de cálculo
// de proyectos (sin IA) se hace en el momento.

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { permitido, persona } from '../sesion';
import { generarHojaDeProyectos, type TipoInformeGeneral } from '../dominio/informesGenerales';
import { avanzarInforme, pedirInforme, reintentarInforme } from '../trabajos/informe';
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
    const tipo = texto(fd, 'conjunto', 20) as TipoInformeGeneral;
    const plantilla = texto(fd, 'plantilla', 100);
    const estados = fd.getAll('estados').map(String).filter((e): e is EstadoProyecto => e in ESTADOS);
    const paises = fd.getAll('paises').map(String).filter((p) => p in PAISES);

    if (plantilla === 'sheets') {
      const i = await generarHojaDeProyectos({ estados, paises }, persona(yo));
      revalidatePath('/', 'layout');
      return { ok: true, mensaje: 'Hoja de cálculo creada.', url: i.url, vez: Date.now() };
    }
    if (!codigo && !['cartera', 'contraparte', 'donante'].includes(tipo)) throw new Error('Tipo de informe no válido.');
    const idioma = texto(fd, 'idioma', 2);
    const ruta = await pedirInforme(
      {
        plantillaId: plantilla,
        ...(codigo ? { codigo } : { conjunto: { tipo, sobre: texto(fd, 'sobre', 100), estados, paises } }),
        desde: fecha(texto(fd, 'desde', 10)),
        hasta: fecha(texto(fd, 'hasta', 10)),
        donanteId: texto(fd, 'donante', 100),
        idioma: esIdioma(idioma) ? idioma : 'es',
        indicaciones: texto(fd, 'indicaciones', 1500),
      },
      persona(yo),
    );
    // Se prepara al terminar la respuesta, sin hacer esperar al voluntario.
    after(() => avanzarInforme(ruta));
    revalidatePath(codigo ? `/proyectos/${codigo}` : '/', codigo ? 'page' : 'layout');
    return { ok: true, ruta, vez: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo pedir el informe.', vez: Date.now() };
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
