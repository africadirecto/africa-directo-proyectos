'use client';

// Una explicación breve que aparece al pasar el ratón por encima, al tocar (en el móvil) o al
// llegar con el teclado. Se corre a un lado si no cabe en la pantalla.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export function Globo({ texto, children }: { texto: string; children: React.ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  const [izquierda, setIzquierda] = useState(0);
  const raiz = useRef<HTMLSpanElement>(null);
  const burbuja = useRef<HTMLSpanElement>(null);
  // Con ratón manda el paso por encima; el clic solo cuenta al tocar.
  const puntero = useRef('');
  const id = useId();

  // Centrado bajo la etiqueta, salvo que se salga de la pantalla (8 px de margen).
  useLayoutEffect(() => {
    if (!abierta) return;
    const caja = raiz.current!.getBoundingClientRect();
    const ancho = burbuja.current!.offsetWidth;
    const pantalla = document.documentElement.clientWidth;
    const x = Math.min(Math.max(caja.left + caja.width / 2 - ancho / 2, 8), pantalla - 8 - ancho);
    setIzquierda(x - caja.left);
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierta(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(false);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierta]);

  return (
    <span
      ref={raiz}
      className="globo"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setAbierta(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setAbierta(false)}
    >
      <button
        type="button"
        className="globo-boton"
        aria-describedby={id}
        onPointerDown={(e) => (puntero.current = e.pointerType)}
        onClick={() => {
          if (puntero.current !== 'mouse') setAbierta((a) => !a);
          puntero.current = '';
        }}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setAbierta(true)}
        onBlur={() => setAbierta(false)}
      >
        {children}
      </button>
      <span ref={burbuja} id={id} role="tooltip" className="globo-texto" hidden={!abierta} style={{ left: izquierda }}>
        {texto}
      </span>
    </span>
  );
}
