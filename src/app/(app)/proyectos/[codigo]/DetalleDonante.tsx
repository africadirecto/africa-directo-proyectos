// Un donante del proyecto: una fila que se despliega al pulsarla y muestra sus registros
// (compromisos y cobros) por fecha. Quien edita puede quitar un registro hecho por error;
// si un donante se queda sin registros, sale del proyecto.

import Link from 'next/link';
import { dinero, fechaCorta } from '@/lib/formato';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { IconoHecho } from '@/componentes/Iconos';
import { quitarCobroAccion, quitarCompromisoAccion } from '@/lib/acciones/financiacion';
import type { AportacionConId } from '@/lib/dominio/aportaciones';

const dia = (fecha: string) => fechaCorta(`${fecha}T12:00:00Z`);

/** Botón ✕ para quitar un registro hecho por error. */
export function Quitar({ accion, campos, pregunta }: { accion: typeof quitarCobroAccion; campos: Record<string, string>; pregunta: string }) {
  return (
    <FormAccion accion={accion} confirmar={pregunta} className="fin-quitar">
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Enviar clase="btn-icono" pendiente="…">
        <span aria-hidden="true">✕</span>
        <span className="oculto">Quitar</span>
      </Enviar>
    </FormAccion>
  );
}

export function DetalleDonante({ a, editor }: { a: AportacionConId; editor: boolean }) {
  const porCobrar = Math.max(0, a.importe - a.recibido);
  const registros = [
    ...a.compromisos.map((m) => ({ ...m, tipo: 'Compromiso' as const })),
    ...a.cobros.map((m) => ({ ...m, tipo: 'Cobro' as const })),
  ].sort((x, y) => x.fecha.localeCompare(y.fecha));

  return (
    <details className="fin-donante">
      <summary className="fin-fila">
        <span>
          {a.donanteNombre}
          {porCobrar ? (
            <span className="fin-pendiente">Faltan {dinero(porCobrar)}</span>
          ) : (
            <span className="fin-cobrado" title="Todo cobrado">
              <IconoHecho tamano={14} />
              <span className="oculto">Todo cobrado</span>
            </span>
          )}
        </span>
        <span className="fin-importe">
          {dinero(a.recibido)} <span className="meta">/ {dinero(a.importe)}</span>
        </span>
        <svg className="fin-flecha" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul className="fin-lista fin-registros">
        {registros.map((r) => (
          <li key={`${r.tipo}-${r.id}`} className="fin-fila">
            <span>
              <span className="fin-tipo">{r.tipo}</span>
              {dia(r.fecha)}
              {r.nota ? <span className="meta"> · {r.nota}</span> : null}
            </span>
            <span className="fin-importe">{dinero(r.importe)}</span>
            {editor ? (
              <Quitar
                accion={r.tipo === 'Cobro' ? quitarCobroAccion : quitarCompromisoAccion}
                campos={{ aportacion: a.id, registro: r.id }}
                pregunta={`¿Quitar ${r.tipo === 'Cobro' ? 'el cobro' : 'el compromiso'} de ${a.donanteNombre} de ${dinero(r.importe)} del ${dia(r.fecha)}?`}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <p className="fin-pie">
        <Link className="btn-enlace" href={`/donantes/${a.donanteId}`}>
          Ficha del donante →
        </Link>
      </p>
    </details>
  );
}
