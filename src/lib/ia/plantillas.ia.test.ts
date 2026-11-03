// «Cambiar con IA» contra OpenRouter de verdad. No se ejecuta con `npm test`:
//   PRUEBAS_IA=1 npx vitest run src/lib/ia/plantillas.ia.test.ts
// Usa la clave de .env.local; solo envía una plantilla de ejemplo, sin datos de proyectos.

import { describe, expect, it } from 'vitest';

const activa = !!process.env.PRUEBAS_IA;
if (activa) process.loadEnvFile('.env.local');

describe.skipIf(!activa)('cambiar una plantilla con IA', () => {
  it('cambia lo pedido en el documento y en las instrucciones, y conserva el resto', async () => {
    const { proponerCambiosIa } = await import('./plantillas');
    const { validarCambios, camposTras } = await import('../dominio/cambiosPlantilla');
    const bloques = [
      { id: 'B1', tipo: 'titulo' as const, texto: 'Informe de seguimiento', contenedor: '|', borrable: true },
      { id: 'B2', tipo: 'titulo' as const, texto: 'Resumen', contenedor: '|', borrable: true },
      { id: 'B3', tipo: 'parrafo' as const, texto: '{{ia:resumen}}', contenedor: '|', borrable: true },
      { id: 'B4', tipo: 'titulo' as const, texto: 'Incidencias', contenedor: '|', borrable: true },
      { id: 'B5', tipo: 'parrafo' as const, texto: '{{ia:incidencias}}', contenedor: '|', borrable: true },
      { id: 'B6', tipo: 'titulo' as const, texto: 'Fotos', contenedor: '|', borrable: true },
      { id: 'B7', tipo: 'parrafo' as const, texto: '{{fotos:fotos}}', contenedor: '|', borrable: true },
    ];
    const instrucciones = {
      general: 'Informe de seguimiento para un donante. Tono cercano.',
      campos: { resumen: 'Qué se ha hecho en el periodo, en pocas frases.', incidencias: 'Problemas y cómo se resolvieron.', fotos: 'Fotos del avance.' },
    };
    const r = await proponerCambiosIa({
      nombre: 'Informe de seguimiento',
      descripcion: '',
      tipo: 'proyecto',
      formato: 'docs',
      instrucciones,
      campos: [
        { clave: 'resumen', tipo: 'ia', veces: 1, enLinea: false },
        { clave: 'incidencias', tipo: 'ia', veces: 1, enLinea: false },
        { clave: 'fotos', tipo: 'fotos', veces: 1, enLinea: false },
      ],
      bloques,
      peticion: 'Quita el apartado de incidencias y añade uno de sostenibilidad antes de las fotos. Que el tono sea más formal.',
    });
    console.log(JSON.stringify(r, null, 2));
    const { cambios, avisos } = validarCambios(r.cambios, bloques);
    expect(avisos).toEqual([]);
    const tras = camposTras(bloques, cambios);
    expect(tras.has('incidencias')).toBe(false);
    expect([...tras.keys()].some((k) => k.includes('sostenib'))).toBe(true);
    expect(tras.has('resumen') && tras.has('fotos')).toBe(true);
    expect(r.general.toLowerCase()).toMatch(/formal/);
    expect(r.resumen.length).toBeGreaterThan(10);
  }, 200_000);
});
