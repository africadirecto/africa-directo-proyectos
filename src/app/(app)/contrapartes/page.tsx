import type { Metadata } from 'next';
import { requiere, tienePermiso } from '@/lib/sesion';
import { listarContrapartes } from '@/lib/dominio/contrapartes';
import { leerIndice } from '@/lib/dominio/indice';
import { Dialogo } from '@/componentes/Dialogo';
import { FormContraparte } from './FormContraparte';
import { PanelContrapartes } from './PanelContrapartes';

export const metadata: Metadata = { title: 'Contrapartes' };

/** Todos pueden verlas; con permiso de edición se añaden y con administración se editan. */
export default async function Contrapartes() {
  const yo = await requiere('lectura');
  const [contrapartes, filas] = await Promise.all([listarContrapartes(), leerIndice()]);

  return (
    <main className="principal">
      <div className="titulo-pagina">
        <div>
          <h1>Contrapartes</h1>
          <p>Congregaciones, diócesis y asociaciones locales que piden y ejecutan los proyectos.</p>
        </div>
        {tienePermiso(yo, 'edicion') ? (
          <Dialogo boton="Añadir contraparte" claseBoton="btn btn-p" titulo="Nueva contraparte">
            <FormContraparte />
          </Dialogo>
        ) : null}
      </div>
      <PanelContrapartes contrapartes={contrapartes} filas={filas} admin={tienePermiso(yo, 'admin')} />
    </main>
  );
}
