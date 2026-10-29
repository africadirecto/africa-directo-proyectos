// Tareas nocturnas: copia de la base de datos a Drive, índice del panel y recordatorios.

import { almacen } from '../almacen';
import { config } from '../config';
import { drive, conFecha } from '../drive';
import { avisarChat } from '../avisos';
import { leerIndice, reconstruirIndice } from './indice';
import { requiereAtencion, DIAS_SIN_NOTICIAS, DIAS_SIN_RESPONDER } from './atencion';

/** Carpeta "Copias de la base de datos" dentro de la unidad Sistema (se crea la primera vez). */
async function carpetaCopias(): Promise<string> {
  const db = await almacen();
  const ajustes = (await db.leer<{ copias?: string }>('ajustes/drive')) ?? {};
  if (ajustes.copias) return ajustes.copias;
  const d = await drive();
  const id = await d.crearCarpeta('Copias de la base de datos', d.raizSistema);
  await db.guardar('ajustes/drive', { copias: id }, { fusionar: true });
  return id;
}

/** Vuelca todos los documentos en un JSON dentro de la unidad "Sistema". */
export async function copiaDeSeguridad(): Promise<{ documentos: number; archivo: string }> {
  const datos = await (await almacen()).volcar();
  const d = await drive();
  const nombre = `${conFecha('copia-base-de-datos')}.json`;
  await d.subir(await carpetaCopias(), nombre, 'application/json', Buffer.from(JSON.stringify({ creada: new Date().toISOString(), datos })));
  return { documentos: Object.keys(datos).length, archivo: nombre };
}

/** Resumen semanal (los lunes) de lo que requiere atención, al espacio de Chat. */
export async function recordatorios(hoy = new Date()): Promise<string | null> {
  if (hoy.getUTCDay() !== 1) return null;
  const a = requiereAtencion(await leerIndice(), hoy.getTime());
  const lineas = [
    a.porRevisar.length && `• ${a.porRevisar.length} solicitud(es) por revisar`,
    a.sinNoticias.length && `• ${a.sinNoticias.length} proyecto(s) sin noticias en más de ${DIAS_SIN_NOTICIAS} días: ${a.sinNoticias.map((f) => f.codigo).join(', ')}`,
    a.sinResponder.length && `• ${a.sinResponder.length} formulario(s) sin responder en más de ${DIAS_SIN_RESPONDER} días: ${a.sinResponder.map((f) => f.codigo).join(', ')}`,
  ].filter(Boolean);
  if (!lineas.length) return null;
  const texto = `📋 Resumen semanal de proyectos\n${lineas.join('\n')}\n${config.appUrl}`;
  await avisarChat(texto);
  return texto;
}

export async function tareasNocturnas() {
  const resultado: Record<string, unknown> = {};
  try {
    resultado.copia = await copiaDeSeguridad();
  } catch (e) {
    resultado.copia = `error: ${(e as Error).message}`;
    await avisarChat('⚠️ La copia nocturna de la base de datos ha fallado. Revisa los registros de Vercel.');
  }
  resultado.indice = await reconstruirIndice();
  resultado.recordatorios = await recordatorios();
  return resultado;
}
