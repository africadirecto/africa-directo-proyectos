// Pruebas de las reglas que no dependen de Google ni de la base de datos.
// Se ejecutan con: npm test

import { describe, expect, it } from 'vitest';
import { puedePasar, transicionesDesde, indiceFase, estadosManuales, esVueltaAtras, normalizarEstado } from './estados';
import { totales, cubrePresupuesto, excedeCobro, excedeEnvio, fechaValida, importeValido } from './dominio/aportaciones';
import { requiereAtencion } from './dominio/atencion';
import { hojasFinanciacion } from './dominio/financiacionHoja';
import { camposQueFaltan, normalizar, totalPresupuesto, VACIAS } from './formulario/respuestas';
import * as enlaces from './enlaces';
import type { FilaPanel, Proyecto } from './tipos';
import type { AportacionConId } from './dominio/aportaciones';

describe('estados', () => {
  it('sigue el ciclo acordado', () => {
    expect(puedePasar('solicitud', 'revision')).toBe(true);
    expect(puedePasar('revision', 'solicitud')).toBe(true); // pedir cambios
    expect(puedePasar('revision', 'financiacion')).toBe(true); // validar
    expect(puedePasar('financiacion', 'aprobado')).toBe(true);
    expect(puedePasar('aprobado', 'financiacion')).toBe(true);
    expect(puedePasar('ejecucion', 'parado')).toBe(true);
    expect(puedePasar('parado', 'ejecucion')).toBe(true);
    expect(puedePasar('solicitud', 'aprobado')).toBe(false);
    expect(puedePasar('financiacion', 'completado')).toBe(false);
  });

  it('a mano, Financiación y Aprobado solo se eligen al volver desde En ejecución', () => {
    expect(estadosManuales('financiacion', false)).toEqual(['ejecucion', 'cancelado']);
    expect(estadosManuales('aprobado', true)).toEqual(['ejecucion', 'cancelado']);
    expect(estadosManuales('ejecucion', true)).toEqual(['parado', 'completado', 'aprobado', 'cancelado']);
    expect(estadosManuales('ejecucion', false)).toEqual(['parado', 'completado', 'financiacion', 'cancelado']);
    expect(estadosManuales('revision', false)).toEqual(['cancelado']);
    expect(estadosManuales('cancelado', false)).toEqual([]);
    expect(esVueltaAtras('ejecucion', 'aprobado')).toBe(true);
    expect(esVueltaAtras('completado', 'ejecucion')).toBe(true);
    expect(esVueltaAtras('ejecucion', 'cancelado')).toBe(false);
  });

  it('lee «validada» de los datos antiguos como Financiación', () => {
    expect(normalizarEstado('validada')).toBe('financiacion');
    expect(normalizarEstado('aprobado')).toBe('aprobado');
  });

  it('permite cancelar desde cualquier estado que no sea final', () => {
    expect(transicionesDesde('ejecucion')).toContain('cancelado');
    expect(transicionesDesde('solicitud')).toContain('cancelado');
    expect(transicionesDesde('cerrado')).toEqual([]);
    expect(transicionesDesde('cancelado')).toEqual([]);
  });

  it('dibuja Parado en la fase de ejecución', () => {
    expect(indiceFase('parado')).toBe(indiceFase('ejecucion'));
  });
});

