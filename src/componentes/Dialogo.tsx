'use client';

// Botón que abre un diálogo modal (elemento <dialog> nativo, accesible con teclado).

import { createContext, useCallback, useMemo, useRef } from 'react';

export const ContextoDialogo = createContext<{ cerrar: () => void } | null>(null);

export function Dialogo({
  boton,
  claseBoton = 'btn btn-s',
  titulo,
  children,
}: {
  boton: React.ReactNode;
  claseBoton?: string;
  titulo: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cerrar = useCallback(() => ref.current?.close(), []);
  const valor = useMemo(() => ({ cerrar }), [cerrar]);

  return (
    <>
      <button type="button" className={claseBoton} onClick={() => ref.current?.showModal()}>
        {boton}
      </button>
      <dialog ref={ref} className="dialogo" aria-label={titulo}>
        <div className="cuerpo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2>{titulo}</h2>
            <button type="button" className="btn btn-s btn-peq" onClick={cerrar} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <ContextoDialogo.Provider value={valor}>{children}</ContextoDialogo.Provider>
        </div>
      </dialog>
    </>
  );
}
