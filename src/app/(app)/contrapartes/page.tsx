import type { Metadata } from 'next';
import { requiere, tienePermiso } from '@/lib/sesion';
import { listarContrapartes } from '@/lib/dominio/contrapartes';
import { leerIndice } from '@/lib/dominio/indice';
import { Dialogo } from '@/componentes/Dialogo';
import { FormContraparte } from './FormContraparte';
import { PanelContrapartes } from './PanelContrapartes';
import { BotonInformeGeneral } from '../BotonInformeGeneral';
import { ListaInformes } from '@/componentes/ListaInformes';
import { listarInformesGenerales } from '@/lib/dominio/informesGenerales';

export const metadata: Metadata = { title: 'Contrapartes' };
export const maxDuration = 180;

/** Todos pueden verlas; con permiso de edición se añaden y con administración se editan. */
export default async function Contrapartes() {
  const yo = await requiere('lectura');
  const [contrapartes, filas] = await Promise.all([listarContrapartes(), leerIndice()]);
  const editor = tienePermiso(yo, 'edicion');

  return (
    <main className="principal">
      <div className="titulo-pagina">
        <div>
          <h1>Contrapartes</h1>
          <p>Congregaciones, diócesis y asociaciones locales que piden y ejecutan los proyectos.</p>
        </div>
        {editor ? (
          <div className="botones">
            <BotonInformeGeneral
              tipo="contraparte"
              etiquetaSobre="Contraparte"
              opcionesSobre={[{ valor: '', texto: 'Todas las contrapartes' }, ...contrapartes.map((c) => ({ valor: c.id, texto: c.nombre }))]}
            />
            <Dialogo boton="Añadir contraparte" claseBoton="btn btn-p" titulo="Nueva contraparte">
              <FormContraparte />
            </Dialogo>
          </div>
        ) : null}
      </div>
      <PanelContrapartes contrapartes={contrapartes} filas={filas} admin={tienePermiso(yo, 'admin')} />
      <ListaInformes informes={await listarInformesGenerales('contraparte')} titulo="Informes de contrapartes" />
    </main>
  );
}
