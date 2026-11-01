import { aportacionesDeProyecto, presupuestoEnEuros } from '@/lib/dominio/aportaciones';
import { listarDonantes, TIPOS_DONANTE } from '@/lib/dominio/donantes';
import { dinero, fechaCorta, porcentaje } from '@/lib/formato';
import { Dialogo } from '@/componentes/Dialogo';
import { IconoCobro, IconoCompromiso, IconoEnvio } from '@/componentes/Iconos';
import { quitarEnvioAccion } from '@/lib/acciones/financiacion';
import { FormCompromiso } from './FormCompromiso';
import { FormCobro } from './FormCobro';
import { FormEnvio } from './FormEnvio';
import { ExportarFinanciacion } from './ExportarFinanciacion';
import { DetalleDonante, Quitar } from './DetalleDonante';
import type { Proyecto } from '@/lib/tipos';

const dia = (fecha: string) => fechaCorta(`${fecha}T12:00:00Z`);

export async function Financiacion({ p, editor }: { p: Proyecto; editor: boolean }) {
  const [aportaciones, donantes] = await Promise.all([aportacionesDeProyecto(p.codigo), editor ? listarDonantes() : []]);
  const objetivo = presupuestoEnEuros(p);
  const envios = p.envios ?? [];
  const enviado = p.enviado ?? 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const ancho = (n: number) => `${Math.min(100, objetivo ? (n / objetivo) * 100 : 0)}%`;

  return (
    <section className="card financiacion">
      <div className="card-cab">
        <h2 className="h3" style={{ margin: 0 }}>
          Financiación
        </h2>
        {editor ? (
          <div className="botones" style={{ gap: 6 }}>
            <Dialogo boton={<><IconoCompromiso /> Compromiso</>} claseBoton="btn btn-s btn-peq" titulo="Un donante se compromete">
              <FormCompromiso codigo={p.codigo} donantes={donantes.map((d) => ({ id: d.id, nombre: d.nombre }))} tipos={TIPOS_DONANTE} enProyecto={aportaciones.map((a) => a.donanteId)} hoy={hoy} />
            </Dialogo>
            <Dialogo boton={<><IconoCobro /> Cobro</>} claseBoton="btn btn-s btn-peq" titulo="Cobro recibido por AD">
              <FormCobro aportaciones={aportaciones.map((a) => ({ id: a.id, nombre: a.donanteNombre, porCobrar: Math.max(0, a.importe - a.recibido) }))} hoy={hoy} />
            </Dialogo>
            <Dialogo boton={<><IconoEnvio /> Envío</>} claseBoton="btn btn-s btn-peq" titulo="Envío a la contraparte">
              <FormEnvio codigo={p.codigo} disponible={Math.max(0, p.recibido - enviado)} hoy={hoy} />
            </Dialogo>
          </div>
        ) : null}
      </div>

      <p className="fin-total">
        <b>{dinero(p.comprometido)}</b> comprometidos de {dinero(objetivo)}
        {objetivo ? <span className="meta"> · {porcentaje(p.comprometido, objetivo)} %</span> : null}
      </p>
      <div className="bar bar-grande bar-etapas" role="img" aria-label={`Comprometido el ${porcentaje(p.comprometido, objetivo)} % del presupuesto`}>
        <span className="etapa-comprometida" style={{ width: ancho(p.comprometido) }} />
        <span className="etapa-recibida" style={{ width: ancho(p.recibido) }} />
        <span className="etapa-enviada" style={{ width: ancho(enviado) }} />
      </div>
      <p className="leyenda fin-leyenda">
        <span>
          <span className="leyenda-punto etapa-recibida" />
          Cobrado {dinero(p.recibido)}
        </span>
        <span>
          <span className="leyenda-punto etapa-enviada" />
          Enviado {dinero(enviado)}
        </span>
      </p>

      <h3 className="fin-seccion fin-seccion-cifras">
        <span>Donantes</span>
        {aportaciones.length ? <span>Cobrado / comprometido</span> : null}
      </h3>
      {aportaciones.length ? (
        <ul className="fin-lista">
          {aportaciones.map((a) => (
            <li key={a.id}>
              <DetalleDonante a={a} editor={editor} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="meta" style={{ margin: 0 }}>
          Ningún donante todavía.
        </p>
      )}

      <h3 className="fin-seccion">Envíos a la contraparte</h3>
      {envios.length ? (
        <ul className="fin-lista">
          {envios.map((e) => (
            <li key={e.id} className="fin-fila">
              <span>
                {dia(e.fecha)}
                {e.nota ? <span className="meta"> · {e.nota}</span> : null}
              </span>
              <span className="fin-importe">{dinero(e.importe)}</span>
              {editor ? <Quitar accion={quitarEnvioAccion} campos={{ codigo: p.codigo, registro: e.id }} pregunta={`¿Quitar el envío de ${dinero(e.importe)} del ${dia(e.fecha)}?`} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="meta" style={{ margin: 0 }}>
          Ningún envío todavía.
        </p>
      )}

      {editor ? <ExportarFinanciacion codigo={p.codigo} /> : null}
    </section>
  );
}
