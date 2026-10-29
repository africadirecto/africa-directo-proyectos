import type { Metadata } from 'next';
import Link from 'next/link';
import { requiere } from '@/lib/sesion';
import { listarContrapartes } from '@/lib/dominio/contrapartes';
import { correoDisponible } from '@/lib/avisos';
import { listaPaises, nombrePais } from '@/lib/paises';
import { FormNueva } from './FormNueva';

export const metadata: Metadata = { title: 'Nueva solicitud' };

export default async function NuevaSolicitud() {
  await requiere('edicion');
  const contrapartes = await listarContrapartes();

  return (
    <main className="principal" style={{ maxWidth: 820 }}>
      <Link className="volver" href="/solicitudes">
        ← Solicitudes
      </Link>
      <div className="titulo-pagina">
        <div>
          <h1>Nueva solicitud</h1>
          <p>Registra la necesidad que ha comunicado una contraparte. Se crea el proyecto, su carpeta en Drive y el enlace al formulario.</p>
        </div>
      </div>
      <FormNueva
        contrapartes={contrapartes.map((c) => ({ id: c.id, nombre: c.nombre, pais: nombrePais(c.pais), correo: c.correos[0] ?? '', idioma: c.idioma }))}
        paises={listaPaises('es')}
        correoAutomatico={correoDisponible()}
      />
    </main>
  );
}
