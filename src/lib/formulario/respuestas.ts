// Limpieza y validación de las respuestas del formulario (navegador y servidor).

import type { ArchivoSubido, LineaPresupuesto, RespuestasSolicitud } from '../tipos';

export const VACIAS: RespuestasSolicitud = {
  organizacion: '',
  contactoNombre: '',
  contactoCargo: '',
  contactoCorreo: '',
  contactoTelefono: '',
  titulo: '',
  sector: '',
  pais: '',
  lugar: '',
  indicaciones: '',
  lat: null,
  lng: null,
  necesidad: '',
  beneficiarios: '',
  numBeneficiarios: null,
  plazoMeses: null,
  aportacionLocal: '',
  moneda: 'EUR',
  lineas: [
    { concepto: '', importe: null },
    { concepto: '', importe: null },
  ],
};

export const OBLIGATORIOS: (keyof RespuestasSolicitud)[] = [
  'organizacion',
  'contactoNombre',
  'contactoCorreo',
  'titulo',
  'sector',
  'pais',
  'lugar',
  'necesidad',
  'beneficiarios',
  'moneda',
  'lineas',
];

const LARGOS: Partial<Record<keyof RespuestasSolicitud, number>> = {
  necesidad: 6000,
  beneficiarios: 3000,
  aportacionLocal: 3000,
  indicaciones: 1000,
};

function textoLimpio(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function numero(v: unknown, min = -Infinity, max = Infinity): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** Convierte lo que llega del navegador en respuestas con tipos y tamaños seguros. */
export function normalizar(entrada: unknown): RespuestasSolicitud {
  const e = (typeof entrada === 'object' && entrada ? entrada : {}) as Record<string, unknown>;
  const r = { ...VACIAS } as Record<string, unknown>;
  for (const clave of Object.keys(VACIAS) as (keyof RespuestasSolicitud)[]) {
    const v = e[clave];
    if (v === undefined) continue;
    switch (clave) {
      case 'lat':
        r[clave] = numero(v, -90, 90);
        break;
      case 'lng':
        r[clave] = numero(v, -180, 180);
        break;
      case 'numBeneficiarios':
        r[clave] = numero(v, 0, 10_000_000);
        break;
      case 'plazoMeses':
        r[clave] = numero(v, 0, 120);
        break;
      case 'lineas':
        r[clave] = (Array.isArray(v) ? v : []).slice(0, 40).map(
          (l): LineaPresupuesto => ({
            concepto: textoLimpio((l as LineaPresupuesto)?.concepto, 200),
            importe: numero((l as LineaPresupuesto)?.importe, 0, 1e10),
          }),
        );
        break;
      default:
        r[clave] = textoLimpio(v, LARGOS[clave] ?? 300);
    }
  }
  return r as unknown as RespuestasSolicitud;
}

export function totalPresupuesto(lineas: LineaPresupuesto[]): number {
  return lineas.reduce((s, l) => s + (l.importe ?? 0), 0);
}

/** Campos obligatorios sin rellenar. */
export function camposQueFaltan(r: RespuestasSolicitud): (keyof RespuestasSolicitud)[] {
  return OBLIGATORIOS.filter((c) => {
    if (c === 'lineas') return totalPresupuesto(r.lineas) <= 0;
    const v = r[c];
    return typeof v === 'string' ? !v.trim() : v == null;
  });
}

/** Comprobaciones sencillas sin IA, en español, para el revisor. */
export function avisosAutomaticos(r: RespuestasSolicitud, archivos: ArchivoSubido[]): string[] {
  const avisos: string[] = [];
  const lineasConImporte = r.lineas.filter((l) => (l.importe ?? 0) > 0);
  if (lineasConImporte.length < 2) avisos.push('El presupuesto no está desglosado por conceptos.');
  if (lineasConImporte.some((l) => !l.concepto.trim())) avisos.push('Hay importes del presupuesto sin concepto.');
  if (!r.numBeneficiarios) avisos.push('No indica el número de beneficiarios.');
  if (!r.plazoMeses) avisos.push('No indica el plazo previsto.');
  if (!archivos.some((a) => a.mime.startsWith('image/'))) avisos.push('No hay fotos del lugar.');
  if (r.lat == null) avisos.push('No tiene la ubicación en el mapa.');
  return avisos;
}
