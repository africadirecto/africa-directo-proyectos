// El compositor de Docs sobre documentos reales leídos de Google en las pruebas S2 y S4
// (scripts/pruebas). Lo que hace Google con las peticiones se probó allí contra la API.

import { describe, expect, it } from 'vitest';
import marcadoresDoc from './__fixtures__/docs-marcadores.json';
import fotosDoc from './__fixtures__/docs-fotos.json';
import {
  encontrarMarcadores,
  imagenesConMarcador,
  planFotos,
  planTablas,
  planTexto,
  planTraduccion,
  reemplazarRango,
  textosFijos,
  type DocumentoDocs,
  type ElementoDoc,
} from './plantillaDocs';
import type { Relleno } from '../dominio/marcadores';

const docM = marcadoresDoc as DocumentoDocs;
const docF = fotosDoc as DocumentoDocs;

/** Aplica las inserciones y borrados de texto a un segmento y devuelve su texto (sin estructura). */
function simular(doc: DocumentoDocs, requests: object[], seg = ''): string {
  const contenido = seg ? doc.headers![seg].content! : doc.body!.content!;
  const chars: string[] = [];
  const poner = (els: ElementoDoc[] = []) => {
    for (const e of els) {
      for (const x of e.paragraph?.elements ?? []) {
        const inicio = x.startIndex ?? 0;
        const t = x.textRun?.content ?? '￼'.repeat((x.endIndex ?? 0) - inicio);
        [...t].forEach((c, i) => (chars[inicio + i] = c));
      }
      for (const f of e.table?.tableRows ?? []) for (const c of f.tableCells ?? []) poner(c.content);
    }
  };
  poner(contenido);
  for (let i = 0; i < chars.length; i++) chars[i] ??= '\u0000';
  for (const r of requests as Record<string, { location?: { index: number; segmentId?: string }; range?: { startIndex: number; endIndex: number; segmentId?: string }; text?: string }>[]) {
    if (r.insertText && (r.insertText.location?.segmentId ?? '') === seg) chars.splice(r.insertText.location!.index, 0, ...r.insertText.text!.split(''));
    if (r.deleteContentRange && (r.deleteContentRange.range?.segmentId ?? '') === seg) {
      const { startIndex: a, endIndex: b } = r.deleteContentRange.range!;
      chars.splice(a, b - a);
    }
  }
  return chars.join('').replace(/\u0000/g, '');
}

const relleno: Relleno = {
  datos: {
    'proyecto.titulo': 'Aula en Kinshasa',
    'proyecto.pais': 'R. D. del Congo',
    'proyecto.presupuesto': '18.000 €',
    'proyecto.codigo': 'P-2026-014',
    'informe.fecha': '[PENDIENTE: fecha]',
  },
  textos: {
    resumen: 'Primer párrafo con **negrita**.\n### Un subtítulo\nLa escuela atiende a [PENDIENTE: nº de alumnos] niños.\n- Primera\n- Segunda',
    avance: 'Texto del avance.',
    lista: 'Uno\nDos',
    // «celda» no tiene texto: debe quedar resaltada como hueco.
  },
  fotos: { portada: [{ url: 'https://app/api/foto/t1', nombre: 'obra.jpg', ancho: 4080, alto: 3072 }] },
  tablas: {
    presupuesto: [
      ['Concepto', 'Importe'],
      ['Cimientos', '4.000 €'],
    ],
  },
};

