// Estructura común de las pantallas internas: cabecera con navegación y usuario.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioActual, tienePermiso } from '@/lib/sesion';
import { leerIndice } from '@/lib/dominio/indice';
import { iniciales } from '@/lib/formato';
import { salir } from '@/lib/acciones/sesion';
import { comprobarConfig, modoDemo } from '@/lib/config';
import { Navegacion } from './Navegacion';

const PERMISOS = { lectura: 'Lectura', edicion: 'Edición', admin: 'Administración' };

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await usuarioActual();
  if (!u || u.estado !== 'activo') redirect('/acceso');
  const porRevisar = (await leerIndice()).filter((f) => f.estado === 'revision').length;
  const faltan = comprobarConfig();

  return (
    <>
      <header className="cabecera">
        <div>
          <Link href="/" className="logo" aria-label="Africa Directo: inicio">
            <img src="/logo-cara.svg" alt="" />
          </Link>
          <Navegacion porRevisar={porRevisar} admin={tienePermiso(u, 'admin')} />
          <div className="yo">
            <span className="avatar" aria-hidden="true">
              {iniciales(u.nombre || u.email)}
            </span>
            <span className="yo-datos">
              <b>{u.nombre || u.email}</b>
              <span>{PERMISOS[u.permiso]}</span>
            </span>
            <form action={salir}>
              <button type="submit" className="salir">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      {modoDemo ? (
        <p className="meta" style={{ margin: 0, padding: '6px 24px', textAlign: 'center', background: 'var(--aviso-fondo)' }}>
          Modo de demostración: los datos son de ejemplo y no se envían correos.
        </p>
      ) : null}
      {faltan.length && tienePermiso(u, 'admin') ? (
        <p className="aviso-error" style={{ margin: 0, borderRadius: 0, textAlign: 'center' }}>
          Falta configuración: {faltan.join(', ')}. Ver docs/DESPLIEGUE.md.
        </p>
      ) : null}
      {children}
    </>
  );
}
