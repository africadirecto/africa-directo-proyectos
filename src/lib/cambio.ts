// Tipos de cambio aproximados, solo para mostrar al lado de un importe su equivalente en
// euros (no se usan para cálculos de la financiación).
//
// Fuente: la API abierta de ExchangeRate-API (https://www.exchangerate-api.com/docs/free),
// gratuita y sin clave, actualizada una vez al día; pide citarla junto a los importes.
// El servidor la consulta como mucho una vez al día (caché de Next) y, si falla, quedan
// las monedas de paridad fija con el euro.

import { MONEDAS } from './paises';

export const FUENTE_CAMBIO = { nombre: 'ExchangeRate-API', url: 'https://www.exchangerate-api.com' };

/** Unidades de cada moneda por 1 euro, para las monedas con paridad fija. */
const FIJOS: Record<string, number> = {
  EUR: 1,
  XOF: 655.957, // franco CFA de África Occidental
  XAF: 655.957, // franco CFA de África Central
  KMF: 491.96775, // franco comorense
  CVE: 110.265, // escudo caboverdiano
  STN: 24.5, // dobra de Santo Tomé
};

/** Unidades de cada moneda de la app por 1 euro. Las que no se conocen no aparecen. */
export async function tiposDeCambio(): Promise<Record<string, number>> {
  let tasas: Record<string, number> = {};
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(3000) });
    const datos = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (res.ok && datos.result === 'success' && datos.rates) tasas = datos.rates;
  } catch {
    // Sin conexión con la fuente: solo las paridades fijas.
  }
  return Object.fromEntries(MONEDAS.map((m) => [m, FIJOS[m] ?? tasas[m]]).filter(([, t]) => typeof t === 'number' && t > 0));
}

/** Importe en euros, o null si no se conoce el cambio de esa moneda. */
export function enEuros(importe: number, moneda: string, tasas: Record<string, number>): number | null {
  const t = tasas[moneda];
  return t ? importe / t : null;
}
