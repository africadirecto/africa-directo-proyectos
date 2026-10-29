'use client';

import { useState, useTransition } from 'react';
import { marcarPublicableAccion } from '@/lib/acciones/proyectos';

export function Publicable({ codigo, id, nombre, inicial }: { codigo: string; id: string; nombre: string; inicial: boolean }) {
  const [valor, setValor] = useState(inicial);
  const [error, setError] = useState('');
  const [pendiente, empezar] = useTransition();

  return (
    <label className="check" style={{ minHeight: 32, fontSize: 14 }}>
      <input
        type="checkbox"
        checked={valor}
        disabled={pendiente}
        onChange={(e) => {
          const nuevo = e.target.checked;
          setValor(nuevo);
          setError('');
          empezar(async () => {
            const r = await marcarPublicableAccion(codigo, id, nombre, nuevo);
            if (!r.ok) {
              setValor(!nuevo);
              setError(r.mensaje ?? 'No se pudo guardar');
            }
          });
        }}
      />
      Publicable
      {error ? <span className="warn">{error}</span> : null}
    </label>
  );
}
