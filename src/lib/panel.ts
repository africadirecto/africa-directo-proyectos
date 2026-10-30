// Utilidades sobre las filas del índice del panel, para el servidor y el navegador.

import type { FilaPanel } from './tipos';

/** Presupuesto en euros de una fila del índice (las antiguas pueden no tenerlo). */
export const eurDe = (f: FilaPanel) => f.presupuestoEur ?? (f.moneda === 'EUR' ? (f.presupuesto ?? 0) : 0);
