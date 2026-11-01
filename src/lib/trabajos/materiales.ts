// Fotos y archivos adjuntos de un informe de proyecto, preparados al poner el informe en marcha.
//
// - Fotos: solo las publicables. Las que elige el voluntario o, si no elige, las del periodo del
//   informe y después las más recientes (como mucho MAX_FOTOS). La IA describe cada una una sola
//   vez (vía directa, sin retención) y la descripción se guarda en su registro; con eso se
//   reparten por los huecos de la plantilla al componer. Las fotos nunca van a los lotes.
// - Adjuntos: el texto de los archivos que marque el voluntario, para que la IA lo use como
//   contexto. Los de Google se exportan; Word, Excel, PowerPoint y PDF se convierten en una copia
//   temporal (con OCR en los PDF escaneados) que va a la papelera; las imágenes se transcriben.
//   Sin datos de contacto y con un tope de tamaño.

import { almacen } from '../almacen';
import { drive } from '../drive';
import { ES_DOC, ES_HOJA, ES_PRESENTACION } from '../drive/tipos';
import { describirImagen } from '../ia/informes';
import { sinContactos } from '../dominio/informesComun';
import type { MaterialInforme } from '../dominio/archivos';

export const MAX_FOTOS = 12;
export const MAX_ADJUNTOS = 8;
const MAX_POR_ARCHIVO = 20_000;
const MAX_TOTAL = 60_000;

export interface FotoTrabajo {
  id: string;
  nombre: string;
  fecha: string;
  descripcion: string;
  ancho?: number;
  alto?: number;
}

/** Las fotos del informe con su descripción. `elegidas` null: se eligen solas. */
export async function prepararFotos(codigo: string, disponibles: MaterialInforme[], elegidas: string[] | null | undefined, o: { desde: string; hasta: string; pista: string }): Promise<FotoTrabajo[]> {
  let lista: MaterialInforme[];
  if (elegidas) lista = disponibles.filter((f) => elegidas.includes(f.id));
  else {
    const delPeriodo = disponibles.filter((f) => f.fecha.slice(0, 10) >= o.desde && f.fecha.slice(0, 10) <= o.hasta);
    lista = [...delPeriodo, ...disponibles.filter((f) => !delPeriodo.includes(f))];
  }
  lista = lista.slice(0, MAX_FOTOS);

  const d = await drive();
  const db = await almacen();
  const fotos: FotoTrabajo[] = [];
  // De cuatro en cuatro, para no saturar al proveedor.
  for (let i = 0; i < lista.length; i += 4) {
    fotos.push(
      ...(await Promise.all(
        lista.slice(i, i + 4).map(async (f) => {
          let descripcion = f.descripcion ?? '';
          if (!descripcion) {
            try {
              const { bytes, mime } = await d.imagen(f.id, 1024);
              descripcion = await describirImagen(bytes, mime, { pista: o.pista });
              if (descripcion) await db.guardar(`proyectos/${codigo}/archivos/${f.id}`, { ia: { descripcion, fecha: new Date().toISOString() } }, { fusionar: true });
            } catch (e) {
              console.error('Fotos: no se pudo describir', f.id, e);
            }
          }
          return { id: f.id, nombre: f.nombre, fecha: f.fecha.slice(0, 10), descripcion, ...(f.medidas ? { ancho: f.medidas.ancho, alto: f.medidas.alto } : {}) };
        }),
      )),
    );
  }
  return fotos;
}

const CONVERTIR: Record<string, string> = {
  'application/pdf': ES_DOC,
  'application/msword': ES_DOC,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ES_DOC,
  'application/vnd.oasis.opendocument.text': ES_DOC,
  'application/rtf': ES_DOC,
  'application/vnd.ms-excel': ES_HOJA,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ES_HOJA,
  'application/vnd.oasis.opendocument.spreadsheet': ES_HOJA,
  'application/vnd.ms-powerpoint': ES_PRESENTACION,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ES_PRESENTACION,
};
const EXPORTAR: Record<string, string> = { [ES_DOC]: 'text/plain', [ES_HOJA]: 'text/csv', [ES_PRESENTACION]: 'text/plain' };

async function textoDe(m: MaterialInforme, temporal: () => Promise<string>): Promise<string> {
  const d = await drive();
  if (EXPORTAR[m.mime]) return (await d.exportar(m.id, EXPORTAR[m.mime])).toString('utf8');
  if (CONVERTIR[m.mime]) {
    const copia = await d.copiarConvirtiendo(m.id, await temporal(), `temporal ${m.nombre}`, CONVERTIR[m.mime]);
    try {
      return (await d.exportar(copia.id, EXPORTAR[CONVERTIR[m.mime]])).toString('utf8');
    } finally {
      await d.aPapelera(copia.id).catch((e) => console.error('Adjuntos: no se pudo quitar la copia temporal', copia.id, e));
    }
  }
  if (m.mime.startsWith('text/') || m.mime === 'message/rfc822' || m.mime === 'application/json') return (await d.descargar(m.id, 2 * 1048576)).bytes.toString('utf8');
  if (m.mime.startsWith('image/')) {
    const { bytes, mime } = await d.imagen(m.id, 1600);
    return describirImagen(bytes, mime, { pista: m.nombre, documento: true });
  }
  return '';
}

/** El texto de los adjuntos elegidos (solo archivos del proyecto), para el contexto de la IA. */
export async function leerAdjuntos(disponibles: MaterialInforme[], ids: string[]): Promise<{ nombre: string; texto: string }[]> {
  const elegidos = disponibles.filter((a) => ids.includes(a.id)).slice(0, MAX_ADJUNTOS);
  if (!elegidos.length) return [];
  const d = await drive();
  let carpeta = '';
  const temporal = async () => (carpeta ||= await d.carpetaHija('_Temporal', d.raizSistema));
  const salida: { nombre: string; texto: string }[] = [];
  let total = 0;
  for (const a of elegidos) {
    let texto: string;
    try {
      texto = sinContactos(await textoDe(a, temporal)).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (!texto) texto = '(no se pudo leer el contenido de este archivo)';
    } catch (e) {
      console.error('Adjuntos: no se pudo leer', a.id, e);
      texto = '(no se pudo leer el contenido de este archivo)';
    }
    const cabe = Math.max(0, Math.min(MAX_POR_ARCHIVO, MAX_TOTAL - total));
    if (!cabe) break;
    if (texto.length > cabe) texto = `${texto.slice(0, cabe)}… (recortado)`;
    total += texto.length;
    salida.push({ nombre: a.nombre, texto });
  }
  return salida;
}
