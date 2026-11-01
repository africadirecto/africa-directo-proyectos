// Rellena una copia de una plantilla de Google Docs con marcadores (ver dominio/marcadores.ts),
// sin tocar su formato. Probado contra Google en scripts/pruebas (S2 y S4).
//
// Cómo:
// - Los marcadores se buscan uniendo los fragmentos de texto de cada párrafo, así un cambio de
//   formato a mitad (p. ej. «{{ia:<b>avance</b>}}») no lo rompe.
// - Se sustituyen del final al principio de cada segmento (cuerpo, encabezados, pies): así las
//   posiciones que faltan por tratar no se mueven.
// - El texto se inserta *dentro* del marcador, detrás de su primer carácter, para que herede su
//   estilo (fuente, tamaño, color). Después se borra el marcador.
// - Va por pasadas que quitan sus marcadores (traducción, textos, tablas, fotos), así que
//   repetir el relleno de un documento a medias continúa donde se quedó.
// - Las fotos van en peticiones aparte: si Google no puede descargar una, no se pierde el resto.

import { apiGoogle } from './google';
import {
  MARCADOR,
  contenidoDe,
  enUnaLinea,
  fotoDe,
  huecoDe,
  leerMarcador,
  textoParrafo,
  type Marcador,
  type Parrafo,
  type Relleno,
  type ResultadoRelleno,
} from '../dominio/marcadores';

const DOCS = 'https://docs.googleapis.com/v1/documents';

// ── Estructura del documento (solo lo que se usa) ───────────────────────────

type Medida = { magnitude?: number; unit?: string };
type ElementoParrafo = { startIndex?: number; endIndex?: number; textRun?: { content?: string } };
export type ElementoDoc = {
  startIndex?: number;
  endIndex?: number;
  paragraph?: { elements?: ElementoParrafo[]; bullet?: object; paragraphStyle?: { namedStyleType?: string } };
  table?: {
    columns?: number;
    tableRows?: { tableCells?: { content?: ElementoDoc[] }[] }[];
    tableStyle?: { tableColumnProperties?: { width?: Medida; widthType?: string }[] };
  };
};
type ObjetoIncrustado = { embeddedObject?: { title?: string; description?: string } };
export type DocumentoDocs = {
  revisionId?: string;
  body?: { content?: ElementoDoc[] };
  headers?: Record<string, { content?: ElementoDoc[] }>;
  footers?: Record<string, { content?: ElementoDoc[] }>;
  documentStyle?: { pageSize?: { width?: Medida; height?: Medida }; marginLeft?: Medida; marginRight?: Medida; marginTop?: Medida; marginBottom?: Medida };
  inlineObjects?: Record<string, { inlineObjectProperties?: ObjetoIncrustado }>;
  positionedObjects?: Record<string, { positionedObjectProperties?: ObjetoIncrustado }>;
};

/** Un párrafo con sus posiciones. `soloTexto` si no contiene imágenes ni otros objetos. */
interface ParrafoDoc {
  seg: string;
  inicio: number;
  /** Fin sin el salto de párrafo final. */
  fin: number;
  texto: string;
  soloTexto: boolean;
  enLista: boolean;
  enCuerpo: boolean;
  enTabla: boolean;
  /** Ancho disponible en puntos (la página o la columna de la tabla). */
  ancho: number;
}

/** Un {{…}} encontrado en el documento. `m` es null si no es un marcador conocido. */
export interface Hallado {
  original: string;
  m: Marcador | null;
  seg: string;
  inicio: number;
  fin: number;
  /** El marcador es lo único que hay en su párrafo. */
  solo: boolean;
  enLista: boolean;
  enCuerpo: boolean;
  enTabla: boolean;
  ancho: number;
}

const pt = (m?: Medida) => m?.magnitude ?? 0;

function medidas(doc: DocumentoDocs) {
  const s = doc.documentStyle ?? {};
  const ancho = (pt(s.pageSize?.width) || 612) - (pt(s.marginLeft) || 72) - (pt(s.marginRight) || 72);
  const alto = (pt(s.pageSize?.height) || 792) - (pt(s.marginTop) || 72) - (pt(s.marginBottom) || 72);
  return { ancho, alto };
}

