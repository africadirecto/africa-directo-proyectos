import type { Metadata } from 'next';
import Link from 'next/link';
import { requiere, tienePermiso } from '@/lib/sesion';
import { listarDonantes } from '@/lib/dominio/donantes';
import {
  CLASE_ESTADO,
  ESTADOS_PLANTILLA,
  FORMATOS_PLANTILLA,
  TIPOS_PLANTILLA,
  camposSinInstruccion,
  documentosSinRegistrar,
  ejemplosDisponibles,
  listarPlantillas,
} from '@/lib/dominio/plantillas';
import { crearPlantillasAppAccion } from '@/lib/acciones/plantillas';
import { fechaCorta } from '@/lib/formato';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Etiqueta } from '@/componentes/Basicos';
import { FormPlantilla } from './FormPlantilla';
import { TIPOS } from './ElegirTipo';
import { NuevaDesdeEjemplo } from './NuevaDesdeEjemplo';
import { MIMES_EJEMPLO } from '@/lib/trabajos/plantilla';
import { modoDemo } from '@/lib/config';
import type { TipoInforme } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Plantillas' };

export default async function Plantillas() {
  const yo = await requiere('lectura');
  const edicion = tienePermiso(yo, 'edicion');
  const [plantillas, documentos, donantes, ejemplos] = await Promise.all([
    listarPlantillas(),
    edicion ? documentosSinRegistrar().catch(() => []) : Promise.resolve([]),
    edicion ? listarDonantes() : Promise.resolve([]),
    edicion ? ejemplosDisponibles(Object.keys(MIMES_EJEMPLO)).catch(() => []) : Promise.resolve([]),
  ]);
  const hayDeLaOng = plantillas.some((p) => p.origen === 'app');

  return (
    <main className="principal">
      <div className="titulo-pagina">
        <div>
          <h1>Plantillas</h1>
          <p>Los informes salen de estas plantillas: el documento se edita en Google y las instrucciones para la IA, aquí.</p>
        </div>
        <div className="botones">
          {tienePermiso(yo, 'admin') && !hayDeLaOng ? (
            <FormAccion accion={crearPlantillasAppAccion}>
              <Enviar clase="btn btn-s" pendiente="Creando en Drive…">
                Crear las plantillas de la ONG
              </Enviar>
            </FormAccion>
          ) : null}
          {edicion ? (
            <Dialogo boton="Crear desde un ejemplo" claseBoton="btn btn-s" titulo="Plantilla a partir de un informe de ejemplo">
              <NuevaDesdeEjemplo ejemplos={ejemplos} donantes={donantes.map((d) => ({ id: d.id, nombre: d.nombre }))} demo={modoDemo} />
            </Dialogo>
          ) : null}
          {edicion ? (
            <Dialogo boton="Añadir desde Drive" claseBoton="btn btn-p" titulo="Añadir una plantilla de Drive">
              <FormPlantilla documentos={documentos} donantes={donantes.map((d) => ({ id: d.id, nombre: d.nombre }))} />
            </Dialogo>
          ) : null}
        </div>
      </div>

      {plantillas.length ? (
        (Object.keys(TIPOS_PLANTILLA) as TipoInforme[])
          .filter((t) => plantillas.some((p) => p.tipo === t))
          .map((tipo) => (
            <section key={tipo} className="card" style={{ padding: 0 }}>
              <h2 className="h3" style={{ padding: '16px 16px 0' }}>
                {TIPOS_PLANTILLA[tipo]}
              </h2>
              <p className="meta" style={{ margin: '2px 16px 0' }}>
                {TIPOS[tipo].ayuda}
              </p>
              <div className="desliza">
                <table className="tbl" style={{ tableLayout: 'fixed', minWidth: 640 }}>
                  {/* Mismos anchos en todas las secciones, para que las columnas se alineen. */}
                  <colgroup>
                    <col style={{ width: '38%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Plantilla</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Campos</th>
                      <th scope="col">Actualizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantillas
                      .filter((p) => p.tipo === tipo)
                      .map((p) => {
                        const ia = p.estructura.campos.filter((c) => !c.huerfano && c.tipo === 'ia').length;
                        const fotos = p.estructura.campos.filter((c) => !c.huerfano && c.tipo !== 'ia').length;
                        const sin = camposSinInstruccion(p).length;
                        const avisos = p.sincronizado?.avisos.length ?? 0;
                        return (
                          <tr key={p.id}>
                            <td>
                              <Link className="fuerte" href={`/plantillas/${p.id}`}>
                                {p.nombre}
                              </Link>
                              <span className="sub">
                                {FORMATOS_PLANTILLA[p.formato]}
                                {p.donante ? ` · de ${p.donante.nombre}` : ''}
                              </span>
                            </td>
                            <td>
                              <div className="botones" style={{ gap: 6 }}>
                                <Etiqueta clase={CLASE_ESTADO[p.estado]}>{ESTADOS_PLANTILLA[p.estado]}</Etiqueta>
                                {p.porDefecto ? <Etiqueta clase="s-fin">Por defecto</Etiqueta> : null}
                              </div>
                            </td>
                            <td>
                              {ia} para redactar{fotos ? `, ${fotos} de fotos` : ''}
                              {sin || avisos ? (
                                <span className="sub" style={{ color: 'var(--aviso-texto)' }}>
                                  {[sin ? `${sin} sin instrucción` : '', avisos ? `${avisos} aviso${avisos > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
                                </span>
                              ) : null}
                            </td>
                            <td>{fechaCorta(p.actualizado)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
      ) : (
        <section className="card">
          <p className="vacio">
            Aún no hay plantillas.{' '}
            {tienePermiso(yo, 'admin') ? 'Crea las de la ONG para empezar, o añade un documento de Drive.' : 'Pide a administración que cree las de la ONG.'}
          </p>
        </section>
      )}
    </main>
  );
}
