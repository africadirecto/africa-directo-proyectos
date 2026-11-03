// La plantilla desde un ejemplo de principio a fin, con Drive y la IA de verdad. No se ejecuta
// con `npm test`:
//   PRUEBAS_GOOGLE=1 npx vitest run src/lib/trabajos/plantilla.google.test.ts
// Para no tocar la base de datos real, usa el almacén local del demo (.datos), y las copias van a
// «_Pruebas técnicas» (unidad Sistema) en vez de a la unidad de plantillas. El ejemplo es el
// .docx sintético de la prueba S3 (scripts/pruebas).

import { describe, expect, it, vi } from 'vitest';

const activa = !!process.env.PRUEBAS_GOOGLE;
if (activa) process.loadEnvFile('.env.local');

vi.mock('../almacen', async () => {
  const { almacenLocal } = await import('../almacen/local');
  return { almacen: async () => almacenLocal };
});
vi.mock('../dominio/plantillas', async (original) => {
  const real = await original<typeof import('../dominio/plantillas')>();
  const { driveGoogle } = await import('../drive/google');
  return { ...real, carpetaPlantillas: async () => driveGoogle.carpetaHija('_Pruebas técnicas', driveGoogle.raizSistema) };
});

describe.skipIf(!activa)('plantilla desde un ejemplo', () => {
  it('convierte, analiza con IA, escribe los marcadores y la deja lista', async () => {
    const { driveGoogle } = await import('../drive/google');
    const { almacen } = await import('../almacen');
    const { crearDesdeEjemplo, avanzarPlantilla } = await import('./plantilla');
    const carpeta = await driveGoogle.carpetaHija('_Pruebas técnicas', driveGoogle.raizSistema);
    const docx = (await driveGoogle.listar([carpeta])).find((a) => a.nombre === 'plantilla-donante-prueba.docx');
    expect(docx, 'falta el .docx de la prueba S3').toBeDefined();

    const id = await crearDesdeEjemplo(docx!.id, { nombre: `Prueba motor ${new Date().toISOString().slice(0, 16)}`, descripcion: '', tipo: 'proyecto', idioma: 'es', donante: null }, { id: 'prueba@demo', nombre: 'Prueba' });
    const db = await almacen();
    type P = { estado: string; error?: string; version: number; archivoId: string; url: string; instrucciones: { general: string; campos: Record<string, string> }; estructura: { campos: { clave: string; tipo: string }[] }; sincronizado: { avisos: string[] } | null; proceso?: { paso: string } | null };
    let p = await db.leer<P>(`plantillas/${id}`);
    const inicio = Date.now();
    while (p?.estado === 'procesando' && Date.now() - inicio < 10 * 60_000) {
      await avanzarPlantilla(id);
      p = await db.leer<P>(`plantillas/${id}`);
      console.log(`${Math.round((Date.now() - inicio) / 1000)} s: ${p?.estado} ${p?.proceso?.paso ?? ''}`);
    }
    console.log('Plantilla:', p?.url);
    console.log(JSON.stringify({ instrucciones: p?.instrucciones, campos: p?.estructura.campos, avisos: p?.sincronizado?.avisos }, null, 1));
    expect(p?.error ?? '').toBe('');
    expect(p?.estado).toBe('activa');
    expect(p?.version).toBe(1);
    expect(p?.instrucciones.general.length).toBeGreaterThan(20);
    const ia = p!.estructura.campos.filter((c) => c.tipo === 'ia');
    expect(ia.length).toBeGreaterThanOrEqual(2);
    expect(ia.every((c) => p!.instrucciones.campos[c.clave]?.length > 10)).toBe(true);
    expect(p?.sincronizado?.avisos.some((a) => a.includes('pruébala con un proyecto'))).toBe(true);
    // Nada a medias.
    expect(await db.leer(`plantillas/${id}/trabajo/analisis`)).toBeNull();
    expect(await db.leer(`trabajos/plantillas~${id}`)).toBeNull();
  }, 15 * 60_000);
});
