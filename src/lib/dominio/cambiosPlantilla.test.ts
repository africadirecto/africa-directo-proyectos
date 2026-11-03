import { describe, expect, it } from 'vitest';
import { camposTras, validarCambios, type BloquePlantilla, type CambioDocumento } from './cambiosPlantilla';
import { aplicarCambiosHtml, bloquesHtml } from '../drive/plantillaHtml';
import { planCambios, type Bloque } from '../drive/plantillaDocs';

const b = (id: string, tipo: BloquePlantilla['tipo'], texto: string, extra: Partial<BloquePlantilla> = {}): BloquePlantilla => ({ id, tipo, texto, contenedor: '|', borrable: true, ...extra });
const c = (accion: CambioDocumento['accion'], bloque: string, x: Partial<CambioDocumento> = {}): CambioDocumento => ({ accion, bloque, buscar: '', texto: '', estilo: 'parrafo', ...x });

const BLOQUES = [b('B1', 'titulo', 'Resumen'), b('B2', 'parrafo', '{{ia:resumen}}'), b('B3', 'titulo', 'Incidencias'), b('B4', 'parrafo', '{{ia:incidencias}}'), b('B5', 'imagen', '[imagen: {{foto:portada}}]')];

describe('validarCambios', () => {
  it('descarta lo que no existe o no está en su bloque, y lo avisa', () => {
    const r = validarCambios([c('reemplazar', 'B1', { buscar: 'Resumen general', texto: 'X' }), c('borrar', 'B9'), c('reemplazar', 'B5', { buscar: 'imagen', texto: 'x' })], BLOQUES);
    expect(r.cambios).toEqual([]);
    expect(r.avisos).toHaveLength(2);
  });

  it('un párrafo tras un bloque que se quita va tras el anterior del mismo sitio', () => {
    const r = validarCambios([c('borrar', 'B3'), c('borrar', 'B4'), c('insertar', 'B4', { texto: 'Sostenibilidad', estilo: 'titulo' }), c('insertar', 'B4', { texto: '{{ia:sostenibilidad}}' })], BLOQUES);
    expect(r.avisos).toEqual([]);
    expect(r.cambios.filter((x) => x.accion === 'insertar').map((x) => x.bloque)).toEqual(['B2', 'B2']);
    // En el orden del documento: lo de B2, y luego lo que se quita.
    expect(r.cambios.map((x) => `${x.accion}:${x.bloque}`)).toEqual(['insertar:B2', 'insertar:B2', 'borrar:B3', 'borrar:B4']);
  });

  it('al quitar una tabla se van sus celdas', () => {
    const bloques = [b('T1', 'tabla', 'a | b'), b('B1', 'celda', 'a', { tabla: 'T1' })];
    const r = validarCambios([c('borrar', 'T1'), c('reemplazar', 'B1', { buscar: 'a', texto: 'z' })], bloques);
    expect(r.cambios.map((x) => x.accion)).toEqual(['borrar']);
  });

  it('camposTras: los campos que quedan, con los nuevos y sin los quitados', () => {
    const { cambios } = validarCambios([c('borrar', 'B4'), c('insertar', 'B2', { texto: '{{ia:sostenibilidad}}' }), c('reemplazar', 'B2', { buscar: 'resumen', texto: 'avance' })], BLOQUES);
    expect([...camposTras(BLOQUES, cambios).keys()].sort()).toEqual(['avance', 'portada', 'sostenibilidad']);
  });
});

describe('aplicar en HTML (demo)', () => {
  const html = '<html><body><h2 style="color:red">Resumen</h2><p>{{ia:resumen}}</p><h2 style="color:red">Incidencias</h2><p>{{ia:incidencias}}</p></body></html>';
  it('añade un apartado con el estilo de los títulos, quita otro y renombra', () => {
    const bloques = bloquesHtml(html);
    expect(bloques.map((x) => x.texto)).toEqual(['Resumen', '{{ia:resumen}}', 'Incidencias', '{{ia:incidencias}}']);
    const salida = aplicarCambiosHtml(html, [
      c('reemplazar', 'B1', { buscar: 'Resumen', texto: 'Resumen del periodo' }),
      c('insertar', 'B2', { texto: 'Sostenibilidad', estilo: 'titulo' }),
      c('insertar', 'B2', { texto: '{{ia:sostenibilidad}}' }),
      c('borrar', 'B3'),
      c('borrar', 'B4'),
    ]);
    expect(salida).toBe('<html><body><h2 style="color:red">Resumen del periodo</h2><p>{{ia:resumen}}</p>\n<h2 style="color:red">Sostenibilidad</h2>\n<p>{{ia:sostenibilidad}}</p></body></html>');
  });
});

describe('aplicar en Docs', () => {
  const bloques: Bloque[] = [
    { id: 'B1', tipo: 'titulo', texto: 'Resumen', seg: '', inicio: 1, fin: 8, estilo: 'HEADING_2' },
    { id: 'B2', tipo: 'parrafo', texto: '{{ia:resumen}}', seg: '', inicio: 9, fin: 23, estilo: 'NORMAL_TEXT' },
    { id: 'B3', tipo: 'parrafo', texto: 'Fin', seg: '', inicio: 24, fin: 27, estilo: 'NORMAL_TEXT', ultimo: true },
  ];
  it('del final al principio: lo que se quita, lo que se añade tras un bloque y luego los cambios dentro', () => {
    const r = planCambios(bloques, [c('reemplazar', 'B2', { buscar: '{{ia:resumen}}', texto: '{{ia:avance}}' }), c('insertar', 'B2', { texto: 'Nuevo', estilo: 'titulo' }), c('borrar', 'B3')]) as Record<string, { range?: object; location?: object; text?: string; paragraphStyle?: object }>[];
    expect(Object.keys(r[0])).toEqual(['deleteContentRange']);
    expect(r[0].deleteContentRange.range).toEqual({ startIndex: 24, endIndex: 27 });
    expect(r[1].insertText).toEqual({ location: { index: 23 }, text: '\nNuevo' });
    // El título nuevo toma el nivel del último título de antes.
    expect(r[2].updateParagraphStyle).toMatchObject({ range: { startIndex: 24, endIndex: 29 }, paragraphStyle: { namedStyleType: 'HEADING_2' } });
    expect(r.findIndex((x) => x.insertText?.text === '{{ia:avance}}')).toBeGreaterThan(2);
  });
});
