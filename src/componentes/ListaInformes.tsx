import { fechaCorta, fechaLarga } from '@/lib/formato';
import { descargas, type InformeConId } from '@/lib/dominio/informesComun';
import { Etiqueta } from './Basicos';
import { LogoDocs, LogoSheets, LogoSlides } from './Iconos';
import { ProgresoInforme } from './ProgresoInforme';

/**
 * Informes hechos por la app (de un proyecto o resúmenes). La app no los envía: un voluntario
 * los revisa en Google y los descarga para enviarlos. Los que están haciéndose muestran cómo van.
 * `coleccion`: dónde están (proyectos/{codigo}/informes o informes), para seguir su progreso.
 */
export function ListaInformes({ informes, coleccion, titulo = 'Informes', editable = false }: { informes: InformeConId[]; coleccion: string; titulo?: string; editable?: boolean }) {
  if (!informes.length) return null;
  return (
    <section className="card">
      <h2 className="h3">{titulo}</h2>
      <p className="meta" style={{ margin: '-6px 0 10px' }}>
        Antes de enviar uno, ábrelo en Google y completa lo resaltado en amarillo: es lo que no consta en la app.
      </p>
      {informes.map((i) => {
        const estado = i.estado ?? 'listo';
        const icono = i.formato === 'slides' ? <LogoSlides tamano={16} /> : i.formato === 'sheets' ? <LogoSheets tamano={16} /> : <LogoDocs tamano={16} />;
        const nombre = i.titulo.replace(/^\d{4}-\d{2}-\d{2} /, '');
        const fuentes = Object.entries(i.fuentes ?? {}).filter(([, f]) => f.length);
        return (
          <div key={i.id} className="req">
            <div style={{ minWidth: 0, flex: '1 1 320px' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                {icono}
                {i.url ? (
                  <a href={i.url} target="_blank" rel="noreferrer">
                    {nombre}
                  </a>
                ) : (
                  nombre
                )}
              </p>
              <p className="meta" style={{ margin: '2px 0 0' }}>
                {i.formato === 'sheets' ? 'Hoja de cálculo' : `${fechaCorta(i.desde)} – ${fechaCorta(i.hasta)}`} · {i.plantilla.nombre}
                {i.donante?.nombre ? ` · para ${i.donante.nombre}` : ''} · pedido el {fechaLarga(i.creado)} por {i.creadoPor.nombre}
              </p>
              {estado !== 'listo' ? (
                <div style={{ marginTop: 8 }}>
                  <ProgresoInforme
                    ruta={`${coleccion}/${i.id}`}
                    editable={editable}
                    inicial={{ estado, progreso: i.progreso ?? null, modo: i.modo ?? null, error: i.error ?? '', url: i.url, pendientes: i.pendientes }}
                  />
                </div>
              ) : null}
              {fuentes.length ? (
                <details className="desplegable" style={{ marginTop: 4 }}>
                  <summary className="btn-enlace">De dónde sale cada apartado</summary>
                  <ul className="meta" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {fuentes.map(([clave, f]) => (
                      <li key={clave}>
                        <b>{clave}</b>: {f.join(' · ')}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : i.notas?.length ? (
                <details className="desplegable" style={{ marginTop: 4 }}>
                  <summary className="btn-enlace">Notas para la revisión</summary>
                  <ul className="meta" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {i.notas
                      .filter((n) => n.startsWith('• '))
                      .map((n, k) => (
                        <li key={k}>{n.slice(2)}</li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </div>
            {estado === 'listo' ? (
              <div className="botones" style={{ alignItems: 'center' }}>
                {i.pendientes ? <Etiqueta clase="s-rev">{`${i.pendientes} hueco${i.pendientes === 1 ? '' : 's'}`}</Etiqueta> : null}
                {/* Exportación de Google: funciona con la sesión de Google de la ONG. */}
                {descargas(i).map((d) => (
                  <a key={d.texto} className="btn btn-s btn-peq" href={d.url} target="_blank" rel="noreferrer">
                    {d.texto}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
