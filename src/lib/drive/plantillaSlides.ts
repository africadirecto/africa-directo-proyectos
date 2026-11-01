// Rellena una copia de una plantilla de Google Slides con marcadores (ver dominio/marcadores.ts),
// igual que plantillaDocs.ts pero con lo que Slides permite:
// - Cada recuadro y cada celda tiene sus propias posiciones, así que no se estorban entre sí;
//   dentro de cada uno se sustituye del final al principio.
// - Una foto va en un recuadro cuyo único texto es {{foto:…}} (la foto ocupa el recuadro) o en
//   una imagen con el marcador en su texto alternativo (se cambia la foto, se conserva el marco).
// - Sin tablas ni galerías: una tabla de datos va como líneas de texto y una galería, como su
//   primera foto. No se repiten diapositivas.

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

const SLIDES = 'https://slides.googleapis.com/v1/presentations';
const EMU = 12700;

type ElementoTexto = { startIndex?: number; endIndex?: number; textRun?: { content?: string }; autoText?: { content?: string } };
type Texto = { textElements?: ElementoTexto[] };
type Medida = { magnitude?: number };
export type ElementoPagina = {
  objectId: string;
  title?: string;
  description?: string;
  size?: { width?: Medida; height?: Medida };
  transform?: { scaleX?: number; scaleY?: number };
  shape?: { text?: Texto };
  image?: object;
  table?: { tableRows?: { tableCells?: { location?: { rowIndex?: number; columnIndex?: number }; text?: Texto }[] }[] };
  elementGroup?: { children?: ElementoPagina[] };
};
export type PresentacionSlides = { revisionId?: string; slides?: { objectId: string; pageElements?: ElementoPagina[] }[] };

/** Un recuadro o una celda con texto. */
interface Contenedor {
  objectId: string;
  celda?: { rowIndex: number; columnIndex: number };
  texto: string;
  soloTexto: boolean;
  /** Tamaño del recuadro en puntos (para orientar la extensión del texto). */
  caja: { ancho: number; alto: number };
}

export interface HalladoSlides {
  original: string;
  m: Marcador | null;
  objectId: string;
  celda?: { rowIndex: number; columnIndex: number };
  inicio: number;
  fin: number;
  /** Es lo único que hay en su párrafo. */
  solo: boolean;
  /** Es el único texto del recuadro (para poner ahí una foto). */
  soloEnRecuadro: boolean;
  caja: { ancho: number; alto: number };
}

function texto(t?: Texto): { texto: string; soloTexto: boolean } {
  let s = '';
  let soloTexto = true;
  // Los fragmentos de texto y los automáticos (p. ej. el número de diapositiva) van seguidos;
  // los marcadores de párrafo no ocupan sitio.
  for (const e of t?.textElements ?? []) {
    const c = e.textRun?.content ?? e.autoText?.content;
    if (c === undefined) continue;
    if (e.autoText) soloTexto = false;
    s += c;
  }
  return { texto: s, soloTexto };
}

function contenedores(p: PresentacionSlides): Contenedor[] {
  const salida: Contenedor[] = [];
  const recorrer = (els: ElementoPagina[] = []) => {
    for (const e of els) {
      const caja = { ancho: ((e.size?.width?.magnitude ?? 0) * (e.transform?.scaleX ?? 1)) / EMU, alto: ((e.size?.height?.magnitude ?? 0) * (e.transform?.scaleY ?? 1)) / EMU };
      if (e.shape?.text) salida.push({ objectId: e.objectId, caja, ...texto(e.shape.text) });
      for (const f of e.table?.tableRows ?? []) {
        for (const c of f.tableCells ?? []) {
          if (c.text) salida.push({ objectId: e.objectId, celda: { rowIndex: c.location?.rowIndex ?? 0, columnIndex: c.location?.columnIndex ?? 0 }, caja, ...texto(c.text) });
        }
      }
      recorrer(e.elementGroup?.children);
    }
  };
  for (const s of p.slides ?? []) recorrer(s.pageElements);
  return salida;
}

