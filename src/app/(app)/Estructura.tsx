'use client';

// Estructura de las pantallas internas: barra lateral a la izquierda con la navegación y el usuario.
// En escritorio se puede plegar (solo iconos); se recuerda en la cookie «barra». En móvil es un
// panel que se abre con el botón de menú de la barra superior.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const COOKIE = 'barra';

const ICONOS = {
  proyectos: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  solicitudes: 'M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z',
  donantes: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  contrapartes: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8',
  plantillas: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  admin: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plegar: 'M4 5h16v14H4zM9 5v14M15.5 10l-2 2 2 2',
  desplegar: 'M4 5h16v14H4zM9 5v14M13.5 10l2 2-2 2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  cerrar: 'M6 6l12 12M18 6 6 18',
} as const;

function Icono({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Estructura({
  plegadaInicial,
  porRevisar,
  admin,
  perfil,
  children,
}: {
  plegadaInicial: boolean;
  porRevisar: number;
  admin: boolean;
  perfil: React.ReactNode;
  children: React.ReactNode;
}) {
  const ruta = usePathname();
  const [plegada, setPlegada] = useState(plegadaInicial);
  const [abierta, setAbierta] = useState(false); // solo móvil
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);

  // Al navegar desde el panel móvil, se cierra.
  useEffect(() => setAbierta(false), [ruta]);

  useEffect(() => {
    if (!abierta) return;
    botonCerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierta(false);
        botonMenu.current?.focus();
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierta]);

  const plegar = () => {
    const nueva = !plegada;
    setPlegada(nueva);
    document.cookie = `${COOKIE}=${nueva ? 'plegada' : 'abierta'}; path=/; max-age=31536000; samesite=lax`;
  };

  const actual = (prefijo: string) =>
    (prefijo === '/' ? ruta === '/' || ruta.startsWith('/proyectos') : ruta.startsWith(prefijo)) ? 'page' : undefined;

  const enlaces: { href: string; nombre: string; icono: string; contador?: number }[] = [
    { href: '/', nombre: 'Proyectos', icono: ICONOS.proyectos },
    { href: '/solicitudes', nombre: 'Solicitudes', icono: ICONOS.solicitudes, contador: porRevisar },
    { href: '/donantes', nombre: 'Donantes', icono: ICONOS.donantes },
    { href: '/contrapartes', nombre: 'Contrapartes', icono: ICONOS.contrapartes },
    { href: '/plantillas', nombre: 'Plantillas', icono: ICONOS.plantillas },
  ];
  if (admin) enlaces.push({ href: '/admin', nombre: 'Administración', icono: ICONOS.admin });

  return (
    <div className="app" data-plegada={plegada || undefined}>
      <header className="barra-movil">
        <button ref={botonMenu} type="button" className="boton-icono" aria-label="Abrir menú" aria-expanded={abierta} aria-controls="lateral" onClick={() => setAbierta(true)}>
          <Icono d={ICONOS.menu} />
        </button>
        <Link href="/" className="logo" aria-label="Africa Directo: inicio">
          <img src="/logo-africadirecto.png" alt="" />
        </Link>
      </header>

      <div className="velo" data-abierta={abierta || undefined} onClick={() => setAbierta(false)} aria-hidden="true" />

      <aside id="lateral" className="lateral" data-abierta={abierta || undefined}>
        <div className="lateral-cabeza">
          <Link href="/" className="logo" aria-label="Africa Directo: inicio">
            <img className="logo-completo" src="/logo-africadirecto.png" alt="" />
            <img className="logo-cara" src="/logo-cara.svg" alt="" />
          </Link>
          <button
            type="button"
            className="boton-icono plegar"
            aria-label={plegada ? 'Desplegar menú' : 'Plegar menú'}
            aria-expanded={!plegada}
            title={plegada ? 'Desplegar menú' : 'Plegar menú'}
            onClick={plegar}
          >
            <Icono d={plegada ? ICONOS.desplegar : ICONOS.plegar} />
          </button>
          <button ref={botonCerrar} type="button" className="boton-icono cerrar-lateral" aria-label="Cerrar menú" onClick={() => setAbierta(false)}>
            <Icono d={ICONOS.cerrar} />
          </button>
        </div>

        <nav className="nav" aria-label="Principal">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} aria-current={actual(e.href)} title={plegada ? e.nombre : undefined}>
              <Icono d={e.icono} />
              <span className="nav-texto">{e.nombre}</span>
              {e.contador ? (
                <span className="count" aria-label={`${e.contador} por revisar`}>
                  {e.contador}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {perfil}
      </aside>

      <div className="contenido">{children}</div>
    </div>
  );
}
