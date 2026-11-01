// S4 · Sustitución de marcadores en Google Docs conservando el estilo de la plantilla.
//   node scripts/pruebas/s4-marcadores.mjs
// Crea un Doc de prueba en «_Pruebas técnicas» (unidad Sistema) y comprueba:
//   - encontrar marcadores aunque un cambio de formato los parta en varios fragmentos;
//   - insertar texto "dentro" del marcador para heredar su estilo (fuente, tamaño, color);
//   - Markdown restringido: párrafos, viñetas, negrita, ### como Título 3, [PENDIENTE: x] resaltado;
//   - marcadores en tablas y en el encabezado;
//   - insertar una tabla de datos y la fórmula de índices de sus celdas;
//   - requiredRevisionId (rechazo si el documento cambió).

import { DOCS, carpetaPruebas, docDesdeHtml, google, guardar } from './comun.mjs';

const HTML = `<html><body>
<h1>Informe de {{proyecto.titulo}}</h1>
<p style="font-family: Georgia; font-size: 13pt; color: #1f4e79">{{ia:resumen}}</p>
<p>🌍 El proyecto en <b>{{proyecto.pais}}</b> cuesta {{proyecto.presupuesto}} en total.</p>
<p style="font-family: Arial; font-size: 11pt">{{ia:<b>avance</b>}}</p>
<ul><li>{{ia:lista}}</li></ul>
<table border="1"><tr><td>Código</td><td>{{proyecto.codigo}}</td></tr><tr><td>Situación</td><td>{{ia:celda}}</td></tr></table>
<p>{{tabla:presupuesto}}</p>
<p>{{foto:portada}}</p>
<p>Texto fijo final.</p>
</body></html>`;

const VALORES = {
  'proyecto.titulo': 'Aula en Kinshasa',
  'proyecto.pais': 'R. D. del Congo',
  'proyecto.presupuesto': '18.000 €',
  'proyecto.codigo': 'P-2026-014',
  'informe.fecha': '1 de noviembre de 2026',
  'ia:resumen':
    'Primer párrafo del resumen, con una **frase en negrita** en medio.\n### Un subtítulo\nSegundo párrafo: la escuela atiende a [PENDIENTE: nº de alumnos] niños.\n- Primera viñeta\n- Segunda viñeta con **negrita**',
  'ia:avance': 'Texto del avance que sustituye a un marcador partido por la negrita.',
  'ia:lista': 'Elemento uno\nElemento dos\nElemento tres',
  'ia:celda': 'En ejecución, con [PENDIENTE: fecha de fin] prevista.',
};

const MARCADOR = /\{\{\s*([^{}]+?)\s*\}\}/g;

// ── Lectura: marcadores con su posición, uniendo los fragmentos de cada párrafo ──

function recorrer(elementos, seg, salida, enTabla = false) {
  for (const e of elementos ?? []) {
    if (e.paragraph) {
      const els = e.paragraph.elements ?? [];
      if (!els.length) continue;
      const base = els[0].startIndex ?? 0;
      let texto = '';
      for (const x of els) texto += x.textRun ? x.textRun.content : '￼'.repeat((x.endIndex ?? 0) - (x.startIndex ?? 0));
      const sinSalto = texto.replace(/\n$/, '');
      for (const m of texto.matchAll(MARCADOR)) {
        salida.push({
          marcador: m[1].replace(/\s+/g, ''),
          inicio: base + m.index,
          fin: base + m.index + m[0].length,
          seg,
          solo: sinSalto.trim() === m[0],
          enLista: !!e.paragraph.bullet,
          enTabla,
        });
      }
    } else if (e.table) {
      for (const f of e.table.tableRows ?? []) for (const c of f.tableCells ?? []) recorrer(c.content, seg, salida, true);
    }
  }
  return salida;
}

function marcadores(doc) {
  const lista = recorrer(doc.body?.content, '', []);
  for (const [id, h] of Object.entries(doc.headers ?? {})) recorrer(h.content, id, lista);
  return lista;
}

// ── Markdown restringido → texto plano y estilos ──

