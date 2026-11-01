// S3 · Conversión de una plantilla de donante (.docx o .pptx) a Google, y qué ve la API.
//   node scripts/pruebas/s3-conversion.mjs <archivo.docx|archivo.pptx> [más archivos…]
// Sube el original a «_Pruebas técnicas», lo copia convirtiéndolo (como hará `copiarConvirtiendo`)
// y resume lo que queda: estilos de título, tablas, encabezados, imágenes en línea y flotantes
// (con su texto alternativo), cuadros de texto y si su texto es visible para la API.

import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { DOCS, DRIVE, SLIDES, carpetaPruebas, google, guardar, tokenGoogle } from './comun.mjs';

const MIME = {
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.google-apps.document'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.google-apps.presentation'],
  '.pdf': ['application/pdf', 'application/vnd.google-apps.document'],
};

async function subir(ruta, carpeta) {
  const [mime] = MIME[extname(ruta).toLowerCase()];
  const limite = 'l' + Date.now();
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: basename(ruta), parents: [carpeta] })}\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`),
    readFileSync(ruta),
    Buffer.from(`\r\n--${limite}--`),
  ]);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await tokenGoogle()}`, 'Content-Type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  if (!res.ok) throw new Error(`subida ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

const texto = (els = []) => els.map((x) => x.textRun?.content ?? '').join('');

function resumirDoc(d) {
  const titulos = [];
  const parrafos = [];
  let tablas = 0;
  (function rec(c) {
    for (const e of c ?? []) {
      if (e.paragraph) {
        const t = texto(e.paragraph.elements).trim();
        const estilo = e.paragraph.paragraphStyle?.namedStyleType;
        if (t) parrafos.push(t);
        if (estilo && estilo !== 'NORMAL_TEXT' && t) titulos.push(`${estilo}: ${t.slice(0, 50)}`);
      }
      if (e.table) {
        tablas++;
        for (const f of e.table.tableRows) for (const cel of f.tableCells) rec(cel.content);
      }
    }
  })(d.body.content);
  const enLinea = Object.values(d.inlineObjects ?? {}).map((o) => o.inlineObjectProperties.embeddedObject);
  const flotantes = Object.values(d.positionedObjects ?? {}).map((o) => o.positionedObjectProperties.embeddedObject);
  const todo = JSON.stringify(d);
  return {
    titulos,
    tablas,
    encabezados: Object.values(d.headers ?? {}).map((h) => h.content.map((e) => texto(e.paragraph?.elements)).join('').trim()),
    imagenesEnLinea: enLinea.map((o) => ({ alt: o.description ?? o.title ?? '', ancho: o.size?.width?.magnitude })),
    objetosFlotantes: flotantes.map((o) => ({ alt: o.description ?? o.title ?? '', tipo: o.imageProperties ? 'imagen' : o.embeddedDrawingProperties ? 'dibujo' : 'otro' })),
    textoDelCuadroVisible: todo.includes('TEXTO EN CUADRO'),
    parrafos: parrafos.length,
    fuentes: [...new Set([...todo.matchAll(/"fontFamily":"([^"]+)"/g)].map((m) => m[1]))],
  };
}

function resumirPres(p) {
  return p.slides.map((s, i) => ({
    diapositiva: i + 1,
    elementos: s.pageElements.map((e) => (e.shape ? `forma:${e.shape.shapeType}:${(e.shape.text?.textElements ?? []).map((t) => t.textRun?.content ?? '').join('').trim().slice(0, 40)}` : e.image ? `imagen(alt:${e.description ?? e.title ?? ''})` : e.table ? 'tabla' : Object.keys(e).find((k) => !['objectId', 'size', 'transform', 'title', 'description'].includes(k)))),
  }));
}

const carpeta = await carpetaPruebas();
for (const ruta of process.argv.slice(2)) {
  const ext = extname(ruta).toLowerCase();
  if (!MIME[ext]) {
    console.log('Se omite (formato no previsto):', ruta);
    continue;
  }
  console.log(`\n══ ${basename(ruta)}`);
  const original = await subir(ruta, carpeta);
  const inicio = Date.now();
  const copia = await google(`${DRIVE}/files/${original}/copy?supportsAllDrives=true&fields=id,mimeType`, {
    metodo: 'POST',
    cuerpo: { name: `${basename(ruta, ext)} (convertido)`, mimeType: MIME[ext][1], parents: [carpeta] },
  });
  console.log(`Convertido en ${Date.now() - inicio} ms →`, copia.mimeType.endsWith('presentation') ? `https://docs.google.com/presentation/d/${copia.id}/edit` : `https://docs.google.com/document/d/${copia.id}/edit`);
  if (copia.mimeType.endsWith('document')) {
    const d = await google(`${DOCS}/${copia.id}`);
    guardar(`s3-${basename(ruta, ext)}.json`, d);
    console.log(JSON.stringify(resumirDoc(d), null, 2));
  } else {
    const p = await google(`${SLIDES}/${copia.id}`);
    guardar(`s3-${basename(ruta, ext)}.json`, p);
    console.log(JSON.stringify(resumirPres(p), null, 2));
  }
}
