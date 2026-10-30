'use client';

// Alta y edición de una contraparte. Dar de alta: permiso de edición; editar: administración
// (se comprueba en el servidor, en guardarContraparteAccion).

import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { opcionesPaises } from '@/componentes/opciones';
import { guardarContraparteAccion } from '@/lib/acciones/admin';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import type { Contraparte, Idioma } from '@/lib/tipos';

export function FormContraparte({ c }: { c?: Contraparte & { id: string } }) {
  return (
    <FormAccion accion={guardarContraparteAccion} className="pila" limpiar={!c}>
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="campos">
        <label className="field ancho">
          Nombre
          <input name="nombre" required defaultValue={c?.nombre} />
        </label>
        <label className="field">
          Tipo
          <input name="tipo" defaultValue={c?.tipo} placeholder="Congregación, diócesis…" />
        </label>
        <label className="field">
          País
          <Desplegable name="pais" required defaultValue={c?.pais ?? ''} opciones={opcionesPaises('es')} />
        </label>
        <label className="field">
          Persona de contacto
          <input name="contactoNombre" defaultValue={c?.contactoNombre} />
        </label>
        <label className="field">
          Idioma
          <Desplegable
            name="idioma"
            defaultValue={c?.idioma ?? 'fr'}
            opciones={(Object.keys(IDIOMAS_ES) as Idioma[]).map((i) => ({ valor: i, texto: IDIOMAS_ES[i] }))}
          />
        </label>
        <label className="field ancho">
          <span>Correos <span className="ayuda">separados por comas; el primero es el principal</span></span>
          <input name="correos" defaultValue={c?.correos.join(', ')} />
        </label>
        <label className="field">
          Teléfono o WhatsApp
          <input name="telefono" defaultValue={c?.telefono} />
        </label>
        <label className="field ancho">
          Notas
          <textarea name="notas" defaultValue={c?.notas} rows={3} />
        </label>
      </div>
      <div className="botones">
        <Enviar pendiente="Guardando…">{c ? 'Guardar' : 'Añadir contraparte'}</Enviar>
      </div>
    </FormAccion>
  );
}
