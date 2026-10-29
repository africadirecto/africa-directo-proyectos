import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { config, modoDemo } from '@/lib/config';
import { usuarioActual } from '@/lib/sesion';
import { entrarDemo, salir } from '@/lib/acciones/sesion';
import { asegurarDemo, USUARIOS_DEMO } from '@/lib/demo/semilla';
import { BotonGoogle } from './BotonGoogle';

export const metadata: Metadata = { title: 'Acceso' };

export default async function Acceso() {
  if (modoDemo) await asegurarDemo();
  const u = await usuarioActual();
  if (u?.estado === 'activo') redirect('/');

  return (
    <div className="centro">
      <main className="tarjeta-acceso">
        <div className="marca">
          <img src="/logo-africadirecto.png" alt="Africa Directo" />
          <span className="lema">
            el 100 %<br />
            llega
          </span>
        </div>

        {u ? (
          <div className="pila" style={{ gap: 20 }}>
            <div className="pila" style={{ gap: 8 }}>
              <h1 style={{ fontSize: 26 }}>{u.estado === 'pendiente' ? 'Acceso pendiente' : 'Sin acceso'}</h1>
              <p className="p" style={{ color: 'var(--texto-2)' }}>
                {u.estado === 'pendiente'
                  ? `Hola, ${u.nombre.split(' ')[0]}. Hemos avisado a los administradores. Te escribiremos a ${u.email} cuando puedas entrar.`
                  : 'Tu cuenta no tiene acceso a la gestión de proyectos. Si crees que es un error, habla con un administrador.'}
              </p>
            </div>
            {u.estado === 'pendiente' ? (
              <div className="nota">
                Al principio tendrás acceso de <b>lectura</b>: podrás ver todos los proyectos, pero no cambiarlos.
              </div>
            ) : null}
            <form action={salir}>
              <button type="submit" className="btn btn-s" style={{ width: '100%' }}>
                Salir
              </button>
            </form>
          </div>
        ) : (
          <div className="pila" style={{ gap: 24 }}>
            <div className="pila" style={{ gap: 8 }}>
              <h1 style={{ fontSize: 26 }}>Gestión de proyectos</h1>
              <p className="p" style={{ color: 'var(--texto-2)' }}>
                {modoDemo ? 'Modo de demostración: elige con qué usuario entrar.' : 'Entra con tu cuenta de Google de la ONG.'}
              </p>
            </div>
            {modoDemo ? (
              <form action={entrarDemo} className="pila" style={{ gap: 8 }}>
                {USUARIOS_DEMO.map((d) => (
                  <button key={d.email} type="submit" name="email" value={d.email} className="btn btn-s" style={{ justifyContent: 'space-between' }}>
                    <span>{d.nombre}</span>
                    <span className="meta">{d.etiqueta}</span>
                  </button>
                ))}
              </form>
            ) : (
              <BotonGoogle dominio={config.ong.dominio} />
            )}
            <p className="meta" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {modoDemo
                ? 'Los datos de demostración se guardan en la carpeta .datos de este ordenador.'
                : `Solo cuentas @${config.ong.dominio}. La primera vez, un administrador tiene que darte acceso.`}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
