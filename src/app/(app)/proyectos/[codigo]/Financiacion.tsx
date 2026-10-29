import Link from 'next/link';
import { aportacionesDeProyecto, ESTADOS_APORTACION } from '@/lib/dominio/aportaciones';
import { listarDonantes, TIPOS_DONANTE } from '@/lib/dominio/donantes';
import { dinero, porcentaje } from '@/lib/formato';
import { MONEDAS } from '@/lib/paises';
import { Barra, Etiqueta } from '@/componentes/Basicos';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAportacion } from './FormAportacion';
import { SelectorAportacion } from './SelectorAportacion';
import type { Proyecto } from '@/lib/tipos';

export async function Financiacion({ p, editor }: { p: Proyecto; editor: boolean }) {
  const [aportaciones, donantes] = await Promise.all([aportacionesDeProyecto(p.codigo), editor ? listarDonantes() : []]);
  const pendiente = aportaciones.filter((a) => a.estado === 'ofrecida' || a.estado === 'interesado').reduce((s, a) => s + a.importeProyecto, 0);

  return (
    <div className="pila" style={{ gap: 20 }}>
      <section className="card">
        <h2 className="h3">Financiación</h2>
        <div className="totales">
          <div>
            <p className="meta">Presupuesto</p>
            <p className="cifra">{dinero(p.presupuesto, p.moneda)}</p>
          </div>
          <div>
            <p className="meta">Comprometido</p>
            <p className="cifra">
              {dinero(p.comprometido, p.moneda)}
              {p.presupuesto ? <span className="meta"> · {porcentaje(p.comprometido, p.presupuesto)} %</span> : null}
            </p>
          </div>
          <div>
            <p className="meta">Ya recibido</p>
            <p className="cifra">{dinero(p.recibido, p.moneda)}</p>
          </div>
          {pendiente ? (
            <div>
              <p className="meta">En conversación</p>
              <p className="cifra">{dinero(pendiente, p.moneda)}</p>
            </div>
          ) : null}
        </div>
        <Barra parte={p.comprometido} total={p.presupuesto} grande />
        <p className="meta" style={{ margin: '12px 0 0' }}>
          Cuentan las aportaciones comprometidas o recibidas. Cuando cubren el presupuesto, el proyecto pasa solo a «Aprobado».
        </p>
      </section>

      <section className="card">
        <div className="card-cab">
          <h2 className="h3">Donantes</h2>
          {editor ? (
            <Dialogo boton="Añadir aportación" titulo="Añadir aportación">
              <FormAportacion
                codigo={p.codigo}
                monedaProyecto={p.moneda}
                monedas={MONEDAS}
                donantes={donantes.map((d) => ({ id: d.id, nombre: d.nombre }))}
                tipos={TIPOS_DONANTE}
              />
            </Dialogo>
          ) : null}
        </div>
        {aportaciones.length ? (
          <div className="desliza">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Donante</th>
                  <th scope="col" className="der">
                    Importe
                  </th>
                  <th scope="col">Estado</th>
                  <th scope="col">Notas</th>
                </tr>
              </thead>
              <tbody>
                {aportaciones.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link className="fuerte" href={`/donantes/${a.donanteId}`}>
                        {a.donanteNombre}
                      </Link>
                    </td>
                    <td className="der">
                      {dinero(a.importe, a.moneda)}
                      {a.moneda !== p.moneda ? <span className="sub">≈ {dinero(a.importeProyecto, p.moneda)}</span> : null}
                    </td>
                    <td>
                      {editor ? (
                        <SelectorAportacion id={a.id} codigo={p.codigo} estado={a.estado} />
                      ) : (
                        <Etiqueta clase={ESTADOS_APORTACION[a.estado].clase}>{ESTADOS_APORTACION[a.estado].nombre}</Etiqueta>
                      )}
                    </td>
                    <td className="meta">{a.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">Todavía no hay donantes. Añade las fundaciones o empresas a las que se presenta el proyecto.</p>
        )}
      </section>
    </div>
  );
}
