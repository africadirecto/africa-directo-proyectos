'use client';

// Diálogo para generar un borrador de informe con IA: plantilla, tipo, periodo, donante,
// idioma, extensión y fotos. El borrador queda en 05_Informes para revisarlo y aprobarlo.

import { useActionState } from 'react';
import { Dialogo } from '@/componentes/Dialogo';
import { Desplegable } from '@/componentes/Desplegable';
import { Enviar } from '@/componentes/FormAccion';
import { LogoDocs } from '@/componentes/Iconos';
import { generarInformeAccion } from '@/lib/acciones/informes';
import type { PlantillaInforme } from '@/lib/dominio/informes';
import type { TipoInforme } from '@/lib/tipos';

const TIPOS = [
  { valor: 'seguimiento', texto: 'De seguimiento (a mitad del proyecto)' },
  { valor: 'final', texto: 'Final (al terminar)' },
];
const IDIOMAS = [
  { valor: 'es', texto: 'Español' },
  { valor: 'fr', texto: 'Francés' },
  { valor: 'en', texto: 'Inglés' },
  { valor: 'pt', texto: 'Portugués' },
];
const EXTENSIONES = [
  { valor: 'breve', texto: 'Breve (1 página)' },
  { valor: 'normal', texto: 'Normal (2-3 páginas)' },
  { valor: 'detallado', texto: 'Detallado' },
];

export function GenerarInforme({
  codigo,
  plantillas,
  donantes,
  tipo,
  desde,
  hoy,
  ia,
}: {
  codigo: string;
  plantillas: PlantillaInforme[];
  donantes: { id: string; nombre: string }[];
  tipo: TipoInforme;
  desde: string;
  hoy: string;
  ia: boolean;
}) {
  const [estado, ejecutar] = useActionState(generarInformeAccion, { ok: false });

  return (
    <Dialogo boton="Generar informe" titulo="Generar informe">
      <form action={ejecutar} className="pila">
        <input type="hidden" name="codigo" value={codigo} />
        <p className="meta" style={{ margin: 0 }}>
          La IA redacta un borrador en Google Docs con los datos del proyecto, la cronología del periodo y la financiación. Lo que no consta queda marcado como [PENDIENTE]. Nada se envía al donante: revísalo y apruébalo en la pestaña Archivos.
        </p>
        {!ia ? (
          <p className="aviso" style={{ margin: 0 }}>
            La IA no está configurada: se creará el documento con los datos y los apartados sin redactar.
          </p>
        ) : null}
        <div className="campos">
          <label className="field ancho">
            Plantilla
            <Desplegable
              name="plantilla"
              required
              defaultValue={plantillas[0]?.id}
              opciones={plantillas.map((p) => ({ valor: p.id, texto: p.nombre, grupo: p.grupo, icono: <LogoDocs tamano={16} /> }))}
            />
          </label>
          <label className="field">
            Tipo de informe
            <Desplegable name="tipo" defaultValue={tipo} opciones={TIPOS} />
          </label>
          <label className="field">
            Para el donante
            <Desplegable
              name="donante"
              defaultValue=""
              placeholder="Ninguno en concreto"
              opciones={[{ valor: '', texto: 'Ninguno en concreto' }, ...donantes.map((d) => ({ valor: d.id, texto: d.nombre }))]}
            />
          </label>
          <label className="field">
            Desde
            <input type="date" name="desde" defaultValue={desde} required max={hoy} />
          </label>
          <label className="field">
            Hasta
            <input type="date" name="hasta" defaultValue={hoy} required max={hoy} />
          </label>
          <label className="field">
            Idioma del informe
            <Desplegable name="idioma" defaultValue="es" opciones={IDIOMAS} />
          </label>
          <label className="field">
            Extensión
            <Desplegable name="extension" defaultValue="normal" opciones={EXTENSIONES} />
          </label>
          <label className="check ancho">
            <input type="checkbox" name="fotos" defaultChecked />
            Incluir la lista de fotos publicables
          </label>
          <label className="field ancho">
            <span>
              Indicaciones para la IA <span className="ayuda">opcional</span>
            </span>
            <textarea name="instrucciones" rows={3} placeholder="Por ejemplo: destaca la participación de las madres en la obra y menciona el retraso por las lluvias." />
          </label>
        </div>
        <div className="botones">
          <Enviar pendiente="Redactando el informe… puede tardar un minuto">Generar borrador</Enviar>
        </div>
        {estado.vez && estado.mensaje ? (
          <div role="status" className={estado.ok ? 'aviso-ok' : 'aviso-error'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>{estado.mensaje}</span>
            {estado.url ? (
              <a className="btn btn-s btn-peq" href={estado.url} target="_blank" rel="noreferrer">
                <LogoDocs tamano={16} /> Abrir en Google Docs
              </a>
            ) : null}
          </div>
        ) : null}
      </form>
    </Dialogo>
  );
}
