import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { anadirDesdeDriveAccion, editarPlantillaAccion } from '@/lib/acciones/plantillas';
import { FORMATOS_PLANTILLA, type PlantillaConId } from '@/lib/dominio/plantillas';
import { ElegirTipo } from './ElegirTipo';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import type { FormatoPlantilla } from '@/lib/tipos';

/** Datos de una plantilla. Sin `p`, para añadir un documento de la unidad Plantillas. */
export function FormPlantilla({
  p,
  documentos = [],
  donantes,
}: {
  p?: PlantillaConId;
  documentos?: { id: string; nombre: string; ruta: string; formato: FormatoPlantilla }[];
  donantes: { id: string; nombre: string }[];
}) {
  return (
    <FormAccion accion={p ? editarPlantillaAccion : anadirDesdeDriveAccion} className="pila">
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <div className="campos">
        {!p ? (
          <label className="field ancho">
            <span>
              Documento <span className="ayuda">un Google Doc o Slides de «AD · Plantillas»</span>
            </span>
            {documentos.length ? (
              <Desplegable
                name="archivo"
                placeholder="Elige el documento"
                opciones={documentos.map((d) => ({ valor: d.id, texto: `${d.nombre} (${FORMATOS_PLANTILLA[d.formato].toLowerCase()})`, grupo: d.ruta || 'AD · Plantillas' }))}
              />
            ) : (
              <span className="nota">No hay documentos nuevos en la unidad de plantillas. Sube allí el documento (o ábrelo con Google Docs si es un Word) y vuelve aquí.</span>
            )}
          </label>
        ) : null}
        <label className="field ancho">
          Nombre
          <input name="nombre" required defaultValue={p?.nombre} placeholder="Por ejemplo: Informe intermedio Fundación Horizonte" />
        </label>
        <ElegirTipo valor={p?.tipo} />
        <label className="field">
          <span>
            Idioma <span className="ayuda">del texto fijo</span>
          </span>
          <Desplegable name="idioma" defaultValue={p?.idioma ?? 'es'} opciones={Object.entries(IDIOMAS_ES).map(([valor, texto]) => ({ valor, texto }))} />
        </label>
        <label className="field ancho">
          <span>
            Donante <span className="ayuda">si es su plantilla propia</span>
          </span>
          <Desplegable
            name="donante"
            defaultValue={p?.donante?.id ?? ''}
            opciones={[{ valor: '', texto: 'Ninguno: plantilla general' }, ...donantes.map((d) => ({ valor: d.id, texto: d.nombre }))]}
          />
        </label>
        <label className="field ancho">
          <span>
            Descripción <span className="ayuda">opcional: cuándo usarla</span>
          </span>
          <textarea name="descripcion" rows={2} defaultValue={p?.descripcion} />
        </label>
      </div>
      <div className="botones">
        <Enviar pendiente={p ? 'Guardando…' : 'Leyendo el documento…'} disabled={!p && !documentos.length}>
          {p ? 'Guardar' : 'Añadir plantilla'}
        </Enviar>
      </div>
    </FormAccion>
  );
}
