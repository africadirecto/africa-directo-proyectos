import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { leerCampo, peticionCampo } from './informes';
import { firmaValida } from './lotes';
import { textosFijosHtml } from '../drive/plantillaHtml';

const campo = { clave: 'avance', instruccion: 'Avance de la obra.', enLinea: false };

describe('texto de un campo', () => {
  it('separa fuentes y pendientes', () => {
    const r = leerCampo('Se hicieron los cimientos.\n\n- Muros al [PENDIENTE: porcentaje]\n\nFUENTES: E1, E2, ficha', campo);
    expect(r.texto).toBe('Se hicieron los cimientos.\n\n- Muros al [PENDIENTE: porcentaje]');
    expect(r.fuentes).toEqual(['E1', 'E2', 'ficha']);
    expect(r.pendientes).toEqual(['porcentaje']);
  });

  it('tolera lo visto en las pruebas: título repetido, fuentes en negrita, sin fuentes', () => {
    // Visto con Gemini y Haiku en la Batch API (scripts/pruebas, S1).
    expect(leerCampo('## Avance de la obra\n\nTexto.\n\n**FUENTES:** E1', campo)).toEqual({ texto: 'Texto.', fuentes: ['E1'], pendientes: [] });
    expect(leerCampo('Texto.\nFUENTES: -', campo).fuentes).toEqual([]);
    expect(leerCampo('Solo texto.', campo)).toEqual({ texto: 'Solo texto.', fuentes: [], pendientes: [] });
  });

  it('conserva los subtítulos si el campo los pide', () => {
    const c = { ...campo, instruccion: 'Un apartado por proyecto con su título como subtítulo (###).' };
    expect(leerCampo('### Aula\nBien.\nFUENTES: E1', c).texto).toBe('### Aula\nBien.');
  });

  it('un campo dentro de una frase queda en una línea', () => {
    expect(leerCampo('- unos 120\nalumnos\nFUENTES: ficha', { ...campo, enLinea: true }).texto).toBe('unos 120 alumnos');
  });
});

describe('petición de un campo', () => {
  const base = { contexto: '{"proyecto":{}}', tipo: 'Informe de seguimiento', formato: 'docs' as const, idioma: 'fr' as const, general: 'Tono cercano.', otros: [{ clave: 'resumen', instruccion: 'Breve.', enLinea: false }], indicaciones: 'Destaca a las madres. Contacto: ana@x.org' };

  it('lo común primero y el campo al final, sin datos de contacto', () => {
    const p = peticionCampo({ ...base, campo });
    expect(p.id).toBe('avance');
    expect(p.entrada.indexOf('DATOS (JSON)')).toBe(0);
    expect(p.entrada.lastIndexOf('CAMPO QUE TIENES QUE REDACTAR')).toBeGreaterThan(p.entrada.indexOf('OTROS CAMPOS'));
    expect(p.entrada).toContain('francés');
    expect(p.entrada).not.toContain('ana@x.org');
    // Las reglas son las mismas para todos los campos (el proveedor reutiliza el principio).
    expect(peticionCampo({ ...base, campo: { ...campo, clave: 'otro' } }).instrucciones).toBe(p.instrucciones);
  });

  it('en una frase o en una diapositiva, lo dice', () => {
    expect(peticionCampo({ ...base, campo: { ...campo, enLinea: true } }).entrada).toMatch(/dentro de una frase/);
    expect(peticionCampo({ ...base, formato: 'slides', campo: { ...campo, caja: { ancho: 600, alto: 280 } } }).entrada).toMatch(/unas 200 palabras/);
  });
});

describe('fotos en los huecos (sin IA)', () => {
  it('una por hueco de foto y el resto en las galerías, en orden y sin repetir', async () => {
    const { asignarFotos } = await import('./informes');
    const fotos = Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, fecha: '2026-10-01', descripcion: '' }));
    const r = await asignarFotos(fotos, [{ clave: 'portada', tipo: 'foto', instruccion: '' }, { clave: 'obra', tipo: 'fotos', instruccion: '' }], 'es');
    expect(r.portada).toEqual([{ id: 'f0', pie: '' }]);
    expect(r.obra.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'f6']); // como mucho 6 por galería
    expect(await asignarFotos([], [{ clave: 'portada', tipo: 'foto', instruccion: '' }], 'es')).toEqual({});
  });
});

describe('aviso de OpenRouter', () => {
  const secreto = 'secreto';
  const cuerpo = '{"type":"batch.completed","data":{"id":"batch_1"}}';
  const firma = (t: number, c = cuerpo, s = secreto) => `t=${t},v1=${crypto.createHmac('sha256', s).update(`${t},${c}`).digest('hex')}`;
  const ahora = 1_793_566_000_000;

  it('acepta la firma buena y reciente', () => {
    expect(firmaValida(firma(ahora / 1000), cuerpo, secreto, ahora)).toBe(true);
  });

  it('rechaza otra firma, otro cuerpo, una vieja o ninguna', () => {
    expect(firmaValida(firma(ahora / 1000, cuerpo, 'otro'), cuerpo, secreto, ahora)).toBe(false);
    expect(firmaValida(firma(ahora / 1000), cuerpo.replace('1', '2'), secreto, ahora)).toBe(false);
    expect(firmaValida(firma(ahora / 1000 - 600), cuerpo, secreto, ahora)).toBe(false);
    expect(firmaValida(null, cuerpo, secreto, ahora)).toBe(false);
  });
});

describe('textos fijos de una plantilla HTML', () => {
  it('sin los marcadores solos ni la cabecera', () => {
    const html = '<html><head><title>No</title><style>p{}</style></head><body><h1>Informe de {{proyecto.titulo}}</h1><p>{{ia:resumen}}</p><td>Código</td><td>{{proyecto.codigo}}</td></body></html>';
    expect(textosFijosHtml(html)).toEqual(['Informe de {{proyecto.titulo}}', 'Código']);
  });
});