function parsear(md) {
  const lineas = [];
  for (const crudo of md.split('\n')) {
    let tipo = 'p';
    let l = crudo;
    if (/^###\s+/.test(l)) (tipo = 'h'), (l = l.replace(/^###\s+/, ''));
    else if (/^-\s+/.test(l)) (tipo = 'li'), (l = l.replace(/^-\s+/, ''));
    const trozos = [];
    let texto = '';
    for (const p of l.split(/(\*\*[^*]+\*\*|\[PENDIENTE:[^\]]*\])/)) {
      if (!p) continue;
      if (p.startsWith('**')) trozos.push({ desde: texto.length, texto: p.slice(2, -2), negrita: true }), (texto += p.slice(2, -2));
      else if (p.startsWith('[PENDIENTE:')) {
        const t = `[${p.slice(11, -1).trim()}]`;
        trozos.push({ desde: texto.length, texto: t, pendiente: true });
        texto += t;
      } else texto += p;
    }
    lineas.push({ tipo, texto, trozos });
  }
  return lineas;
}

const AMARILLO = { color: { rgbColor: { red: 1, green: 0.93, blue: 0.4 } } };

/** Peticiones para sustituir un marcador por un texto (ya ordenadas para aplicarse en este punto). */
function sustituir(m, valor) {
  const rango = (a, b) => ({ startIndex: a, endIndex: b, ...(m.seg ? { segmentId: m.seg } : {}) });
  const lineas = m.solo ? parsear(valor) : [{ tipo: 'p', ...parsear(valor.replace(/\n+/g, ' '))[0] }];
  const s = lineas.map((l) => l.texto).join('\n');
  const r = [
    // Dentro del marcador: el texto hereda el estilo del carácter anterior, que ya es del marcador.
    { insertText: { location: { index: m.inicio + 1, ...(m.seg ? { segmentId: m.seg } : {}) }, text: s } },
    { deleteContentRange: { range: rango(m.inicio + 1 + s.length, m.fin + s.length) } },
    { deleteContentRange: { range: rango(m.inicio, m.inicio + 1) } },
  ];
  let pos = m.inicio;
  const vinetas = [];
  for (const l of lineas) {
    const a = pos;
    const b = pos + l.texto.length;
    if (l.tipo === 'h') {
      r.push({ updateParagraphStyle: { range: rango(a, b), paragraphStyle: { namedStyleType: 'HEADING_3' }, fields: 'namedStyleType' } });
      // El texto heredó un estilo explícito del marcador; se quita para que mande el del título.
      r.push({ updateTextStyle: { range: rango(a, b), textStyle: {}, fields: 'bold,italic,fontSize,weightedFontFamily,foregroundColor' } });
    }
    for (const t of l.trozos) {
      const ra = rango(a + t.desde, a + t.desde + t.texto.length);
      if (t.negrita) r.push({ updateTextStyle: { range: ra, textStyle: { bold: true }, fields: 'bold' } });
      if (t.pendiente) r.push({ updateTextStyle: { range: ra, textStyle: { backgroundColor: AMARILLO, bold: true }, fields: 'backgroundColor,bold' } });
    }
    if (l.tipo === 'li' && !m.enLista) vinetas.push([a, b]);
    pos = b + 1;
  }
  for (const [a, b] of vinetas) r.push({ createParagraphBullets: { range: rango(a, b), bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
  return r;
}

const batch = (id, requests, revision) =>
  google(`${DOCS}/${id}:batchUpdate`, { metodo: 'POST', cuerpo: { requests, ...(revision ? { writeControl: { requiredRevisionId: revision } } : {}) } });

// ── Prueba ──

const carpeta = await carpetaPruebas();
const id = await docDesdeHtml(`S4 marcadores ${new Date().toISOString().slice(0, 16)}`, HTML, carpeta);
console.log('Doc:', `https://docs.google.com/document/d/${id}/edit`);

// Encabezado con marcadores (el HTML importado no trae encabezados).
const h = await batch(id, [{ createHeader: { type: 'DEFAULT' } }]);
const headerId = h.replies[0].createHeader.headerId;
await batch(id, [{ insertText: { location: { segmentId: headerId, index: 0 }, text: '{{proyecto.codigo}} · {{informe.fecha}}' } }]);

const antes = await google(`${DOCS}/${id}`);
guardar('s4-antes.json', antes);
const ms = marcadores(antes);
console.log('\nMarcadores encontrados:');
for (const m of ms) console.log(`  ${m.marcador.padEnd(22)} ${m.seg ? 'encabezado' : 'cuerpo'} [${m.inicio},${m.fin}) solo=${m.solo} lista=${m.enLista} tabla=${m.enTabla}`);

// Estilo del marcador antes de sustituir, para comparar.
function estiloEn(doc, indice, seg = '') {
  const contenido = seg ? doc.headers[seg].content : doc.body.content;
  const pila = [...contenido];
  while (pila.length) {
    const e = pila.shift();
    if (e.table) for (const f of e.table.tableRows) for (const c of f.tableCells) pila.push(...c.content);
    for (const x of e.paragraph?.elements ?? []) if (x.textRun && x.startIndex <= indice && indice < x.endIndex) return { estilo: x.textRun.textStyle, parrafo: e.paragraph.paragraphStyle?.namedStyleType, vineta: !!e.paragraph.bullet };
  }
  return null;
}
const estilosAntes = Object.fromEntries(ms.map((m) => [m.marcador, estiloEn(antes, m.inicio, m.seg)]));

// Pasada 1: datos y textos, del final al principio por segmento. Las tablas y fotos esperan.
const pasada1 = ms.filter((m) => VALORES[m.marcador] !== undefined).sort((a, b) => (a.seg === b.seg ? b.inicio - a.inicio : a.seg.localeCompare(b.seg)));
const requests = pasada1.flatMap((m) => sustituir(m, VALORES[m.marcador]));
await batch(id, requests, antes.revisionId);
console.log(`\nPasada 1: ${pasada1.length} marcadores, ${requests.length} peticiones en un solo batchUpdate.`);

// Pasada 2: tabla de datos en lugar de {{tabla:presupuesto}}.
let doc = await google(`${DOCS}/${id}`);
const mt = marcadores(doc).find((m) => m.marcador === 'tabla:presupuesto');
const FILAS = [
  ['Concepto', 'Importe'],
  ['Cimientos', '4.000 €'],
  ['Tejado y estructura', '9.500 €'],
  ['Total', '13.500 €'],
];
const C = FILAS[0].length;
await batch(id, [{ deleteContentRange: { range: { startIndex: mt.inicio, endIndex: mt.fin } } }, { insertTable: { rows: FILAS.length, columns: C, location: { index: mt.inicio } } }]);
const celda = (r, c) => mt.inicio + 4 + r * (2 * C + 1) + 2 * c; // fórmula a comprobar
const relleno = [];
for (let r = FILAS.length - 1; r >= 0; r--) for (let c = C - 1; c >= 0; c--) relleno.push({ insertText: { location: { index: celda(r, c) }, text: FILAS[r][c] } });
await batch(id, relleno);
doc = await google(`${DOCS}/${id}`);
const tablas = doc.body.content.filter((e) => e.table);
const nueva = tablas[tablas.length - 1].table;
const leidas = nueva.tableRows.map((f) => f.tableCells.map((c) => c.content.map((p) => (p.paragraph.elements ?? []).map((x) => x.textRun?.content ?? '').join('')).join('').replace(/\n$/, '')));
const formulaOk = JSON.stringify(leidas) === JSON.stringify(FILAS);
console.log('Pasada 2: tabla insertada; fórmula de índices de celdas', formulaOk ? 'CORRECTA' : `INCORRECTA → ${JSON.stringify(leidas)}`);
// Cabecera en negrita (el texto de la fila 0 está ya en su sitio).
const fila0 = nueva.tableRows[0].tableCells.map((c) => [c.content[0].startIndex, c.content[0].endIndex - 1]);
await batch(id, fila0.map(([a, b]) => ({ updateTextStyle: { range: { startIndex: a, endIndex: b }, textStyle: { bold: true }, fields: 'bold' } })));

// requiredRevisionId: una revisión vieja debe rechazarse.
let rechazo = 'NO SE RECHAZÓ';
try {
  await batch(id, [{ insertText: { location: { index: 1 }, text: 'x' } }], antes.revisionId);
} catch (e) {
  rechazo = `rechazado con ${e.status}`;
}
console.log('requiredRevisionId con revisión vieja:', rechazo);

// ── Comprobaciones ──
doc = await google(`${DOCS}/${id}`);
guardar('s4-despues.json', doc);
const restantes = marcadores(doc).map((m) => m.marcador);
console.log('\nMarcadores que quedan:', restantes.join(', ') || '(ninguno)');

const parrafos = [];
(function todos(els, seg) {
  for (const e of els ?? []) {
    if (e.paragraph) parrafos.push({ seg, p: e.paragraph, texto: (e.paragraph.elements ?? []).map((x) => x.textRun?.content ?? '').join('') });
    if (e.table) for (const f of e.table.tableRows) for (const c of f.tableCells) todos(c.content, seg);
  }
})(doc.body.content, '');
for (const [hid, hh] of Object.entries(doc.headers ?? {})) for (const e of hh.content) if (e.paragraph) parrafos.push({ seg: hid, p: e.paragraph, texto: e.paragraph.elements.map((x) => x.textRun?.content ?? '').join('') });

const buscar = (t) => parrafos.find((x) => x.texto.includes(t));
const run = (par, t) => par?.p.elements.find((x) => x.textRun?.content.includes(t))?.textRun.textStyle;
const comprobar = (nombre, ok, detalle = '') => console.log(`  ${ok ? '✔' : '✘'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);

console.log('\nComprobaciones:');
const pRes = buscar('Primer párrafo');
const eRes = estilosAntes['ia:resumen'].estilo;
const sRes = run(pRes, 'Primer párrafo');
comprobar('el texto hereda la fuente del marcador', sRes?.weightedFontFamily?.fontFamily === eRes?.weightedFontFamily?.fontFamily, `${eRes?.weightedFontFamily?.fontFamily} → ${sRes?.weightedFontFamily?.fontFamily}`);
comprobar('el texto hereda el tamaño', sRes?.fontSize?.magnitude === eRes?.fontSize?.magnitude, `${eRes?.fontSize?.magnitude} → ${sRes?.fontSize?.magnitude}`);
comprobar('el texto hereda el color', JSON.stringify(sRes?.foregroundColor) === JSON.stringify(eRes?.foregroundColor));
comprobar('negrita en medio de la frase', run(pRes, 'frase en negrita')?.bold === true);
const pH = buscar('Un subtítulo');
comprobar('### pasa a Título 3', pH?.p.paragraphStyle?.namedStyleType === 'HEADING_3', pH?.p.paragraphStyle?.namedStyleType);
comprobar('el título no arrastra la fuente del marcador', !run(pH, 'Un subtítulo')?.weightedFontFamily, JSON.stringify(run(pH, 'Un subtítulo')?.weightedFontFamily ?? {}));
const pPend = buscar('nº de alumnos');
const sPend = run(pPend, '[nº de alumnos]');
comprobar('[PENDIENTE: x] → "[x]" resaltado', !!sPend?.backgroundColor, JSON.stringify(sPend?.backgroundColor ?? {}));
comprobar('viñetas creadas', !!buscar('Primera viñeta')?.p.bullet && !!buscar('Segunda viñeta')?.p.bullet);
comprobar('negrita dentro de viñeta', run(buscar('Segunda viñeta'), 'negrita')?.bold === true);
comprobar('marcador partido por la negrita encontrado y sustituido', !!buscar('Texto del avance'));
comprobar('las líneas dentro de una lista heredan la viñeta', ['Elemento uno', 'Elemento dos', 'Elemento tres'].every((t) => buscar(t)?.p.bullet));
comprobar('dato en línea con negrita conservada', run(buscar('R. D. del Congo'), 'R. D. del Congo')?.bold === true);
comprobar('offsets con emoji correctos', buscar('🌍')?.texto.startsWith('🌍 El proyecto en R. D. del Congo cuesta 18.000 € en total.'), buscar('🌍')?.texto.trim());
comprobar('marcador en celda de tabla', !!buscar('En ejecución, con'));
comprobar('pendiente resaltado en celda', !!run(buscar('En ejecución'), '[fecha de fin]')?.backgroundColor);
comprobar('marcadores del encabezado', parrafos.some((x) => x.seg && x.texto.startsWith('P-2026-014 · 1 de noviembre de 2026')));
comprobar('título h1 con dato', buscar('Informe de Aula en Kinshasa')?.p.paragraphStyle?.namedStyleType === 'HEADING_1');
comprobar('tabla de datos: fórmula de celdas', formulaOk);
comprobar('requiredRevisionId rechaza revisión vieja', rechazo.startsWith('rechazado'), rechazo);
comprobar('solo queda {{foto:portada}} (para S2)', restantes.length === 1 && restantes[0] === 'foto:portada');
console.log('\nAbre el documento para verlo:', `https://docs.google.com/document/d/${id}/edit`);
guardar('s4-doc.json', { id });
