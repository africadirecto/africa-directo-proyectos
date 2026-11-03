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
import type { CambioDocumento } from '../dominio/cambiosPlantilla';

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

// ── Convertir un informe de ejemplo en plantilla ────────────────────────────

/** Un trozo del documento de ejemplo, numerado para que la IA diga qué hacer con él. */
export interface Bloque {
  id: string;
  tipo: 'titulo' | 'parrafo' | 'celda' | 'imagen' | 'tabla';
  texto: string;
  seg: string;
  inicio: number;
  fin: number;
  /** Celdas: su tabla (T1…) y posición. */
  tabla?: { id: string; fila: number; columna: number };
  /** Imágenes: el objeto y si es flotante. */
  imagen?: { objeto: string; flotante: boolean };
  /** Último párrafo de su celda o segmento (no se puede borrar su salto). */
  ultimo?: boolean;
  /** Estilo del párrafo (HEADING_2, NORMAL_TEXT…). */
  estilo?: string;
}

/** Los bloques del documento en orden: títulos, párrafos, celdas, imágenes y tablas (con su texto). */
export function bloquesDoc(doc: DocumentoDocs & { body?: { content?: (ElementoDoc & { paragraph?: { positionedObjectIds?: string[] } })[] } }): Bloque[] {
  const bloques: Bloque[] = [];
  let n = 0;
  let t = 0;
  const recorrer = (elementos: ElementoDoc[] | undefined, seg: string, tabla?: Bloque['tabla']) => {
    (elementos ?? []).forEach((e, k, todos) => {
      if (e.paragraph) {
        const els = e.paragraph.elements ?? [];
        if (!els.length) return;
        const inicio = els[0].startIndex ?? 0;
        let texto = '';
        for (const x of els) {
          const obj = (x as { inlineObjectElement?: { inlineObjectId?: string } }).inlineObjectElement?.inlineObjectId;
          if (obj) bloques.push({ id: `B${++n}`, tipo: 'imagen', texto: describir(doc, obj), seg, inicio: x.startIndex ?? 0, fin: (x.startIndex ?? 0) + 1, imagen: { objeto: obj, flotante: false } });
          texto += x.textRun ? (x.textRun.content ?? '') : '￼'.repeat((x.endIndex ?? 0) - (x.startIndex ?? 0));
        }
        for (const obj of (e.paragraph as { positionedObjectIds?: string[] }).positionedObjectIds ?? []) {
          bloques.push({ id: `B${++n}`, tipo: 'imagen', texto: describir(doc, obj), seg, inicio, fin: inicio, imagen: { objeto: obj, flotante: true } });
        }
        const limpio = texto.replace(/\n$/, '');
        if (!limpio.replace(/￼/g, '').trim()) return;
        const estilo = e.paragraph.paragraphStyle?.namedStyleType ?? '';
        bloques.push({
          id: `B${++n}`,
          tipo: tabla ? 'celda' : /^(HEADING_|TITLE|SUBTITLE)/.test(estilo) ? 'titulo' : 'parrafo',
          texto: limpio.replace(/￼/g, ''),
          seg,
          inicio,
          fin: inicio + limpio.length,
          ...(tabla ? { tabla } : {}),
          ...(k === todos.length - 1 ? { ultimo: true } : {}),
          ...(estilo ? { estilo } : {}),
        });
      } else if (e.table) {
        const id = `T${++t}`;
        const filas = e.table.tableRows ?? [];
        const resumen = filas.map((f) => (f.tableCells ?? []).map((c) => texto1(c.content)).join(' | ')).join('\n');
        bloques.push({ id, tipo: 'tabla', texto: resumen.slice(0, 1500), seg, inicio: e.startIndex ?? 0, fin: e.endIndex ?? 0 });
        filas.forEach((f, fila) => (f.tableCells ?? []).forEach((c, columna) => recorrer(c.content, seg, { id, fila, columna })));
      }
    });
  };
  recorrer(doc.body?.content, '');
  for (const [hid, h] of Object.entries(doc.headers ?? {})) recorrer(h.content, hid);
  for (const [fid, f] of Object.entries(doc.footers ?? {})) recorrer(f.content, fid);
  return bloques;
}

const texto1 = (els: ElementoDoc[] | undefined): string =>
  (els ?? []).map((e) => (e.paragraph?.elements ?? []).map((x) => x.textRun?.content ?? '').join('')).join(' ').replace(/\s+/g, ' ').trim();

function describir(doc: DocumentoDocs, objeto: string): string {
  const e = doc.inlineObjects?.[objeto]?.inlineObjectProperties?.embeddedObject ?? doc.positionedObjects?.[objeto]?.positionedObjectProperties?.embeddedObject;
  return `[imagen${e?.description || e?.title ? `: ${e.description || e.title}` : ''}]`;
}

