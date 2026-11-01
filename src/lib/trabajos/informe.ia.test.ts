// El motor de informes de principio a fin con la IA de verdad, sobre los datos del modo demo
// (almacén y Drive locales en .datos: datos inventados). No se ejecuta con `npm test`:
//   PRUEBAS_IA=1 npx vitest run src/lib/trabajos/informe.ia.test.ts               (vía directa)
//   PRUEBAS_IA=1 PRUEBAS_LOTES=1 npx vitest run src/lib/trabajos/informe.ia.test.ts (Batch API)
// Hace falta haber abierto antes el demo (para que existan sus datos y plantillas). Con lotes,
// la «dirección pública» es example.com: OpenRouter le avisará en vano y el test consulta el lote.

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const activa = !!process.env.PRUEBAS_IA;
if (activa) {
  process.env.MODO_DEMO = '1';
  if (process.env.PRUEBAS_LOTES) process.env.APP_URL = 'https://example.com';
  process.loadEnvFile('.env.local');
}

describe.skipIf(!activa)('motor de informes con IA', () => {
  it(
    `informe de seguimiento en francés (${process.env.PRUEBAS_LOTES ? 'lote' : 'directo'})`,
    async () => {
      const { almacen } = await import('../almacen');
      const { pedirInforme, avanzarInforme } = await import('./informe');
      const { rutaLocal } = await import('../drive/local');
      const db = await almacen();
      const plantilla = (await db.consultar<{ tipo: string; formato: string; porDefecto: boolean }>('plantillas')).find((p) => p.tipo === 'seguimiento' && p.formato === 'docs' && p.porDefecto);
      expect(plantilla, 'abre antes el demo para que existan sus plantillas').toBeDefined();

      const ruta = await pedirInforme(
        { plantillaId: plantilla!.id, codigo: 'P-2026-014', desde: '2025-01-01', hasta: new Date().toISOString().slice(0, 10), donanteId: '', idioma: 'fr', indicaciones: 'Destaca la participación de las familias.' },
        { id: 'prueba@demo', nombre: 'Prueba' },
      );
      type Estado = { estado: string; modo?: string; error?: string; docId: string; pendientes: number; fuentes?: Record<string, string[]>; resumen: string; progreso?: { campos: number; hechos: number } };
      let i = await db.leer<Estado>(ruta);
      const inicio = Date.now();
      // Como la pantalla: avanzar y volver a mirar hasta que acabe.
      while (i && i.estado !== 'listo' && i.estado !== 'error' && Date.now() - inicio < 25 * 60_000) {
        await avanzarInforme(ruta);
        i = await db.leer<Estado>(ruta);
        console.log(`${Math.round((Date.now() - inicio) / 1000)} s: ${i?.estado} ${i?.modo ?? ''} ${i?.progreso ? `${i.progreso.hechos}/${i.progreso.campos}` : ''}`);
        if (i?.estado === 'redactando' && i.modo === 'lote') await new Promise((r) => setTimeout(r, 20_000));
      }
      expect(i?.error ?? '').toBe('');
      expect(i?.estado).toBe('listo');
      expect(i?.modo).toBe(process.env.PRUEBAS_LOTES ? 'lote' : 'directo');

      const html = fs.readFileSync(rutaLocal(i!.docId)!.ruta, 'utf8');
      console.log(`Informe: .datos/drive/${i!.docId} · ${i!.pendientes} huecos · resumen: ${i!.resumen}`);
      expect(html).not.toMatch(/\{\{ia:/); // todos los campos redactados
      expect(html).not.toContain('Resumen del periodo'); // el texto fijo, traducido
      expect(html).toContain('P-2026-014');
      expect(Object.keys(i!.fuentes ?? {}).length).toBeGreaterThan(0);
      // Lo de trabajo se borra al terminar.
      expect(await db.leer(`${ruta}/trabajo/contexto`)).toBeNull();
      expect((await db.consultar(`${ruta}/campos`)).length).toBe(0);
    },
    30 * 60_000,
  );
});
