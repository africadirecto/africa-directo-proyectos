import { listarEventos } from '@/lib/dominio/eventos';
import { fechaCorta } from '@/lib/formato';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { anadirNota } from '@/lib/acciones/proyectos';
import type { Evento, Proyecto } from '@/lib/tipos';

const ETIQUETA: Record<string, string> = {
  avance: 'Avance',
  incidencia: 'Incidencia',
  economico: 'Económico',
  otro: 'Nota',
  estado: 'Cambio de estado',
  solicitud: 'Solicitud',
  revision: 'Revisión',
  sistema: 'Sistema',
};

const ORIGEN: Record<Evento['tipo'], string> = {
  estado: '',
  nota: 'nota',
  solicitud: 'formulario',
  revision: 'revisión',
  aportacion: 'financiación',
  correo: 'correo',
  archivo: 'archivo',
  sistema: 'sistema',
};

export function ListaEventos({ eventos }: { eventos: Evento[] }) {
  if (!eventos.length) return <p className="vacio">Todavía no hay actividad.</p>;
  return (
    <div>
      {eventos.map((e, i) => {
        const clave = e.categoria ?? e.tipo;
        return (
          <div key={i} className="ev">
            <div className="d">
              {fechaCorta(e.fecha)}
              <small>{[ORIGEN[e.tipo], e.autor?.nombre.split(' ')[0]].filter(Boolean).join(' · ') || 'automático'}</small>
            </div>
            <div>
              <span className={`st ev-${clave}`}>{ETIQUETA[clave] ?? ETIQUETA.otro}</span>
              <p>{e.texto}</p>
              {e.enlaces?.length ? (
                <p className="meta" style={{ marginTop: 6 }}>
                  {e.enlaces.map((l, j) => (
                    <span key={j}>
                      {j ? ' · ' : ''}
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.texto} ↗
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export async function Seguimiento({ p, editor }: { p: Proyecto; editor: boolean }) {
  const eventos = await listarEventos(p.codigo, 200);
  return (
    <section className="card">
      <div className="card-cab">
        <h2 className="h3">Seguimiento</h2>
        {editor ? (
          <Dialogo boton="Añadir nota" titulo="Añadir nota">
            <FormAccion accion={anadirNota} className="pila" limpiar>
              <input type="hidden" name="codigo" value={p.codigo} />
              <label className="field">
                Tipo
                <select name="categoria" defaultValue="otro">
                  <option value="otro">Nota</option>
                  <option value="avance">Avance</option>
                  <option value="incidencia">Incidencia</option>
                  <option value="economico">Económico</option>
                </select>
              </label>
              <label className="field">
                Nota
                <textarea name="texto" required placeholder="Por ejemplo: llamada con la hermana; la cubierta se termina en dos semanas." />
              </label>
              <label className="check">
                <input type="checkbox" name="noticia" />
                Es una noticia de la contraparte (llamada, WhatsApp…)
              </label>
              <div className="botones">
                <Enviar pendiente="Guardando…">Añadir nota</Enviar>
              </div>
            </FormAccion>
          </Dialogo>
        ) : null}
      </div>
      <p className="meta" style={{ margin: '0 0 8px' }}>
        Formulario de la contraparte, notas del equipo, financiación y cambios de estado.
      </p>
      <ListaEventos eventos={eventos} />
    </section>
  );
}
