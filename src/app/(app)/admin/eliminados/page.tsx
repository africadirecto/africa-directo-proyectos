import type { Metadata } from 'next';
import { requiere } from '@/lib/sesion';
import { listarEliminados } from '@/lib/dominio/proyectos';
import { drive } from '@/lib/drive';
import { fechaCorta } from '@/lib/formato';
import { nombrePais } from '@/lib/paises';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { recuperarProyectoAccion } from '@/lib/acciones/proyectos';

export const metadata: Metadata = { title: 'Proyectos eliminados' };

export default async function Eliminados() {
  await requiere('admin');
  const [proyectos, d] = await Promise.all([listarEliminados(), drive()]);

  return (
    <>
      <h1>Proyectos eliminados</h1>
      <section className="card">
        <p className="meta" style={{ margin: '0 0 8px' }}>
          No se ven en el resto de la app, pero se conservan enteros, con su carpeta en «Proyectos eliminados» de Drive. Al recuperar uno, vuelve a Proyectos tal como
          estaba.
        </p>
        {proyectos.map((p) => (
          <div key={p.codigo} className="req">
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                {p.codigo} · {p.titulo || `Solicitud de ${p.contraparte.nombre}`}
              </p>
              <p className="meta" style={{ margin: '2px 0 0' }}>
                {[nombrePais(p.pais), p.contraparte.nombre].filter(Boolean).join(' · ')} · eliminado el {fechaCorta(p.eliminado!.fecha)} por {p.eliminado!.por.nombre}
                {p.drive ? (
                  <>
                    {' · '}
                    <a href={d.urlCarpeta(p.drive.carpetaId)} target="_blank" rel="noreferrer">
                      Carpeta en Drive
                    </a>
                    {p.eliminado!.carpetaAnterior ? '' : ' (no se pudo mover a «Proyectos eliminados»)'}
                  </>
                ) : null}
              </p>
            </div>
            <FormAccion accion={recuperarProyectoAccion} confirmar={`¿Recuperar el proyecto ${p.codigo}? Volverá a verse en la app y su carpeta de Drive volverá a su sitio.`}>
              <input type="hidden" name="codigo" value={p.codigo} />
              <Enviar clase="btn btn-s" pendiente="Recuperando…">
                Recuperar
              </Enviar>
            </FormAccion>
          </div>
        ))}
        {!proyectos.length ? <p className="vacio">No hay proyectos eliminados.</p> : null}
      </section>
    </>
  );
}
