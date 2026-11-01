'use client';

// «Cobro recibido»: llega a Africa Directo dinero de uno de los donantes del proyecto.

import { useEffect, useRef, useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { cobroAccion } from '@/lib/acciones/financiacion';
import { aNumero, dinero } from '@/lib/formato';

export function FormCobro({ aportaciones: todas, hoy }: { aportaciones: { id: string; nombre: string; porCobrar: number }[]; hoy: string }) {
  // Solo se puede cobrar de quien aún tiene algo pendiente.
  const aportaciones = todas.filter((x) => x.porCobrar > 0);
  // Con un solo donante pendiente, ya viene elegido y con lo que le queda por pagar.
  const unico = aportaciones.length === 1 ? aportaciones[0] : null;
  const inicial = unico?.id ?? '';
  const importeInicial = unico ? String(unico.porCobrar) : '';
  const [elegida, setElegida] = useState(inicial);
  const [importe, setImporte] = useState(importeInicial);
  const a = aportaciones.find((x) => x.id === elegida);
  // Como en el servidor: no se cobra más de lo comprometido. Si se escribe más, no deja guardar.
  const excede = !!a && (aNumero(importe) ?? 0) > a.porCobrar + 0.005;
  const raiz = useRef<HTMLDivElement>(null);

  // Tras registrar el cobro el formulario se vacía: también el donante y el importe.
  useEffect(() => {
    const form = raiz.current?.closest('form');
    const vaciar = () => {
      setElegida(inicial);
      setImporte(importeInicial);
    };
    form?.addEventListener('reset', vaciar);
    return () => form?.removeEventListener('reset', vaciar);
  }, [inicial, importeInicial]);

  // Sin nada pendiente se muestra un aviso, dentro del mismo formulario: así, si se queda sin
  // pendientes al guardar el último cobro, el diálogo se cierra igual.
  return (
    <FormAccion accion={cobroAccion} className="pila" limpiar>
      {!aportaciones.length ? (
        <p className="meta" style={{ margin: 0 }}>
          {todas.length ? 'Todos los donantes han pagado lo que comprometieron.' : 'Primero registra el compromiso de un donante.'}
        </p>
      ) : (
        <>
          <div ref={raiz} hidden />
          <label className="field">
            ¿De qué donante?
            <Desplegable
              name="aportacion"
              required
              buscar
              textoBuscar="Buscar donante…"
              value={elegida}
              onChange={(v) => {
                setElegida(v);
                setImporte(String(aportaciones.find((x) => x.id === v)?.porCobrar ?? ''));
              }}
              opciones={aportaciones.map((x) => ({ valor: x.id, texto: x.nombre }))}
            />
          </label>
          <div className="campos">
            <label className="field" data-error={excede || undefined}>
              Importe (€)
              <input name="importe" inputMode="decimal" required value={importe} onChange={(e) => setImporte(e.target.value)} aria-invalid={excede || undefined} />
              {a && excede ? (
                <span className="error-campo">No se puede cobrar más de lo comprometido: le quedan {dinero(a.porCobrar)} por pagar.</span>
              ) : a ? (
                <span className="pista">Pendiente: {dinero(a.porCobrar)}</span>
              ) : null}
            </label>
            <label className="field">
              Fecha
              <input name="fecha" type="date" required defaultValue={hoy} max={hoy} />
            </label>
          </div>
          <label className="field">
            <span>
              Nota <span className="ayuda">opcional</span>
            </span>
            <input name="nota" maxLength={200} placeholder="Primer plazo" />
          </label>
          <div className="botones">
            <Enviar pendiente="Guardando…" disabled={excede}>
              Guardar
            </Enviar>
          </div>
        </>
      )}
    </FormAccion>
  );
}
