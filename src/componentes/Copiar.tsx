'use client';

import { useId, useState } from 'react';

/** Campo de solo lectura con un botón para copiar su contenido. */
export function Copiar({ valor, etiqueta = 'Enlace', multilinea = false }: { valor: string; etiqueta?: string; multilinea?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const id = useId();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el navegador no lo permite: se puede seleccionar a mano */
    }
  };
  return (
    <div className="enlace-copiar">
      <label className="oculto" htmlFor={id}>
        {etiqueta}
      </label>
      {multilinea ? (
        <textarea id={id} readOnly value={valor} rows={6} onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <input id={id} readOnly value={valor} onFocus={(e) => e.currentTarget.select()} />
      )}
      <button type="button" className="btn btn-s" onClick={copiar}>
        {copiado ? 'Copiado ✓' : 'Copiar'}
      </button>
    </div>
  );
}
