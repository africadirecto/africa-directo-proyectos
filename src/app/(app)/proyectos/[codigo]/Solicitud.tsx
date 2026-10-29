import Link from 'next/link';
import { listarRevisiones, listarVersiones } from '@/lib/dominio/solicitudes';
import { fechaLarga } from '@/lib/formato';
import { VistaSolicitud } from '@/componentes/VistaSolicitud';
import type { Proyecto } from '@/lib/tipos';

const DECISION = { validar: 'Validada', cambios: 'Cambios pedidos', rechazar: 'Rechazada' };

export async function Solicitud({ p, version }: { p: Proyecto; version: number | null }) {
  const [versiones, revisiones] = await Promise.all([listarVersiones(p.codigo), listarRevisiones(p.codigo)]);
  if (!versiones.length) {
    return (
      <section className="card">
        <p className="vacio">
          La contraparte todavía no ha enviado el formulario. <Link href={`/solicitudes?p=${p.codigo}`}>Ver el enlace</Link>
        </p>
      </section>
    );
  }
  const v = versiones.find((x) => x.version === version) ?? versiones[0];

  return (
    <div className="fila">
      <section className="card col-ancha" style={{ gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 className="h3" style={{ margin: 0 }}>
            Solicitud de la contraparte
          </h2>
          {versiones.length > 1 ? (
            <nav aria-label="Versiones" className="botones" style={{ gap: 6 }}>
              {versiones.map((x) => (
                <Link
                  key={x.version}
                  href={`?pestana=solicitud&v=${x.version}`}
                  className={`btn btn-peq ${x.version === v.version ? 'btn-p' : 'btn-s'}`}
                  aria-current={x.version === v.version ? 'page' : undefined}
                  scroll={false}
                >
                  Versión {x.version}
                  {x === versiones[0] ? ' (vigente)' : ''}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        {v.analisis?.falta.length ? (
          <div className="aviso">
            <h3>Información que faltaba en esta versión</h3>
            <ul>
              {v.analisis.falta.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <VistaSolicitud v={v} />
      </section>
      <aside className="col-estrecha">
        <section className="card">
          <h2 className="h3">Revisiones</h2>
          {revisiones.length ? (
            <div className="pila">
              {revisiones.map((r, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--borde-suave)', paddingBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {DECISION[r.decision]} · versión {r.version}
                  </p>
                  <p className="meta" style={{ margin: '2px 0 6px' }}>
                    {r.por.nombre} · {fechaLarga(r.fecha)}
                  </p>
                  {r.comentario ? <p className="p" style={{ fontSize: 14 }}>{r.comentario}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="meta" style={{ margin: 0 }}>
              Sin revisiones todavía.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
