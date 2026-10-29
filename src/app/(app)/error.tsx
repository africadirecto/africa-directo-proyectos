'use client';

// Pantalla de error de las páginas internas.

import Link from 'next/link';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="principal" style={{ maxWidth: 640 }}>
      <h1>Algo ha fallado</h1>
      <p className="p">No se ha podido cargar la página. Vuelve a intentarlo; si sigue fallando, avisa a quien mantiene la aplicación.</p>
      <div className="botones">
        <button type="button" className="btn btn-p" onClick={reset}>
          Reintentar
        </button>
        <Link className="btn btn-s" href="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
