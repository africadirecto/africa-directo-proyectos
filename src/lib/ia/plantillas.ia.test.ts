// «Cambiar con IA» contra OpenRouter de verdad. No se ejecuta con `npm test`:
//   PRUEBAS_IA=1 npx vitest run src/lib/ia/plantillas.ia.test.ts
// Usa la clave de .env.local; solo envía instrucciones de ejemplo, sin datos de proyectos.

import { describe, expect, it } from 'vitest';

const activa = !!process.env.PRUEBAS_IA;
if (activa) process.loadEnvFile('.env.local');

describe.skipIf(!activa)('cambiar instrucciones con IA', () => {
  it('cambia lo pedido, conserva el resto y no inventa campos', async () => {
    const { editarInstrucciones } = await import('./plantillas');
    const actuales = {
      general: 'Informe de seguimiento para un donante. Tono cercano.',
      campos: { resumen: 'Qué se ha hecho en el periodo, en pocas frases.', incidencias: 'Problemas y cómo se resolvieron.', fotos: 'Fotos del avance.' },
    };
    const r = await editarInstrucciones({
      nombre: 'Informe de seguimiento',
      tipo: 'proyecto',
      formato: 'docs',
      actuales,
      campos: [
        { clave: 'resumen', tipo: 'ia', veces: 1, enLinea: false },
        { clave: 'incidencias', tipo: 'ia', veces: 1, enLinea: false },
        { clave: 'fotos', tipo: 'fotos', veces: 1, enLinea: false },
      ],
      peticion: 'Que el tono sea más formal, y que el resumen mencione siempre el número de alumnos.',
    });
    console.log(JSON.stringify(r, null, 2));
    expect(Object.keys(r.instrucciones.campos).sort()).toEqual(['fotos', 'incidencias', 'resumen']);
    expect(r.instrucciones.general).not.toBe(actuales.general);
    expect(r.instrucciones.general.toLowerCase()).toMatch(/formal/);
    expect(r.instrucciones.campos.resumen.toLowerCase()).toMatch(/alumn/);
    expect(r.resumen.length).toBeGreaterThan(10);
  }, 120_000);
});