function parrafos(doc: DocumentoDocs): ParrafoDoc[] {
  const salida: ParrafoDoc[] = [];
  const { ancho } = medidas(doc);
  const recorrer = (elementos: ElementoDoc[] | undefined, seg: string, enCuerpo: boolean, anchoDisponible: number, enTabla: boolean) => {
    for (const e of elementos ?? []) {
      if (e.paragraph) {
        const els = e.paragraph.elements ?? [];
        if (!els.length) continue;
        // Google omite startIndex cuando vale 0 (por ejemplo, al principio de un encabezado).
        const inicio = els[0].startIndex ?? 0;
        let texto = '';
        for (const x of els) texto += x.textRun ? (x.textRun.content ?? '') : '￼'.repeat((x.endIndex ?? 0) - (x.startIndex ?? 0));
        const sinSalto = texto.replace(/\n$/, '');
        salida.push({
          seg,
          inicio,
          fin: inicio + sinSalto.length,
          texto: sinSalto,
          soloTexto: els.every((x) => x.textRun),
          enLista: !!e.paragraph.bullet,
          enCuerpo,
          enTabla,
          ancho: anchoDisponible,
        });
      } else if (e.table) {
        const columnas = e.table.columns ?? e.table.tableRows?.[0]?.tableCells?.length ?? 1;
        const props = e.table.tableStyle?.tableColumnProperties ?? [];
        for (const fila of e.table.tableRows ?? []) {
          (fila.tableCells ?? []).forEach((celda, i) => {
            const fijo = props[i]?.widthType === 'FIXED_WIDTH' ? pt(props[i]?.width) : 0;
            // Menos el margen interior de la celda.
            recorrer(celda.content, seg, enCuerpo, Math.max(40, (fijo || anchoDisponible / columnas) - 10), true);
          });
        }
      }
    }
  };
  recorrer(doc.body?.content, '', true, ancho, false);
  for (const [id, h] of Object.entries(doc.headers ?? {})) recorrer(h.content, id, false, ancho, false);
  for (const [id, f] of Object.entries(doc.footers ?? {})) recorrer(f.content, id, false, ancho, false);
  return salida;
}

/** Todos los {{…}} del documento, en cuerpo, tablas, encabezados y pies. */
export function encontrarMarcadores(doc: DocumentoDocs): Hallado[] {
  return parrafos(doc).flatMap((p) =>
    [...p.texto.matchAll(MARCADOR)].map((x) => ({
      original: x[0],
      m: leerMarcador(x[1]),
      seg: p.seg,
      inicio: p.inicio + x.index,
      fin: p.inicio + x.index + x[0].length,
      solo: p.texto.trim() === x[0],
      enLista: p.enLista,
      enCuerpo: p.enCuerpo,
      enTabla: p.enTabla,
      ancho: p.ancho,
    })),
  );
}

/** Marcadores de foto en el texto alternativo de imágenes existentes (en línea o flotantes). */
export function imagenesConMarcador(doc: DocumentoDocs): { objeto: string; clave: string }[] {
  const objetos = [
    ...Object.entries(doc.inlineObjects ?? {}).map(([id, o]) => [id, o.inlineObjectProperties?.embeddedObject] as const),
    ...Object.entries(doc.positionedObjects ?? {}).map(([id, o]) => [id, o.positionedObjectProperties?.embeddedObject] as const),
  ];
  return objetos.flatMap(([objeto, e]) => {
    const m = `${e?.description ?? ''} ${e?.title ?? ''}`.match(/\{\{([^{}]+)\}\}/);
    const marcador = m ? leerMarcador(m[1]) : null;
    return marcador?.tipo === 'foto' ? [{ objeto, clave: marcador.clave }] : [];
  });
}

/** Textos fijos de la plantilla (sin marcadores), para traducirlos si el informe va en otro idioma. */
export function textosFijos(doc: DocumentoDocs): string[] {
  const textos = parrafos(doc)
    .filter((p) => p.soloTexto && /\p{L}/u.test(p.texto.replace(MARCADOR, '')))
    .map((p) => p.texto.trim());
  return [...new Set(textos)];
}

// ── Peticiones ──────────────────────────────────────────────────────────────

const AMARILLO = { color: { rgbColor: { red: 1, green: 0.93, blue: 0.4 } } };
const GRIS = { color: { rgbColor: { red: 0.93, green: 0.93, blue: 0.93 } } };
const lugar = (seg: string, index: number) => ({ index, ...(seg ? { segmentId: seg } : {}) });
const rango = (seg: string, a: number, b: number) => ({ startIndex: a, endIndex: b, ...(seg ? { segmentId: seg } : {}) });

/** Del final al principio dentro de cada segmento. */
const alReves = <T extends { seg: string; inicio: number }>(xs: T[]) => [...xs].sort((a, b) => (a.seg === b.seg ? b.inicio - a.inicio : a.seg.localeCompare(b.seg)));

