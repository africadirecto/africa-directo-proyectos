import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requiere, tienePermiso } from '@/lib/sesion';
import { leerDonante, TIPOS_DONANTE } from '@/lib/dominio/donantes';
import { aportacionesDeDonante } from '@/lib/dominio/aportaciones';
import { ESTADOS_APORTACION } from '@/lib/estados';
import { dinero, fechaCorta } from '@/lib/formato';
import { Etiqueta } from '@/componentes/Basicos';
import { FormDonante } from '../FormDonante';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = await leerDonante((await params).id);
  return { title: d?.nombre ?? 'Donante' };
}

export default async function Donante({ params }: { params: Promise<{ id: string }> }) {
  const yo = await requiere('lectura');
  const d = await leerDonante((await params).id);
  if (!d) notFound();
  const aportaciones = await aportacionesDeDonante(d.id);

  return (
    <main className="principal">
      <Link className="volver" href="/donantes">
        ← Donantes
      </Link>
      <div className="titulo-pagina">
        <div>
          <h1>{d.nombre}</h1>
          <p>
            {TIPOS_DONANTE[d.tipo]}
            {d.correo ? ` · ${d.correo}` : ''}
          </p>
        </div>
      </div>
      <div className="fila">
        <section className="card col-ancha" style={{ gap: 8 }}>
          <h2 className="h3">Aportaciones</h2>
          {aportaciones.length ? (
            <div className="desliza">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Proyecto</th>
                    <th scope="col" className="der">
                      Importe
                    </th>
                    <th scope="col">Estado</th>
                    <th scope="col">Actualizada</th>
                  </tr>
                </thead>
                <tbody>
                  {aportaciones.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link className="fuerte" href={`/proyectos/${a.proyecto}?pestana=financiacion`}>
                          {a.proyectoTitulo || a.proyecto}
                        </Link>
                        <span className="sub">{a.proyecto}</span>
                      </td>
                      <td className="der">{dinero(a.importe, a.moneda)}</td>
                      <td>
                        <Etiqueta clase={ESTADOS_APORTACION[a.estado].clase}>{ESTADOS_APORTACION[a.estado].nombre}</Etiqueta>
                      </td>
                      <td>{fechaCorta(a.actualizado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vacio">Este donante todavía no tiene aportaciones.</p>
          )}
        </section>
        <aside className="col-estrecha">
          <section className="card">
            <h2 className="h3">Datos</h2>
            {tienePermiso(yo, 'edicion') ? (
              <FormDonante d={d} />
            ) : (
              <dl className="kv kv-1">
                <div>
                  <dt>Contacto</dt>
                  <dd>{d.contactoNombre || '—'}</dd>
                </div>
                <div>
                  <dt>Informes que pide</dt>
                  <dd>{d.informes || '—'}</dd>
                </div>
                <div>
                  <dt>Notas</dt>
                  <dd>{d.notas || '—'}</dd>
                </div>
              </dl>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
