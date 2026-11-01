// Estructura común de las pantallas internas: barra lateral con navegación y usuario.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { usuarioActual, tienePermiso } from '@/lib/sesion';
import { leerIndice } from '@/lib/dominio/indice';
import { iniciales } from '@/lib/formato';
import { salir } from '@/lib/acciones/sesion';
import { comprobarConfig, modoDemo } from '@/lib/config';
import { Estructura } from './Estructura';
import { MenuPerfil } from './MenuPerfil';

const PERMISOS = { lectura: 'Lectura', edicion: 'Edición', admin: 'Administración' };

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await usuarioActual();
  if (!u || u.estado !== 'activo') redirect('/acceso');
  const porRevisar = (await leerIndice()).filter((f) => f.estado === 'revision').length;
  const faltan = comprobarConfig();
  const plegada = (await cookies()).get('barra')?.value === 'plegada';

  return (
    <Estructura
      plegadaInicial={plegada}
      porRevisar={porRevisar}
      admin={tienePermiso(u, 'admin')}
      perfil={<MenuPerfil iniciales={iniciales(u.nombre || u.email)} nombre={u.nombre || u.email} email={u.email} permiso={PERMISOS[u.permiso]} salir={salir} />}
    >
      {modoDemo ? (
        <p className="meta" style={{ margin: 0, padding: '6px 24px', textAlign: 'center', background: 'var(--aviso-fondo)' }}>
          Modo de demostración: los datos son de ejemplo.
        </p>
      ) : null}
      {faltan.length && tienePermiso(u, 'admin') ? (
        <p className="aviso-error" style={{ margin: 0, borderRadius: 0, textAlign: 'center' }}>
          Falta configuración: {faltan.join(', ')}. Ver docs/DESPLIEGUE.md.
        </p>
      ) : null}
      {children}
    </Estructura>
  );
}