describe('financiación', () => {
  it('suma compromisos y cobros por donante, y envíos por proyecto', () => {
    const t = totales(
      [
        { donanteId: 'a', importe: 12000, recibido: 6000 },
        { donanteId: 'b', importe: 6000, recibido: 6000 },
        { donanteId: 'c', importe: 0, recibido: 0 },
      ],
      [{ importe: 5000 }, { importe: 4000 }],
    );
    expect(t).toEqual({ comprometido: 18000, recibido: 12000, enviado: 9000, numDonantes: 2 });
  });

  it('no cobra más de lo comprometido ni envía más de lo cobrado', () => {
    const a = { donanteNombre: 'Horizonte', importe: 12000, recibido: 6000 };
    expect(excedeCobro(a, 6000)).toBeNull();
    expect(excedeCobro(a, 6000.01)).toContain('6.000');
    expect(excedeCobro({ ...a, recibido: 12000 }, 1)).toContain('todo lo comprometido');
    expect(excedeEnvio(16000, 12000, 4000)).toBeNull();
    expect(excedeEnvio(16000, 12000, 4001)).toContain('4.000');
    expect(excedeEnvio(12000, 12000, 1)).toContain('No hay');
  });

  it('comprueba importes y fechas de los movimientos', () => {
    expect(importeValido(1200.456)).toBe(1200.46);
    expect(() => importeValido(0)).toThrow();
    expect(() => importeValido(null)).toThrow();
    expect(fechaValida('', '2026-11-01')).toBe('2026-11-01');
    expect(fechaValida('2026-10-15', '2026-11-01')).toBe('2026-10-15');
    expect(() => fechaValida('2026-12-01', '2026-11-01')).toThrow('futura');
    expect(() => fechaValida('15/10/2026', '2026-11-01')).toThrow();
  });

  it('exporta la financiación con totales que salen de los registros', () => {
    const mov = (id: string, importe: number, fecha: string, nota = '') => ({ id, importe, fecha, nota });
    const p = { codigo: 'P-2026-014', titulo: 'Aula', contraparte: { nombre: 'Sœurs' }, presupuestoEur: 18000, presupuesto: 18000, moneda: 'EUR', envios: [mov('e1', 5000, '2026-09-01', 'Inicio')] } as unknown as Proyecto;
    const a = { donanteNombre: 'Horizonte', compromisos: [mov('k1', 12000, '2026-06-01')], cobros: [mov('c1', 6000, '2026-07-01')] } as unknown as AportacionConId;
    const [resumen, donantes, registros] = hojasFinanciacion(p, [a], '2026-11-01');
    expect(resumen.filas[5][1]).toBe('=SUMAR.SI(Registros!B:B;"Compromiso";Registros!D:D)');
    expect(donantes.filas[1]).toEqual(['Horizonte', expect.stringContaining('"Compromiso"'), expect.stringContaining('"Cobro"'), '=B2-C2']);
    expect(registros.filas.slice(1).map((f) => f[1])).toEqual(['Compromiso', 'Cobro', 'Envío']);
  });

  it('aprueba al cubrir el 100 % del presupuesto', () => {
    expect(cubrePresupuesto(18000, 18000)).toBe(true);
    expect(cubrePresupuesto(18000, 17999)).toBe(false);
    expect(cubrePresupuesto(null, 5000)).toBe(false);
    expect(cubrePresupuesto(0, 0)).toBe(false);
  });
});

describe('formulario', () => {
  it('limpia tipos y longitudes de lo que llega del navegador', () => {
    const r = normalizar({ titulo: 'x'.repeat(1000), lat: '91', numBeneficiarios: '45', lineas: [{ concepto: 'Cemento', importe: '1200,5' }], otro: 'nada' });
    expect(r.titulo.length).toBe(300);
    expect(r.lat).toBeNull();
    expect(r.numBeneficiarios).toBe(45);
    expect(r.lineas).toEqual([{ concepto: 'Cemento', descripcion: '', importe: 1200.5 }]);
    expect('otro' in r).toBe(false);
  });

  it('exige los datos básicos y un presupuesto', () => {
    expect(camposQueFaltan(VACIAS)).toContain('lineas');
    const completo = normalizar({
      organizacion: 'Sœurs',
      contactoNombre: 'Claire',
      contactoCorreo: 'c@example.org',
      titulo: 'Aula',
      sector: 'educacion',
      pais: 'CD',
      lugar: 'Kikwit',
      necesidad: 'Un aula',
      beneficiarios: '45 alumnos',
      moneda: 'EUR',
      lineas: [{ concepto: 'Materiales', importe: 9000 }],
    });
    expect(camposQueFaltan(completo)).toEqual([]);
    expect(totalPresupuesto(completo.lineas)).toBe(9000);
  });
});

