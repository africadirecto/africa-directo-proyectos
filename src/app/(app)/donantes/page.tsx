import type { Metadata } from 'next';
import { requiere, tienePermiso } from '@/lib/sesion';
import { listarDonantes, TIPOS_DONANTE } from '@/lib/dominio/donantes';
import { todasLasAportaciones } from '@/lib/dominio/aportaciones';
import { Dialogo } from '@/componentes/Dialogo';
import { FormDonante } from './FormDonante';
import { PanelDonantes } from './PanelDonantes';

export const metadata: Metadata = { title: 'Donantes' };

export default async function Donantes() {
  const yo = await requiere('lectura');
  const [donantes, aportaciones] = await Promise.all([listarDonantes(), todasLasAportaciones()]);

  return (
    <main className="principal">
      <div className="titulo-pagina">
        <div>
          <h1>Donantes</h1>
          <p>Fundaciones, empresas, entidades públicas y particulares, con lo que han aportado y los informes que piden.</p>
        </div>
        {tienePermiso(yo, 'edicion') ? (
          <Dialogo boton="Añadir donante" claseBoton="btn btn-p" titulo="Nuevo donante">
            <FormDonante />
          </Dialogo>
        ) : null}
      </div>
      <PanelDonantes donantes={donantes} aportaciones={aportaciones} tipos={TIPOS_DONANTE} />
    </main>
  );
}
