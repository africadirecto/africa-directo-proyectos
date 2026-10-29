import Link from 'next/link';
import { requiere, tienePermiso } from '@/lib/sesion';
import { leerIndice } from '@/lib/dominio/indice';
import { requiereAtencion } from '@/lib/dominio/atencion';
import { ACTIVOS } from '@/lib/estados';
import { PanelProyectos } from './PanelProyectos';

export default async function Proyectos() {
  const yo = await requiere('lectura');
  const filas = await leerIndice();
  const atencion = requiereAtencion(filas);
  const activos = filas.filter((f) => ACTIVOS.includes(f.estado));
  const paises = new Set(activos.map((f) => f.pais)).size;

  return (
    <main className="principal">
      <div className="titulo-pagina">
        <div>
          <h1>Proyectos</h1>
          <p>
            {filas.length} proyectos · {activos.length} activos en {paises} {paises === 1 ? 'país' : 'países'}
          </p>
        </div>
        {tienePermiso(yo, 'edicion') ? (
          <Link className="btn btn-p" href="/solicitudes/nueva">
            Nueva solicitud
          </Link>
        ) : null}
      </div>
      <PanelProyectos
        filas={filas}
        yo={yo.email}
        sinNoticias={atencion.sinNoticias.map((f) => f.codigo)}
        porRevisar={atencion.porRevisar.length}
        sinResponder={atencion.sinResponder.length}
      />
    </main>
  );
}
