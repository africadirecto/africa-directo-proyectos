'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { permitido, persona } from '../sesion';
import { aprobarInforme, generarInforme, type TipoInformeProyecto } from '../dominio/informes';
import { aprobarInformeGeneral, generarInformeGeneral, type TipoInformeGeneral } from '../dominio/informesGenerales';
import { ESTADOS } from '../estados';
import { PAISES } from '../paises';
import { esIdioma } from '../formulario/textos';
import { intentar, texto, type Resultado } from './resultado';
import type { EstadoProyecto, ExtensionInforme, FormatoInforme, Informe } from '../tipos';

type ResultadoInforme = Resultado & { url?: string };

const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const formato = (fd: FormData): FormatoInforme => {
  const f = texto(fd, 'formato', 10);
  return f === 'slides' || f === 'sheets' ? f : 'docs';
};
const extension = (fd: FormData): ExtensionInforme => {
  const e = texto(fd, 'extension', 20);
  return e === 'breve' || e === 'detallado' ? e : 'normal';
};
const idioma = (fd: FormData) => {
  const i = texto(fd, 'idioma', 2);
  return esIdioma(i) ? i : 'es';
};

function mensajeListo(i: Informe): string {
  return [
    `${i.formato === 'slides' ? 'Presentación creada' : i.formato === 'sheets' ? 'Hoja de cálculo creada' : 'Borrador creado'}.`,
    !i.hechoPorIA && i.formato !== 'sheets' ? 'La IA no está configurada: los apartados están sin redactar.' : '',
    i.formato === 'sheets' ? 'Revísala y apruébala para poder descargarla.' : '',
    i.pendientes ? `Tiene ${i.pendientes} ${i.pendientes === 1 ? 'dato pendiente' : 'datos pendientes'} marcados como [PENDIENTE].` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

async function conUrl(fn: () => Promise<Informe>): Promise<ResultadoInforme> {
  try {
    const i = await fn();
    return { ok: true, mensaje: mensajeListo(i), url: i.url, vez: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo generar el informe.', vez: Date.now() };
  }
}

/** Informe de un proyecto; devuelve también su dirección para abrirlo en Google. */
export async function generarInformeAccion(_: ResultadoInforme, fd: FormData): Promise<ResultadoInforme> {
  return conUrl(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const tipo = texto(fd, 'tipo', 20);
    const informe = await generarInforme(
      codigo,
      {
        plantilla: texto(fd, 'plantilla', 200),
        formato: formato(fd),
        tipo: (['final', 'financiacion'].includes(tipo) ? tipo : 'seguimiento') as TipoInformeProyecto,
        desde: fecha(texto(fd, 'desde', 10)),
        hasta: fecha(texto(fd, 'hasta', 10)),
        donanteId: texto(fd, 'donante', 100),
        idioma: idioma(fd),
        extension: extension(fd),
        fotos: fd.get('fotos') === 'on',
        instrucciones: texto(fd, 'instrucciones', 1500),
      },
      persona(yo),
    );
    revalidatePath(`/proyectos/${codigo}`);
    return informe;
  });
}

/** Informe de conjunto: cartera de proyectos, contraparte o donante. */
export async function generarInformeGeneralAccion(_: ResultadoInforme, fd: FormData): Promise<ResultadoInforme> {
  return conUrl(async () => {
    const yo = await permitido('edicion');
    const tipo = texto(fd, 'tipo', 20) as TipoInformeGeneral;
    if (!['cartera', 'contraparte', 'donante'].includes(tipo)) throw new Error('Tipo de informe no válido.');
    const informe = await generarInformeGeneral(
      {
        tipo,
        sobre: texto(fd, 'sobre', 100),
        formato: formato(fd),
        estados: fd.getAll('estados').map(String).filter((e): e is EstadoProyecto => e in ESTADOS),
        paises: fd.getAll('paises').map(String).filter((p) => p in PAISES),
        desde: fecha(texto(fd, 'desde', 10)),
        hasta: fecha(texto(fd, 'hasta', 10)),
        idioma: idioma(fd),
        extension: extension(fd),
        instrucciones: texto(fd, 'instrucciones', 1500),
      },
      persona(yo),
    );
    revalidatePath('/', 'layout');
    return informe;
  });
}

export async function aprobarInformeAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const id = texto(fd, 'id', 100);
    // Sin código de proyecto es un informe de conjunto.
    if (codigo) {
      await aprobarInforme(codigo, id, persona(yo));
      revalidatePath(`/proyectos/${codigo}`);
    } else {
      await aprobarInformeGeneral(id, persona(yo));
      revalidatePath('/', 'layout');
    }
    return 'Informe aprobado. Ya puedes descargarlo y enviarlo.';
  });
}
