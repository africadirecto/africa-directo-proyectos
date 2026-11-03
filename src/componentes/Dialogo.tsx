'use client';

// Botón que abre un diálogo modal (elemento <dialog> nativo, accesible con teclado). Sin `boton`,
// solo el diálogo: lo abre otro elemento con abrirDialogo(id) (p. ej. una opción de un menú).

import { createContext, useCallback, useMemo, useRef } from 'react';

export const ContextoDialogo = createContext<{ cerrar: () => void } | null>(null);

export const abrirDialogo = (id: string) => (document.getElementById(id) as HTMLDialogElement | null)?.showModal();

export function Dialogo({
  boton,
  claseBoton = 'btn btn-s',
  titulo,
  id,
  children,
}: {
  boton?: React.ReactNode;
  claseBoton?: string;
  titulo: string;
  id?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cerrar = useCallback(() => ref.current?.close(), []);
  const valor = useMemo(() => ({ cerrar }), [cerrar]);

  return (
    <>
      {boton ? (
        <button type="button" className={claseBoton} onClick={() => ref.current?.showModal()}>
          {boton}
        </button>
      ) : null}
      <dialog ref={ref} id={id} className="dialogo" aria-label={titulo}>
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
