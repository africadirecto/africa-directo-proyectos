import { listarEventos } from '@/lib/dominio/eventos';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { anadirNota } from '@/lib/acciones/proyectos';
import type { Proyecto } from '@/lib/tipos';
import { CronologiaFiltrada } from './CronologiaFiltrada';

const LIMITE = 200;

export async function Seguimiento({ p, editor }: { p: Proyecto; editor: boolean }) {
  const eventos = await listarEventos(p.codigo, LIMITE);
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
                <Desplegable
                  name="categoria"
                  defaultValue="otro"
                  opciones={[
                    { valor: 'otro', texto: 'Nota' },
                    { valor: 'avance', texto: 'Avance' },
                    { valor: 'incidencia', texto: 'Incidencia' },
                    { valor: 'economico', texto: 'Económico' },
                  ]}
                />
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
        Formulario de la contraparte, notas del equipo, financiación, informes y cambios de estado.
      </p>
      <CronologiaFiltrada eventos={eventos} limite={LIMITE} />
    </section>
  );
}
