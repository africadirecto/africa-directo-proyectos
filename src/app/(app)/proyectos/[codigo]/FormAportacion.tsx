'use client';

import { useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { Desplegable } from '@/componentes/Desplegable';
import { anadirAportacion } from '@/lib/acciones/financiacion';
import { ESTADOS_APORTACION } from '@/lib/estados';

export function FormAportacion({
  codigo,
  donantes,
  tipos,
}: {
  codigo: string;
  donantes: { id: string; nombre: string }[];
  tipos: Record<string, string>;
}) {
  const [donante, setDonante] = useState('');

  return (
    <FormAccion accion={anadirAportacion} className="pila" limpiar>
      <input type="hidden" name="codigo" value={codigo} />
      <label className="field">
        Donante
        <Desplegable
          name="donante"
          required
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
        </label>
        <label className="field">
          Estado
          <Desplegable name="estado" defaultValue="ofrecida" opciones={Object.entries(ESTADOS_APORTACION).map(([valor, v]) => ({ valor, texto: v.nombre }))} />
        </label>
      </div>
      <label className="field">
        <span>Notas <span className="ayuda">opcional</span></span>
        <input name="notas" placeholder="Por ejemplo: pide informe intermedio el 15 de noviembre" />
      </label>
      <p className="meta" style={{ margin: 0 }}>
        Ofrecida: se le ha presentado el proyecto · Interesado: lo está estudiando · Comprometida: ha dicho que sí · Recibida: ya ha pagado.
      </p>
      <div className="botones">
        <Enviar pendiente="Guardando…">Añadir</Enviar>
      </div>
    </FormAccion>
  );
}
