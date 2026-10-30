// Piezas comunes de los informes (de proyecto y de conjunto): plantillas, notas para la
// revisión, HTML del documento, creación del Google Doc o de la presentación y registro.

import { almacen } from '../almacen';
import { config } from '../config';
import { drive } from '../drive';
import { ES_PRESENTACION } from '../drive/tipos';
import { rellenarPresentacion, type Diapositiva } from '../drive/slides';
import type { Redaccion } from '../ia';
import type { ExtensionInforme, FormatoInforme, Idioma, Informe, Persona } from '../tipos';

export type InformeConId = Informe & { id: string };

export interface PlantillaInforme {
  id: string;
  nombre: string;
  grupo: string;
  formato: FormatoInforme;
}

export const LOCALE: Record<Idioma, string> = { es: 'es-ES', fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT' };
export const FACTOR: Record<ExtensionInforme, number> = { breve: 0.6, normal: 1, detallado: 1.6 };

/** Plantillas propias de la unidad «Plantillas» (Google Docs y Slides con marcadores). */
export async function plantillasDeDrive(): Promise<PlantillaInforme[]> {
  if (!config.drive.unidadPlantillas) return [];
  try {
    const docs = await (await drive()).documentosDeUnidad(config.drive.unidadPlantillas);
    return docs
      .map((d) => {
        const esPresentacion = d.mime === ES_PRESENTACION;
        return { id: `${esPresentacion ? 'pres' : 'doc'}:${d.id}`, nombre: d.nombre, grupo: d.ruta ? `Plantillas · ${d.ruta}` : 'Plantillas', formato: (esPresentacion ? 'slides' : 'docs') as FormatoInforme };
      })
      .sort((a, b) => a.grupo.localeCompare(b.grupo, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  } catch (e) {
    console.error('Drive: no se pudieron leer las plantillas', e);
    return [];
  }
}

/** Quita correos y teléfonos de los textos que van a la IA. */
export const sinContactos = (t: string) =>
  t.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[correo]').replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[teléfono]' : m));

export interface EventoContexto {
  id: string;
  fecha: string;
  texto: string;
}

/** Notas para quien revisa: lo pendiente y de dónde sale cada apartado. Se borran antes de enviar. */
export function notasRevision(r: Redaccion, eventos: EventoContexto[], extra: string[] = []): string[] {
  const porId = new Map(eventos.map((e) => [e.id, e]));
  const lineas: string[] = [];
  if (!r.hechoPorIA) lineas.push('Sin IA: los apartados están sin redactar.');
  const pendientes = [...extra, ...r.pendientes];
  if (pendientes.length) lineas.push('Pendiente de completar o comprobar:', ...pendientes.map((x) => `• ${x}`));
  const fuentes = r.apartados.filter((a) => a.fuentes.length);
  if (fuentes.length) {
    lineas.push('De dónde sale cada apartado:');
    for (const a of fuentes) {
      const detalle = a.fuentes.map((f) => {
        const e = porId.get(f);
        return e ? `${f} (${e.fecha}: ${e.texto.slice(0, 80)}${e.texto.length > 80 ? '…' : ''})` : f;
      });
      lineas.push(`• ${a.titulo}: ${detalle.join('; ')}`);
    }
  }
  return lineas;
}

export const TITULO_NOTAS = 'NOTAS PARA LA REVISIÓN (borra esta parte antes de enviar)';

export const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parrafos = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${escapar(x).replace(/\n/g, '<br>')}</p>`)
    .join('');
/** Ideas de un texto para diapositivas: una por línea, sin viñetas escritas. */
export const puntos = (t: string) =>
  t
    .split(/\n+/)
    .map((x) => x.replace(/^\s*[-•*·]\s*/, '').trim())
    .filter(Boolean);

/** Lo que tiene un informe hecho por la app, para pintarlo como documento o presentación. */
export interface Contenido {
  titulo: string;
  subtitulo: string;
  /** Tabla de datos clave: [etiqueta, valor]. */
  datos: { titulo: string; filas: [string, string][] };
  apartados: { titulo: string; texto: string }[];
  /** Tablas con cabecera en la primera fila (presupuesto, lista de proyectos…). */
  tablas: { titulo: string; filas: string[][] }[];
  /** Apartados por proyecto (informes de varios proyectos). */
  porProyecto: { titulo: string; detalle: string; texto: string }[];
  enlaces: { titulo: string; lista: { texto: string; url: string }[] } | null;
  notas: string[];
}

function htmlContenido(c: Contenido): string {
  const fila = (k: string, v: string) => (v ? `<tr><td style="color:#5e5d57;padding:4px 16px 4px 0">${escapar(k)}</td><td style="padding:4px 0">${escapar(v)}</td></tr>` : '');
  const celda = 'style="padding:4pt 8pt;border:1px solid #d5d4cc"';
  const tabla = (filas: string[][]) =>
    `<table style="border-collapse:collapse;font-size:10pt">${filas
      .map((f, i) => `<tr>${f.map((x) => (i === 0 ? `<th ${celda} align="left">${escapar(x)}</th>` : `<td ${celda}>${escapar(x)}</td>`)).join('')}</tr>`)
      .join('')}</table>`;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5">
<p style="color:#b8360b;font-weight:bold;margin:0">Africa Directo · el 100 % llega</p>
<h1 style="font-size:20pt;margin:6pt 0 2pt">${escapar(c.titulo)}</h1>
<p style="color:#5e5d57;margin:0 0 12pt">${escapar(c.subtitulo)}</p>
${c.datos.filas.length ? `<h2 style="font-size:13pt">${escapar(c.datos.titulo)}</h2><table>${c.datos.filas.map(([k, v]) => fila(k, v)).join('')}</table>` : ''}
${c.apartados.map((a) => `<h2 style="font-size:13pt">${escapar(a.titulo)}</h2>${parrafos(a.texto)}`).join('\n')}
${c.tablas.map((t) => `<h2 style="font-size:13pt">${escapar(t.titulo)}</h2>${tabla(t.filas)}`).join('\n')}
${c.porProyecto.map((x) => `<h3 style="font-size:12pt;margin-bottom:0">${escapar(x.titulo)}</h3><p style="color:#5e5d57;margin:0 0 4pt">${escapar(x.detalle)}</p>${parrafos(x.texto)}`).join('\n')}
${c.enlaces?.lista.length ? `<h2 style="font-size:13pt">${escapar(c.enlaces.titulo)}</h2><ul>${c.enlaces.lista.map((f) => `<li><a href="${escapar(f.url)}">${escapar(f.texto)}</a></li>`).join('')}</ul>` : ''}
${c.notas.length ? `<hr><div style="color:#5e5d57;font-size:9.5pt"><p><b>${escapar(TITULO_NOTAS)}</b></p>${c.notas.map((l) => `<p style="margin:0">${escapar(l)}</p>`).join('')}</div>` : ''}
</body></html>`;
}

