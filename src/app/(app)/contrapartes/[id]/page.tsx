import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requiere, tienePermiso } from '@/lib/sesion';
import { leerContraparte } from '@/lib/dominio/contrapartes';
import { leerIndice } from '@/lib/dominio/indice';
import { listarInformesGenerales } from '@/lib/dominio/informesGenerales';
import { ACTIVOS } from '@/lib/estados';
import { nombrePais } from '@/lib/paises';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import { dinero, fechaLarga } from '@/lib/formato';
import { Estado } from '@/componentes/Basicos';
import { Bandera } from '@/componentes/Desplegable';
import { Dialogo } from '@/componentes/Dialogo';
import { ListaInformes } from '@/componentes/ListaInformes';
import { BotonInformeGeneral } from '../../BotonInformeGeneral';
import { eurDe } from '@/lib/panel';
import { FormContraparte } from '../FormContraparte';

export const maxDuration = 180;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await leerContraparte((await params).id);
  return { title: c?.nombre ?? 'Contraparte' };
}

export default async function ContraparteFicha({ params }: { params: Promise<{ id: string }> }) {
  const yo = await requiere('lectura');
  const c = await leerContraparte((await params).id);
  if (!c) notFound();
  const filas = (await leerIndice()).filter((f) => f.contraparteId === c.id);
  const editor = tienePermiso(yo, 'edicion');
  const presupuesto = filas.reduce((s, f) => s + eurDe(f), 0);

  return (
    <main className="principal">
      <Link className="volver" href="/contrapartes">
        ← Contrapartes
      </Link>
      <div className="titulo-pagina">
        <div>
          <h1>{c.nombre}</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Bandera codigo={c.pais} /> {nombrePais(c.pais)}
            {c.tipo ? ` · ${c.tipo}` : ''} · escribe en {IDIOMAS_ES[c.idioma].toLowerCase()}
          </p>
        </div>
        <div className="botones">
          {editor && filas.length ? <BotonInformeGeneral tipo="contraparte" sobre={c.id} /> : null}
          {tienePermiso(yo, 'admin') ? (
            <Dialogo boton="Editar" claseBoton="btn btn-s" titulo={c.nombre}>
              <FormContraparte c={c} />
            </Dialogo>
          ) : null}
        </div>
      </div>

      <div className="fila">
        <section className="card" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <h2 className="h3">Contacto</h2>
          <dl className="kv kv-1">
            <div>
              <dt>Persona de contacto</dt>
              <dd>{c.contactoNombre || '—'}</dd>
            </div>
            <div>
              <dt>Correos</dt>
              <dd>{c.correos.length ? c.correos.join(', ') : '—'}</dd>
            </div>
            <div>
              <dt>Teléfono o WhatsApp</dt>
              <dd>{c.telefono || '—'}</dd>
            </div>
            <div>
              <dt>Notas</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{c.notas || '—'}</dd>
            </div>
            <div>
              <dt>Alta</dt>
              <dd>{fechaLarga(c.creado)}</dd>
            </div>
          </dl>
        </section>
        <section className="card" style={{ flex: '999 1 520px', minWidth: 0 }}>
          <h2 className="h3">Proyectos</h2>
          <p className="meta" style={{ margin: '-6px 0 10px' }}>
            {filas.length} proyecto{filas.length === 1 ? '' : 's'} · {filas.filter((f) => ACTIVOS.includes(f.estado)).length} activos · {dinero(presupuesto)} de presupuesto
          </p>
          {filas.length ? (
            <div className="desliza">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Proyecto</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="der">
                      Presupuesto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.codigo}>
                      <td>
                        <Link className="fuerte" href={`/proyectos/${f.codigo}`}>
                          {f.titulo || `Solicitud de ${f.contraparte}`}
                        </Link>
                        <span className="sub">
                          {f.codigo} · {f.anio}
                        </span>
                      </td>
                      <td>
                        <Estado estado={f.estado} />
                      </td>
                      <td className="der">{eurDe(f) ? dinero(eurDe(f)) : <span className="meta">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vacio">Todavía no tiene proyectos.</p>
          )}
        </section>
      </div>
      <ListaInformes informes={await listarInformesGenerales('contraparte', c.id)} editor={editor} titulo="Informes de esta contraparte" />
    </main>
  );
}
