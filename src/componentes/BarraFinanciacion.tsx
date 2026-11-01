// Barra de la financiación de un proyecto sobre su presupuesto: lo comprometido debajo y lo
// cobrado y lo enviado encima, con su leyenda. Se usa en el resumen y en la pestaña Financiación.

import { dinero, porcentaje } from '@/lib/formato';

export function BarraFinanciacion({
  comprometido,
  recibido,
  enviado,
  total,
  conComprometido = true,
}: {
  comprometido: number;
  recibido: number;
  enviado: number;
  /** Presupuesto en euros. */
  total: number | null;
  /** En la pestaña Financiación lo comprometido ya se ve en grande: la leyenda no lo repite. */
  conComprometido?: boolean;
}) {
  const ancho = (n: number) => `${Math.min(100, total ? (n / total) * 100 : 0)}%`;
  return (
    <>
      <div className="bar bar-grande bar-etapas" role="img" aria-label={`Comprometido el ${porcentaje(comprometido, total)} % del presupuesto`}>
        <span className="etapa-comprometida" style={{ width: ancho(comprometido) }} />
        <span className="etapa-recibida" style={{ width: ancho(recibido) }} />
        <span className="etapa-enviada" style={{ width: ancho(enviado) }} />
      </div>
      <p className="leyenda fin-leyenda">
        {conComprometido ? (
          <span>
            <span className="leyenda-punto etapa-comprometida" />
            Comprometido {dinero(comprometido)}
          </span>
        ) : null}
        <span>
          <span className="leyenda-punto etapa-recibida" />
          Cobrado {dinero(recibido)}
        </span>
        <span>
          <span className="leyenda-punto etapa-enviada" />
          Enviado {dinero(enviado)}
        </span>
      </p>
    </>
  );
}
