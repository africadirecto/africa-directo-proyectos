// La cronología de un proyecto: cada evento con su fecha, quién lo hizo y una etiqueta de color.
// Sin nada del servidor: la usan el resumen, el seguimiento y su filtro (en el navegador).

import { fechaCorta } from '@/lib/formato';
import type { Evento } from '@/lib/tipos';

/** Etiquetas, en el orden en que se ofrecen en el filtro. */
export const ETIQUETAS: Record<string, string> = {
  estado: 'Cambio de estado',
  solicitud: 'Solicitud',
  revision: 'Revisión',
  informe: 'Informe',
  avance: 'Avance',
  incidencia: 'Incidencia',
  economico: 'Económico',
  correo: 'Correo',
  archivo: 'Archivo',
  otro: 'Nota',
  sistema: 'Sistema',
};

/**
 * La etiqueta de un evento: su categoría, si la tiene, o su tipo. Los borradores de informe y el
 * alta de la solicitud se guardaban antes como «sistema».
 */
export function etiquetaDe(e: Pick<Evento, 'tipo' | 'categoria' | 'texto'>): string {
  if (e.tipo === 'sistema' && e.texto.startsWith('Borrador listo')) return 'informe';
  if (e.tipo === 'sistema' && e.texto.startsWith('Solicitud registrada')) return 'solicitud';
  const clave = e.categoria ?? e.tipo;
  return clave in ETIQUETAS ? clave : 'otro';
}

const ORIGEN: Record<Evento['tipo'], string> = {
  estado: '',
  nota: 'nota',
  solicitud: 'formulario',
  revision: 'revisión',
  aportacion: 'financiación',
  correo: 'correo',
  archivo: 'archivo',
  informe: '',
  sistema: 'sistema',
};

export function ListaEventos({ eventos, vacio = 'Todavía no hay actividad.' }: { eventos: Evento[]; vacio?: string }) {
  if (!eventos.length) return <p className="vacio">{vacio}</p>;
  return (
    <div>
      {eventos.map((e, i) => {
        const clave = etiquetaDe(e);
        // Lo que hace un voluntario (dar de alta la solicitud, pedir un informe) lleva solo su nombre.
        const origen = e.autor && (clave === 'solicitud' || clave === 'informe') ? '' : ORIGEN[e.tipo];
        return (
          <div key={i} className="ev">
            <div className="d">
              {fechaCorta(e.fecha)}
              <small>{[origen, e.autor?.nombre.split(' ')[0]].filter(Boolean).join(' · ') || 'automático'}</small>
            </div>
            <div>
              <span className={`st ev-${clave}`}>{ETIQUETAS[clave]}</span>
              <p>{e.texto}</p>
              {e.enlaces?.length ? (
                <p className="meta" style={{ marginTop: 6 }}>
                  {e.enlaces.map((l, j) => (
                    <span key={j}>
                      {j ? ' · ' : ''}
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.texto} ↗
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
