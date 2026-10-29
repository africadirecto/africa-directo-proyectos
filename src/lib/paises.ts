// Países de África (código ISO) con un punto aproximado para el mapa cuando
// el proyecto aún no tiene coordenadas. Los nombres salen de Intl en cada idioma.

import type { Idioma } from './tipos';

export const PAISES: Record<string, [lat: number, lng: number]> = {
  AO: [-11.2, 17.9], BF: [12.2, -1.6], BI: [-3.4, 29.9], BJ: [9.3, 2.3], BW: [-22.3, 24.7],
  CD: [-2.9, 23.7], CF: [6.6, 20.9], CG: [-0.7, 15.2], CI: [7.5, -5.5], CM: [5.7, 12.4],
  CV: [15.1, -23.6], DJ: [11.8, 42.6], DZ: [28.0, 1.7], EG: [26.8, 30.8], ER: [15.2, 39.8],
  ET: [9.1, 40.5], GA: [-0.8, 11.6], GH: [7.9, -1.0], GM: [13.4, -15.3], GN: [9.9, -9.7],
  GQ: [1.6, 10.3], GW: [11.8, -15.2], KE: [0.0, 37.9], KM: [-11.9, 43.9], LR: [6.4, -9.4],
  LS: [-29.6, 28.2], LY: [26.3, 17.2], MA: [31.8, -7.1], MG: [-18.8, 46.9], ML: [17.6, -4.0],
  MR: [21.0, -10.9], MU: [-20.3, 57.6], MW: [-13.3, 34.3], MZ: [-18.7, 35.5], NA: [-22.6, 17.1],
  NE: [17.6, 8.1], NG: [9.1, 8.7], RW: [-1.9, 29.9], SC: [-4.7, 55.5], SD: [12.9, 30.2],
  SL: [8.5, -11.8], SN: [14.5, -14.5], SO: [5.2, 46.2], SS: [6.9, 31.3], ST: [0.2, 6.6],
  SZ: [-26.5, 31.5], TD: [15.5, 18.7], TG: [8.6, 0.8], TN: [33.9, 9.5], TZ: [-6.4, 34.9],
  UG: [1.4, 32.3], ZA: [-30.6, 22.9], ZM: [-13.1, 27.8], ZW: [-19.0, 29.2],
};

const CORTOS_ES: Record<string, string> = {
  CD: 'RD Congo',
  CF: 'Rep. Centroafricana',
  CG: 'Congo',
};

export function nombrePais(codigo: string, idioma: Idioma = 'es'): string {
  if (!codigo) return '';
  if (idioma === 'es' && CORTOS_ES[codigo]) return CORTOS_ES[codigo];
  try {
    return new Intl.DisplayNames([idioma], { type: 'region' }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/** Países ordenados por nombre en el idioma indicado. */
export function listaPaises(idioma: Idioma = 'es'): { codigo: string; nombre: string }[] {
  return Object.keys(PAISES)
    .map((codigo) => ({ codigo, nombre: nombrePais(codigo, idioma) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, idioma));
}

export const MONEDAS = ['EUR', 'USD', 'XOF', 'XAF', 'CDF', 'KES', 'TZS', 'UGX', 'RWF', 'ETB', 'MWK', 'MZN', 'NGN', 'GHS', 'ZAR', 'AOA', 'MGA'];

export function nombreMoneda(codigo: string, idioma: Idioma = 'es'): string {
  try {
    return new Intl.DisplayNames([idioma], { type: 'currency' }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}