describe('requiere atención', () => {
  const ahora = new Date('2026-10-29T12:00:00Z').getTime();
  const fila = (codigo: string, estado: FilaPanel['estado'], dias: number, formulario: FilaPanel['formulario'] = 'cerrado'): FilaPanel => ({
    codigo,
    titulo: codigo,
    sector: '',
    pais: 'CD',
    lugar: '',
    lat: null,
    lng: null,
    estado,
    moneda: 'EUR',
    presupuesto: 1000,
    presupuestoEur: 1000,
    comprometido: 0,
    contraparte: '',
    contraparteId: '',
    inicio: null,
    formulario,
    formularioEnviadoEn: new Date(ahora - dias * 86_400_000).toISOString(),
    ultimaNoticia: new Date(ahora - dias * 86_400_000).toISOString(),
    anio: 2026,
    actualizado: '',
  });

  it('señala proyectos en marcha sin noticias, solicitudes por revisar y formularios olvidados', () => {
    const a = requiereAtencion(
      [fila('A', 'ejecucion', 31), fila('B', 'ejecucion', 5), fila('C', 'cerrado', 200), fila('D', 'revision', 1), fila('E', 'solicitud', 20, 'pendiente'), fila('F', 'solicitud', 3, 'abierto')],
      ahora,
    );
    expect(a.sinNoticias.map((f) => f.codigo)).toEqual(['A']);
    expect(a.porRevisar.map((f) => f.codigo)).toEqual(['D']);
    expect(a.sinResponder.map((f) => f.codigo)).toEqual(['E']);
  });
});

describe('enlaces', () => {
  it('acepta solo tokens firmados con el secreto', () => {
    const id = enlaces.nuevoIdEnlace();
    const token = enlaces.tokenDe(id);
    expect(enlaces.idDeToken(token)).toBe(id);
    expect(enlaces.idDeToken(`${id}.firmafalsa0000000000000`)).toBeNull();
    expect(enlaces.idDeToken(`otroid.${token.split('.')[1]}`)).toBeNull();
    expect(enlaces.idDeToken('sin-punto')).toBeNull();
  });

  it('firma las sesiones de subida por enlace', () => {
    const f = enlaces.firmaSubida('e1', 'https://www.googleapis.com/upload/drive/v3/files?upload_id=x');
    expect(enlaces.comprobarFirmaSubida('e1', 'https://www.googleapis.com/upload/drive/v3/files?upload_id=x', f)).toBe(true);
    expect(enlaces.comprobarFirmaSubida('e2', 'https://www.googleapis.com/upload/drive/v3/files?upload_id=x', f)).toBe(false);
  });

  it('los tokens temporales caducan y no se pueden alterar', () => {
    const ahora = Date.UTC(2026, 10, 1, 12);
    const t = enlaces.tokenTemporal('foto:P-2026-014:abc', 30, ahora);
    expect(enlaces.leerTokenTemporal(t, ahora + 29 * 60_000)).toBe('foto:P-2026-014:abc');
    expect(enlaces.leerTokenTemporal(t, ahora + 31 * 60_000)).toBeNull();
    const [, caduca, firma] = t.split('.');
    const otro = Buffer.from('foto:P-2026-015:abc').toString('base64url');
    expect(enlaces.leerTokenTemporal(`${otro}.${caduca}.${firma}`, ahora)).toBeNull();
    expect(enlaces.leerTokenTemporal(`${t.split('.')[0]}.zzzzzzz.${firma}`, ahora)).toBeNull();
    expect(enlaces.urlFoto('P-2026-014', 'abc', 30, 'https://app.example/')).toMatch(/^https:\/\/app\.example\/api\/foto\/[\w-]+\.[0-9a-z]+\.[\w-]{22}$/);
  });
});
