'use client';

import { useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { nuevaSolicitud } from '@/lib/acciones/solicitudes';
import { IDIOMAS_ES, SECTORES } from '@/lib/formulario/textos';
import type { Idioma } from '@/lib/tipos';

interface OpcionContraparte {
  id: string;
  nombre: string;
  pais: string;
  correo: string;
  idioma: Idioma;
}

export function FormNueva({
  contrapartes,
  paises,
  correoAutomatico,
}: {
  contrapartes: OpcionContraparte[];
  paises: { codigo: string; nombre: string }[];
  correoAutomatico: boolean;
}) {
  const [cp, setCp] = useState(contrapartes.length ? '' : 'nueva');
  const elegida = contrapartes.find((c) => c.id === cp);
  const tieneCorreo = cp === 'nueva' || !!elegida?.correo;

  return (
    <FormAccion accion={nuevaSolicitud} className="pila" >
      <section className="card pila" style={{ gap: 14 }}>
        <h2 className="h3" style={{ margin: 0 }}>
          Contraparte
        </h2>
        <label className="field">
          ¿Quién pide el proyecto?
          <select name="contraparte" value={cp} onChange={(e) => setCp(e.target.value)} required>
            <option value="" disabled>
              Elige una contraparte…
            </option>
            {contrapartes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.pais})
              </option>
            ))}
            <option value="nueva">＋ Contraparte nueva</option>
          </select>
        </label>
        {elegida ? (
          <p className="meta" style={{ margin: 0 }}>
            {elegida.correo || 'Sin correo'} · escribe en {IDIOMAS_ES[elegida.idioma].toLowerCase()}
          </p>
        ) : null}

        {cp === 'nueva' ? (
          <div className="campos">
            <label className="field ancho">
              Nombre de la organización
              <input name="cp_nombre" required placeholder="Por ejemplo: Congregación de las Hermanas de…" />
            </label>
            <label className="field">
              Tipo
              <input name="cp_tipo" placeholder="Congregación, diócesis, asociación…" />
            </label>
            <label className="field">
              País
              <select name="cp_pais" required defaultValue="">
                <option value="" disabled>
                  Elige…
                </option>
                {paises.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Persona de contacto
              <input name="cp_contacto" placeholder="Hna. …" />
            </label>
            <label className="field">
              Correo
              <input name="cp_correo" type="email" placeholder="contacto@…" />
            </label>
            <label className="field">
              Idioma en que escribe
              <select name="cp_idioma" defaultValue="fr" required>
                {(Object.keys(IDIOMAS_ES) as Idioma[]).map((i) => (
                  <option key={i} value={i}>
                    {IDIOMAS_ES[i]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      <section className="card pila" style={{ gap: 14 }}>
        <h2 className="h3" style={{ margin: 0 }}>
          Proyecto
        </h2>
        <p className="meta" style={{ margin: 0 }}>
          Puedes dejarlo en blanco: lo rellenará la contraparte en el formulario.
        </p>
        <div className="campos">
          <label className="field">
            <span>Título provisional <span className="ayuda">opcional</span></span>
            <input name="titulo" placeholder="Por ejemplo: Aula escuela primaria" />
          </label>
          <label className="field">
            <span>Sector <span className="ayuda">opcional</span></span>
            <select name="sector" defaultValue="">
              <option value="">Sin decidir</option>
              {Object.entries(SECTORES).map(([clave, n]) => (
                <option key={clave} value={clave}>
                  {n.es}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {correoAutomatico && tieneCorreo ? (
        <label className="check">
          <input type="checkbox" name="enviar" defaultChecked />
          Enviar ya el formulario por correo a la contraparte, en su idioma
        </label>
      ) : (
        <p className="meta" style={{ margin: 0 }}>
          Al crearla verás el enlace al formulario y un correo listo para copiar y enviar.
        </p>
      )}
      <div className="botones">
        <Enviar pendiente="Creando carpeta y enlace…">Crear solicitud</Enviar>
      </div>
    </FormAccion>
  );
}
