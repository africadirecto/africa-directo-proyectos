// Lo que requiere atención, calculado a partir del índice del panel.

import { EN_MARCHA } from '../estados';
import { diasDesde } from '../formato';
import type { FilaPanel } from '../tipos';

export const DIAS_SIN_NOTICIAS = 30;
export const DIAS_SIN_RESPONDER = 14;

export function requiereAtencion(filas: FilaPanel[], ahora = Date.now()) {
  return {
    sinNoticias: filas.filter((f) => EN_MARCHA.includes(f.estado) && diasDesde(f.ultimaNoticia, ahora) > DIAS_SIN_NOTICIAS),
    porRevisar: filas.filter((f) => f.estado === 'revision'),
    sinResponder: filas.filter(
      (f) => f.estado === 'solicitud' && f.formulario !== 'cerrado' && diasDesde(f.formularioEnviadoEn, ahora) > DIAS_SIN_RESPONDER,
    ),
  };
}
