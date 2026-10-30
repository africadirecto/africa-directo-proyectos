import { fechaCorta, fechaLarga } from '@/lib/formato';
import { descargas, type InformeConId } from '@/lib/dominio/informesComun';
import { Etiqueta } from './Basicos';
import { FormAccion, Enviar } from './FormAccion';
import { LogoDocs, LogoSlides } from './Iconos';
import { aprobarInformeAccion } from '@/lib/acciones/informes';

/**
 * Borradores de informe (de un proyecto si se da `codigo`, o de conjunto). Solo los aprobados
 * se pueden descargar para enviarlos: ningún documento sale sin aprobación humana.
 */
export function ListaInformes({ informes, codigo = '', editor, titulo = 'Informes' }: { informes: InformeConId[]; codigo?: string; editor: boolean; titulo?: string }) {
  if (!informes.length) return null;
  return (
    <section className="card">
      <h2 className="h3">{titulo}</h2>
      <p className="meta" style={{ margin: '-6px 0 10px' }}>
        Revisa cada borrador en Google, completa lo marcado como [PENDIENTE] y borra las notas de revisión. Después apruébalo: solo entonces se puede descargar para enviarlo.
      </p>
      {informes.map((i) => (
        <div key={i.id} className="req">
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              {i.formato === 'slides' ? <LogoSlides tamano={16} /> : <LogoDocs tamano={16} />}
              <a href={i.url} target="_blank" rel="noreferrer">
                {i.titulo.replace(/^\d{4}-\d{2}-\d{2} /, '')}
              </a>
            </p>
            <p className="meta" style={{ margin: '2px 0 0' }}>
              {i.tipo === 'financiacion' ? 'Para buscar financiación' : `${fechaCorta(i.desde)} – ${fechaCorta(i.hasta)}`} · {i.plantilla.nombre} · creado el {fechaLarga(i.creado)} por {i.creadoPor.nombre}
              {i.estado === 'aprobado' && i.aprobadoPor ? ` · aprobado por ${i.aprobadoPor.nombre}` : ''}
            </p>
            {i.notas?.length && i.estado !== 'aprobado' ? (
              <details className="desplegable" style={{ marginTop: 4 }}>
                <summary className="btn-enlace">Notas para la revisión</summary>
                <ul className="meta" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {i.notas.filter((n) => n.startsWith('• ')).map((n, k) => (
                    <li key={k}>{n.slice(2)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <div className="botones" style={{ alignItems: 'center' }}>
            {i.estado === 'aprobado' ? (
              <>
                <Etiqueta clase="s-val">Aprobado</Etiqueta>
                {/* Exportación de Google: funciona con la sesión de Google de la ONG. */}
                {descargas(i).map((d) => (
                  <a key={d.texto} className="btn btn-s btn-peq" href={d.url} target="_blank" rel="noreferrer">
                    {d.texto}
                  </a>
                ))}
              </>
            ) : (
              <>
                <Etiqueta clase="s-par">{i.pendientes ? `Borrador · ${i.pendientes} pendiente${i.pendientes === 1 ? '' : 's'}` : 'Borrador'}</Etiqueta>
                {editor ? (
                  <FormAccion accion={aprobarInformeAccion} confirmar="¿Has revisado el borrador en Google y está listo para enviar?">
                    <input type="hidden" name="codigo" value={codigo} />
                    <input type="hidden" name="id" value={i.id} />
                    <Enviar clase="btn btn-s btn-peq" pendiente="Aprobando…">
                      Aprobar
                    </Enviar>
                  </FormAccion>
                ) : null}
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
