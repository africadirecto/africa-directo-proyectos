'use client';

// Diálogo para un informe de conjunto con IA: de varios proyectos (página de Proyectos), de
// contrapartes o de un donante. Desde Proyectos se puede pedir también la hoja de cálculo.

import { useActionState, useState } from 'react';
import { Dialogo } from '@/componentes/Dialogo';
import { Desplegable, type Opcion } from '@/componentes/Desplegable';
import { Enviar } from '@/componentes/FormAccion';
import { ElegirPlantilla, Idioma, Indicaciones, ResultadoInforme } from '@/componentes/OpcionesInforme';
import { pedirInformeAccion } from '@/lib/acciones/informes';
import { ACTIVOS, ESTADOS } from '@/lib/estados';
import type { OpcionPlantilla } from '@/lib/dominio/plantillas';
import type { EstadoProyecto } from '@/lib/tipos';

const OPCIONES_ESTADO = (Object.keys(ESTADOS) as EstadoProyecto[]).map((e) => ({ valor: e, texto: ESTADOS[e].nombre }));

const hoy = () => new Date().toISOString().slice(0, 10);
const haceUnAnio = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
};

export function BotonInformeGeneral({
  tipo,
  plantillas,
  sobre,
  opcionesSobre,
  etiquetaSobre = '',
  paises,
  claseBoton = 'btn btn-s',
}: {
  tipo: 'cartera' | 'contraparte' | 'donante';
  /** Las plantillas activas de este tipo. */
  plantillas: OpcionPlantilla[];
  /** Fijo (por ejemplo, el donante de su página). */
  sobre?: string;
  /** Para elegir (por ejemplo, la contraparte o «todas»). */
  opcionesSobre?: Opcion[];
  etiquetaSobre?: string;
  /** Para filtrar por país (informe de cartera). */
  paises?: Opcion[];
  claseBoton?: string;
}) {
  const [estado, pedir] = useActionState(pedirInformeAccion, { ok: false });
  const [id, setId] = useState(plantillas[0]?.id ?? (tipo === 'cartera' ? 'sheets' : ''));
  const elegida = plantillas.find((p) => p.id === id);
  const hoja = id === 'sheets';
  const titulo = { cartera: 'Informe de proyectos', contraparte: 'Informe de contrapartes', donante: 'Informe para el donante' }[tipo];
  const explicacion = {
    cartera: 'Un informe de varios proyectos: cifras, panorama, avances y retos, con la tabla de proyectos.',
    contraparte: 'Los proyectos de una contraparte (o de todas), con sus cifras y lo más relevante del periodo.',
    donante: 'Lo que ha financiado este donante y cómo van esos proyectos, para enviárselo.',
  }[tipo];

  return (
    <Dialogo boton="Generar informe" claseBoton={claseBoton} titulo={titulo}>
      <form action={pedir} className="pila">
        <input type="hidden" name="conjunto" value={tipo} />
        {sobre !== undefined ? <input type="hidden" name="sobre" value={sobre} /> : null}
        <p className="meta" style={{ margin: 0 }}>
          {hoja
            ? 'Un libro con todos los datos de los proyectos elegidos y resúmenes por estado, país, sector, contraparte y año, con gráficas. Los resúmenes son fórmulas: si corriges un dato en la hoja «Proyectos», se recalculan. No usa IA.'
            : `${explicacion} La IA lo redacta con los datos de la app siguiendo la plantilla; lo que no consta queda resaltado en amarillo. Revísalo en Google antes de enviarlo.`}
        </p>
        <div className="campos">
          <ElegirPlantilla plantillas={plantillas} valor={id} onChange={setId} hoja={tipo === 'cartera'} />
          {opcionesSobre ? (
            <label className="field ancho">
              {etiquetaSobre}
              <Desplegable name="sobre" buscar textoBuscar="Buscar…" defaultValue={opcionesSobre[0]?.valor ?? ''} opciones={opcionesSobre} />
            </label>
          ) : null}
          {tipo !== 'donante' ? (
            <label className="field">
              Proyectos en estado
              <Desplegable
                multiple
                name="estados"
                defaultValue={[...ACTIVOS]}
                opciones={OPCIONES_ESTADO}
                atajos={[
                  { texto: 'Activos', valores: [...ACTIVOS] },
                  { texto: 'Todos', valores: OPCIONES_ESTADO.map((o) => o.valor) },
                ]}
                placeholder="Activos"
              />
            </label>
          ) : null}
          {paises ? (
            <label className="field">
              Países
              <Desplegable multiple name="paises" opciones={paises} placeholder="Todos" textoBuscar="Buscar país…" />
            </label>
          ) : null}
          {!hoja ? (
            <>
              <label className="field">
                Novedades desde
                <input type="date" name="desde" defaultValue={haceUnAnio()} required max={hoy()} />
              </label>
              <label className="field">
                Hasta
                <input type="date" name="hasta" defaultValue={hoy()} required max={hoy()} />
              </label>
              <Idioma valor={elegida?.idioma ?? 'es'} />
              <Indicaciones ejemplo={tipo === 'donante' ? 'agradece especialmente su apoyo a la escuela de Kinshasa.' : 'centra el informe en los proyectos de agua.'} />
            </>
          ) : null}
        </div>
        <div className="botones">
          <Enviar pendiente={hoja ? 'Creando la hoja…' : 'Poniéndolo en marcha…'} disabled={!hoja && !elegida}>
            {hoja ? 'Generar hoja de cálculo' : elegida?.formato === 'slides' ? 'Generar presentación' : 'Generar informe'}
          </Enviar>
        </div>
        <ResultadoInforme estado={estado} />
      </form>
    </Dialogo>
  );
}
