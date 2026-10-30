// Pruebas de las reglas que no dependen de Google ni de la base de datos.
// Se ejecutan con: npm test

import { describe, expect, it } from 'vitest';
import { puedePasar, transicionesDesde, indiceFase } from './estados';
import { totales, cubrePresupuesto } from './dominio/aportaciones';
import { requiereAtencion } from './dominio/atencion';
import { camposQueFaltan, normalizar, totalPresupuesto, VACIAS } from './formulario/respuestas';
import * as enlaces from './enlaces';
import type { FilaPanel } from './tipos';

describe('estados', () => {
  it('sigue el ciclo acordado', () => {
    expect(puedePasar('solicitud', 'revision')).toBe(true);
    expect(puedePasar('revision', 'solicitud')).toBe(true); // pedir cambios
    expect(puedePasar('revision', 'validada')).toBe(true);
    expect(puedePasar('ejecucion', 'parado')).toBe(true);
    expect(puedePasar('parado', 'ejecucion')).toBe(true);
    expect(puedePasar('solicitud', 'aprobado')).toBe(false);
    expect(puedePasar('validada', 'ejecucion')).toBe(false);
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
  const ap = (estado: 'ofrecida' | 'comprometida' | 'recibida' | 'descartada', importe: number, donanteId = 'a') => ({
    estado,
    importe,
    donanteId,
  });

  it('solo cuenta lo comprometido o recibido', () => {
    const t = totales([ap('comprometida', 12000, 'a'), ap('recibida', 6000, 'b'), ap('ofrecida', 5000, 'c'), ap('descartada', 9000, 'd')]);
    expect(t).toEqual({ comprometido: 18000, recibido: 6000, numDonantes: 2 });
  });

  it('aprueba al cubrir el 100 % del presupuesto en financiación', () => {
    expect(cubrePresupuesto('financiacion', 18000, 18000)).toBe(true);
    expect(cubrePresupuesto('financiacion', 18000, 17999)).toBe(false);
    expect(cubrePresupuesto('validada', 18000, 18000)).toBe(false);
    expect(cubrePresupuesto('financiacion', null, 5000)).toBe(false);
  });
});

describe('formulario', () => {
  it('limpia tipos y longitudes de lo que llega del navegador', () => {
    const r = normalizar({ titulo: 'x'.repeat(1000), lat: '91', numBeneficiarios: '45', lineas: [{ concepto: 'Cemento', importe: '1200,5' }], otro: 'nada' });
    expect(r.titulo.length).toBe(300);
    expect(r.lat).toBeNull();
    expect(r.numBeneficiarios).toBe(45);
    expect(r.lineas).toEqual([{ concepto: 'Cemento', importe: 1200.5 }]);
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
});
