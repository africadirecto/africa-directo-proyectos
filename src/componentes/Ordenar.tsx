'use client';

// Tablas que se ordenan pulsando la cabecera de una columna: una vez, ascendente; otra,
// descendente; la tercera vuelve al orden de siempre.

import { useMemo, useState } from 'react';

export interface Orden<C extends string> {
  columna: C;
  dir: 'asc' | 'desc';
}

type Valor = string | number | null | undefined;

/** Ordena `filas` por la columna elegida; sin ninguna, las deja como vienen. Lo vacío, al final. */
export function useOrden<T, C extends string>(filas: T[], valores: Record<C, (fila: T) => Valor>, inicial: Orden<C> | null = null) {
  const [orden, setOrden] = useState<Orden<C> | null>(inicial);
  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const valor = valores[orden.columna];
    const s = orden.dir === 'asc' ? 1 : -1;
    const vacio = (v: Valor) => v == null || v === '';
    return [...filas].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (vacio(va) || vacio(vb)) return vacio(va) ? (vacio(vb) ? 0 : 1) : -1;
      return s * (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `valores` es fijo en cada tabla
  }, [filas, orden]);
  const alternar = (columna: C) =>
    setOrden((o) => (o?.columna !== columna ? { columna, dir: 'asc' } : o.dir === 'asc' ? { columna, dir: 'desc' } : inicial?.columna === columna ? { columna, dir: 'asc' } : inicial));
  return { ordenadas, orden, alternar };
}

/** Cabecera de columna que ordena al pulsarla. */
export function ThOrden<C extends string>({
  columna,
  orden,
  alternar,
  className,
  children,
}: {
  columna: C;
  orden: Orden<C> | null;
  alternar: (columna: C) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const dir = orden?.columna === columna ? orden.dir : null;
  return (
    <th scope="col" className={className} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}>
      <button type="button" className="th-orden" onClick={() => alternar(columna)} title="Ordenar por esta columna">
        {children}
        <span aria-hidden="true" className="th-flecha">
          {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
        </span>
      </button>
    </th>
  );
}
