'use client';

// «Envío a la contraparte»: Africa Directo transfiere dinero del proyecto a la contraparte.
// Como mucho, lo cobrado que aún no se ha enviado: si se escribe más, no deja guardar.

import { useEffect, useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { envioAccion } from '@/lib/acciones/financiacion';
import { aNumero, dinero } from '@/lib/formato';

export function FormEnvio({ codigo, disponible, hoy }: { codigo: string; /** Cobrado y aún sin enviar. */ disponible: number; hoy: string }) {
  const [importe, setImporte] = useState(String(disponible));
  // Tras guardar cambia lo disponible: la casilla vuelve a proponerlo.
  useEffect(() => setImporte(String(disponible)), [disponible]);
  const excede = (aNumero(importe) ?? 0) > disponible + 0.005;

  // El aviso va dentro del formulario para que el diálogo se cierre al enviar todo lo disponible.
  return (
    <FormAccion accion={envioAccion} className="pila" limpiar>
      {disponible <= 0 ? (
        <p className="meta" style={{ margin: 0 }}>
          No hay dinero cobrado sin enviar. Registra antes el cobro de un donante.
        </p>
      ) : (
        <>
          <input type="hidden" name="codigo" value={codigo} />
          <div className="campos">
            <label className="field" data-error={excede || undefined}>
              Importe (€)
              <input name="importe" inputMode="decimal" required value={importe} onChange={(e) => setImporte(e.target.value)} aria-invalid={excede || undefined} />
              {excede ? (
                <span className="error-campo">No se puede enviar más de lo cobrado: hay {dinero(disponible)} disponibles.</span>
              ) : (
                <span className="pista">Disponible: {dinero(disponible)}</span>
              )}
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
            <input name="nota" maxLength={200} placeholder="Inicio de obra" />
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
