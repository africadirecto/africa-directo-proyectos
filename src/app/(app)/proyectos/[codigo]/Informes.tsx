import { listarInformes } from '@/lib/dominio/informes';
import { fechaCorta, fechaLarga } from '@/lib/formato';
import { Etiqueta } from '@/componentes/Basicos';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { LogoDocs } from '@/componentes/Iconos';
import { aprobarInformeAccion } from '@/lib/acciones/informes';
import type { Proyecto } from '@/lib/tipos';

/** Borradores de informe del proyecto. Solo los aprobados se pueden descargar para enviarlos. */
export async function Informes({ p, editor }: { p: Proyecto; editor: boolean }) {
  const informes = await listarInformes(p.codigo);
  if (!informes.length) return null;

  return (
    <section className="card">
      <h2 className="h3">Informes</h2>
      <p className="meta" style={{ margin: '-6px 0 10px' }}>
        Revisa cada borrador en Google Docs, completa lo marcado como [PENDIENTE] y borra las notas del final. Después apruébalo: solo entonces se puede descargar para enviarlo.
      </p>
      {informes.map((i) => (
        <div key={i.id} className="req">
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogoDocs tamano={16} />
              <a href={i.url} target="_blank" rel="noreferrer">
                {i.titulo.replace(/^\d{4}-\d{2}-\d{2} /, '')}
              </a>
            </p>
            <p className="meta" style={{ margin: '2px 0 0' }}>
              {fechaCorta(i.desde)} – {fechaCorta(i.hasta)} · {i.plantilla.nombre} · creado el {fechaLarga(i.creado)} por {i.creadoPor.nombre}
              {i.estado === 'aprobado' && i.aprobadoPor ? ` · aprobado por ${i.aprobadoPor.nombre}` : ''}
            </p>
          </div>
          <div className="botones" style={{ alignItems: 'center' }}>
            {i.estado === 'aprobado' ? (
              <>
                <Etiqueta clase="s-val">Aprobado</Etiqueta>
                {/* Exportación de Google Docs: funciona con la sesión de Google de la ONG. */}
                <a className="btn btn-s btn-peq" href={`https://docs.google.com/document/d/${i.docId}/export?format=pdf`} target="_blank" rel="noreferrer">
                  PDF
                </a>
                <a className="btn btn-s btn-peq" href={`https://docs.google.com/document/d/${i.docId}/export?format=docx`} target="_blank" rel="noreferrer">
                  Word
                </a>
              </>
            ) : (
              <>
                <Etiqueta clase="s-par">{i.pendientes ? `Borrador · ${i.pendientes} pendiente${i.pendientes === 1 ? '' : 's'}` : 'Borrador'}</Etiqueta>
                {editor ? (
                  <FormAccion accion={aprobarInformeAccion} confirmar="¿Has revisado el informe en Google Docs y está listo para enviar al donante?">
                    <input type="hidden" name="codigo" value={p.codigo} />
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
