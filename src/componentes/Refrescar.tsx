'use client';

// Vuelve a pedir la página cada pocos segundos (para algo que se hace en segundo plano, como una
// plantilla que se está preparando). Deja de hacerlo a los 20 minutos.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function Refrescar({ segundos = 5 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const inicio = Date.now();
    const t = setInterval(() => {
      if (Date.now() - inicio > 20 * 60_000) clearInterval(t);
      else router.refresh();
    }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
