import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <div className="centro">
      <main className="tarjeta-acceso">
        <h1 style={{ fontSize: 26 }}>No encontrado</h1>
        <p className="p">Esta página no existe o se ha movido.</p>
        <Link className="btn btn-s" href="/">
          Ir al inicio
        </Link>
      </main>
    </div>
  );
}