/** Todos los {{…}} de las diapositivas (no de los patrones ni diseños). */
export function encontrarMarcadoresSlides(p: PresentacionSlides): HalladoSlides[] {
  return contenedores(p).flatMap((c) =>
    [...c.texto.matchAll(MARCADOR)].map((x) => {
      const antes = c.texto.lastIndexOf('\n', x.index - 1) + 1;
      const despues = c.texto.indexOf('\n', x.index);
      const parrafo = c.texto.slice(antes, despues < 0 ? undefined : despues);
      return {
        original: x[0],
        m: leerMarcador(x[1]),
        objectId: c.objectId,
        ...(c.celda ? { celda: c.celda } : {}),
        inicio: x.index,
        fin: x.index + x[0].length,
        solo: parrafo.trim() === x[0],
        soloEnRecuadro: !c.celda && c.texto.trim() === x[0],
        caja: c.caja,
      };
    }),
  );
}

/** Imágenes con {{foto:…}} en su texto alternativo. */
export function imagenesConMarcadorSlides(p: PresentacionSlides): { objeto: string; clave: string }[] {
  const salida: { objeto: string; clave: string }[] = [];
  const recorrer = (els: ElementoPagina[] = []) => {
    for (const e of els) {
      const m = e.image ? `${e.description ?? ''} ${e.title ?? ''}`.match(/\{\{([^{}]+)\}\}/) : null;
      const marcador = m ? leerMarcador(m[1]) : null;
      if (marcador?.tipo === 'foto') salida.push({ objeto: e.objectId, clave: marcador.clave });
      recorrer(e.elementGroup?.children);
    }
  };
  for (const s of p.slides ?? []) recorrer(s.pageElements);
  return salida;
}

/** Párrafos de texto fijo de las diapositivas, para traducirlos. */
export function textosFijosSlides(p: PresentacionSlides): string[] {
  const textos = contenedores(p)
    .filter((c) => c.soloTexto)
    .flatMap((c) => c.texto.split('\n'))
    .map((t) => t.trim())
    .filter((t) => /\p{L}/u.test(t.replace(MARCADOR, '')));
  return [...new Set(textos)];
}

// ── Peticiones ──────────────────────────────────────────────────────────────

const AMARILLO = { opaqueColor: { rgbColor: { red: 1, green: 0.93, blue: 0.4 } } };
type Destino = { objectId: string; celda?: { rowIndex: number; columnIndex: number } };
const donde = (d: Destino) => ({ objectId: d.objectId, ...(d.celda ? { cellLocation: d.celda } : {}) });
const tramo = (a: number, b: number) => ({ type: 'FIXED_RANGE', startIndex: a, endIndex: b });