/**
 * Sustituye [inicio, fin) por los párrafos, heredando el estilo del primer carácter.
 * `enLista`: el párrafo ya es de lista, así que sus líneas heredan la viñeta y no se crean otras.
 */
export function reemplazarRango(seg: string, inicio: number, fin: number, ps: Parrafo[], enLista: boolean): object[] {
  const s = ps.map(textoParrafo).join('\n');
  if (!s) return [{ deleteContentRange: { range: rango(seg, inicio, fin) } }];
  const r: object[] = [
    { insertText: { location: lugar(seg, inicio + 1), text: s } },
    { deleteContentRange: { range: rango(seg, inicio + 1 + s.length, fin + s.length) } },
    { deleteContentRange: { range: rango(seg, inicio, inicio + 1) } },
  ];
  const vinetas: [number, number][] = [];
  let pos = inicio;
  for (const p of ps) {
    const a = pos;
    const b = pos + textoParrafo(p).length;
    if (p.tipo === 'h') {
      r.push({ updateParagraphStyle: { range: rango(seg, a, b), paragraphStyle: { namedStyleType: 'HEADING_3' }, fields: 'namedStyleType' } });
      // El texto heredó el estilo explícito del marcador; se quita para que mande el del título.
      r.push({ updateTextStyle: { range: rango(seg, a, b), textStyle: {}, fields: 'bold,italic,fontSize,weightedFontFamily,foregroundColor' } });
    }
    let x = a;
    for (const t of p.trozos) {
      if (t.negrita) r.push({ updateTextStyle: { range: rango(seg, x, x + t.texto.length), textStyle: { bold: true }, fields: 'bold' } });
      if (t.pendiente) r.push({ updateTextStyle: { range: rango(seg, x, x + t.texto.length), textStyle: { backgroundColor: AMARILLO }, fields: 'backgroundColor' } });
      x += t.texto.length;
    }
    if (p.tipo === 'li' && !enLista) {
      const ultima = vinetas[vinetas.length - 1];
      if (ultima && ultima[1] === a - 1) ultima[1] = b;
      else vinetas.push([a, b]);
    }
    pos = b + 1;
  }
  for (const [a, b] of vinetas) r.push({ createParagraphBullets: { range: rango(seg, a, b), bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
  return r;
}

/** Pasada 0: el texto fijo traducido. Los párrafos con imágenes u otros objetos no se tocan. */
export function planTraduccion(doc: DocumentoDocs, traducciones: Record<string, string>): object[] {
  const cambios = parrafos(doc).filter((p) => p.soloTexto && p.texto.trim() && traducciones[p.texto.trim()] && traducciones[p.texto.trim()] !== p.texto.trim());
  return alReves(cambios).flatMap((p) => reemplazarRango(p.seg, p.inicio, p.fin, [{ tipo: 'p', trozos: [{ texto: traducciones[p.texto.trim()] }] }], true));
}

/** Pasada 1: datos, textos de la IA y pies de foto. Lo que no se puede rellenar queda resaltado. */
export function planTexto(doc: DocumentoDocs, r: Relleno): { requests: object[]; desconocidos: string[] } {
  const desconocidos: string[] = [];
  const requests = alReves(encontrarMarcadores(doc).filter((h) => !h.m || ['dato', 'ia', 'pie'].includes(h.m.tipo))).flatMap((h) => {
    const contenido = h.m ? contenidoDe(h.m, r) : null;
    if (!contenido) desconocidos.push(h.original);
    const ps = contenido ?? [huecoDe(h.m, h.original)];
    return reemplazarRango(h.seg, h.inicio, h.fin, h.solo ? ps : [enUnaLinea(ps)], h.enLista);
  });
  return { requests, desconocidos };
}

/** Índice del contenido de la celda (fila, columna) de una tabla recién insertada en `i`. */
const celda = (i: number, columnas: number, f: number, c: number) => i + 4 + f * (2 * columnas + 1) + 2 * c;

/** Inserta una tabla en `i` (un párrafo vacío del cuerpo) con el texto de cada celda. */
function tabla(i: number, filas: string[][], o: { cabecera: boolean; sinBordes: boolean }): object[] {
  const columnas = Math.max(...filas.map((f) => f.length));
  const r: object[] = [{ insertTable: { rows: filas.length, columns: columnas, location: { index: i } } }];
  // Se rellenan del final al principio: así cada celda está donde dice la fórmula.
  for (let f = filas.length - 1; f >= 0; f--) for (let c = columnas - 1; c >= 0; c--) if (filas[f][c]) r.push({ insertText: { location: { index: celda(i, columnas, f, c) }, text: filas[f][c] } });
  const zona = { tableCellLocation: { tableStartLocation: { index: i + 1 }, rowIndex: 0, columnIndex: 0 }, rowSpan: o.cabecera ? 1 : filas.length, columnSpan: columnas };
  if (o.cabecera) {
    // Ya relleno, el texto de cada celda de la cabecera empieza donde dice la fórmula más lo insertado antes.
    let antes = 0;
    for (let c = 0; c < columnas; c++) {
      const t = filas[0][c] ?? '';
      const a = celda(i, columnas, 0, c) + antes;
      if (t) r.push({ updateTextStyle: { range: { startIndex: a, endIndex: a + t.length }, textStyle: { bold: true }, fields: 'bold' } });
      antes += t.length;
    }
    r.push({ updateTableCellStyle: { tableRange: zona, tableCellStyle: { backgroundColor: GRIS }, fields: 'backgroundColor' } });
  }
  if (o.sinBordes) {
    const borde = { width: { magnitude: 0, unit: 'PT' }, dashStyle: 'SOLID', color: { color: { rgbColor: {} } } };
    r.push({
      updateTableCellStyle: {
        tableRange: { ...zona, rowSpan: filas.length },
        tableCellStyle: { borderTop: borde, borderBottom: borde, borderLeft: borde, borderRight: borde },
        fields: 'borderTop,borderBottom,borderLeft,borderRight',
      },
    });
  }
  return r;
}

/**
 * Pasada 2: tablas de datos y galerías de fotos. Solo en el cuerpo, con el marcador solo en su
 * párrafo y fuera de otra tabla; si no, una tabla va como líneas de texto y una galería como
 * su primera foto. Cada celda de una galería lleva {{foto:clave#n}} y su pie, para la pasada 3.
 */
export function planTablas(doc: DocumentoDocs, r: Relleno): { requests: object[]; desconocidos: string[] } {
  const desconocidos: string[] = [];
  const requests = alReves(encontrarMarcadores(doc).filter((h) => h.m?.tipo === 'tabla' || h.m?.tipo === 'fotos')).flatMap((h) => {
    const m = h.m!;
    const cabe = h.solo && h.enCuerpo && !h.enTabla;
    const borrar = { deleteContentRange: { range: rango(h.seg, h.inicio, h.fin) } };
    if (m.tipo === 'tabla') {
      const filas = r.tablas[m.clave];
      if (!filas?.length) {
        desconocidos.push(h.original);
        return reemplazarRango(h.seg, h.inicio, h.fin, [huecoDe(m, h.original)], h.enLista);
      }
      if (!cabe) return reemplazarRango(h.seg, h.inicio, h.fin, filas.map((f) => ({ tipo: 'p' as const, trozos: [{ texto: f.join(' · ') }] })), h.enLista);
      return [borrar, ...tabla(h.inicio, filas, { cabecera: filas.length > 1 && !r.tablasSinCabecera?.includes(m.clave), sinBordes: false })];
    }
    const fotos = r.fotos[m.clave] ?? [];
    // Sin fotos, la galería desaparece.
    if (!fotos.length) return [borrar];
    if (!cabe) return [borrar, { insertText: { location: lugar(h.seg, h.inicio), text: `{{foto:${m.clave}#0}}` } }];
    const filas: string[][] = [];
    fotos.forEach((f, n) => {
      if (n % 2 === 0) filas.push([]);
      filas[filas.length - 1].push(`{{foto:${m.clave}#${n}}}${f.pie ? `\n${f.pie}` : ''}`);
    });
    if (filas[filas.length - 1].length === 1) filas[filas.length - 1].push('');
    return [borrar, ...tabla(h.inicio, filas, { cabecera: false, sinBordes: true })];
  });
  return { requests, desconocidos };
}

/** Una foto que insertar, con sus peticiones y las de reserva si Google no la puede descargar. */
export interface FotoPlaneada {
  nombre: string;
  requests: object[];
  /** Si falla: el hueco resaltado en su lugar. */
  reserva: object[];
}

/** Pasada 3: fotos en los marcadores de texto y en las imágenes con el marcador en su texto alternativo. */
export function planFotos(doc: DocumentoDocs, r: Relleno): { fotos: FotoPlaneada[]; desconocidos: string[] } {
  const desconocidos: string[] = [];
  const { alto } = medidas(doc);
  const fotos: FotoPlaneada[] = alReves(encontrarMarcadores(doc).filter((h) => h.m?.tipo === 'foto')).map((h) => {
    const foto = fotoDe(h.m!.clave, r);
    const hueco = reemplazarRango(h.seg, h.inicio, h.fin, [huecoDe(h.m, h.original)], h.enLista);
    if (!foto) {
      desconocidos.push(h.original);
      return { nombre: h.original, requests: hueco, reserva: [] };
    }
    // Ancho del sitio y, como mucho, casi media página de alto (en encabezados, poco más que un logo).
    // Con ancho y alto, Google la encaja dentro manteniendo la proporción.
    const maxAlto = h.enCuerpo ? alto * 0.45 : 60;
    const proporcion = foto.ancho && foto.alto ? foto.alto / foto.ancho : 0.75;
    const ancho = Math.min(h.ancho, maxAlto / proporcion);
    const requests = [
      { deleteContentRange: { range: rango(h.seg, h.inicio, h.fin) } },
      {
        insertInlineImage: {
          location: lugar(h.seg, h.inicio),
          uri: foto.url,
          objectSize: { width: { magnitude: Math.round(ancho), unit: 'PT' }, height: { magnitude: Math.round(ancho * proporcion), unit: 'PT' } },
        },
      },
    ];
    const reserva = reemplazarRango(h.seg, h.inicio, h.fin, [{ tipo: 'p', trozos: [{ texto: `[foto: ${foto.nombre}]`, pendiente: true }] }], h.enLista);
    return { nombre: foto.nombre, requests, reserva };
  });
  for (const { objeto, clave } of imagenesConMarcador(doc)) {
    const foto = fotoDe(clave, r);
    if (!foto) {
      desconocidos.push(`{{foto:${clave}}}`);
      continue;
    }
    // Se cambia la foto y se conserva el marco de la plantilla (tamaño, posición, ajuste).
    fotos.push({ nombre: foto.nombre, requests: [{ replaceImage: { imageObjectId: objeto, uri: foto.url, imageReplaceMethod: 'CENTER_CROP' } }], reserva: [] });
  }
  return { fotos, desconocidos };
}

// ── Relleno ─────────────────────────────────────────────────────────────────

/** El documento entero, como lo devuelve la API de Docs. */
export const leerDoc = (id: string) => apiGoogle<DocumentoDocs>(`${DOCS}/${id}`);
const leer = leerDoc;

/**
 * Envía las peticiones en tandas. La primera exige la revisión leída: si alguien cambió el
 * documento entretanto, falla en vez de escribir en el sitio equivocado. Las siguientes ya no
 * pueden exigirla, pero van del final al principio y no les afecta lo anterior.
 */
async function enviar(id: string, requests: object[], revision?: string) {
  for (let i = 0; i < requests.length; i += 400) {
    await apiGoogle(`${DOCS}/${id}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: requests.slice(i, i + 400), ...(i === 0 && revision ? { writeControl: { requiredRevisionId: revision } } : {}) }),
    });
  }
}

/** Rellena el documento (una copia de la plantilla) con el contenido. */
export async function rellenarDoc(id: string, r: Relleno): Promise<ResultadoRelleno> {
  const desconocidos: string[] = [];
  const fotosFallidas: string[] = [];
  let doc = await leer(id);

  if (r.traducciones && Object.keys(r.traducciones).length) {
    const requests = planTraduccion(doc, r.traducciones);
    if (requests.length) {
      await enviar(id, requests, doc.revisionId);
      doc = await leer(id);
    }
  }
  for (const plan of [planTexto, planTablas]) {
    const p = plan(doc, r);
    desconocidos.push(...p.desconocidos);
    if (p.requests.length) {
      await enviar(id, p.requests, doc.revisionId);
      doc = await leer(id);
    }
  }
  const p = planFotos(doc, r);
  desconocidos.push(...p.desconocidos);
  if (p.fotos.length) {
    try {
      await enviar(id, p.fotos.flatMap((f) => f.requests), doc.revisionId);
    } catch {
      // Alguna foto falló y la tanda entera se descartó: se reintenta una a una, en el mismo orden.
      for (const f of p.fotos) {
        try {
          await enviar(id, f.requests);
        } catch (e) {
          console.error('Docs: no se pudo insertar la foto', f.nombre, e);
          fotosFallidas.push(f.nombre);
          if (f.reserva.length) await enviar(id, f.reserva);
        }
      }
    }
  }
  return { desconocidos: [...new Set(desconocidos)], fotosFallidas };
}
