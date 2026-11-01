'use client';

// Decisión del revisor: primero se elige qué hacer y después se escribe el comentario, que
// cambia de sentido según la decisión (nota interna, cambios que se piden o motivo del rechazo).

import { useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { decidirSolicitud } from '@/lib/acciones/solicitudes';
import type { Decision } from '@/lib/tipos';

const OPCIONES: Record<Decision, { nombre: string; detalle: string; boton: string; pendiente: string; clase: string }> = {
  validar: {
    nombre: 'Validar',
    detalle: 'Está completa: pasa a buscar financiación.',
    boton: 'Validar la propuesta',
    pendiente: 'Validando…',
    clase: 'btn btn-p',
  },
  cambios: {
    nombre: 'Pedir cambios',
    detalle: 'La contraparte corrige el mismo formulario y lo reenvía.',
    boton: 'Pedir los cambios',
    pendiente: 'Guardando…',
    clase: 'btn btn-p',
  },
  rechazar: {
    nombre: 'Rechazar',
    detalle: 'No se puede apoyar. Se prepara un correo con el motivo.',
    boton: 'Rechazar la solicitud',
    pendiente: 'Rechazando…',
    clase: 'btn btn-d',
  },
};

export function FormDecision({ codigo, idioma }: { codigo: string; /** Idioma de la contraparte, en español y minúsculas («francés»), o vacío si es el español. */ idioma: string }) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const traduccion = idioma ? ` Se traduce al ${idioma} para el correo.` : '';
  const comentario = {
    validar: { etiqueta: 'Nota interna', opcional: true, ayuda: 'Queda en la cronología; no se envía a la contraparte.', ejemplo: 'Por ejemplo: presupuesto revisado con el plano.' },
    cambios: { etiqueta: 'Qué tiene que cambiar la contraparte', opcional: false, ayuda: `Va en el formulario y en el correo.${traduccion}`, ejemplo: 'Por ejemplo: separad el presupuesto en materiales y mano de obra.' },
    rechazar: { etiqueta: 'Motivo para la contraparte', opcional: true, ayuda: `Va en el correo.${traduccion}`, ejemplo: 'Por ejemplo: este año no financiamos proyectos de este tipo.' },
  };
  const c = decision ? comentario[decision] : null;

  return (
    <FormAccion accion={decidirSolicitud} className="pila">
      <input type="hidden" name="codigo" value={codigo} />
      <fieldset className="formatos decisiones">
        <legend>¿Qué decides?</legend>
        {(Object.keys(OPCIONES) as Decision[]).map((d) => (
          <label key={d} className="formato" data-elegido={decision === d ? '' : undefined}>
            <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} className="oculto" />
            <span>
              <b>{OPCIONES[d].nombre}</b>
              <span className="meta">{OPCIONES[d].detalle}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {/* El mismo campo para las tres opciones: lo escrito se conserva al cambiar de opción. */}
      {c ? (
        <label className="field">
          <span>
            {c.etiqueta} {c.opcional ? <span className="ayuda">opcional</span> : null}
          </span>
          <textarea name="comentario" required={!c.opcional} placeholder={c.ejemplo} />
          <span className="pista">{c.ayuda}</span>
        </label>
      ) : null}
      <div className="botones">
        {decision ? (
          <Enviar clase={OPCIONES[decision].clase} pendiente={OPCIONES[decision].pendiente}>
            {OPCIONES[decision].boton}
          </Enviar>
        ) : (
          <Enviar disabled>Elige una opción</Enviar>
        )}
      </div>
    </FormAccion>
  );
}