/** Sustituye [inicio, fin) del recuadro o celda por los párrafos, heredando el estilo del primer carácter. */
export function reemplazarEnSlides(d: Destino, inicio: number, fin: number, ps: Parrafo[]): object[] {
  const s = ps.map(textoParrafo).join('\n');
  if (!s) return [{ deleteText: { ...donde(d), textRange: tramo(inicio, fin) } }];
  const r: object[] = [
    { insertText: { ...donde(d), insertionIndex: inicio + 1, text: s } },
    { deleteText: { ...donde(d), textRange: tramo(inicio + 1 + s.length, fin + s.length) } },
    { deleteText: { ...donde(d), textRange: tramo(inicio, inicio + 1) } },
  ];
  let pos = inicio;
  for (const p of ps) {
    const a = pos;
    const b = pos + textoParrafo(p).length;
    // En Slides no hay estilos de título: un título va en negrita.
    if (p.tipo === 'h' && b > a) r.push({ updateTextStyle: { ...donde(d), textRange: tramo(a, b), style: { bold: true }, fields: 'bold' } });
    let x = a;
    for (const t of p.trozos) {
      if (t.negrita) r.push({ updateTextStyle: { ...donde(d), textRange: tramo(x, x + t.texto.length), style: { bold: true }, fields: 'bold' } });
      if (t.pendiente) r.push({ updateTextStyle: { ...donde(d), textRange: tramo(x, x + t.texto.length), style: { backgroundColor: AMARILLO }, fields: 'backgroundColor' } });
      x += t.texto.length;
    }
    if (p.tipo === 'li') r.push({ createParagraphBullets: { ...donde(d), textRange: tramo(a, b), bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
    pos = b + 1;
  }
  return r;
}

/** Agrupadas por recuadro o celda y del final al principio dentro de cada uno. */
const ordenar = <T extends Destino & { inicio: number }>(xs: T[]) =>
  [...xs].sort((a, b) => {
    const ka = `${a.objectId}:${a.celda?.rowIndex ?? ''}:${a.celda?.columnIndex ?? ''}`;
    const kb = `${b.objectId}:${b.celda?.rowIndex ?? ''}:${b.celda?.columnIndex ?? ''}`;
    return ka === kb ? b.inicio - a.inicio : ka.localeCompare(kb);
  });

export function planTraduccionSlides(p: PresentacionSlides, traducciones: Record<string, string>): object[] {
  const cambios = contenedores(p)
    .filter((c) => c.soloTexto)
    .flatMap((c) => {
      let inicio = 0;
      return c.texto.split('\n').flatMap((linea) => {
        const a = inicio;
        inicio += linea.length + 1;
        const t = traducciones[linea.trim()];
        return t && t !== linea.trim() ? [{ objectId: c.objectId, celda: c.celda, inicio: a, fin: a + linea.length, t }] : [];
      });
    });
  return ordenar(cambios).flatMap((x) => reemplazarEnSlides(x, x.inicio, x.fin, [{ tipo: 'p', trozos: [{ texto: x.t }] }]));
}

/** Textos, datos, pies y tablas (como líneas). Las fotos van aparte (planFotosSlides). */
export function planTextoSlides(p: PresentacionSlides, r: Relleno): { requests: object[]; desconocidos: string[] } {
  const desconocidos: string[] = [];
  const hallados = encontrarMarcadoresSlides(p).filter((h) => !(h.m && (h.m.tipo === 'foto' || h.m.tipo === 'fotos') && h.soloEnRecuadro));
  const requests = ordenar(hallados).flatMap((h) => {
    let ps: Parrafo[] | null = null;
    if (!h.m) ps = null;
    else if (h.m.tipo === 'tabla') ps = r.tablas[h.m.clave]?.map((f) => ({ tipo: 'p' as const, trozos: [{ texto: f.join(' · ') }] })) ?? null;
    else if (h.m.tipo === 'foto' || h.m.tipo === 'fotos') ps = null; // una foto dentro de una frase no cabe en Slides
    else ps = contenidoDe(h.m, r);
    if (!ps) desconocidos.push(h.original);
    const contenido = ps ?? [huecoDe(h.m, h.original)];
    return reemplazarEnSlides(h, h.inicio, h.fin, h.solo ? contenido : [enUnaLinea(contenido)]);
  });
  return { requests, desconocidos };
}

export interface FotoPlaneadaSlides {
  nombre: string;
  requests: object[];
  reserva: object[];
}

export function planFotosSlides(p: PresentacionSlides, r: Relleno): { fotos: FotoPlaneadaSlides[]; desconocidos: string[] } {
  const desconocidos: string[] = [];
  const fotos: FotoPlaneadaSlides[] = [];
  const vistos = new Set<string>();
  for (const h of encontrarMarcadoresSlides(p)) {
    if (!h.m || (h.m.tipo !== 'foto' && h.m.tipo !== 'fotos') || !h.soloEnRecuadro || vistos.has(h.original)) continue;
    // replaceAllShapesWithImage cambia todos los recuadros con ese texto: una vez por marcador.
    vistos.add(h.original);
    const foto = fotoDe(h.m.tipo === 'fotos' ? `${h.m.clave}#0` : h.m.clave, r);
    const hueco = reemplazarEnSlides(h, h.inicio, h.fin, [huecoDe(h.m, h.original)]);
    if (!foto) {
      desconocidos.push(h.original);
      fotos.push({ nombre: h.original, requests: hueco, reserva: [] });
      continue;
    }
    fotos.push({
      nombre: foto.nombre,
      requests: [{ replaceAllShapesWithImage: { imageUrl: foto.url, imageReplaceMethod: 'CENTER_CROP', containsText: { text: h.original, matchCase: true } } }],
      reserva: reemplazarEnSlides(h, h.inicio, h.fin, [{ tipo: 'p', trozos: [{ texto: `[foto: ${foto.nombre}]`, pendiente: true }] }]),
    });
  }
  for (const { objeto, clave } of imagenesConMarcadorSlides(p)) {
    const foto = fotoDe(clave, r);
    if (!foto) {
      desconocidos.push(`{{foto:${clave}}}`);
      continue;
    }
    fotos.push({ nombre: foto.nombre, requests: [{ replaceImage: { imageObjectId: objeto, url: foto.url, imageReplaceMethod: 'CENTER_CROP' } }], reserva: [] });
  }
  return { fotos, desconocidos };
}

// ── Convertir una presentación de ejemplo en plantilla ──────────────────────

export interface BloqueSlides {
  id: string;
  tipo: 'titulo' | 'parrafo' | 'celda' | 'imagen';
  texto: string;
  destino: Destino;
  inicio: number;
  fin: number;
  ultimo: boolean;
  diapositiva: number;
}

/** Párrafos de cada recuadro y celda, e imágenes, en orden de diapositiva. */
export function bloquesSlides(p: PresentacionSlides & { slides?: { pageElements?: (ElementoPagina & { shape?: { placeholder?: { type?: string } } })[] }[] }): BloqueSlides[] {
  const bloques: BloqueSlides[] = [];
  let n = 0;
  const parrafos = (texto: string, destino: Destino, tipo: BloqueSlides['tipo'], diapositiva: number) => {
    const lineas = texto.replace(/\n$/, '').split('\n');
    let inicio = 0;
    lineas.forEach((l, k) => {
      if (l.trim()) bloques.push({ id: `B${++n}`, tipo, texto: l, destino, inicio, fin: inicio + l.length, ultimo: k === lineas.length - 1, diapositiva });
      inicio += l.length + 1;
    });
  };
  (p.slides ?? []).forEach((s, i) => {
    const recorrer = (els: (ElementoPagina & { shape?: { placeholder?: { type?: string } } })[] = []) => {
      for (const e of els) {
        if (e.image) bloques.push({ id: `B${++n}`, tipo: 'imagen', texto: `[imagen${e.description ? `: ${e.description}` : ''}]`, destino: { objectId: e.objectId }, inicio: 0, fin: 0, ultimo: true, diapositiva: i + 1 });
        if (e.shape?.text) parrafos(texto(e.shape.text).texto, { objectId: e.objectId }, /TITLE/.test(e.shape.placeholder?.type ?? '') ? 'titulo' : 'parrafo', i + 1);
        for (const f of e.table?.tableRows ?? []) for (const c of f.tableCells ?? []) if (c.text) parrafos(texto(c.text).texto, { objectId: e.objectId, celda: { rowIndex: c.location?.rowIndex ?? 0, columnIndex: c.location?.columnIndex ?? 0 } }, 'celda', i + 1);
        recorrer(e.elementGroup?.children);
      }
    };
    recorrer(s.pageElements);
  });
  return bloques;
}

/** Escribe los marcadores en la presentación convertida (sin tablas: en Slides no hay {{tabla:…}}). */
export async function aplicarAnalisisSlides(id: string, bloques: BloqueSlides[], a: { campos: { clave: string; tipo: string; bloques: string[] }[]; datos: { bloque: string; buscar: string; marcador: string }[] }): Promise<string[]> {
  const porId = new Map(bloques.map((b) => [b.id, b]));
  const avisos: string[] = [];
  const usados = new Set<string>();
  const textos: (Destino & { inicio: number; requests: object[] })[] = [];
  const altText: object[] = [];
  const plano = (t: string) => [{ tipo: 'p' as const, trozos: [{ texto: t }] }];

  for (const c of a.campos) {
    const bs = c.bloques.map((x) => porId.get(x)).filter((b): b is BloqueSlides => !!b && !usados.has(b.id));
    if (!bs.length) continue;
    bs.forEach((b) => usados.add(b.id));
    const marcador = `{{${c.tipo}:${c.clave}}}`;
    const [primero, ...resto] = bs;
    // Una imagen conserva su marco: el marcador va en su texto alternativo.
    if (primero.tipo === 'imagen') altText.push({ updatePageElementAltText: { objectId: primero.destino.objectId, description: marcador } });
    else textos.push({ ...primero.destino, inicio: primero.inicio, requests: reemplazarEnSlides(primero.destino, primero.inicio, primero.fin, plano(marcador)) });
    for (const b of resto) {
      if (b.tipo !== 'imagen') textos.push({ ...b.destino, inicio: b.inicio, requests: [{ deleteText: { ...donde(b.destino), textRange: tramo(b.inicio, b.ultimo ? b.fin : b.fin + 1) } }] });
    }
  }
  for (const d of a.datos) {
    const b = porId.get(d.bloque);
    if (!b || usados.has(b.id) || b.tipo === 'imagen') continue;
    const i = b.texto.indexOf(d.buscar);
    if (!d.buscar || i < 0) {
      avisos.push(`No se encontró «${d.buscar}» para poner ${d.marcador}.`);
      continue;
    }
    textos.push({ ...b.destino, inicio: b.inicio + i, requests: reemplazarEnSlides(b.destino, b.inicio + i, b.inicio + i + d.buscar.length, plano(d.marcador)) });
  }
  const requests = [...ordenar(textos).flatMap((x) => x.requests), ...altText];
  if (requests.length) await enviar(id, requests, (await leerSlides(id)).revisionId);
  return avisos;
}

// ── Relleno ─────────────────────────────────────────────────────────────────

/** La presentación entera, como la devuelve la API de Slides. */
export const leerSlides = (id: string) => apiGoogle<PresentacionSlides>(`${SLIDES}/${id}`);
const leer = leerSlides;

async function enviar(id: string, requests: object[], revision?: string) {
  for (let i = 0; i < requests.length; i += 400) {
    await apiGoogle(`${SLIDES}/${id}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: requests.slice(i, i + 400), ...(i === 0 && revision ? { writeControl: { requiredRevisionId: revision } } : {}) }),
    });
  }
}

/** Rellena la presentación (una copia de la plantilla) con el contenido. */
export async function rellenarSlides(id: string, r: Relleno): Promise<ResultadoRelleno> {
  const desconocidos: string[] = [];
  const fotosFallidas: string[] = [];
  let p = await leer(id);

  if (r.traducciones && Object.keys(r.traducciones).length) {
    const requests = planTraduccionSlides(p, r.traducciones);
    if (requests.length) {
      await enviar(id, requests, p.revisionId);
      p = await leer(id);
    }
  }
  const t = planTextoSlides(p, r);
  desconocidos.push(...t.desconocidos);
  if (t.requests.length) {
    await enviar(id, t.requests, p.revisionId);
    p = await leer(id);
  }
  const f = planFotosSlides(p, r);
  desconocidos.push(...f.desconocidos);
  if (f.fotos.length) {
    try {
      await enviar(id, f.fotos.flatMap((x) => x.requests), p.revisionId);
    } catch {
      for (const x of f.fotos) {
        try {
          await enviar(id, x.requests);
        } catch (e) {
          console.error('Slides: no se pudo poner la foto', x.nombre, e);
          fotosFallidas.push(x.nombre);
          if (x.reserva.length) await enviar(id, x.reserva);
        }
      }
    }
  }
  return { desconocidos: [...new Set(desconocidos)], fotosFallidas };
}
