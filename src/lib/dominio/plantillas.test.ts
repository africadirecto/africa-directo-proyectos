import { describe, expect, it } from 'vitest';
import { analizarEstructura, camposSinInstruccion, type MarcadorLeido } from './plantillas';

const m = (original: string, o: Partial<MarcadorLeido> = {}): MarcadorLeido => ({ original, solo: true, enTabla: false, enEncabezado: false, enAlt: false, ...o });
const vacias = { general: '', campos: {} };

describe('estructura de una plantilla', () => {
  it('cuenta campos, datos y tablas', () => {
    const { estructura, avisos } = analizarEstructura(
      [m('{{ia:avance}}'), m('{{ia:avance}}', { solo: false }), m('{{proyecto.titulo}}', { solo: false }), m('{{tabla:presupuesto}}'), m('{{fotos:obra}}'), m('{{pie:obra}}')],
      'seguimiento',
      'docs',
      vacias,
    );
    expect(estructura.campos).toEqual([
      { clave: 'avance', tipo: 'ia', veces: 2, enLinea: true },
      { clave: 'obra', tipo: 'fotos', veces: 1, enLinea: false },
    ]);
    expect(estructura.datos).toEqual(['proyecto.titulo']);
    expect(estructura.tablas).toEqual(['presupuesto']);
    expect(avisos).toEqual([]);
  });

  it('avisa de lo que no va a salir bien', () => {
    const { avisos } = analizarEstructura(
      [
        m('{{raro}}'),
        m('{{proyecto.inventado}}'),
        m('{{conjunto.proyectos}}'),
        m('{{tabla:presupuesto}}', { enTabla: true }),
        m('{{fotos:obra}}', { solo: false }),
        m('{{pie:portada}}'),
        m('{{foto:avance}}'),
        m('{{ia:avance}}'),
      ],
      'seguimiento',
      'docs',
      vacias,
    );
    // 7 + «no tiene ningún campo {{ia:…}}», porque «avance» quedó como foto.
    expect(avisos).toHaveLength(8);
    expect(avisos.join('\n')).toMatch(/\{\{raro\}\} no es un marcador/);
    expect(avisos.join('\n')).toMatch(/proyecto\.inventado.*no conoce/);
    expect(avisos.join('\n')).toMatch(/conjunto\.proyectos.*de conjunto/);
    expect(avisos.join('\n')).toMatch(/tabla:presupuesto.*fuera de otras tablas/);
    expect(avisos.join('\n')).toMatch(/fotos:obra.*primera foto/);
    expect(avisos.join('\n')).toMatch(/pie:portada.*no tiene su foto/);
    expect(avisos.join('\n')).toMatch(/«avance» se usa para cosas distintas/);
  });

  it('en Slides: fotos en su recuadro, tablas como texto', () => {
    const { avisos, estructura } = analizarEstructura(
      [m('{{foto:portada}}', { soloEnRecuadro: false }), m('{{foto:otra}}', { soloEnRecuadro: true, caja: { ancho: 300.4, alto: 200 } }), m('{{tabla:presupuesto}}'), m('{{ia:a}}')],
      'financiacion',
      'slides',
      vacias,
    );
    expect(avisos.join('\n')).toMatch(/foto:portada.*único texto de un recuadro/);
    expect(avisos.join('\n')).not.toMatch(/foto:otra/);
    // En Slides las tablas salen siempre como líneas de texto: no es un aviso.
    expect(avisos.join('\n')).not.toMatch(/líneas de texto/);
    expect(estructura.campos.find((c) => c.clave === 'otra')?.caja).toEqual({ ancho: 300, alto: 200 });
  });

  it('sin campos de IA, y fotos en un informe de conjunto', () => {
    expect(analizarEstructura([m('{{proyecto.titulo}}')], 'seguimiento', 'docs', vacias).avisos).toEqual(['La plantilla no tiene ningún campo {{ia:…}}: la IA no redactará nada.']);
    expect(analizarEstructura([m('{{ia:a}}'), m('{{foto:b}}')], 'cartera', 'docs', vacias).avisos.join()).toMatch(/de conjunto no llevan fotos/);
  });

  it('importa las instrucciones del formato antiguo y conserva los campos que desaparecen', () => {
    const { estructura, extras } = analizarEstructura([m('{{ia:avance|150 palabras|Describe la obra}}')], 'seguimiento', 'docs', { general: '', campos: { viejo: 'Algo', vacio: '' } });
    expect(extras).toEqual({ avance: 'Describe la obra' });
    expect(estructura.campos.map((c) => [c.clave, !!c.huerfano])).toEqual([
      ['avance', false],
      ['viejo', true],
    ]);
  });

  it('campos sin instrucción', () => {
    const p = { estructura: { campos: [{ clave: 'a', tipo: 'ia' as const, veces: 1, enLinea: false }, { clave: 'b', tipo: 'ia' as const, veces: 1, enLinea: false }, { clave: 'f', tipo: 'foto' as const, veces: 1, enLinea: false }], datos: [], tablas: [] }, instrucciones: { general: '', campos: { a: 'x', b: ' ' } } };
    expect(camposSinInstruccion(p)).toEqual(['b']);
  });
});
