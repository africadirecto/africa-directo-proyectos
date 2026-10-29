import type { Metadata } from 'next';
import { requiere } from '@/lib/sesion';
import { listarUsuarios } from '@/lib/dominio/usuarios';
import { fechaCorta, haceDias } from '@/lib/formato';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Dialogo } from '@/componentes/Dialogo';
import { aprobarAccion, invitarAccion, quitarAccesoAccion } from '@/lib/acciones/admin';
import { SelectorPermiso } from './SelectorPermiso';

export const metadata: Metadata = { title: 'Usuarios y permisos' };

export default async function Usuarios() {
  const yo = await requiere('admin');
  const usuarios = await listarUsuarios();
  const pendientes = usuarios.filter((u) => u.estado === 'pendiente');
  const activos = usuarios.filter((u) => u.estado === 'activo');
  const sinAcceso = usuarios.filter((u) => u.estado === 'rechazado');

  return (
    <>
      <h1>Usuarios y permisos</h1>

      <section className="card" aria-labelledby="pend-t">
        <h2 id="pend-t" className="h2">
          Accesos pendientes · {pendientes.length}
        </h2>
        <p className="meta" style={{ margin: '4px 0' }}>
          Personas de la ONG que han entrado con Google y esperan acceso.
        </p>
        {pendientes.map((u) => (
          <div key={u.email} className="req">
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{u.nombre}</p>
              <p className="meta" style={{ margin: '2px 0 0' }}>
                {u.email} · pidió acceso el {fechaCorta(u.creado)}
              </p>
            </div>
            <div className="botones" style={{ gap: 8 }}>
              <FormAccion accion={aprobarAccion} ocultarOk>
                <input type="hidden" name="email" value={u.email} />
                <Enviar pendiente="Dando acceso…">Dar acceso de lectura</Enviar>
              </FormAccion>
              <FormAccion accion={quitarAccesoAccion} ocultarOk>
                <input type="hidden" name="email" value={u.email} />
                <Enviar clase="btn btn-d">Rechazar</Enviar>
              </FormAccion>
            </div>
          </div>
        ))}
        {!pendientes.length ? <p className="vacio">No hay peticiones pendientes.</p> : null}
      </section>

      <section className="card" aria-labelledby="usr-t">
        <div className="card-cab">
          <h2 id="usr-t" className="h2">
            Usuarios · {activos.length}
          </h2>
          <Dialogo boton="Dar acceso por correo" titulo="Dar acceso por correo">
            <FormAccion accion={invitarAccion} className="pila" limpiar>
              <p className="meta" style={{ margin: 0 }}>
                Así no tendrá que esperar la aprobación: al entrar con Google ya tendrá el permiso elegido.
              </p>
              <label className="field">
                Correo de la ONG
                <input name="email" type="email" required />
              </label>
              <label className="field">
                Permiso
                <select name="permiso" defaultValue="lectura">
                  <option value="lectura">Lectura</option>
                  <option value="edicion">Edición</option>
                  <option value="admin">Administración</option>
                </select>
              </label>
              <div className="botones">
                <Enviar pendiente="Guardando…">Dar acceso</Enviar>
              </div>
            </FormAccion>
          </Dialogo>
        </div>
        <div className="desliza">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Permiso</th>
                <th scope="col">Último acceso</th>
                <th scope="col">
                  <span className="oculto">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {activos.map((u) => (
                <tr key={u.email}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{u.nombre || '(todavía no ha entrado)'}</span>
                    <span className="sub">
                      {u.email}
                      {u.email === yo.email ? ' · tú' : ''}
                    </span>
                  </td>
                  <td>
                    <SelectorPermiso email={u.email} nombre={u.nombre} permiso={u.permiso} propio={u.email === yo.email} />
                  </td>
                  <td>{u.ultimoAcceso ? haceDias(u.ultimoAcceso) : '—'}</td>
                  <td className="der">
                    {u.email !== yo.email ? (
                      <FormAccion accion={quitarAccesoAccion} confirmar={`¿Quitar el acceso a ${u.nombre || u.email}?`}>
                        <input type="hidden" name="email" value={u.email} />
                        <Enviar clase="btn btn-d btn-peq">Quitar acceso</Enviar>
                      </FormAccion>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sinAcceso.length ? (
          <details className="desplegable" style={{ marginTop: 12 }}>
            <summary className="btn-enlace">Ver personas sin acceso ({sinAcceso.length})</summary>
            {sinAcceso.map((u) => (
              <div key={u.email} className="req">
                <span>
                  {u.nombre} <span className="meta">· {u.email}</span>
                </span>
                <FormAccion accion={aprobarAccion} ocultarOk>
                  <input type="hidden" name="email" value={u.email} />
                  <Enviar clase="btn btn-s btn-peq">Devolver acceso de lectura</Enviar>
                </FormAccion>
              </div>
            ))}
          </details>
        ) : null}
      </section>

      <section className="card" aria-labelledby="perm-t">
        <h2 id="perm-t" className="h2" style={{ marginBottom: 12 }}>
          Qué permite cada permiso
        </h2>
        <div className="perm">
          <div>
            <b>Lectura</b>
            <p>Ver proyectos, solicitudes, donantes y archivos. Es el permiso inicial.</p>
          </div>
          <div>
            <b>Edición</b>
            <p>Además: registrar y revisar solicitudes, cambiar estados, editar proyectos, añadir donantes, aportaciones y notas.</p>
          </div>
          <div>
            <b>Administración</b>
            <p>Además: dar y quitar accesos, y gestionar contrapartes y ajustes.</p>
          </div>
        </div>
      </section>
    </>
  );
}
