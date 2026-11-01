import { requiere, tienePermiso } from '@/lib/sesion';
import { leerIndice } from '@/lib/dominio/indice';
import { requiereAtencion } from '@/lib/dominio/atencion';
import { listarResumenes } from '@/lib/dominio/informesGenerales';
import { ACTIVOS } from '@/lib/estados';
import { nombrePais } from '@/lib/paises';
import { Bandera } from '@/componentes/Desplegable';
import { ListaInformes } from '@/componentes/ListaInformes';
import { plantillasActivas } from '@/lib/dominio/plantillas';
import { PanelProyectos } from './PanelProyectos';
import { GenerarResumen } from './GenerarResumen';

// Al pedir un resumen, su preparación sigue en segundo plano dentro de la misma petición.
export const maxDuration = 300;

export default async function Proyectos() {
  const yo = await requiere('lectura');
  const editor = tienePermiso(yo, 'edicion');
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
        {editor ? (
          <GenerarResumen
            plantillas={await plantillasActivas('resumen')}
            paises={[...new Set(filas.map((f) => f.pais).filter(Boolean))]
              .sort((a, b) => nombrePais(a).localeCompare(nombrePais(b), 'es'))
              .map((p) => ({ valor: p, texto: nombrePais(p), icono: <Bandera codigo={p} /> }))}
          />
        ) : null}
      </div>
      <PanelProyectos
        filas={filas}
        sinNoticias={atencion.sinNoticias.map((f) => f.codigo)}
        porRevisar={atencion.porRevisar.length}
        sinResponder={atencion.sinResponder.length}
      />
      <ListaInformes informes={await listarResumenes()} coleccion="informes" editable={editor} titulo="Resúmenes" />
    </main>
  );
}
