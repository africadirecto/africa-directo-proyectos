// Prueba de los compositores contra Google de verdad. No se ejecuta con `npm test`:
//   PRUEBAS_GOOGLE=1 npx vitest run src/lib/drive/plantillas.google.test.ts
// Usa .env.local y deja un Doc y una presentación en «_Pruebas técnicas» (unidad Sistema),
// con datos inventados y fotos públicas de Google, para revisarlos a ojo.

import { describe, expect, it } from 'vitest';
import type { Relleno } from '../dominio/marcadores';

const activa = !!process.env.PRUEBAS_GOOGLE;
if (activa) process.loadEnvFile('.env.local');

const PUBLICA = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
const ROTA = 'https://example.invalid/no-existe.jpg';

const PLANTILLA = `<html><body>
<h1>Informe de {{proyecto.titulo}}</h1>
<p style="font-family: Georgia; font-size: 13pt; color: #1f4e79">{{ia:resumen}}</p>
<p>El proyecto en <b>{{proyecto.pais}}</b> cuesta {{proyecto.presupuesto}}.</p>
<p style="font-family: Arial">{{ia:<b>avance</b>}}</p>
<ul><li>{{ia:lista}}</li></ul>
<table border="1"><tr><td>Código</td><td>{{proyecto.codigo}}</td></tr><tr><td>Situación</td><td>{{ia:sin_texto}}</td></tr></table>
<p>{{tabla:presupuesto}}</p>
<p>{{foto:portada}}</p>
<p>{{pie:portada}}</p>
<p>{{fotos:galeria}}</p>
<p>{{foto:rota}}</p>
<p><img src="${PUBLICA}" alt="{{foto:alt}}" width="150"></p>
<p>Un marcador raro: {{raro}}.</p>
<p>Texto fijo final.</p>
</body></html>`;

const relleno: Relleno = {
  datos: { 'proyecto.titulo': 'Aula en Kinshasa', 'proyecto.pais': 'R. D. del Congo', 'proyecto.presupuesto': '18.000 €', 'proyecto.codigo': 'P-2026-014' },
  textos: {
    resumen: '## Resumen\nPrimer párrafo con **negrita**.\n### Un subtítulo\nLa escuela atiende a [PENDIENTE: nº de alumnos] niños.\n* Primera\n* Segunda',
    avance: 'Texto del avance.',
    lista: 'Uno\nDos',
    titulo: 'Avance del **aula**',
    cuerpo: 'Cimientos hechos.\n- Muros al [PENDIENTE: porcentaje]',
  },
  fotos: {
    portada: [{ url: PUBLICA, nombre: 'portada.png', ancho: 544, alto: 184, pie: 'La obra en marzo' }],
    galeria: [
      { url: PUBLICA, nombre: 'g1.png', ancho: 544, alto: 184, pie: 'Primera' },
      { url: PUBLICA, nombre: 'g2.png', ancho: 544, alto: 184, pie: 'Segunda' },
      { url: PUBLICA, nombre: 'g3.png', ancho: 544, alto: 184 },
    ],
    rota: [{ url: ROTA, nombre: 'rota.jpg' }],
    alt: [{ url: PUBLICA, nombre: 'alt.png' }],
    logo: [{ url: PUBLICA, nombre: 'logo.png', ancho: 544, alto: 184 }],
    hueco: [{ url: PUBLICA, nombre: 'hueco.png' }],
    segunda: [{ url: PUBLICA, nombre: 'segunda.png' }],
  },
  tablas: { presupuesto: [['Concepto', 'Importe'], ['Cimientos', '4.000 €'], ['Total', '4.000 €']] },
  traducciones: { 'Texto fijo final.': 'Texte final.' },
};

