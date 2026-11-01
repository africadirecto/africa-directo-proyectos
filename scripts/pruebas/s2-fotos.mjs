// S2 · Fotos dentro de Docs y Slides.
//   node scripts/pruebas/s2-fotos.mjs
// Comprueba:
//   - insertInlineImage en el cuerpo, en una celda y en el encabezado, con ancho calculado;
//   - si el texto alternativo de una imagen importada sirve de marcador, y replaceImage sobre ella;
//   - Slides: replaceAllShapesWithImage sobre un recuadro con {{foto:…}};
//   - la miniatura de Drive a 1600 px con la cuenta de servicio (lo que serviría /api/foto) y si
//     esa misma URL funciona sin credenciales o pasándola directamente a Google (no debería).
// La ruta firmada de la app no se puede probar desde localhost: Google no llega. Queda para Vercel.

import { DOCS, DRIVE, SLIDES, carpetaPruebas, config, docDesdeHtml, google, guardar, tokenGoogle } from './comun.mjs';

const PUBLICA = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
const comprobar = (nombre, ok, detalle = '') => console.log(`  ${ok ? '✔' : '✘'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
const batch = (id, requests) => google(`${DOCS}/${id}:batchUpdate`, { metodo: 'POST', cuerpo: { requests } });

const carpeta = await carpetaPruebas();

// ── Docs ──
const HTML = `<html><body>
<p>{{foto:portada}}</p>
<table border="1"><tr><td>Antes</td><td>Después</td></tr><tr><td>{{foto:antes}}</td><td>texto</td></tr></table>
<p><img src="${PUBLICA}" alt="{{foto:alt}}" width="200"></p>
<p>Fin.</p>
</body></html>`;
const id = await docDesdeHtml(`S2 fotos ${new Date().toISOString().slice(0, 16)}`, HTML, carpeta);
console.log('Doc:', `https://docs.google.com/document/d/${id}/edit`);
const h = await batch(id, [{ createHeader: { type: 'DEFAULT' } }]);
const headerId = h.replies[0].createHeader.headerId;
await batch(id, [{ insertText: { location: { segmentId: headerId, index: 0 }, text: '{{foto:logo}}' } }]);

let doc = await google(`${DOCS}/${id}`);
guardar('s2-antes.json', doc);
const ds = doc.documentStyle;
const anchoPagina = ds.pageSize.width.magnitude - ds.marginLeft.magnitude - ds.marginRight.magnitude;
console.log('Página útil:', anchoPagina, ds.pageSize.width.unit);

// Posiciones de los marcadores de foto (texto plano, sin formato partido en esta prueba).
function buscar(contenido, seg, salida, celda = null) {
  for (const e of contenido ?? []) {
    if (e.paragraph) {
      for (const x of e.paragraph.elements ?? []) {
        const m = x.textRun?.content.match(/\{\{foto:(\w+)\}\}/);
        // Google omite startIndex cuando vale 0 (por ejemplo, al principio de un encabezado).
        if (m) salida.push({ clave: m[1], inicio: (x.startIndex ?? 0) + m.index, fin: (x.startIndex ?? 0) + m.index + m[0].length, seg, celda });
      }
    }
    if (e.table) {
      const anchos = e.table.tableStyle?.tableColumnProperties ?? [];
      e.table.tableRows.forEach((f) => f.tableCells.forEach((c, i) => buscar(c.content, seg, salida, { columna: i, ancho: anchos[i]?.width?.magnitude ?? null, columnas: f.tableCells.length })));
    }
  }
  return salida;
}
const fotos = buscar(doc.body.content, '', []);
buscar(doc.headers[headerId].content, headerId, fotos);
console.log('Marcadores de foto:', fotos.map((f) => `${f.clave}${f.seg ? ' (encabezado)' : ''}${f.celda ? ` (celda, ancho ${f.celda.ancho ?? 'auto'})` : ''}`).join(', '));

// Imagen importada: ¿conserva el alt como descripción?
const inline = Object.entries(doc.inlineObjects ?? {});
const conAlt = inline.find(([, o]) => JSON.stringify(o.inlineObjectProperties?.embeddedObject ?? {}).includes('{{foto:alt}}'));
console.log('Imágenes importadas:', inline.length, '· con el marcador en el texto alternativo:', !!conAlt, conAlt ? JSON.stringify({ title: conAlt[1].inlineObjectProperties.embeddedObject.title, description: conAlt[1].inlineObjectProperties.embeddedObject.description }) : '');

// Inserción, del final al principio dentro de cada segmento.
const ancho = (f) => (f.celda ? (f.celda.ancho ?? anchoPagina / f.celda.columnas) - 10 : f.seg ? 60 : anchoPagina);
const requests = [...fotos]
  .sort((a, b) => (a.seg === b.seg ? b.inicio - a.inicio : a.seg.localeCompare(b.seg)))
  .flatMap((f) => {
    const loc = f.seg ? { segmentId: f.seg } : {};
    return [
      { deleteContentRange: { range: { startIndex: f.inicio, endIndex: f.fin, ...loc } } },
      { insertInlineImage: { location: { index: f.inicio, ...loc }, uri: PUBLICA, objectSize: { width: { magnitude: ancho(f), unit: 'PT' } } } },
    ];
  });
try {
  await batch(id, requests);
  console.log('insertInlineImage en cuerpo, celda y encabezado: OK');
} catch (e) {
  console.log('insertInlineImage FALLÓ:', e.message);
}

// replaceImage sobre la imagen importada (como si su alt fuera {{foto:alt}}).
if (inline.length) {
  try {
    await batch(id, [{ replaceImage: { imageObjectId: inline[0][0], uri: PUBLICA, imageReplaceMethod: 'CENTER_CROP' } }]);
    console.log('replaceImage sobre imagen existente: OK');
  } catch (e) {
    console.log('replaceImage FALLÓ:', e.message);
  }
}

doc = await google(`${DOCS}/${id}`);
guardar('s2-despues.json', doc);
const objetos = Object.values(doc.inlineObjects ?? {}).map((o) => o.inlineObjectProperties.embeddedObject.size?.width?.magnitude);
console.log('\nComprobaciones Docs:');
comprobar('imágenes en el documento', objetos.length >= 4, `${objetos.length} imágenes, anchos ${objetos.map((w) => Math.round(w)).join(', ')} pt`);
comprobar('encabezado con imagen', JSON.stringify(doc.headers[headerId]).includes('inlineObjectElement'));
comprobar('no quedan marcadores de foto', !JSON.stringify(doc.body).includes('{{foto:') && !JSON.stringify(doc.headers).includes('{{foto:'));

// ── Miniatura de Drive con la cuenta de servicio ──
console.log('\nMiniatura de una foto real de Drive:');
const q = encodeURIComponent("mimeType contains 'image/' and trashed = false");
const r = await google(`${DRIVE}/files?q=${q}&corpora=drive&driveId=${config.unidadProyectos}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=1&fields=files(id,mimeType,size,thumbnailLink,imageMediaMetadata(width,height,rotation))`);
const foto = r.files?.[0];
if (!foto) console.log('  (no hay fotos en la unidad Proyectos; se omite)');
else {
  console.log('  foto:', foto.mimeType, `${Math.round(Number(foto.size) / 1024)} KB`, JSON.stringify(foto.imageMediaMetadata ?? {}), '· thumbnailLink:', !!foto.thumbnailLink);
  if (foto.thumbnailLink) {
    const grande = foto.thumbnailLink.replace(/=s\d+$/, '=s1600');
    const conToken = await fetch(grande, { headers: { Authorization: `Bearer ${await tokenGoogle()}` } });
    const bytes = (await conToken.arrayBuffer()).byteLength;
    comprobar('miniatura 1600 px con la cuenta de servicio', conToken.ok, `${conToken.status} ${conToken.headers.get('content-type')} ${Math.round(bytes / 1024)} KB`);
    const sinToken = await fetch(grande, { redirect: 'manual' });
    comprobar('la miniatura NO es accesible sin credenciales', !sinToken.ok, `sin token → ${sinToken.status}`);
    let directa = 'aceptada';
    try {
      await batch(id, [{ insertInlineImage: { location: { index: 1 }, uri: grande, objectSize: { width: { magnitude: 100, unit: 'PT' } } } }]);
    } catch (e) {
      directa = `rechazada (${e.status}): ${e.message.match(/"message": "([^"]+)/)?.[1] ?? e.message.slice(0, 200)}`;
    }
    comprobar('pasar la miniatura directamente a Docs no funciona (hace falta la ruta de la app)', directa !== 'aceptada', directa);
  }
}

// ── Slides ──
console.log('\nSlides:');
const pres = await google(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
  metodo: 'POST',
  cuerpo: { name: `S2 fotos ${new Date().toISOString().slice(0, 16)}`, mimeType: 'application/vnd.google-apps.presentation', parents: [carpeta] },
});
const p = await google(`${SLIDES}/${pres.id}`);
const pagina = p.slides[0].objectId;
const EMU = 12700;
await google(`${SLIDES}/${pres.id}:batchUpdate`, {
  metodo: 'POST',
  cuerpo: {
    requests: [
      { createShape: { objectId: 'hueco_foto', shapeType: 'RECTANGLE', elementProperties: { pageObjectId: pagina, size: { width: { magnitude: 300 * EMU, unit: 'EMU' }, height: { magnitude: 200 * EMU, unit: 'EMU' } }, transform: { scaleX: 1, scaleY: 1, translateX: 50 * EMU, translateY: 100 * EMU, unit: 'EMU' } } } },
      { insertText: { objectId: 'hueco_foto', text: '{{foto:portada}}' } },
    ],
  },
});
try {
  const rr = await google(`${SLIDES}/${pres.id}:batchUpdate`, {
    metodo: 'POST',
    cuerpo: { requests: [{ replaceAllShapesWithImage: { imageUrl: PUBLICA, imageReplaceMethod: 'CENTER_CROP', containsText: { text: '{{foto:portada}}', matchCase: true } } }] },
  });
  comprobar('replaceAllShapesWithImage', rr.replies?.[0]?.replaceAllShapesWithImage?.occurrencesChanged === 1, JSON.stringify(rr.replies?.[0]));
} catch (e) {
  comprobar('replaceAllShapesWithImage', false, e.message);
}
const p2 = await google(`${SLIDES}/${pres.id}`);
const img = p2.slides[0].pageElements.find((e) => e.image);
comprobar('la imagen ocupa el sitio del recuadro', !!img, img ? JSON.stringify({ ancho: (img.size.width.magnitude * (img.transform.scaleX ?? 1)) / EMU, alto: (img.size.height.magnitude * (img.transform.scaleY ?? 1)) / EMU, x: img.transform.translateX / EMU }) : '');
guardar('s2-slides.json', p2);
console.log('Presentación:', `https://docs.google.com/presentation/d/${pres.id}/edit`);
