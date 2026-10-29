import type { Metadata } from 'next';
import { requiere } from '@/lib/sesion';
import { listarContrapartes, type ContraparteConId } from '@/lib/dominio/contrapartes';
import { leerIndice } from '@/lib/dominio/indice';
import { listaPaises, nombrePais } from '@/lib/paises';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { guardarContraparteAccion } from '@/lib/acciones/admin';
import type { Idioma } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Contrapartes' };

function FormContraparte({ c }: { c?: ContraparteConId }) {
  return (
    <FormAccion accion={guardarContraparteAccion} className="pila" limpiar={!c}>
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="campos">
        <label className="field ancho">
          Nombre
          <input name="nombre" required defaultValue={c?.nombre} />
        </label>
        <label className="field">
          Tipo
          <input name="tipo" defaultValue={c?.tipo} placeholder="Congregación, diócesis…" />
        </label>
        <label className="field">
          País
          <select name="pais" required defaultValue={c?.pais ?? ''}>
            <option value="" disabled>
              Elige…
            </option>
            {listaPaises('es').map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Persona de contacto
          <input name="contactoNombre" defaultValue={c?.contactoNombre} />
        </label>
        <label className="field">
          Idioma
          <select name="idioma" defaultValue={c?.idioma ?? 'fr'}>
            {(Object.keys(IDIOMAS_ES) as Idioma[]).map((i) => (
              <option key={i} value={i}>
                {IDIOMAS_ES[i]}
              </option>
            ))}
          </select>
        </label>
        <label className="field ancho">
          <span>Correos <span className="ayuda">separados por comas; el primero es el principal</span></span>
          <input name="correos" defaultValue={c?.correos.join(', ')} />
        </label>
        <label className="field">
          Teléfono o WhatsApp
          <input name="telefono" defaultValue={c?.telefono} />
        </label>
        <label className="field ancho">
          Notas
          <textarea name="notas" defaultValue={c?.notas} rows={3} />
        </label>
      </div>
      <div className="botones">
        <Enviar pendiente="Guardando…">{c ? 'Guardar' : 'Añadir contraparte'}</Enviar>
      </div>
    </FormAccion>
  );
}

export default async function Contrapartes() {
  await requiere('admin');
  const [contrapartes, filas] = await Promise.all([listarContrapartes(), leerIndice()]);

  return (
    <>
      <div className="titulo-pagina">
        <h1>Contrapartes</h1>
        <Dialogo boton="Añadir contraparte" claseBoton="btn btn-p" titulo="Nueva contraparte">
          <FormContraparte />
        </Dialogo>
      </div>
      <section className="tabla-marco">
        <div className="desliza">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Contraparte</th>
                <th scope="col">País</th>
                <th scope="col">Idioma</th>
                <th scope="col">Proyectos</th>
                <th scope="col">
                  <span className="oculto">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contrapartes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                    <span className="sub">{[c.contactoNombre, c.correos[0]].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td>{nombrePais(c.pais)}</td>
                  <td>{IDIOMAS_ES[c.idioma]}</td>
                  <td>{filas.filter((f) => f.contraparteId === c.id).length || '—'}</td>
                  <td className="der">
                    <Dialogo boton="Editar" claseBoton="btn btn-s btn-peq" titulo={c.nombre}>
                      <FormContraparte c={c} />
                    </Dialogo>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!contrapartes.length ? <p className="vacio">Todavía no hay contrapartes.</p> : null}
        </div>
      </section>
    </>
  );
}
