'use client';

// Diálogo para generar un borrador con IA a partir de un proyecto: informe (Google Docs) o
// presentación (Google Slides), de seguimiento, final o para buscar financiación. Queda en
// 05_Informes para revisarlo y aprobarlo.

import { useActionState, useState } from 'react';
import { Dialogo } from '@/componentes/Dialogo';
import { Desplegable } from '@/componentes/Desplegable';
import { Enviar } from '@/componentes/FormAccion';
import { LogoDocs, LogoSlides } from '@/componentes/Iconos';
import { ElegirFormato, IdiomaYExtension, Indicaciones, ResultadoInforme } from '@/componentes/OpcionesInforme';
import { generarInformeAccion } from '@/lib/acciones/informes';
import type { PlantillaInforme, TipoInformeProyecto } from '@/lib/dominio/informes';
import type { FormatoInforme } from '@/lib/tipos';

const TIPOS = [
  { valor: 'financiacion', texto: 'Para buscar financiación (presentar el proyecto)' },
  { valor: 'seguimiento', texto: 'De seguimiento (a mitad del proyecto)' },
  { valor: 'final', texto: 'Final (al terminar)' },
];

export function GenerarInforme({
  codigo,
  plantillas,
  donantes,
  tipo: tipoInicial,
  desde,
  hoy,
  ia,
}: {
  codigo: string;
  plantillas: PlantillaInforme[];
  donantes: { id: string; nombre: string }[];
  tipo: TipoInformeProyecto;
  desde: string;
  hoy: string;
  ia: boolean;
}) {
  const [estado, ejecutar] = useActionState(generarInformeAccion, { ok: false });
  const [formato, setFormato] = useState<FormatoInforme>('docs');
  const [tipo, setTipo] = useState<string>(tipoInicial);
  const [plantilla, setPlantilla] = useState(`app:docs`);
  const deFormato = plantillas.filter((p) => p.formato === formato);

  return (
    <Dialogo boton="Generar informe" titulo="Generar informe">
      <form action={ejecutar} className="pila">
        <input type="hidden" name="codigo" value={codigo} />
        <p className="meta" style={{ margin: 0 }}>
          La IA redacta un borrador con los datos del proyecto, su cronología y la financiación. Lo que no consta queda marcado como [PENDIENTE]. Nada se envía al donante: revísalo y apruébalo en la pestaña Archivos.
        </p>
        {!ia ? (
          <p className="aviso" style={{ margin: 0 }}>
            La IA no está configurada: se creará el archivo con los datos y los apartados sin redactar.
          </p>
        ) : null}
        <ElegirFormato
          valor={formato}
          onChange={(f) => {
            setFormato(f);
            setPlantilla(`app:${f}`);
          }}
        />
        <div className="campos">
          <label className="field ancho">
            Tipo
            <Desplegable name="tipo" value={tipo} onChange={setTipo} opciones={TIPOS} />
          </label>
          <label className="field ancho">
            Plantilla
            <Desplegable
              name="plantilla"
              required
              value={plantilla}
              onChange={setPlantilla}
              opciones={deFormato.map((p) => ({ valor: p.id, texto: p.nombre, grupo: p.grupo, icono: p.formato === 'slides' ? <LogoSlides tamano={16} /> : <LogoDocs tamano={16} /> }))}
            />
          </label>
          <label className="field">
            {tipo === 'financiacion' ? 'Para presentar a' : 'Para el donante'}
            <Desplegable
              name="donante"
              defaultValue=""
              placeholder="Ninguno en concreto"
              opciones={[{ valor: '', texto: 'Ninguno en concreto' }, ...donantes.map((d) => ({ valor: d.id, texto: d.nombre }))]}
            />
          </label>
          {tipo !== 'financiacion' ? (
            <>
              <label className="field">
                Desde
                <input type="date" name="desde" defaultValue={desde} required max={hoy} />
              </label>
              <label className="field">
                Hasta
                <input type="date" name="hasta" defaultValue={hoy} required max={hoy} />
              </label>
            </>
          ) : null}
          <IdiomaYExtension />
          <label className="check ancho">
            <input type="checkbox" name="fotos" defaultChecked />
            Incluir la lista de fotos publicables
          </label>
          <Indicaciones ejemplo={tipo === 'financiacion' ? 'insiste en que la escuela es la única del barrio y en la aportación de las familias.' : 'destaca la participación de las madres en la obra.'} />
        </div>
        <div className="botones">
          <Enviar pendiente="Redactando… puede tardar un minuto">{formato === 'slides' ? 'Generar presentación' : 'Generar borrador'}</Enviar>
        </div>
        <ResultadoInforme estado={estado} />
      </form>
    </Dialogo>
  );
}
