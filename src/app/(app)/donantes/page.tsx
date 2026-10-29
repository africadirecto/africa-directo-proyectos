import type { Metadata } from 'next';
import Link from 'next/link';
import { requiere, tienePermiso } from '@/lib/sesion';
import { listarDonantes, TIPOS_DONANTE } from '@/lib/dominio/donantes';
import { almacen } from '@/lib/almacen';
import { dinero } from '@/lib/formato';
import { Dialogo } from '@/componentes/Dialogo';
import { FormDonante } from './FormDonante';
import type { Aportacion } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Donantes' };

export default async function Donantes() {
  const yo = await requiere('lectura');
  const [donantes, aportaciones] = await Promise.all([listarDonantes(), (await almacen()).consultar<Aportacion>('aportaciones')]);
  const resumen = (id: string) => {
    const suyas = aportaciones.filter((a) => a.donanteId === id);
    return {
      proyectos: new Set(suyas.map((a) => a.proyecto)).size,
      comprometido: suyas.filter((a) => a.estado === 'comprometida' || a.estado === 'recibida').reduce((s, a) => s + a.importeProyecto, 0),
      enCurso: suyas.filter((a) => a.estado === 'ofrecida' || a.estado === 'interesado').length,
    };
  };

  return (
    <main className="principal">
      <div className="titulo-pagina">
        <div>
          <h1>Donantes</h1>
          <p>Fundaciones, empresas, entidades públicas y particulares, con lo que han aportado y los informes que piden.</p>
        </div>
        {tienePermiso(yo, 'edicion') ? (
          <Dialogo boton="Añadir donante" claseBoton="btn btn-p" titulo="Nuevo donante">
            <FormDonante />
          </Dialogo>
        ) : null}
      </div>
      <section className="tabla-marco">
        <div className="desliza">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Donante</th>
                <th scope="col">Tipo</th>
                <th scope="col">Proyectos</th>
                <th scope="col" className="der">
                  Comprometido
                </th>
                <th scope="col">En conversación</th>
                <th scope="col">Informes que pide</th>
              </tr>
            </thead>
            <tbody>
              {donantes.map((d) => {
                const r = resumen(d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link className="fuerte" href={`/donantes/${d.id}`}>
                        {d.nombre}
                      </Link>
                      {d.contactoNombre ? <span className="sub">{d.contactoNombre}</span> : null}
                    </td>
                    <td>{TIPOS_DONANTE[d.tipo]}</td>
                    <td>{r.proyectos || '—'}</td>
                    <td className="der">{r.comprometido ? dinero(r.comprometido) : '—'}</td>
                    <td>{r.enCurso || '—'}</td>
                    <td className="meta">{d.informes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!donantes.length ? <p className="vacio">Todavía no hay donantes.</p> : null}
        </div>
        <p className="pie-tabla">Los importes están en la moneda de cada proyecto (normalmente euros).</p>
      </section>
    </main>
  );
}
