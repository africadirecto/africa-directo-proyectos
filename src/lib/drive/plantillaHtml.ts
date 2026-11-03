// Relleno de plantillas en HTML, para el modo demo (allí una plantilla es un .html del Drive
// local). Mismos marcadores y mismo contenido que en Docs; los huecos van en <mark>.

import {
  MARCADOR,
  contenidoDe,
  enUnaLinea,
  fotoDe,
  huecoDe,
  leerMarcador,
  type FotoRelleno,
  type Parrafo,
  type Relleno,
  type ResultadoRelleno,
} from '../dominio/marcadores';
import type { CambioDocumento } from '../dominio/cambiosPlantilla';

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function enLinea(p: Parrafo): string {
  return p.trozos.map((t) => (t.pendiente ? `<mark>${escapar(t.texto)}</mark>` : t.negrita ? `<b>${escapar(t.texto)}</b>` : escapar(t.texto))).join('');
}

function bloques(ps: Parrafo[]): string {
  let html = '';
  let lista = false;
  for (const p of ps) {
    if (p.tipo === 'li' && !lista) (html += '<ul>'), (lista = true);
    if (p.tipo !== 'li' && lista) (html += '</ul>'), (lista = false);
    html += p.tipo === 'h' ? `<h3>${enLinea(p)}</h3>` : p.tipo === 'li' ? `<li>${enLinea(p)}</li>` : `<p>${enLinea(p)}</p>`;
  }
  return lista ? `${html}</ul>` : html;
}

const imagen = (f: FotoRelleno) => `<img src="${escapar(f.url)}" alt="${escapar(f.pie ?? f.nombre)}" style="max-width:100%;max-height:45vh">`;

const tablaHtml = (filas: string[][], cabecera: boolean) =>
  `<table border="1" cellpadding="6" style="border-collapse:collapse">${filas
    .map((f, i) => `<tr>${f.map((c) => (i === 0 && cabecera && filas.length > 1 ? `<th>${escapar(c)}</th>` : `<td>${escapar(c)}</td>`)).join('')}</tr>`)
    .join('')}</table>`;

/** Textos fijos de una plantilla HTML (para traducirlos), sin los que solo son marcadores. */
export function textosFijosHtml(html: string): string[] {
  const cuerpo = html.replace(/<head[\s\S]*?<\/head>/i, '');
  const textos = [...cuerpo.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter((t) => /\p{L}/u.test(t.replace(MARCADOR, '')));
  return [...new Set(textos)];
}

/** Marcadores de una plantilla HTML: `solo` si es lo único de su párrafo; los de imágenes, en `alt`. */
export function marcadoresHtml(html: string): { original: string; solo: boolean; enTabla: boolean; enAlt: boolean }[] {
  const enAlt = [...html.matchAll(/<img\b[^>]*\balt="(\{\{[^{}"]+\}\})"/g)].map((m) => ({ original: m[1], solo: true, enTabla: false, enAlt: true }));
  const sinAlt = html.replace(/<img\b[^>]*>/g, '');
  const solos = new Set([...sinAlt.matchAll(/<p\b[^>]*>\s*(\{\{[^{}]+\}\})\s*<\/p>/g)].map((m) => m.index! + m[0].indexOf(m[1])));
  const tablas = [...sinAlt.matchAll(/<table\b[\s\S]*?<\/table>/g)].map((m) => [m.index!, m.index! + m[0].length]);
  const resto = [...sinAlt.matchAll(MARCADOR)].map((m) => ({
    original: m[0],
    solo: solos.has(m.index!),
    enTabla: tablas.some(([a, b]) => m.index! > a && m.index! < b),
    enAlt: false,
  }));
  return [...resto, ...enAlt];
}

// ── Cambiar la estructura («Cambiar con IA») ────────────────────────────────

export interface BloqueHtml {
  id: string;
  tipo: 'titulo' | 'parrafo' | 'celda' | 'imagen';
  texto: string;
  /** El elemento entero, [inicio, fin) en el HTML. */
  inicio: number;
  fin: number;
  /** El contenido del elemento, entre sus etiquetas. */
  interior: [number, number];
  /** La etiqueta de apertura (para copiar el estilo de un título). */
  apertura: string;
}

