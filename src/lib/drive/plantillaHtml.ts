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

const tablaHtml = (filas: string[][]) =>
  `<table border="1" cellpadding="6" style="border-collapse:collapse">${filas
    .map((f, i) => `<tr>${f.map((c) => (i === 0 && filas.length > 1 ? `<th>${escapar(c)}</th>` : `<td>${escapar(c)}</td>`)).join('')}</tr>`)
    .join('')}</table>`;

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
      return filas?.length ? tablaHtml(filas) : enLinea(huecoDe(m, original));
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
