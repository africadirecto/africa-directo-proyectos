'use client';

// «Compromiso»: un donante dice que pone un importe. Si ya estaba en el proyecto, se suma.

import { useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { compromisoAccion } from '@/lib/acciones/financiacion';

export function FormCompromiso({
  codigo,
  donantes,
  tipos,
  enProyecto,
  hoy,
}: {
  codigo: string;
  donantes: { id: string; nombre: string }[];
  tipos: Record<string, string>;
  /** Donantes que ya tienen compromiso en este proyecto: el importe se les suma. */
  enProyecto: string[];
  hoy: string;
}) {
  const [donante, setDonante] = useState('');

  return (
    <FormAccion accion={compromisoAccion} className="pila" limpiar>
      <input type="hidden" name="codigo" value={codigo} />
      <label className="field">
        ¿Quién se compromete?
        <Desplegable
          name="donante"
          required
          buscar
          textoBuscar="Buscar donante…"
          value={donante}
          onChange={setDonante}
          opciones={[...donantes.map((d) => ({ valor: d.id, texto: d.nombre })), { valor: 'nuevo', texto: '＋ Donante nuevo' }]}
        />
      </label>
      {donante === 'nuevo' ? (
        <div className="campos">
          <label className="field">
            Nombre del donante
            <input name="donante_nombre" required />
          </label>
          <label className="field">
            Tipo
            <Desplegable name="donante_tipo" defaultValue="fundacion" opciones={Object.entries(tipos).map(([valor, texto]) => ({ valor, texto }))} />
          </label>
        </div>
      ) : null}
      <div className="campos">
        <label className="field">
          Importe (€)
          <input name="importe" inputMode="decimal" required placeholder="12000" />
          {enProyecto.includes(donante) ? <span className="pista">Se suma a lo que ya tenía comprometido.</span> : null}
        </label>
        <label className="field">
          Fecha
          <input name="fecha" type="date" required defaultValue={hoy} max={hoy} />
        </label>
      </div>
      <label className="field">
        <span>
          Nota <span className="ayuda">opcional</span>
        </span>
        <input name="nota" maxLength={200} placeholder="Convocatoria 2026" />
      </label>
      <div className="botones">
        <Enviar pendiente="Guardando…">Guardar</Enviar>
      </div>
    </FormAccion>
  );
}
