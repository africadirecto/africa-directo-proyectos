'use client';

import { useRef, useState } from 'react';
import { Dialogo } from '@/componentes/Dialogo';
import { FormAccion, Enviar } from '@/componentes/FormAccion';
import { editarProyecto } from '@/lib/acciones/proyectos';
import { SECTORES } from '@/lib/formulario/textos';
import type { Proyecto } from '@/lib/tipos';

const dia = (iso?: string) => (iso ? iso.slice(0, 10) : '');

export function EditarProyecto({
  p,
  paises,
  monedas,
  responsables,
}: {
  p: Proyecto;
  paises: { codigo: string; nombre: string }[];
  monedas: string[];
  responsables: { id: string; nombre: string }[];
}) {
  const form = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState('');

  // Busca las coordenadas del lugar en OpenStreetMap (Nominatim), a petición del usuario.
  const buscar = async () => {
    const campo = (n: string) => form.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${n}"]`);
    const lugar = campo('lugar')?.value.trim();
    const pais = campo('pais') as HTMLSelectElement | undefined;
    if (!lugar) return setAviso('Escribe primero el lugar.');
    setAviso('Buscando…');
    try {
      const q = `${lugar}, ${pais?.selectedOptions[0]?.text ?? ''}`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es&q=${encodeURIComponent(q)}`);
      const [r] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (!r) return setAviso('No se ha encontrado. Puedes escribir las coordenadas a mano.');
      (campo('lat') as HTMLInputElement).value = Number(r.lat).toFixed(5);
      (campo('lng') as HTMLInputElement).value = Number(r.lon).toFixed(5);
      setAviso(`Encontrado: ${r.display_name}`);
    } catch {
      setAviso('No se pudo buscar. Escribe las coordenadas a mano.');
    }
  };

  return (
    <Dialogo boton="Editar datos" titulo="Datos del proyecto">
      <FormAccion accion={editarProyecto} className="pila">
        <div ref={form} className="campos">
          <input type="hidden" name="codigo" value={p.codigo} />
          <label className="field ancho">
            Título
            <input name="titulo" defaultValue={p.titulo} required />
          </label>
          <label className="field">
            Sector
            <select name="sector" defaultValue={p.sector}>
              <option value="">Sin decidir</option>
              {Object.entries(SECTORES).map(([k, n]) => (
                <option key={k} value={k}>
                  {n.es}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Responsable
            <select name="responsable" defaultValue={p.responsable?.id ?? ''}>
              <option value="">Sin asignar</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            País
            <select name="pais" defaultValue={p.pais}>
              {paises.map((x) => (
                <option key={x.codigo} value={x.codigo}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Lugar
            <input name="lugar" defaultValue={p.lugar} />
          </label>
          <label className="field">
            Latitud
            <input name="lat" inputMode="decimal" defaultValue={p.lat ?? ''} placeholder="-4.33" />
          </label>
          <label className="field">
            Longitud
            <input name="lng" inputMode="decimal" defaultValue={p.lng ?? ''} placeholder="15.31" />
          </label>
          <div className="ancho" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button type="button" className="btn btn-s btn-peq" onClick={buscar}>
              Buscar coordenadas del lugar
            </button>
            {aviso ? <span className="meta">{aviso}</span> : null}
          </div>
          <label className="field">
            Presupuesto
            <input name="presupuesto" inputMode="decimal" defaultValue={p.presupuesto ?? ''} />
          </label>
          <label className="field">
            Moneda
            <select name="moneda" defaultValue={p.moneda}>
              {monedas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Inicio de obra
            <input type="date" name="inicio" defaultValue={dia(p.fechas.inicio)} />
          </label>
          <label className="field">
            Fin previsto
            <input type="date" name="finPrevisto" defaultValue={dia(p.fechas.finPrevisto)} />
          </label>
          <label className="field ancho">
            Beneficiarios
            <input name="beneficiarios" defaultValue={p.beneficiarios} />
          </label>
          <label className="field ancho">
            Descripción
            <textarea name="descripcion" defaultValue={p.descripcion} rows={5} />
          </label>
        </div>
        <div className="botones">
          <Enviar pendiente="Guardando…">Guardar</Enviar>
        </div>
      </FormAccion>
    </Dialogo>
  );
}
