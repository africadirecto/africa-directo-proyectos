import { archivosDelProyecto } from '@/lib/dominio/archivos';
import { drive } from '@/lib/drive';
import { fechaCorta } from '@/lib/formato';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { crearCarpetaAccion } from '@/lib/acciones/proyectos';
import { Publicable } from './Publicable';
import type { Proyecto } from '@/lib/tipos';

export async function Archivos({ p, editor }: { p: Proyecto; editor: boolean }) {
  if (!p.drive) {
    return (
      <section className="card pila">
        <p className="p">Este proyecto todavía no tiene carpeta en Drive.</p>
        {editor ? (
          <FormAccion accion={crearCarpetaAccion}>
            <input type="hidden" name="codigo" value={p.codigo} />
            <Enviar pendiente="Creando…">Crear carpeta en Drive</Enviar>
          </FormAccion>
        ) : null}
      </section>
    );
  }
  const d = await drive();
  const { carpetas, fotos, error } = await archivosDelProyecto(p);

  return (
    <div className="fila">
      <section className="card" style={{ flex: '1 1 340px', minWidth: 0 }}>
        <div className="card-cab">
          <h2 className="h3">Carpetas</h2>
          <a href={d.urlCarpeta(p.drive.carpetaId)} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600 }}>
            Abrir en Drive ↗
          </a>
        </div>
        {error ? <p className="aviso-error">{error}</p> : null}
        {carpetas.map((c) => (
          <div key={c.clave} className="folder">
            <a href={c.url} target="_blank" rel="noreferrer">
              {c.nombre}
            </a>
            <span className="meta">{c.cuenta ? `${c.cuenta} elemento${c.cuenta === 1 ? '' : 's'}` : 'vacía'}</span>
          </div>
        ))}
      </section>
      <section className="card" style={{ flex: '999 1 480px', minWidth: 0 }}>
        <h2 className="h3">Fotos</h2>
        <p className="meta" style={{ margin: '-6px 0 14px' }}>
          Solo las marcadas como publicables aparecerán en informes y presentaciones. Cuidado con las fotos de menores.
        </p>
        {fotos.length ? (
          <div className="fotos">
            {fotos.map((f) => (
              <div key={f.id} className="foto">
                <a href={f.url} target="_blank" rel="noreferrer">
                  {/* Miniatura de Drive: se ve si tienes sesión de Google con acceso a la unidad. */}
                  <img src={f.miniatura} alt={f.nombre} loading="lazy" referrerPolicy="no-referrer" />
                </a>
                <span className="meta" title={f.nombre} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fechaCorta(f.fecha)} · {f.nombre}
                </span>
                {editor ? (
                  <Publicable codigo={p.codigo} id={f.id} nombre={f.nombre} inicial={f.publicable} />
                ) : (
                  <span className="meta">{f.publicable ? 'Publicable' : 'No publicable'}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="vacio">Todavía no hay fotos.</p>
        )}
      </section>
    </div>
  );
}
