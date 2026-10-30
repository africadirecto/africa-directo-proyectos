import Link from 'next/link';
import { listarEventos } from '@/lib/dominio/eventos';
import { leerContraparte } from '@/lib/dominio/contrapartes';
import { aliasProyecto } from '@/lib/avisos';
import { dinero, fechaLarga, porcentaje } from '@/lib/formato';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import type { Proyecto } from '@/lib/tipos';
import { ListaEventos } from './Seguimiento';

export async function Resumen({ p }: { p: Proyecto }) {
  const [eventos, contraparte] = await Promise.all([listarEventos(p.codigo, 3), leerContraparte(p.contraparte.id)]);
  const alias = aliasProyecto(p.codigo);

  return (
    <div className="fila">
      <div className="col-ancha">
        <section className="card">
          <h2 className="h3">Descripción</h2>
          {p.resumen ? (
            <p className="p" style={{ marginBottom: 12 }}>
              {p.resumen} <span className="meta">(resumen de IA)</span>
            </p>
          ) : null}
          <p className="p" style={{ marginBottom: 18, whiteSpace: 'pre-wrap' }}>
            {p.descripcion || <span className="meta">Sin descripción todavía.</span>}
          </p>
          <dl className="kv">
            <div>
              <dt>Presupuesto</dt>
              <dd>{dinero(p.presupuesto, p.moneda)}</dd>
            </div>
            <div>
              <dt>Financiado</dt>
              <dd>
                {p.presupuesto ? `${porcentaje(p.comprometido, p.presupuesto)} %` : '—'}
                {p.numDonantes ? ` · ${p.numDonantes} donante${p.numDonantes === 1 ? '' : 's'}` : ''}
              </dd>
            </div>
            <div>
              <dt>Inicio de obra</dt>
              <dd>{fechaLarga(p.fechas.inicio)}</dd>
            </div>
            <div>
              <dt>Fin previsto</dt>
              <dd>{fechaLarga(p.fechas.finPrevisto)}</dd>
            </div>
            <div>
              <dt>Beneficiarios</dt>
              <dd>{p.beneficiarios || '—'}</dd>
            </div>
            <div>
              <dt>Coordenadas</dt>
              <dd>{p.lat != null && p.lng != null ? `${p.lat.toFixed(2).replace('.', ',')} · ${p.lng.toFixed(2).replace('.', ',')}` : '—'}</dd>
            </div>
          </dl>
        </section>
        <section className="card">
          <div className="card-cab">
            <h2 className="h3">Última actividad</h2>
            <Link className="btn-enlace" href="?pestana=seguimiento" scroll={false}>
              Ver todo →
            </Link>
          </div>
          <ListaEventos eventos={eventos} />
        </section>
      </div>
      <aside className="col-estrecha">
        <section className="card">
          <h2 className="h3">Contraparte</h2>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.contraparte.nombre}</p>
          <p className="meta" style={{ margin: '4px 0 12px', fontSize: 14 }}>
            {contraparte?.contactoNombre ? `${contraparte.contactoNombre} · ` : ''}escribe en {IDIOMAS_ES[p.contraparte.idioma].toLowerCase()}
          </p>
          {p.contraparte.correo ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              <a href={`mailto:${p.contraparte.correo}`}>{p.contraparte.correo}</a>
            </p>
          ) : null}
          {alias ? (
            <p className="meta" style={{ margin: '8px 0 0' }}>
              Dirección de este proyecto: {alias}
            </p>
          ) : null}
        </section>
        <section className="card">
          <h2 className="h3">Equipo</h2>
          <dl className="kv kv-1">
            <div>
              <dt>Revisó la propuesta</dt>
              <dd>{p.revisor ? `${p.revisor.nombre} · ${fechaLarga(p.revisor.fecha)}` : '—'}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
