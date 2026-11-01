// La última decisión del revisor, con la opción de corregir el comentario o deshacerla
// mientras la contraparte no haya enviado otra versión (ver decisionAbierta).

import { fechaLarga } from '@/lib/formato';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { corregirComentarioAccion, deshacerDecisionAccion } from '@/lib/acciones/solicitudes';
import type { Idioma, Revision } from '@/lib/tipos';

const TITULO = { validar: 'Propuesta validada', cambios: 'Cambios pedidos', rechazar: 'Solicitud rechazada' };

export function DecisionTomada({ codigo, r, idioma, editor }: { codigo: string; r: Revision; idioma: Idioma; editor: boolean }) {
  const deshacer = {
    validar: 'La propuesta vuelve a «En revisión», como antes de validarla.',
    cambios: 'La solicitud vuelve a «En revisión» y el formulario se cierra otra vez. Si ya enviaste el correo a la contraparte, avísala.',
    rechazar: 'La solicitud vuelve a «En revisión». Si ya enviaste el correo a la contraparte, avísala.',
  }[r.decision];

  return (
    <section className="aviso pila" style={{ gap: 8 }}>
      <h3 style={{ margin: 0 }}>{TITULO[r.decision]}</h3>
      {r.comentario ? <p className="p" style={{ whiteSpace: 'pre-wrap' }}>{r.comentario}</p> : <p className="meta" style={{ margin: 0 }}>Sin comentario.</p>}
      {r.decision !== 'validar' && idioma !== 'es' && r.comentario ? (
        <p className="meta" style={{ margin: 0 }}>
          {r.comentarioTraducido ? `En ${IDIOMAS_ES[idioma].toLowerCase()}: ${r.comentarioTraducido}` : 'Sin IA no se ha traducido: la contraparte lo verá en español.'}
        </p>
      ) : null}
      <p className="meta" style={{ margin: 0 }}>
        {r.por.nombre} · {fechaLarga(r.fecha)}
      </p>
      {editor ? (
        <div className="botones" style={{ gap: 8 }}>
          {r.decision !== 'validar' ? (
            <Dialogo boton="Corregir el comentario" claseBoton="btn btn-s btn-peq" titulo="Corregir el comentario">
              <FormAccion accion={corregirComentarioAccion} className="pila">
                <input type="hidden" name="codigo" value={codigo} />
                <label className="field">
                  {r.decision === 'cambios' ? 'Qué tiene que cambiar la contraparte' : 'Motivo para la contraparte'}
                  <textarea name="comentario" required={r.decision === 'cambios'} defaultValue={r.comentario} />
                  {idioma !== 'es' ? <span className="pista">Se vuelve a traducir al {IDIOMAS_ES[idioma].toLowerCase()}.</span> : null}
                </label>
                <div className="botones">
                  <Enviar pendiente="Guardando…">Guardar</Enviar>
                </div>
              </FormAccion>
            </Dialogo>
          ) : null}
          <FormAccion accion={deshacerDecisionAccion} confirmar={`¿Deshacer la decisión? ${deshacer}`}>
            <input type="hidden" name="codigo" value={codigo} />
            <Enviar clase="btn btn-s btn-peq" pendiente="Deshaciendo…">
              Deshacer la decisión
            </Enviar>
          </FormAccion>
        </div>
      ) : null}
    </section>
  );
}
