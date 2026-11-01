import { describe, expect, it } from 'vitest';
import { contenidoDe, enUnaLinea, fotoDe, huecoDe, leerMarcador, normalizarClave, parsearTexto, type Relleno } from './marcadores';

describe('marcadores', () => {
  it('reconoce cada tipo', () => {
    expect(leerMarcador('proyecto.titulo')).toEqual({ tipo: 'dato', clave: 'proyecto.titulo' });
    expect(leerMarcador(' Proyecto . Titulo ')).toEqual({ tipo: 'dato', clave: 'proyecto.titulo' });
    expect(leerMarcador('ia:avance')).toEqual({ tipo: 'ia', clave: 'avance' });
    expect(leerMarcador('IA : Avance de obras')).toEqual({ tipo: 'ia', clave: 'avance_de_obras' });
    expect(leerMarcador('foto:portada')).toEqual({ tipo: 'foto', clave: 'portada' });
    expect(leerMarcador('foto:galeria#3')).toEqual({ tipo: 'foto', clave: 'galeria#3' });
    expect(leerMarcador('pie:portada')).toEqual({ tipo: 'pie', clave: 'portada' });
    expect(leerMarcador('fotos:obra')).toEqual({ tipo: 'fotos', clave: 'obra' });
    expect(leerMarcador('tabla:presupuesto')).toEqual({ tipo: 'tabla', clave: 'presupuesto' });
  });

  it('conserva la instrucción del formato antiguo y quita las palabras', () => {
    expect(leerMarcador('ia:avance|150 palabras|Describe la obra')).toEqual({ tipo: 'ia', clave: 'avance', extra: 'Describe la obra' });
    expect(leerMarcador('ia:avance|150 palabras')).toEqual({ tipo: 'ia', clave: 'avance' });
  });

  it('rechaza lo que no es un marcador', () => {
    expect(leerMarcador('nombre')).toBeNull();
    expect(leerMarcador('ia:')).toBeNull();
    expect(leerMarcador('otro:cosa')).toBeNull();
  });

  it('normaliza claves', () => {
    expect(normalizarClave('Situación económica')).toBe('situacion_economica');
    expect(normalizarClave('próximos-pasos')).toBe('proximos_pasos');
  });
});

describe('texto de la IA', () => {
  it('interpreta el Markdown restringido', () => {
    const ps = parsearTexto('Uno con **negrita**.\n### Título\n- a\n- b con [PENDIENTE: nº de alumnos]');
    expect(ps).toEqual([
      { tipo: 'p', trozos: [{ texto: 'Uno con ' }, { texto: 'negrita', negrita: true }, { texto: '.' }] },
      { tipo: 'h', trozos: [{ texto: 'Título' }] },
      { tipo: 'li', trozos: [{ texto: 'a' }] },
      { tipo: 'li', trozos: [{ texto: 'b con ' }, { texto: '[nº de alumnos]', pendiente: true }] },
    ]);
  });

  it('tolera lo que los modelos añaden por su cuenta', () => {
    // Visto en las pruebas con la Batch API: ##, ####, «*», dos espacios al final, cursiva.
    const ps = parsearTexto('## Avance\n\n**Estado:** bien  \n#### Cronología\n* **02/03**: cimientos\n1. uno\n• dos\nTexto *en cursiva* y `código`.');
    expect(ps.map((p) => p.tipo)).toEqual(['h', 'p', 'h', 'li', 'li', 'li', 'p']);
    expect(ps[1].trozos).toEqual([{ texto: 'Estado:', negrita: true }, { texto: ' bien' }]);
    expect(ps[3].trozos[0]).toEqual({ texto: '02/03', negrita: true });
    expect(ps[6].trozos).toEqual([{ texto: 'Texto en cursiva y código.' }]);
  });

  it('no deja que el texto cree marcadores', () => {
    expect(parsearTexto('Hola {{proyecto.titulo}}')[0].trozos).toEqual([{ texto: 'Hola proyecto.titulo' }]);
  });

  it('pone todo en una línea para los marcadores dentro de una frase', () => {
    expect(enUnaLinea(parsearTexto('### A\n- b\nc **d**'))).toEqual({ tipo: 'p', trozos: [{ texto: 'A b c ' }, { texto: 'd', negrita: true }] });
  });
});

describe('contenido de cada marcador', () => {
  const r: Relleno = {
    datos: { 'proyecto.titulo': 'Aula', 'proyecto.inicio': '[PENDIENTE: fecha de inicio]' },
    textos: { avance: '- uno\n- dos' },
    fotos: { portada: [{ url: 'https://x/1', nombre: 'a.jpg', pie: 'La obra' }], galeria: [{ url: 'u0', nombre: 'b' }, { url: 'u1', nombre: 'c', pie: 'Segunda' }] },
    tablas: {},
  };

  it('datos como texto llano, con pendiente permitido', () => {
    expect(contenidoDe({ tipo: 'dato', clave: 'proyecto.titulo' }, r)).toEqual([{ tipo: 'p', trozos: [{ texto: 'Aula' }] }]);
    expect(contenidoDe({ tipo: 'dato', clave: 'proyecto.inicio' }, r)?.[0].trozos).toEqual([{ texto: '[fecha de inicio]', pendiente: true }]);
    expect(contenidoDe({ tipo: 'dato', clave: 'proyecto.otro' }, r)).toBeNull();
  });

  it('textos de la IA como Markdown, y pies de las fotos', () => {
    expect(contenidoDe({ tipo: 'ia', clave: 'avance' }, r)?.map((p) => p.tipo)).toEqual(['li', 'li']);
    expect(contenidoDe({ tipo: 'pie', clave: 'portada' }, r)).toEqual([{ tipo: 'p', trozos: [{ texto: 'La obra' }] }]);
    expect(contenidoDe({ tipo: 'pie', clave: 'galeria#1' }, r)?.[0].trozos[0].texto).toBe('Segunda');
  });

  it('fotos por clave y por posición en la galería', () => {
    expect(fotoDe('portada', r)?.url).toBe('https://x/1');
    expect(fotoDe('galeria#1', r)?.url).toBe('u1');
    expect(fotoDe('galeria#5', r)).toBeNull();
  });

  it('huecos resaltados', () => {
    expect(huecoDe({ tipo: 'dato', clave: 'proyecto.fin_previsto' }, '{{proyecto.fin_previsto}}').trozos).toEqual([{ texto: '[fin previsto]', pendiente: true }]);
    expect(huecoDe({ tipo: 'foto', clave: 'x' }, '{{foto:x}}').trozos[0].texto).toBe('[foto]');
    expect(huecoDe(null, '{{raro}}').trozos[0].texto).toBe('{{raro}}');
  });
});