describe.skipIf(!activa)('compositores contra Google', () => {
  it('Docs: rellena todos los tipos de marcador sin perder el formato', async () => {
    const { driveGoogle, apiGoogle } = await import('./google');
    const { rellenarDoc, encontrarMarcadores } = await import('./plantillaDocs');
    type Doc = import('./plantillaDocs').DocumentoDocs & Record<string, unknown>;
    const DOCS = 'https://docs.googleapis.com/v1/documents';
    const carpeta = await driveGoogle.carpetaHija('_Pruebas técnicas', driveGoogle.raizSistema);
    const { id } = await driveGoogle.htmlADoc(PLANTILLA, carpeta, `Compositor Docs ${new Date().toISOString().slice(0, 16)}`);
    const batch = (requests: object[]) => apiGoogle<{ replies: { createHeader?: { headerId: string } }[] }>(`${DOCS}/${id}:batchUpdate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) });
    const h = await batch([{ createHeader: { type: 'DEFAULT' } }]);
    await batch([{ insertText: { location: { segmentId: h.replies[0].createHeader!.headerId, index: 0 }, text: '{{proyecto.codigo}} {{foto:logo}}' } }]);
    console.log('Doc:', driveGoogle.urlDocumento(id));

    const resultado = await rellenarDoc(id, relleno);
    expect(resultado.fotosFallidas).toEqual(['rota.jpg']);
    expect(resultado.desconocidos.sort()).toEqual(['{{ia:sin_texto}}', '{{raro}}']);

    const doc = await apiGoogle<Doc>(`${DOCS}/${id}`);
    const json = JSON.stringify(doc);
    const restantes = encontrarMarcadores(doc).map((x) => x.original);
    expect(restantes).toEqual(['{{raro}}']); // se queda resaltado para el revisor
    expect(json).toContain('Texte final.');
    expect(json).toContain('[nº de alumnos]');
    expect(json).toContain('[sin texto]');
    expect(json).toContain('[foto: rota.jpg]');
    expect(json).toContain('La obra en marzo');
    expect(json).toContain('Cimientos');
    expect(json).toContain('HEADING_3');
    expect(json).toContain('"backgroundColor"');
    // portada + 3 de la galería + logo del encabezado + la imagen con alt (cambiada).
    expect(Object.keys(doc.inlineObjects ?? {}).length).toBe(6);
    // Estilo heredado del marcador.
    type Run = { content: string; textStyle?: { weightedFontFamily?: { fontFamily?: string }; fontSize?: { magnitude?: number } } };
    const runs: Run[] = [];
    for (const e of (doc.body?.content ?? []) as { paragraph?: { elements?: { textRun?: Run }[] } }[]) for (const x of e.paragraph?.elements ?? []) if (x.textRun) runs.push(x.textRun);
    const primero = runs.find((x) => x.content.startsWith('Primer párrafo'));
    // Al importar el HTML, Google a veces la guarda en minúsculas.
    expect(primero?.textStyle?.weightedFontFamily?.fontFamily?.toLowerCase()).toBe('georgia');
    expect(primero?.textStyle?.fontSize?.magnitude).toBe(13);

    // Repetir el relleno sobre el documento ya relleno no rompe nada ni duplica.
    const otra = await rellenarDoc(id, relleno);
    expect(otra.fotosFallidas).toEqual([]);
    const doc2 = await apiGoogle<Doc>(`${DOCS}/${id}`);
    expect(Object.keys(doc2.inlineObjects ?? {}).length).toBe(6);
  }, 180_000);

  it('las plantillas de la ONG llegan a Google con sus marcadores enteros y sin avisos', async () => {
    const { driveGoogle } = await import('./google');
    const { ES_DOC, ES_PRESENTACION } = await import('./tipos');
    const { rellenarPresentacion } = await import('./slides');
    const { DEFINICIONES, htmlDePlantilla, diapositivasDePlantilla } = await import('../dominio/plantillasApp');
    const { analizarEstructura, leerMarcadores } = await import('../dominio/plantillas');
    const carpeta = await driveGoogle.carpetaHija('_Pruebas técnicas', driveGoogle.raizSistema);
    const vacias = { general: '', campos: {} };
    for (const def of DEFINICIONES) {
      const { id } = await driveGoogle.htmlADoc(htmlDePlantilla(def), carpeta, `Plantilla ONG ${def.tipo} ${new Date().toISOString().slice(0, 16)}`);
      const r = analizarEstructura(await leerMarcadores(id, ES_DOC), def.tipo, 'docs', vacias);
      expect(r.avisos, def.tipo).toEqual([]);
      expect(r.estructura.campos.filter((c) => c.tipo === 'ia').map((c) => c.clave), def.tipo).toEqual(def.campos.map((c) => c.clave));
    }
    for (const def of DEFINICIONES.filter((d) => d.tipo === 'financiacion' || d.tipo === 'donante')) {
      const { id } = await driveGoogle.crearVacio(`Plantilla ONG ${def.tipo} (presentación)`, ES_PRESENTACION, carpeta);
      await rellenarPresentacion(id, { titulo: def.titulo, subtitulo: def.subtitulo }, diapositivasDePlantilla(def));
      const leidos = await leerMarcadores(id, ES_PRESENTACION);
      const r = analizarEstructura(leidos, def.tipo, 'slides', vacias);
      expect(r.avisos, `${def.tipo} (Slides)`).toEqual([]);
      if (def.portada) expect(leidos.find((l) => l.original === '{{foto:portada}}')?.soloEnRecuadro).toBe(true);
      console.log(`${def.tipo} (Slides):`, driveGoogle.urlPresentacion(id));
    }
  }, 300_000);

  it('adjuntos: texto de un Google Doc y de un .docx (copia temporal a la papelera); la IA describe una imagen', async () => {
    const { driveGoogle } = await import('./google');
    const { leerAdjuntos } = await import('../trabajos/materiales');
    const { describirImagen } = await import('../ia/informes');
    const carpeta = await driveGoogle.carpetaHija('_Pruebas técnicas', driveGoogle.raizSistema);
    const archivos = await driveGoogle.listar([carpeta]);
    const docx = archivos.find((a) => a.nombre === 'plantilla-donante-prueba.docx');
    const doc = archivos.find((a) => a.mime === 'application/vnd.google-apps.document' && a.nombre.startsWith('S4 marcadores'));
    expect(docx && doc, 'faltan los archivos de las pruebas S3 y S4 en «_Pruebas técnicas»').toBeTruthy();
    const material = (a: NonNullable<typeof docx>) => ({ id: a.id, nombre: a.nombre, fecha: a.creado, mime: a.mime, carpeta: 'seguimiento' as const, miniatura: '' });

    const textos = await leerAdjuntos([material(docx!), material(doc!)], [docx!.id, doc!.id]);
    expect(textos.map((t) => t.nombre)).toEqual([docx!.nombre, doc!.nombre]);
    expect(textos[0].texto).toContain('Actividades realizadas en el periodo');
    expect(textos[0].texto).toContain('Las lluvias de marzo');
    expect(textos[1].texto).toContain('Aula en Kinshasa');
    // La copia temporal del .docx ya no está (va a la papelera).
    const temporal = await driveGoogle.carpetaHija('_Temporal', driveGoogle.raizSistema);
    expect((await driveGoogle.listar([temporal])).length).toBe(0);

    const logo = Buffer.from(await (await fetch(PUBLICA)).arrayBuffer());
    const descripcion = await describirImagen(logo, 'image/png', { pista: 'Imagen de prueba' });
    console.log('Descripción:', descripcion);
    expect(descripcion.length).toBeGreaterThan(10);
  }, 180_000);

  it('plantilla desde un ejemplo: convertir el .docx, analizarlo con IA y escribir los marcadores', async () => {
    const { driveGoogle } = await import('./google');
    const { ES_DOC } = await import('./tipos');
    const { bloquesDoc, leerDoc, aplicarAnalisisDoc } = await import('./plantillaDocs');
    const { peticionEjemplo, analizarEjemploDirecto } = await import('../ia/plantillas');
    const { analizarEstructura, leerMarcadores } = await import('../dominio/plantillas');
    const carpeta = await driveGoogle.carpetaHija('_Pruebas técnicas', driveGoogle.raizSistema);
    const docx = (await driveGoogle.listar([carpeta])).find((a) => a.nombre === 'plantilla-donante-prueba.docx');
    expect(docx, 'falta el .docx de la prueba S3').toBeDefined();
    const { id } = await driveGoogle.copiarConvirtiendo(docx!.id, carpeta, `Plantilla desde ejemplo ${new Date().toISOString().slice(0, 16)}`, ES_DOC);
    console.log('Plantilla:', driveGoogle.urlDocumento(id));

    const bloques = bloquesDoc(await leerDoc(id));
    const analisis = await analizarEjemploDirecto(peticionEjemplo({ bloques, tipo: 'seguimiento', formato: 'docs', donante: 'Fundación de Ejemplo' }), bloques, 'seguimiento');
    console.log(JSON.stringify({ idioma: analisis.idioma, campos: analisis.campos, datos: analisis.datos, tablas: analisis.tablas, dudas: analisis.dudas, general: analisis.instrucciones.general }, null, 1));
    expect(analisis.campos.filter((c) => c.tipo === 'ia').length).toBeGreaterThanOrEqual(2);

    const avisos = await aplicarAnalisisDoc(id, bloques, analisis);
    console.log('Avisos:', avisos);
    const leidos = await leerMarcadores(id, ES_DOC);
    const { estructura } = analizarEstructura(leidos, 'seguimiento', 'docs', analisis.instrucciones);
    console.log('Estructura:', JSON.stringify(estructura));
    const texto = JSON.stringify(await leerDoc(id));
    // Lo propio del ejemplo ya no está; lo fijo, sí.
    expect(texto).not.toContain('Durante el primer semestre se han completado los cimientos');
    expect(texto).toContain('Actividades realizadas en el periodo');
    expect(estructura.campos.filter((c) => c.tipo === 'ia' && !c.huerfano).map((c) => c.clave).sort()).toEqual(analisis.campos.filter((c) => c.tipo === 'ia').map((c) => c.clave).sort());
  }, 300_000);

  it('Slides: textos con formato, fotos en recuadros y en imágenes con texto alternativo', async () => {
    const { driveGoogle, apiGoogle } = await import('./google');
    const { ES_PRESENTACION } = await import('./tipos');
    const { rellenarSlides, encontrarMarcadoresSlides } = await import('./plantillaSlides');
    type Pres = import('./plantillaSlides').PresentacionSlides;
    const SLIDES = 'https://slides.googleapis.com/v1/presentations';
    const carpeta = await driveGoogle.carpetaHija('_Pruebas técnicas', driveGoogle.raizSistema);
    const { id } = await driveGoogle.crearVacio(`Compositor Slides ${new Date().toISOString().slice(0, 16)}`, ES_PRESENTACION, carpeta);
    const p = await apiGoogle<Pres>(`${SLIDES}/${id}`);
    const pagina = p.slides![0].objectId;
    const EMU = 12700;
    const caja = (x: number, y: number, w: number, hh: number) => ({ pageObjectId: pagina, size: { width: { magnitude: w * EMU, unit: 'EMU' }, height: { magnitude: hh * EMU, unit: 'EMU' } }, transform: { scaleX: 1, scaleY: 1, translateX: x * EMU, translateY: y * EMU, unit: 'EMU' } });
    await apiGoogle(`${SLIDES}/${id}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { createShape: { objectId: 't_titulo', shapeType: 'TEXT_BOX', elementProperties: caja(20, 10, 600, 40) } },
          { insertText: { objectId: 't_titulo', text: '{{ia:titulo}} · {{proyecto.codigo}}' } },
          { updateTextStyle: { objectId: 't_titulo', textRange: { type: 'ALL' }, style: { fontFamily: 'Georgia', fontSize: { magnitude: 20, unit: 'PT' } }, fields: 'fontFamily,fontSize' } },
          { createShape: { objectId: 't_cuerpo', shapeType: 'TEXT_BOX', elementProperties: caja(20, 60, 300, 200) } },
          { insertText: { objectId: 't_cuerpo', text: 'Avance\n{{ia:cuerpo}}\nTexto fijo final.' } },
          { createShape: { objectId: 't_hueco', shapeType: 'RECTANGLE', elementProperties: caja(340, 60, 300, 200) } },
          { insertText: { objectId: 't_hueco', text: '{{foto:hueco}}' } },
          { createImage: { objectId: 't_imagen', url: PUBLICA, elementProperties: caja(20, 280, 200, 70) } },
          { updatePageElementAltText: { objectId: 't_imagen', description: '{{foto:segunda}}' } },
        ],
      }),
    });
    console.log('Presentación:', driveGoogle.urlPresentacion(id));

    const resultado = await rellenarSlides(id, relleno);
    expect(resultado).toEqual({ desconocidos: [], fotosFallidas: [] });
    const p2 = await apiGoogle<Pres>(`${SLIDES}/${id}`);
    expect(encontrarMarcadoresSlides(p2)).toEqual([]);
    type Run = { content?: string; style?: { bold?: boolean; fontFamily?: string; backgroundColor?: { opaqueColor?: object } } };
    type Elem = { objectId: string; image?: object; shape?: { text?: { textElements?: { textRun?: Run; paragraphMarker?: { bullet?: object } }[] } } };
    const elementos = p2.slides![0].pageElements! as Elem[];
    const runs = (objectId: string) => (elementos.find((e) => e.objectId === objectId)?.shape?.text?.textElements ?? []).flatMap((x) => (x.textRun ? [x.textRun] : []));
    const textoDe = (objectId: string) => runs(objectId).map((x) => x.content).join('');
    expect(textoDe('t_titulo')).toBe('Avance del aula · P-2026-014\n');
    expect(textoDe('t_cuerpo')).toBe('Avance\nCimientos hechos.\nMuros al [porcentaje]\nTexte final.\n');
    // Hereda la fuente del marcador; negrita y resaltado donde toca; viñeta en su línea.
    expect(runs('t_titulo').every((x) => x.style?.fontFamily === 'Georgia')).toBe(true);
    expect(runs('t_titulo').find((x) => x.content === 'aula')?.style?.bold).toBe(true);
    expect(runs('t_cuerpo').filter((x) => x.style?.backgroundColor?.opaqueColor).map((x) => x.content?.trim())).toEqual(['[porcentaje]']);
    const parrafos = elementos.find((e) => e.objectId === 't_cuerpo')!.shape!.text!.textElements!.filter((x) => 'paragraphMarker' in x);
    expect(parrafos.map((x) => !!x.paragraphMarker?.bullet)).toEqual([false, false, true, false]);
    // El recuadro pasa a ser la foto (con el mismo identificador) y la imagen con alt se cambia.
    expect(elementos.find((e) => e.objectId === 't_hueco')?.image).toBeDefined();
    expect(elementos.filter((e) => e.image).length).toBe(2);
  }, 180_000);
});