describe('encontrar marcadores', () => {
  it('en cuerpo, tablas y encabezado, con las posiciones que dio Google', () => {
    const hs = encontrarMarcadores(docM).map((h) => [h.m?.tipo === 'dato' ? h.m.clave : `${h.m?.tipo}:${h.m?.clave}`, h.seg ? 'encabezado' : 'cuerpo', h.inicio, h.fin, h.solo, h.enLista, h.enTabla]);
    expect(hs).toEqual([
      ['proyecto.titulo', 'cuerpo', 12, 31, false, false, false],
      ['ia:resumen', 'cuerpo', 32, 46, true, false, false],
      ['proyecto.pais', 'cuerpo', 65, 82, false, false, false],
      ['proyecto.presupuesto', 'cuerpo', 90, 114, false, false, false],
      // Partido por la negrita en la plantilla: se encuentra igual.
      ['ia:avance', 'cuerpo', 125, 138, true, false, false],
      ['ia:lista', 'cuerpo', 139, 151, true, true, false],
      ['proyecto.codigo', 'cuerpo', 163, 182, true, false, true],
      ['ia:celda', 'cuerpo', 196, 208, true, false, true],
      ['tabla:presupuesto', 'cuerpo', 210, 231, true, false, false],
      ['foto:portada', 'cuerpo', 232, 248, true, false, false],
      ['proyecto.codigo', 'encabezado', 0, 19, false, false, false],
      ['informe.fecha', 'encabezado', 22, 39, false, false, false],
    ]);
  });

  it('el ancho disponible es el de la página o el de la columna', () => {
    const hs = encontrarMarcadores(docF);
    expect(hs.find((h) => h.m?.clave === 'portada')?.ancho).toBe(468);
    expect(hs.find((h) => h.m?.clave === 'antes')?.ancho).toBe(224);
    expect(hs.find((h) => h.m?.clave === 'logo')?.enCuerpo).toBe(false);
  });

  it('las imágenes con el marcador en su texto alternativo', () => {
    expect(imagenesConMarcador(docF)).toEqual([{ objeto: expect.any(String), clave: 'alt' }]);
  });

  it('los textos fijos, sin los párrafos que solo son marcadores', () => {
    const t = textosFijos(docM);
    expect(t).toContain('Texto fijo final.');
    expect(t).toContain('Informe de {{proyecto.titulo}}');
    expect(t).not.toContain('{{ia:resumen}}');
  });
});

describe('sustituir texto', () => {
  it('inserta dentro del marcador y lo borra después', () => {
    const ps = [{ tipo: 'p' as const, trozos: [{ texto: 'ab' }] }];
    expect(reemplazarRango('', 10, 20, ps, false)).toEqual([
      { insertText: { location: { index: 11 }, text: 'ab' } },
      { deleteContentRange: { range: { startIndex: 13, endIndex: 22 } } },
      { deleteContentRange: { range: { startIndex: 10, endIndex: 11 } } },
    ]);
  });

  it('el cuerpo y el encabezado quedan con el texto esperado', () => {
    const { requests, desconocidos } = planTexto(docM, relleno);
    const cuerpo = simular(docM, requests);
    expect(cuerpo).toContain('Informe de Aula en Kinshasa\n');
    expect(cuerpo).toContain('Primer párrafo con negrita.\nUn subtítulo\nLa escuela atiende a [nº de alumnos] niños.\nPrimera\nSegunda\n');
    expect(cuerpo).toContain('🌍 El proyecto en R. D. del Congo cuesta 18.000 € en total.\n');
    expect(cuerpo).toContain('Texto del avance.\nUno\nDos\n');
    expect(cuerpo).toContain('P-2026-014');
    expect(cuerpo).toContain('[celda]');
    // Las tablas y fotos esperan a sus pasadas.
    expect(cuerpo).toContain('{{tabla:presupuesto}}');
    expect(cuerpo).toContain('{{foto:portada}}');
    expect(simular(docM, requests, Object.keys(docM.headers!)[0])).toBe('P-2026-014 · [fecha]\n');
    expect(desconocidos).toEqual(['{{ia:celda}}']);
  });

  it('formato: negrita, título, resaltado y viñetas solo donde no las hay', () => {
    const { requests } = planTexto(docM, relleno);
    const tipos = requests.map((r) => Object.keys(r)[0]);
    expect(tipos.filter((t) => t === 'updateParagraphStyle')).toHaveLength(1);
    expect(requests.filter((r) => JSON.stringify(r).includes('backgroundColor'))).toHaveLength(3); // nº de alumnos, celda, fecha
    // Las dos viñetas del resumen van en una sola petición; las líneas de «lista» ya heredan la suya.
    expect(tipos.filter((t) => t === 'createParagraphBullets')).toHaveLength(1);
  });

  it('traducción del texto fijo', () => {
    const requests = planTraduccion(docM, { 'Texto fijo final.': 'Texte final.', 'Informe de {{proyecto.titulo}}': 'Rapport de {{proyecto.titulo}}' });
    const cuerpo = simular(docM, requests);
    expect(cuerpo).toContain('Texte final.\n');
    expect(cuerpo).toContain('Rapport de {{proyecto.titulo}}\n');
  });
});

