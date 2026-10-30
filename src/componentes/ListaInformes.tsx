import { fechaCorta, fechaLarga } from '@/lib/formato';
import { descargas, type InformeConId } from '@/lib/dominio/informesComun';
import { Etiqueta } from './Basicos';
import { LogoDocs, LogoSheets, LogoSlides } from './Iconos';

/**
 * Informes hechos por la app (de un proyecto o de conjunto). La app no los envía: un voluntario
 * los revisa en Google y los descarga para enviarlos.
 */
export function ListaInformes({ informes, titulo = 'Informes' }: { informes: InformeConId[]; titulo?: string }) {
  if (!informes.length) return null;
  return (
    <section className="card">
      <h2 className="h3">{titulo}</h2>
      <p className="meta" style={{ margin: '-6px 0 10px' }}>
        Antes de enviar uno, ábrelo en Google, completa lo marcado como [PENDIENTE] y borra las notas para la revisión del final.
      </p>
      {informes.map((i) => (
        <div key={i.id} className="req">
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              {i.formato === 'slides' ? <LogoSlides tamano={16} /> : i.formato === 'sheets' ? <LogoSheets tamano={16} /> : <LogoDocs tamano={16} />}
              <a href={i.url} target="_blank" rel="noreferrer">
                {i.titulo.replace(/^\d{4}-\d{2}-\d{2} /, '')}
              </a>
            </p>
            <p className="meta" style={{ margin: '2px 0 0' }}>
              {i.tipo === 'financiacion' ? 'Para buscar financiación' : i.formato === 'sheets' ? 'Hoja de cálculo' : `${fechaCorta(i.desde)} – ${fechaCorta(i.hasta)}`} · {i.plantilla.nombre} · creado el {fechaLarga(i.creado)} por {i.creadoPor.nombre}
            </p>
            {i.notas?.length ? (
              <details className="desplegable" style={{ marginTop: 4 }}>
                <summary className="btn-enlace">Notas para la revisión</summary>
                <ul className="meta" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {i.notas.filter((n) => n.startsWith('• ')).map((n, k) => (
                    <li key={k}>{n.slice(2)}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <div className="botones" style={{ alignItems: 'center' }}>
            {i.pendientes ? <Etiqueta clase="s-par">{`${i.pendientes} pendiente${i.pendientes === 1 ? '' : 's'}`}</Etiqueta> : null}
            {/* Exportación de Google: funciona con la sesión de Google de la ONG. */}
            {descargas(i).map((d) => (
              <a key={d.texto} className="btn btn-s btn-peq" href={d.url} target="_blank" rel="noreferrer">
                {d.texto}
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
