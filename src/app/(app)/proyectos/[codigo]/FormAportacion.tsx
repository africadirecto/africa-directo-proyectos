'use client';

import { useState } from 'react';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { anadirAportacion } from '@/lib/acciones/financiacion';
import { ESTADOS_APORTACION } from '@/lib/estados';

export function FormAportacion({
  codigo,
  monedaProyecto,
  monedas,
  donantes,
  tipos,
}: {
  codigo: string;
  monedaProyecto: string;
  monedas: string[];
  donantes: { id: string; nombre: string }[];
  tipos: Record<string, string>;
}) {
  const [donante, setDonante] = useState('');
  const [moneda, setMoneda] = useState(monedaProyecto);

  return (
    <FormAccion accion={anadirAportacion} className="pila" limpiar>
      <input type="hidden" name="codigo" value={codigo} />
      <label className="field">
        Donante
        <select name="donante" value={donante} onChange={(e) => setDonante(e.target.value)} required>
          <option value="" disabled>
            Elige…
          </option>
          {donantes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
          <option value="nuevo">＋ Donante nuevo</option>
        </select>
      </label>
      {donante === 'nuevo' ? (
        <div className="campos">
          <label className="field">
            Nombre del donante
            <input name="donante_nombre" required />
          </label>
          <label className="field">
            Tipo
            <select name="donante_tipo" defaultValue="fundacion">
              {Object.entries(tipos).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className="campos">
        <label className="field">
          Importe
          <input name="importe" inputMode="decimal" required placeholder="12000" />
        </label>
        <label className="field">
          Moneda
          <select name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            {monedas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {moneda !== monedaProyecto ? (
          <label className="field ancho">
            Equivalente en {monedaProyecto} (la moneda del proyecto)
            <input name="importe_proyecto" inputMode="decimal" required />
          </label>
        ) : null}
        <label className="field">
          Estado
          <select name="estado" defaultValue="ofrecida">
            {Object.entries(ESTADOS_APORTACION).map(([k, v]) => (
              <option key={k} value={k}>
                {v.nombre}
              </option>
            ))}
          </select>
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
