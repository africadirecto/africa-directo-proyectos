'use client';

import { useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Bandera, Desplegable } from '@/componentes/Desplegable';
import { opcionesPaises } from '@/componentes/opciones';
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

const IDIOMAS = (Object.keys(IDIOMAS_ES) as Idioma[]).map((i) => ({ valor: i, texto: IDIOMAS_ES[i] }));
const SECTORES_OPC = [{ valor: '', texto: 'Sin decidir' }, ...Object.entries(SECTORES).map(([valor, n]) => ({ valor, texto: n.es }))];

export function FormNueva({ contrapartes }: { contrapartes: OpcionContraparte[] }) {
  const [cp, setCp] = useState(contrapartes.length ? '' : 'nueva');
  const elegida = contrapartes.find((c) => c.id === cp);

  return (
    <FormAccion accion={nuevaSolicitud} className="pila" >
      <section className="card pila" style={{ gap: 14 }}>
        <h2 className="h3" style={{ margin: 0 }}>
          Contraparte
        </h2>
        <label className="field">
          ¿Quién pide el proyecto?
          <Desplegable
            name="contraparte"
            required
            value={cp}
            onChange={setCp}
            placeholder="Elige una contraparte…"
            opciones={[
              ...contrapartes.map((c) => ({ valor: c.id, texto: c.nombre, icono: c.pais ? <Bandera codigo={c.pais} /> : undefined })),
              { valor: 'nueva', texto: '＋ Contraparte nueva' },
            ]}
          />
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
              <Desplegable name="cp_pais" required opciones={opcionesPaises('es')} />
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
              <Desplegable name="cp_idioma" required defaultValue="fr" opciones={IDIOMAS} />
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
            <Desplegable name="sector" defaultValue="" placeholder="Sin decidir" opciones={SECTORES_OPC} />
          </label>
        </div>
      </section>

      <p className="meta" style={{ margin: 0 }}>
        Al crearla verás el enlace al formulario y un correo listo para copiar y enviar.
      </p>
      <div className="botones">
        <Enviar pendiente="Creando carpeta y enlace…">Crear solicitud</Enviar>
      </div>
    </FormAccion>
  );
}
