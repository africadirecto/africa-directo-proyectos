import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { guardarDonante } from '@/lib/acciones/financiacion';
import { TIPOS_DONANTE, type DonanteConId } from '@/lib/dominio/donantes';

export function FormDonante({ d }: { d?: DonanteConId }) {
  return (
    <FormAccion accion={guardarDonante} className="pila" limpiar={!d}>
      {d ? <input type="hidden" name="id" value={d.id} /> : null}
      <div className="campos">
        <label className="field">
          Nombre
          <input name="nombre" required defaultValue={d?.nombre} />
        </label>
        <label className="field">
          Tipo
          <Desplegable
            name="tipo"
            defaultValue={d?.tipo ?? 'fundacion'}
            opciones={Object.entries(TIPOS_DONANTE).map(([valor, texto]) => ({ valor, texto }))}
          />
        </label>
        <label className="field">
          Persona de contacto
          <input name="contactoNombre" defaultValue={d?.contactoNombre} />
        </label>
        <label className="field">
          Correo
          <input name="correo" type="email" defaultValue={d?.correo} />
        </label>
        <label className="field ancho">
          <span>Informes que pide <span className="ayuda">cuándo y en qué formato</span></span>
          <textarea name="informes" defaultValue={d?.informes} rows={3} placeholder="Por ejemplo: informe intermedio a los 6 meses y final, con su plantilla de Word." />
        </label>
        <label className="field ancho">
          <span>Plantilla de informe <span className="ayuda">enlace al documento en Drive, si tiene la suya</span></span>
          <input name="plantilla" defaultValue={d?.plantilla} placeholder="https://docs.google.com/…" />
        </label>
        <label className="field ancho">
          Notas
          <textarea name="notas" defaultValue={d?.notas} rows={3} />
        </label>
      </div>
      <div className="botones">
        <Enviar pendiente="Guardando…">{d ? 'Guardar' : 'Añadir donante'}</Enviar>
      </div>
    </FormAccion>
  );
}
