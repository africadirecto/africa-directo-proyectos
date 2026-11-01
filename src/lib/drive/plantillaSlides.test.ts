// Compositores de Slides y HTML. La presentación de ejemplo es mínima pero con la forma que
// devuelve la API (startIndex omitido cuando vale 0, textos con su salto final).

import { describe, expect, it } from 'vitest';
import { encontrarMarcadoresSlides, planFotosSlides, planTextoSlides, planTraduccionSlides, textosFijosSlides, type PresentacionSlides } from './plantillaSlides';
import { rellenarHtml } from './plantillaHtml';
import type { Relleno } from '../dominio/marcadores';

const texto = (...trozos: string[]) => {
  let i = 0;
  return {
    textElements: trozos.flatMap((t) => {
      const e = [{ ...(i ? { startIndex: i } : {}), endIndex: i + t.length, paragraphMarker: {} }, { ...(i ? { startIndex: i } : {}), endIndex: i + t.length, textRun: { content: t } }];
      i += t.length;
      return e;
    }),
  };
};

const pres: PresentacionSlides = {
  revisionId: 'r1',
  slides: [
    {
      objectId: 's1',
      pageElements: [
        { objectId: 'titulo', shape: { text: texto('Informe de {{proyecto.titulo}}\n') } },
        { objectId: 'cuerpo', shape: { text: texto('Avance\n', '{{ia:avance}}\n') } },
        { objectId: 'hueco', size: { width: { magnitude: 3810000 }, height: { magnitude: 2540000 } }, shape: { text: texto('{{foto:portada}}\n') } },
        { objectId: 'imagen', image: {}, description: '{{foto:segunda}}' },
        {
          objectId: 'tabla',
          table: { tableRows: [{ tableCells: [{ location: {}, text: texto('Código\n') }, { location: { columnIndex: 1 }, text: texto('{{proyecto.codigo}}\n') }] }] },
        },
      ],
    },
  ],
};

const r: Relleno = {
  datos: { 'proyecto.titulo': 'Aula', 'proyecto.codigo': 'P-2026-014' },
  textos: { avance: 'Cimientos **hechos**.\n- Muros [PENDIENTE: porcentaje]' },
  fotos: { portada: [{ url: 'https://app/f/1', nombre: 'obra.jpg' }], segunda: [{ url: 'https://app/f/2', nombre: 'b.jpg' }] },
  tablas: {},
};

describe('Slides', () => {
  it('encuentra marcadores en recuadros y celdas', () => {
    const hs = encontrarMarcadoresSlides(pres).map((h) => [h.objectId, h.celda ?? null, h.inicio, h.fin, h.solo, h.soloEnRecuadro]);
    expect(hs).toEqual([
      ['titulo', null, 11, 30, false, false],
      ['cuerpo', null, 7, 20, true, false],
      ['hueco', null, 0, 16, true, true],
      ['tabla', { rowIndex: 0, columnIndex: 1 }, 0, 19, true, false],
    ]);
    expect(encontrarMarcadoresSlides(pres).find((h) => h.objectId === 'hueco')?.caja).toEqual({ ancho: 300, alto: 200 });
  });

  it('texto con negrita, viñeta y resaltado; la foto del recuadro se deja para después', () => {
    const { requests, desconocidos } = planTextoSlides(pres, r);
    expect(desconocidos).toEqual([]);
    const cuerpo = requests.filter((x) => JSON.stringify(x).includes('"objectId":"cuerpo"'));
    expect(cuerpo[0]).toEqual({ insertText: { objectId: 'cuerpo', insertionIndex: 8, text: 'Cimientos hechos.\nMuros [porcentaje]' } });
    expect(cuerpo.map((x) => Object.keys(x)[0])).toEqual(['insertText', 'deleteText', 'deleteText', 'updateTextStyle', 'updateTextStyle', 'createParagraphBullets']);
    expect(JSON.stringify(requests)).toContain('"cellLocation":{"rowIndex":0,"columnIndex":1}');
    expect(JSON.stringify(requests)).not.toContain('"objectId":"hueco"');
  });

  it('fotos en recuadros y en imágenes con texto alternativo', () => {
    const { fotos } = planFotosSlides(pres, r);
    expect(fotos.map((f) => f.requests[0])).toEqual([
      { replaceAllShapesWithImage: { imageUrl: 'https://app/f/1', imageReplaceMethod: 'CENTER_CROP', containsText: { text: '{{foto:portada}}', matchCase: true } } },
      { replaceImage: { imageObjectId: 'imagen', url: 'https://app/f/2', imageReplaceMethod: 'CENTER_CROP' } },
    ]);
    expect(JSON.stringify(fotos[0].reserva)).toContain('[foto: obra.jpg]');
  });

  it('textos fijos y su traducción', () => {
    expect(textosFijosSlides(pres)).toEqual(['Informe de {{proyecto.titulo}}', 'Avance', 'Código']);
    const req = planTraduccionSlides(pres, { Avance: 'Progrès' });
    expect(req[0]).toEqual({ insertText: { objectId: 'cuerpo', insertionIndex: 1, text: 'Progrès' } });
  });
});

describe('HTML (demo)', () => {
  it('rellena bloques, texto en línea, fotos, tablas y huecos', () => {
    const plantilla =
      '<h1>Informe de {{proyecto.titulo}}</h1><p>{{ia:avance}}</p><p>{{fotos:galeria}}</p><p>{{tabla:presupuesto}}</p><p>Hecho en {{proyecto.pais}}.</p><img alt="{{foto:portada}}" src="x.png"><p>Fijo</p>';
    const { html, resultado } = rellenarHtml(plantilla, {
      ...r,
      fotos: { ...r.fotos, galeria: [{ url: 'g1', nombre: 'g', pie: 'Pie <1>' }] },
      tablas: { presupuesto: [['Concepto', 'Importe'], ['Muros', '4.000 €']] },
      traducciones: { Fijo: 'Fixe' },
    });
    expect(html).toContain('<h1>Informe de Aula</h1>');
    expect(html).toContain('<p>Cimientos <b>hechos</b>.</p><ul><li>Muros <mark>[porcentaje]</mark></li></ul>');
    expect(html).toContain('<figcaption>Pie &lt;1&gt;</figcaption>');
    expect(html).toContain('<th>Concepto</th>');
    expect(html).toContain('Hecho en <mark>[pais]</mark>.');
    expect(html).toContain('src="https://app/f/1"');
    expect(html).toContain('<p>Fixe</p>');
    expect(resultado.desconocidos).toEqual(['{{proyecto.pais}}']);
  });
});
