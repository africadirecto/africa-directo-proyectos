'use client';

// Diálogo para un resumen de varios proyectos (página de Proyectos), con una de las plantillas de
// resumen o, sin IA, la hoja de cálculo con los datos.

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

export function GenerarResumen({ plantillas, paises }: { plantillas: OpcionPlantilla[]; paises: Opcion[] }) {
  const [estado, pedir] = useActionState(pedirInformeAccion, { ok: false });
  const propuesta = plantillas.find((p) => p.porDefecto && p.formato === 'docs') ?? plantillas[0];
  const [id, setId] = useState(propuesta?.id ?? 'sheets');
  const elegida = plantillas.find((p) => p.id === id);
  const hoja = id === 'sheets';

  return (
    <Dialogo boton="Generar resumen" claseBoton="btn btn-s" titulo="Resumen de proyectos">
      <form action={pedir} className="pila">
        <p className="meta" style={{ margin: 0 }}>
          {hoja
            ? 'Un libro con todos los datos de los proyectos elegidos y resúmenes por estado, país, sector, contraparte y año, con gráficas. Los resúmenes son fórmulas: si corriges un dato en la hoja «Proyectos», se recalculan. No usa IA.'
            : 'La IA lo redacta con los datos de los proyectos elegidos siguiendo la plantilla; lo que no consta queda resaltado en amarillo. Revísalo en Google antes de enviarlo.'}
        </p>
        <div className="campos">
          <ElegirPlantilla plantillas={plantillas} valor={id} onChange={setId} hoja />
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
          <label className="field">
            Países
            <Desplegable multiple name="paises" opciones={paises} placeholder="Todos" textoBuscar="Buscar país…" />
          </label>
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
              <Indicaciones ejemplo="centra el resumen en los proyectos de agua." />
            </>
          ) : null}
        </div>
        <div className="botones">
          <Enviar pendiente={hoja ? 'Creando la hoja…' : 'Poniéndolo en marcha…'} disabled={!hoja && !elegida}>
            {hoja ? 'Generar hoja de cálculo' : elegida?.formato === 'slides' ? 'Generar presentación' : 'Generar resumen'}
          </Enviar>
        </div>
        <ResultadoInforme estado={estado} />
      </form>
    </Dialogo>
  );
}