/** Lo que decidió la IA sobre el ejemplo (ver ia/plantillas.ts › analizarEjemplo). */
export interface Analisis {
  campos: { clave: string; tipo: 'ia' | 'foto' | 'fotos'; bloques: string[] }[];
  datos: { bloque: string; buscar: string; marcador: string }[];
  tablas: { tabla: string; marcador: string }[];
}

/**
 * Peticiones para convertir el ejemplo en plantilla: cada campo de la IA ocupa el sitio de su
 * primer bloque (los demás se borran), cada dato sustituye el texto exacto que lo contenía, cada
 * imagen deja su marcador y cada tabla de cifras, el suyo. Todo del final al principio.
 * Devuelve aparte las tablas, que se quitan en una segunda tanda (si falla, se avisa).
 */
export function planMarcadores(bloques: Bloque[], a: Analisis): { requests: object[]; tablas: object[][]; avisos: string[] } {
  const porId = new Map(bloques.map((b) => [b.id, b]));
  const avisos: string[] = [];
  type Cambio = { seg: string; inicio: number; requests: object[] };
  const cambios: Cambio[] = [];
  const usados = new Set<string>();
  const texto = (marcador: string) => [{ tipo: 'p' as const, trozos: [{ texto: marcador }] }];

  for (const c of a.campos) {
    const bs = c.bloques.map((id) => porId.get(id)).filter((b): b is Bloque => !!b && !usados.has(b.id));
    if (!bs.length) continue;
    bs.forEach((b) => usados.add(b.id));
    const marcador = `{{${c.tipo}:${c.clave}}}`;
    const [primero, ...resto] = bs;
    if (primero.tipo === 'imagen') {
      const r = primero.imagen!.flotante
        ? [{ deletePositionedObject: { objectId: primero.imagen!.objeto } }, { insertText: { location: lugar(primero.seg, primero.inicio), text: marcador } }]
        : [{ deleteContentRange: { range: rango(primero.seg, primero.inicio, primero.fin) } }, { insertText: { location: lugar(primero.seg, primero.inicio), text: marcador } }];
      cambios.push({ seg: primero.seg, inicio: primero.inicio, requests: r });
    } else {
      cambios.push({ seg: primero.seg, inicio: primero.inicio, requests: reemplazarRango(primero.seg, primero.inicio, primero.fin, texto(marcador), true) });
    }
    for (const b of resto) {
      if (b.tipo === 'imagen') {
        cambios.push({ seg: b.seg, inicio: b.inicio, requests: [b.imagen!.flotante ? { deletePositionedObject: { objectId: b.imagen!.objeto } } : { deleteContentRange: { range: rango(b.seg, b.inicio, b.fin) } }] });
      } else {
        // El párrafo entero con su salto, salvo el último de su celda o segmento.
        cambios.push({ seg: b.seg, inicio: b.inicio, requests: [{ deleteContentRange: { range: rango(b.seg, b.inicio, b.ultimo ? b.fin : b.fin + 1) } }] });
      }
    }
  }

  for (const d of a.datos) {
    const b = porId.get(d.bloque);
    if (!b || usados.has(b.id) || b.tipo === 'imagen' || b.tipo === 'tabla') continue;
    const i = b.texto.indexOf(d.buscar);
    if (!d.buscar || i < 0) {
      avisos.push(`No se encontró «${d.buscar}» para poner ${d.marcador}.`);
      continue;
    }
    cambios.push({ seg: b.seg, inicio: b.inicio + i, requests: reemplazarRango(b.seg, b.inicio + i, b.inicio + i + d.buscar.length, texto(d.marcador), true) });
  }

  // Del final al principio, segmento a segmento.
  const requests = cambios.sort((x, y) => (x.seg === y.seg ? y.inicio - x.inicio : x.seg.localeCompare(y.seg))).flatMap((c) => c.requests);

  // Las tablas se quitan después (cambian mucho las posiciones): se recalculan al releer.
  const tablas = a.tablas
    .map((t) => porId.get(t.tabla) && { b: porId.get(t.tabla)!, marcador: t.marcador })
    .filter((x): x is { b: Bloque; marcador: string } => !!x && !x.b.seg)
    .sort((x, y) => y.b.inicio - x.b.inicio)
    .map(({ b, marcador }) => [{ deleteContentRange: { range: { startIndex: b.inicio, endIndex: b.fin } } }, { insertText: { location: { index: b.inicio }, text: marcador } }]);
  return { requests, tablas, avisos };
}

/** Escribe los marcadores en el documento convertido. Las tablas que no se puedan quitar quedan como aviso. */
export async function aplicarAnalisisDoc(id: string, bloques: Bloque[], a: Analisis): Promise<string[]> {
  const doc = await leerDoc(id);
  // Las posiciones de las tablas se toman antes de los cambios de texto y se ajustan releyendo.
  const { requests, avisos } = planMarcadores(bloques, { ...a, tablas: [] });
  if (requests.length) await enviar(id, requests, doc.revisionId);
  if (a.tablas.length) {
    const despues = bloquesDoc(await leerDoc(id));
    // Tras los cambios, las tablas conservan su orden: T1, T2… siguen siendo las mismas.
    const plan = planMarcadores(despues, { campos: [], datos: [], tablas: a.tablas });
    for (const [k, r] of plan.tablas.entries()) {
      try {
        await enviar(id, r);
      } catch (e) {
        console.error('Plantilla: no se pudo quitar una tabla', e);
        avisos.push(`No se pudo quitar una tabla para poner ${a.tablas[k]?.marcador}: bórrala a mano y escribe el marcador en su lugar.`);
      }
    }
  }
  return avisos;
}