function diapositivasContenido(c: Contenido): Diapositiva[] {
  const d: Diapositiva[] = [];
  if (c.datos.filas.length) d.push({ titulo: c.datos.titulo, tabla: c.datos.filas.map(([k, v]) => [k, v]), cabecera: false });
  for (const a of c.apartados) d.push({ titulo: a.titulo, puntos: puntos(a.texto) });
  for (const t of c.tablas) {
    // Como mucho 8 filas de datos por diapositiva: las tablas largas se reparten.
    const [cabecera, ...resto] = t.filas;
    for (let i = 0; i < Math.max(1, resto.length); i += 8) {
      d.push({ titulo: resto.length > 8 ? `${t.titulo} (${i / 8 + 1})` : t.titulo, tabla: [cabecera, ...resto.slice(i, i + 8)] });
    }
  }
  for (const x of c.porProyecto) d.push({ titulo: x.titulo, subtitulo: x.detalle, puntos: puntos(x.texto) });
  if (c.enlaces?.lista.length) d.push({ titulo: c.enlaces.titulo, puntos: c.enlaces.lista.map((f) => `${f.texto}: ${f.url}`) });
  if (c.notas.length) d.push({ titulo: 'Notas para la revisión (borra esta diapositiva antes de enviar)', puntos: c.notas.map((l) => l.replace(/^• /, '')) });
  return d;
}

/** Crea el Google Doc o la presentación con el contenido y devuelve su id y dirección. */
export async function crearArchivoInforme(c: Contenido, formato: FormatoInforme, carpetaId: string, nombre: string): Promise<{ id: string; url: string }> {
  const d = await drive();
  if (formato === 'slides') {
    const { id } = await d.crearVacio(nombre, ES_PRESENTACION, carpetaId);
    await rellenarPresentacion(id, { titulo: c.titulo, subtitulo: c.subtitulo }, diapositivasContenido(c));
    return { id, url: d.urlPresentacion(id) };
  }
  const { id } = await d.htmlADoc(htmlContenido(c), carpetaId, nombre);
  return { id, url: d.urlDocumento(id) };
}

/** Cuántos [PENDIENTE: …] han quedado en el texto. */
export const contarPendientes = (r: Redaccion) =>
  [...r.apartados.map((a) => a.texto), ...r.proyectos.map((p) => p.texto)].reduce((s, t) => s + (t.match(/\[PENDIENTE/g)?.length ?? 0), 0);

/** Direcciones de descarga de Google para un informe aprobado. */
export function descargas(i: Pick<Informe, 'docId' | 'formato'>): { texto: string; url: string }[] {
  if (i.formato === 'sheets') {
    return [
      { texto: 'Excel', url: `https://docs.google.com/spreadsheets/d/${i.docId}/export?format=xlsx` },
      { texto: 'PDF', url: `https://docs.google.com/spreadsheets/d/${i.docId}/export?format=pdf` },
    ];
  }
  if (i.formato === 'slides') {
    return [
      { texto: 'PDF', url: `https://docs.google.com/presentation/d/${i.docId}/export/pdf` },
      { texto: 'PowerPoint', url: `https://docs.google.com/presentation/d/${i.docId}/export/pptx` },
    ];
  }
  return [
    { texto: 'PDF', url: `https://docs.google.com/document/d/${i.docId}/export?format=pdf` },
    { texto: 'Word', url: `https://docs.google.com/document/d/${i.docId}/export?format=docx` },
  ];
}

export async function aprobar(ruta: string, autor: Persona): Promise<Informe> {
  const db = await almacen();
  const informe = await db.leer<Informe>(ruta);
  if (!informe) throw new Error('Informe no encontrado');
  await db.guardar(ruta, { estado: 'aprobado', aprobado: new Date().toISOString(), aprobadoPor: autor }, { fusionar: true });
  return informe;
}
