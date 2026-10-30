'use client';

// Diálogo para un informe de conjunto con IA (Google Docs o Slides): de varios proyectos
// (página de Proyectos), de contrapartes o de un donante.

import { useActionState, useState } from 'react';
import { Dialogo } from '@/componentes/Dialogo';
import { Desplegable, type Opcion } from '@/componentes/Desplegable';
import { Enviar } from '@/componentes/FormAccion';
import { ElegirFormato, IdiomaYExtension, Indicaciones, ResultadoInforme } from '@/componentes/OpcionesInforme';
import { generarInformeGeneralAccion } from '@/lib/acciones/informes';
import { ACTIVOS, ESTADOS } from '@/lib/estados';
import type { EstadoProyecto, FormatoInforme } from '@/lib/tipos';

const OPCIONES_ESTADO = (Object.keys(ESTADOS) as EstadoProyecto[]).map((e) => ({ valor: e, texto: ESTADOS[e].nombre }));

const hoy = () => new Date().toISOString().slice(0, 10);
const haceUnAnio = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
};

export function BotonInformeGeneral({
  tipo,
  sobre,
  opcionesSobre,
  etiquetaSobre = '',
  paises,
  claseBoton = 'btn btn-s',
}: {
  tipo: 'cartera' | 'contraparte' | 'donante';
  /** Fijo (por ejemplo, el donante de su página). */
  sobre?: string;
  /** Para elegir (por ejemplo, la contraparte o «todas»). */
  opcionesSobre?: Opcion[];
  etiquetaSobre?: string;
  /** Para filtrar por país (informe de cartera). */
  paises?: Opcion[];
  claseBoton?: string;
}) {
  const [estado, ejecutar] = useActionState(generarInformeGeneralAccion, { ok: false });
  const [formato, setFormato] = useState<FormatoInforme>('docs');
  const titulo = { cartera: 'Informe de proyectos', contraparte: 'Informe de contrapartes', donante: 'Informe para el donante' }[tipo];
  const explicacion = {
    cartera: 'Un informe de varios proyectos: cifras, panorama, avances y retos, con la tabla de proyectos.',
    contraparte: 'Los proyectos de una contraparte (o de todas), con sus cifras y lo más relevante del periodo.',
    donante: 'Lo que ha financiado este donante y cómo van esos proyectos, para enviárselo.',
  }[tipo];

  return (
    <Dialogo boton="Generar informe" claseBoton={claseBoton} titulo={titulo}>
      <form action={ejecutar} className="pila">
        <input type="hidden" name="tipo" value={tipo} />
        {sobre !== undefined ? <input type="hidden" name="sobre" value={sobre} /> : null}
        <p className="meta" style={{ margin: 0 }}>
          {explicacion} La IA lo redacta con los datos de la app; lo que no consta queda como [PENDIENTE]. Revísalo y apruébalo antes de enviarlo.
        </p>
        <ElegirFormato valor={formato} onChange={setFormato} />
        <div className="campos">
          {opcionesSobre ? (
            <label className="field ancho">
              {etiquetaSobre}
              <Desplegable name="sobre" defaultValue={opcionesSobre[0]?.valor ?? ''} opciones={opcionesSobre} />
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
          <label className="field">
            Novedades desde
            <input type="date" name="desde" defaultValue={haceUnAnio()} required max={hoy()} />
          </label>
          <label className="field">
            Hasta
            <input type="date" name="hasta" defaultValue={hoy()} required max={hoy()} />
          </label>
          <IdiomaYExtension />
          <Indicaciones ejemplo={tipo === 'donante' ? 'agradece especialmente su apoyo a la escuela de Kinshasa.' : 'centra el informe en los proyectos de agua.'} />
        </div>
        <div className="botones">
          <Enviar pendiente="Redactando… puede tardar un minuto">{formato === 'slides' ? 'Generar presentación' : 'Generar informe'}</Enviar>
        </div>
        <ResultadoInforme estado={estado} />
      </form>
    </Dialogo>
  );
}
