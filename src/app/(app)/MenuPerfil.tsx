'use client';

// Menú del usuario en la cabecera: se abre al pulsar el perfil. Por ahora solo «Cerrar sesión».

import { useEffect, useRef, useState } from 'react';

export function MenuPerfil({
  iniciales,
  nombre,
  email,
  permiso,
  salir,
}: {
  iniciales: string;
  nombre: string;
  email: string;
  permiso: string;
  salir: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const primera = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    primera.current?.focus();
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className="perfil">
      <button
        ref={boton}
        type="button"
        className="yo"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls="menu-perfil"
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="avatar" aria-hidden="true">
          {iniciales}
        </span>
        <span className="yo-datos">
          <b>{nombre}</b>
          <span>{permiso}</span>
        </span>
        <svg className="desplegable-flecha" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto ? (
        <div id="menu-perfil" className="perfil-menu" role="menu" aria-label="Opciones de usuario">
          <p className="perfil-correo">{email}</p>
          <form action={salir}>
            <button ref={primera} type="submit" role="menuitem" className="perfil-opcion">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
