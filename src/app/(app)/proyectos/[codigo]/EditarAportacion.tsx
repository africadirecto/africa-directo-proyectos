'use client';

// Corregir una aportación (importe en euros, estado y notas) o eliminarla si se registró por error.

import { Dialogo } from '@/componentes/Dialogo';
import { Desplegable } from '@/componentes/Desplegable';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { editarAportacion, eliminarAportacionAccion } from '@/lib/acciones/financiacion';
import { ESTADOS_APORTACION } from '@/lib/estados';
import type { EstadoAportacion } from '@/lib/tipos';

export function EditarAportacion({
  id,
  codigo,
  donante,
  importe,
  estado,
  notas,
}: {
  id: string;
  codigo: string;
  donante: string;
  importe: number;
  estado: EstadoAportacion;
  notas: string;
}) {
  return (
    <Dialogo boton="Editar" claseBoton="btn btn-s btn-peq" titulo={`Aportación de ${donante}`}>
      <FormAccion accion={editarAportacion} className="pila">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="codigo" value={codigo} />
        <div className="campos">
          <label className="field">
            Importe (€)
            <input name="importe" inputMode="decimal" required defaultValue={importe} />
          </label>
          <label className="field">
            Estado
            <Desplegable
              name="estado"
              defaultValue={estado}
              opciones={(Object.keys(ESTADOS_APORTACION) as EstadoAportacion[]).map((e) => ({ valor: e, texto: ESTADOS_APORTACION[e].nombre }))}
            />
          </label>
          <label className="field ancho">
            <span>
              Notas <span className="ayuda">opcional</span>
            </span>
            <input name="notas" defaultValue={notas} />
          </label>
        </div>
        <div className="botones">
          <Enviar pendiente="Guardando…">Guardar</Enviar>
        </div>
      </FormAccion>
      <FormAccion accion={eliminarAportacionAccion} confirmar={`¿Eliminar la aportación de ${donante}? Si el donante ha dicho que no, mejor márcala como «Descartada».`}>
        <input type="hidden" name="id" value={id} />
        <p className="meta" style={{ margin: '4px 0 8px' }}>
          ¿Se registró por error? Si el donante ha dicho que no, es mejor marcarla como «Descartada» para que quede constancia.
        </p>
        <Enviar clase="btn btn-d btn-peq" pendiente="Eliminando…">
          Eliminar aportación
        </Enviar>
      </FormAccion>
    </Dialogo>
  );
}
