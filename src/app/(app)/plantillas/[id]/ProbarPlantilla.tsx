'use client';

// Probar una plantilla (aunque esté en borrador) con los datos de un proyecto. El informe de prueba
// va a «AD · Plantillas / _Pruebas» y aparece en esta página, no en la ficha del proyecto.

import { useActionState } from 'react';
import { Desplegable } from '@/componentes/Desplegable';
import { Enviar } from '@/componentes/FormAccion';
import { Idioma, Indicaciones, ResultadoInforme } from '@/componentes/OpcionesInforme';
import { pedirInformeAccion } from '@/lib/acciones/informes';

export function ProbarPlantilla({ id, idioma, proyectos, conPeriodo }: { id: string; idioma: string; proyectos: { codigo: string; titulo: string }[]; conPeriodo: boolean }) {
  const [estado, pedir] = useActionState(pedirInformeAccion, { ok: false });
  const hoy = new Date().toISOString().slice(0, 10);
  const haceSeisMeses = new Date(Date.now() - 182 * 86_400_000).toISOString().slice(0, 10);
  return (
    <form action={pedir} className="pila">
      <input type="hidden" name="plantilla" value={id} />
      <input type="hidden" name="prueba" value="1" />
      <p className="meta" style={{ margin: 0 }}>
        Se hace un informe con esta plantilla y los datos del proyecto que elijas, igual que uno de verdad, para ver cómo queda. Va a «AD · Plantillas / _Pruebas»; no aparece en la ficha del proyecto.
      </p>
      <div className="campos">
        <label className="field ancho">
          Proyecto
          <Desplegable name="codigo" buscar textoBuscar="Buscar proyecto…" defaultValue={proyectos[0]?.codigo ?? ''} opciones={proyectos.map((p) => ({ valor: p.codigo, texto: p.titulo ? `${p.titulo} (${p.codigo})` : p.codigo }))} />
        </label>
        <Idioma valor={idioma} />
        {conPeriodo ? (
          <>
            <label className="field">
              Desde
              <input type="date" name="desde" defaultValue={haceSeisMeses} required max={hoy} />
            </label>
            <label className="field">
              Hasta
              <input type="date" name="hasta" defaultValue={hoy} required max={hoy} />
            </label>
          </>
        ) : null}
        <Indicaciones ejemplo="destaca el avance de la obra." />
      </div>
      <div className="botones">
        <Enviar pendiente="Poniéndolo en marcha…" disabled={!proyectos.length}>
          Probar
        </Enviar>
      </div>
      <ResultadoInforme estado={estado} />
    </form>
  );
}
