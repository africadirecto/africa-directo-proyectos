'use client';

// Diálogo para pedir un borrador con IA de un proyecto, con una de las plantillas de informe de
// proyecto (su nombre dice para qué es: seguimiento, final, presentación…). Se hace en segundo
// plano y queda en 03_Informes para revisarlo en Google y descargarlo.

import { useActionState, useState } from 'react';
import { Dialogo } from '@/componentes/Dialogo';
import { Desplegable } from '@/componentes/Desplegable';
import { Enviar } from '@/componentes/FormAccion';
import { ElegirPlantilla, Idioma, Indicaciones, ResultadoInforme } from '@/componentes/OpcionesInforme';
import { FotosYAdjuntos } from '@/componentes/FotosYAdjuntos';
import { pedirInformeAccion } from '@/lib/acciones/informes';
import type { OpcionPlantilla } from '@/lib/dominio/plantillas';

export function GenerarInforme({
  codigo,
  plantillas,
  donantes,
  desde,
  hoy,
  ia,
}: {
  codigo: string;
  plantillas: OpcionPlantilla[];
  donantes: { id: string; nombre: string }[];
  desde: string;
  hoy: string;
  ia: boolean;
}) {
  const [estado, pedir] = useActionState(pedirInformeAccion, { ok: false });
  const propuesta = plantillas.find((p) => p.porDefecto && p.formato === 'docs') ?? plantillas[0];
  const [id, setId] = useState(propuesta?.id ?? '');
  const elegida = plantillas.find((p) => p.id === id);

  return (
    <Dialogo boton="Generar informe" titulo="Generar informe">
      <form action={pedir} className="pila">
        <input type="hidden" name="codigo" value={codigo} />
        <p className="meta" style={{ margin: 0 }}>
          La IA redacta un borrador con los datos del proyecto, su cronología y la financiación, siguiendo las instrucciones de la plantilla. Lo que no consta queda resaltado en amarillo. Nada se envía al donante: revísalo en Google y descárgalo desde la pestaña Archivos.
        </p>
        {!ia ? (
          <p className="aviso" style={{ margin: 0 }}>
            La IA no está configurada: el documento se hará con los datos y los apartados sin redactar.
          </p>
        ) : null}
        <div className="campos">
          <ElegirPlantilla plantillas={plantillas} valor={id} onChange={setId} />
          <label className="field">
            Para el donante
            <Desplegable
              name="donante"
              buscar
              textoBuscar="Buscar donante…"
              defaultValue={elegida?.donante?.id ?? ''}
              key={elegida?.id}
              placeholder="Ninguno en concreto"
              opciones={[{ valor: '', texto: 'Ninguno en concreto' }, ...donantes.map((d) => ({ valor: d.id, texto: d.nombre }))]}
            />
          </label>
          <Idioma valor={elegida?.idioma ?? 'es'} />
          <label className="field">
            Desde
            <input type="date" name="desde" defaultValue={desde} required max={hoy} />
          </label>
          <label className="field">
            Hasta
            <input type="date" name="hasta" defaultValue={hoy} required max={hoy} />
          </label>
          <FotosYAdjuntos codigo={codigo} conFotos={!!elegida?.conFotos} desde={desde} hasta={hoy} />
          <Indicaciones ejemplo="destaca la participación de las madres en la obra." />
        </div>
        <div className="botones">
          <Enviar pendiente="Poniéndolo en marcha…" disabled={!elegida}>
            {elegida?.formato === 'slides' ? 'Generar presentación' : 'Generar borrador'}
          </Enviar>
        </div>
        <ResultadoInforme estado={estado} />
      </form>
    </Dialogo>
  );
}