describe('tablas y fotos', () => {
  it('tabla de datos con la fórmula de celdas comprobada en Google', () => {
    const { requests } = planTablas(docM, relleno);
    expect(requests.slice(0, 2)).toEqual([{ deleteContentRange: { range: { startIndex: 210, endIndex: 231 } } }, { insertTable: { rows: 2, columns: 2, location: { index: 210 } } }]);
    const celdas = requests.filter((r) => 'insertText' in r).map((r) => (r as { insertText: { location: { index: number }; text: string } }).insertText);
    // inicio + 4 + fila·(2·columnas + 1) + 2·columna, rellenando del final al principio.
    expect(celdas.map((c) => [c.location.index, c.text])).toEqual([
      [221, '4.000 €'],
      [219, 'Cimientos'],
      [216, 'Importe'],
      [214, 'Concepto'],
    ]);
    // Cabecera en negrita: «Importe» empieza tras «Concepto» ya insertado.
    const negritas = requests.filter((r) => JSON.stringify(r).includes('"bold":true')).map((r) => (r as { updateTextStyle: { range: object } }).updateTextStyle.range);
    expect(negritas).toEqual([
      { startIndex: 214, endIndex: 222 },
      { startIndex: 224, endIndex: 231 },
    ]);
  });

  it('galería: tabla sin bordes con un marcador de foto por celda', () => {
    const r = { ...relleno, tablas: {}, fotos: { obra: [{ url: 'u0', nombre: 'a', pie: 'Uno' }, { url: 'u1', nombre: 'b' }, { url: 'u2', nombre: 'c' }] } };
    const doc = structuredClone(docM);
    // Se usa el párrafo de {{tabla:presupuesto}} como si fuera {{fotos:obra}} (mismo largo no importa).
    const p = doc.body!.content!.find((e) => JSON.stringify(e).includes('tabla:presupuesto'))!;
    p.paragraph!.elements![0].textRun!.content = '{{fotos:obra}}\n';
    p.paragraph!.elements![0].endIndex = (p.paragraph!.elements![0].startIndex ?? 0) + 15;
    const { requests } = planTablas(doc, r);
    expect(requests).toContainEqual({ insertTable: { rows: 2, columns: 2, location: { index: 210 } } });
    const textos = requests.filter((x) => 'insertText' in x).map((x) => (x as { insertText: { text: string } }).insertText.text);
    expect(textos).toEqual(['{{foto:obra#2}}', '{{foto:obra#1}}', '{{foto:obra#0}}\nUno']);
    expect(JSON.stringify(requests)).toContain('borderTop');
  });

  it('fotos: ancho del sitio, alto limitado y reserva resaltada', () => {
    const r: Relleno = { ...relleno, fotos: { portada: [{ url: 'p', nombre: 'p.jpg', ancho: 4000, alto: 3000 }], antes: [{ url: 'a', nombre: 'a.jpg' }], logo: [{ url: 'l', nombre: 'l.png', ancho: 100, alto: 100 }], alt: [{ url: 'x', nombre: 'x.jpg' }] } };
    const { fotos, desconocidos } = planFotos(docF, r);
    const tam = fotos.map((f) => (f.requests as { insertInlineImage?: { objectSize: { width: { magnitude: number }; height: { magnitude: number } } } }[]).find((x) => x.insertInlineImage)?.insertInlineImage?.objectSize);
    // Orden: cuerpo del final al principio, luego el encabezado, luego las imágenes con alt.
    expect(tam.map((t) => t && [t.width.magnitude, t.height.magnitude])).toEqual([
      [224, 168], // celda de 234 pt menos el margen, proporción 4:3 por defecto
      [389, 292], // cuerpo: limitado al 45 % de los 648 pt de alto útil
      [60, 60], // encabezado: poco más que un logo
      undefined, // la imagen con el marcador en su texto alternativo se cambia, no se inserta
    ]);
    expect(fotos[3].requests).toEqual([{ replaceImage: { imageObjectId: expect.any(String), uri: 'x', imageReplaceMethod: 'CENTER_CROP' } }]);
    expect(JSON.stringify(fotos[1].reserva)).toContain('[foto: p.jpg]');
    expect(desconocidos).toEqual([]);
  });
});
