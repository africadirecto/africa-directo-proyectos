'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { permitido, persona } from '../sesion';
import { aprobarInforme, generarInforme } from '../dominio/informes';
import { esIdioma } from '../formulario/textos';
import { intentar, texto, type Resultado } from './resultado';
import type { ExtensionInforme, TipoInforme } from '../tipos';

const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

/** Genera el borrador; devuelve también su dirección para abrirlo en Google Docs. */
export async function generarInformeAccion(_: Resultado & { url?: string }, fd: FormData): Promise<Resultado & { url?: string }> {
  try {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    const idioma = texto(fd, 'idioma', 2);
    const informe = await generarInforme(
      codigo,
      {
        plantilla: texto(fd, 'plantilla', 200),
        tipo: (texto(fd, 'tipo', 20) === 'final' ? 'final' : 'seguimiento') as TipoInforme,
        desde: fecha(texto(fd, 'desde', 10)),
        hasta: fecha(texto(fd, 'hasta', 10)),
        donanteId: texto(fd, 'donante', 100),
        idioma: esIdioma(idioma) ? idioma : 'es',
        extension: (['breve', 'normal', 'detallado'].includes(texto(fd, 'extension', 20)) ? texto(fd, 'extension', 20) : 'normal') as ExtensionInforme,
        fotos: fd.get('fotos') === 'on',
        instrucciones: texto(fd, 'instrucciones', 1500),
      },
      persona(yo),
    );
    revalidatePath(`/proyectos/${codigo}`);
    const avisos = [
      !informe.hechoPorIA ? 'La IA no está configurada: los apartados están sin redactar.' : '',
      informe.pendientes ? `Tiene ${informe.pendientes} ${informe.pendientes === 1 ? 'dato pendiente' : 'datos pendientes'} marcados como [PENDIENTE].` : '',
    ].filter(Boolean);
    return { ok: true, mensaje: ['Borrador creado en 05_Informes.', ...avisos].join(' '), url: informe.url, vez: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo generar el informe.', vez: Date.now() };
  }
}

export async function aprobarInformeAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('edicion');
    const codigo = texto(fd, 'codigo', 20);
    await aprobarInforme(codigo, texto(fd, 'id', 100), persona(yo));
    revalidatePath(`/proyectos/${codigo}`);
    return 'Informe aprobado. Ya puedes descargarlo y enviarlo.';
  });
}
