'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECCIONES = [
  ['/admin', 'Usuarios y permisos'],
  ['/admin/ajustes', 'Ajustes'],
] as const;

export function MenuAdmin() {
  const ruta = usePathname();
  return (
    <nav className="side" aria-label="Administración">
      {SECCIONES.map(([href, nombre]) => (
        <Link key={href} href={href} aria-current={ruta === href ? 'page' : undefined}>
          {nombre}
        </Link>
      ))}
    </nav>
  );
}