// ── Cambiar la estructura («Cambiar con IA») ────────────────────────────────

/** Al quitar el estilo heredado, vuelve a mandar el del párrafo (título o normal). */
const SIN_ESTILO = 'bold,italic,underline,fontSize,weightedFontFamily,foregroundColor,backgroundColor';

/**
 * Peticiones para los cambios ya validados (ver dominio/cambiosPlantilla.ts): cambiar un texto
 * dentro de un bloque, añadir párrafos tras un bloque y quitar bloques. Del final al principio
 * de cada segmento; en un mismo sitio, primero lo que se añade detrás.
 */
export function planCambios(bloques: Bloque[], cambios: CambioDocumento[]): object[] {
  const porId = new Map(bloques.map((b) => [b.id, b]));
  const lista: { seg: string; inicio: number; requests: object[] }[] = [];
  const tras = new Map<string, CambioDocumento[]>();
  for (const c of cambios) {
    const b = porId.get(c.bloque);
    if (!b) continue;
    if (c.accion === 'insertar') tras.set(b.id, [...(tras.get(b.id) ?? []), c]);
    else if (c.accion === 'borrar') {
      const requests =
        b.tipo === 'imagen'
          ? [b.imagen!.flotante ? { deletePositionedObject: { objectId: b.imagen!.objeto } } : { deleteContentRange: { range: rango(b.seg, b.inicio, b.fin) } }]
          : b.tipo === 'tabla'
            ? [{ deleteContentRange: { range: rango(b.seg, b.inicio, b.fin) } }]
            : // El párrafo con su salto, salvo el último de su celda o segmento (queda vacío).
              [{ deleteContentRange: { range: rango(b.seg, b.inicio, b.ultimo ? b.fin : b.fin + 1) } }];
      lista.push({ seg: b.seg, inicio: b.inicio, requests });
    } else {
      const a = b.inicio + b.texto.indexOf(c.buscar);
      const z = a + c.buscar.length;
      lista.push({
        seg: b.seg,
        inicio: a,
        requests: c.texto ? reemplazarRango(b.seg, a, z, [{ tipo: 'p', trozos: [{ texto: c.texto }] }], true) : [{ deleteContentRange: { range: rango(b.seg, a, z) } }],
      });
    }
  }
  for (const [id, cs] of tras) {
    const b = porId.get(id)!;
    // Un título nuevo, del mismo nivel que el último título de antes (o HEADING_2).
    const previo = bloques
      .slice(0, bloques.indexOf(b) + 1)
      .reverse()
      .find((x) => x.estilo?.startsWith('HEADING_'));
    const nivel = previo?.estilo ?? 'HEADING_2';
    const requests: object[] = [{ insertText: { location: lugar(b.seg, b.fin), text: cs.map((c) => `\n${c.texto}`).join('') } }];
    let pos = b.fin + 1;
    for (const c of cs) {
      const r = rango(b.seg, pos, pos + c.texto.length);
      if (c.estilo === 'titulo') {
        requests.push(
          { updateParagraphStyle: { range: r, paragraphStyle: { namedStyleType: nivel }, fields: 'namedStyleType' } },
          { updateTextStyle: { range: r, textStyle: {}, fields: SIN_ESTILO } },
          { deleteParagraphBullets: { range: r } },
        );
      } else if (b.tipo === 'titulo') {
        // Tras un título, un párrafo normal: sin el estilo del título.
        requests.push({ updateParagraphStyle: { range: r, paragraphStyle: { namedStyleType: 'NORMAL_TEXT' }, fields: 'namedStyleType' } }, { updateTextStyle: { range: r, textStyle: {}, fields: SIN_ESTILO } });
      }
      pos += c.texto.length + 1;
    }
    // +0,5: en el mismo sitio que un cambio al final del bloque, va antes.
    lista.push({ seg: b.seg, inicio: b.fin + 0.5, requests });
  }
  return alReves(lista).flatMap((x) => x.requests);
}

/** Aplica los cambios si el documento sigue en la revisión `revision` (si no, falla sin tocarlo). */
export async function aplicarCambiosDoc(id: string, cambios: CambioDocumento[], revision: string): Promise<void> {
  const doc = await leerDoc(id);
  if (revision && doc.revisionId !== revision) throw new Error('El documento ha cambiado desde la propuesta: vuelve a pedirla.');
  const requests = planCambios(bloquesDoc(doc), cambios);
  if (requests.length) await enviar(id, requests, doc.revisionId);
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