const desescapar = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/** Títulos, párrafos, celdas e imágenes del cuerpo, en orden (como bloquesDoc en Docs). */
export function bloquesHtml(html: string): BloqueHtml[] {
  const cuerpo = Math.max(0, html.search(/<body\b/i));
  const bloques: BloqueHtml[] = [];
  let n = 0;
  for (const m of html.slice(cuerpo).matchAll(/<(h[1-6]|p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi)) {
    const inicio = cuerpo + m.index!;
    const fin = inicio + m[0].length;
    const apertura = m[0].slice(0, m[0].indexOf('>') + 1);
    if (!m[1]) {
      const alt = m[0].match(/\balt="([^"]*)"/)?.[1];
      bloques.push({ id: `B${++n}`, tipo: 'imagen', texto: `[imagen${alt ? `: ${desescapar(alt)}` : ''}]`, inicio, fin, interior: [fin, fin], apertura });
      continue;
    }
    const texto = desescapar(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const etiqueta = m[1].toLowerCase();
    bloques.push({
      id: `B${++n}`,
      tipo: etiqueta.startsWith('h') ? 'titulo' : etiqueta === 'td' || etiqueta === 'th' ? 'celda' : 'parrafo',
      texto,
      inicio,
      fin,
      interior: [inicio + apertura.length, fin - `</${m[1]}>`.length],
      apertura,
    });
  }
  return bloques;
}

/** El HTML con los cambios ya validados (ver dominio/cambiosPlantilla.ts). */
export function aplicarCambiosHtml(html: string, cambios: CambioDocumento[]): string {
  const bloques = bloquesHtml(html);
  const porId = new Map(bloques.map((b) => [b.id, b]));
  const cortes: { inicio: number; fin: number; texto: string; orden: number }[] = [];
  for (const c of cambios) {
    const b = porId.get(c.bloque);
    if (!b) continue;
    if (c.accion === 'borrar') cortes.push({ inicio: b.inicio, fin: b.fin, texto: '', orden: 0 });
    else if (c.accion === 'insertar') {
      // Un título nuevo copia la etiqueta (y el estilo) del último título de antes.
      const previo = bloques
        .slice(0, bloques.indexOf(b) + 1)
        .reverse()
        .find((x) => x.tipo === 'titulo');
      const abre = c.estilo === 'titulo' ? (previo?.apertura ?? '<h2>') : '<p>';
      const etiqueta = abre.match(/^<(\w+)/)![1];
      const orden = 2 - cambios.indexOf(c) / cambios.length;
      // En una celda, otra línea dentro de la misma celda.
      if (b.tipo === 'celda') cortes.push({ inicio: b.interior[1], fin: b.interior[1], texto: `<br>${escapar(c.texto)}`, orden });
      else cortes.push({ inicio: b.fin, fin: b.fin, texto: `\n${abre}${escapar(c.texto)}</${etiqueta}>`, orden });
    } else {
      const interior = html.slice(b.interior[0], b.interior[1]);
      const k = interior.indexOf(escapar(c.buscar)) >= 0 ? interior.indexOf(escapar(c.buscar)) : interior.indexOf(c.buscar);
      if (k < 0) continue;
      const largo = interior.indexOf(escapar(c.buscar)) >= 0 ? escapar(c.buscar).length : c.buscar.length;
      cortes.push({ inicio: b.interior[0] + k, fin: b.interior[0] + k + largo, texto: escapar(c.texto), orden: 0 });
    }
  }
  // Del final al principio. En un mismo sitio, primero lo que se quita y luego lo que se añade,
  // del último al primero (así quedan en su orden).
  let salida = html;
  for (const x of cortes.sort((a, b) => b.inicio - a.inicio || a.orden - b.orden)) salida = salida.slice(0, x.inicio) + x.texto + salida.slice(x.fin);
  return salida;
}

export function rellenarHtml(html: string, r: Relleno): { html: string; resultado: ResultadoRelleno } {
  const desconocidos: string[] = [];
  let salida = html;

  for (const [original, traducido] of Object.entries(r.traducciones ?? {})) {
    salida = salida.split(`>${escapar(original)}<`).join(`>${escapar(traducido)}<`);
  }

  // Imágenes con el marcador en el texto alternativo: se cambia la foto.
  salida = salida.replace(/<img\b[^>]*\balt="\{\{([^{}"]+)\}\}"[^>]*>/g, (todo, interior: string) => {
    const m = leerMarcador(interior);
    const foto = m?.tipo === 'foto' ? fotoDe(m.clave, r) : null;
    if (!foto) desconocidos.push(`{{${interior}}}`);
    return foto ? imagen(foto) : todo;
  });

  const sustituir = (interior: string, enBloque: boolean): string => {
    const m = leerMarcador(interior);
    const original = `{{${interior}}}`;
    if (m?.tipo === 'foto' || m?.tipo === 'fotos') {
      const fotos = m.tipo === 'foto' ? [fotoDe(m.clave, r)].filter((f): f is FotoRelleno => !!f) : (r.fotos[m.clave] ?? []);
      if (!fotos.length && m.tipo === 'foto') desconocidos.push(original);
      if (!fotos.length) return m.tipo === 'fotos' ? '' : `<mark>[foto]</mark>`;
      const figuras = fotos.map((f) => `<figure style="display:inline-block;margin:6px;vertical-align:top">${imagen(f)}${f.pie ? `<figcaption>${escapar(f.pie)}</figcaption>` : ''}</figure>`).join('');
      return enBloque ? `<div>${figuras}</div>` : figuras;
    }
    if (m?.tipo === 'tabla') {
      const filas = r.tablas[m.clave];
      if (!filas?.length) desconocidos.push(original);
      return filas?.length ? tablaHtml(filas, !r.tablasSinCabecera?.includes(m.clave)) : enLinea(huecoDe(m, original));
    }
    const ps = m ? contenidoDe(m, r) : null;
    if (!ps) desconocidos.push(original);
    const contenido = ps ?? [huecoDe(m, original)];
    return enBloque ? bloques(contenido) : enLinea(enUnaLinea(contenido));
  };

  // Un marcador solo en su párrafo se convierte en bloques; dentro de una frase, en texto en línea.
  salida = salida.replace(/<p\b[^>]*>\s*\{\{([^{}]+)\}\}\s*<\/p>/g, (_, interior: string) => sustituir(interior, true));
  salida = salida.replace(MARCADOR, (_, interior: string) => sustituir(interior, false));

  return { html: salida, resultado: { desconocidos: [...new Set(desconocidos)], fotosFallidas: [] } };
}
