'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navegacion({ porRevisar, admin }: { porRevisar: number; admin: boolean }) {
  const ruta = usePathname();
  const actual = (prefijo: string) =>
    (prefijo === '/' ? ruta === '/' || ruta.startsWith('/proyectos') : ruta.startsWith(prefijo)) ? 'page' : undefined;

  return (
    <nav className="nav" aria-label="Principal">
      <Link href="/" aria-current={actual('/')}>
        Proyectos
      </Link>
      <Link href="/solicitudes" aria-current={actual('/solicitudes')}>
        Solicitudes {porRevisar ? <span className="count" aria-label={`${porRevisar} por revisar`}>{porRevisar}</span> : null}
      </Link>
      <Link href="/donantes" aria-current={actual('/donantes')}>
        Donantes
      </Link>
      <Link href="/contrapartes" aria-current={actual('/contrapartes')}>
        Contrapartes
      </Link>
      {admin ? (
        <Link href="/admin" aria-current={actual('/admin')}>
          Administración
        </Link>
      ) : null}
    </nav>
  );
}
