// Si la plantilla es para un proyecto o para varios: decide en qué página se ofrece al generar.
// Sin importar lib/dominio (es de servidor): también lo usa NuevaDesdeEjemplo, en el navegador.

import type { TipoInforme } from '@/lib/tipos';

export const TIPOS: Record<TipoInforme, { nombre: string; ayuda: string }> = {
  proyecto: { nombre: 'Un proyecto', ayuda: 'Se ofrecen en la ficha de cada proyecto, con «Generar informe».' },
  resumen: { nombre: 'Varios proyectos', ayuda: 'Se ofrecen en Proyectos, con «Generar resumen».' },
};

export function ElegirTipo({ valor = 'proyecto' }: { valor?: TipoInforme }) {
  return (
    <fieldset className="formatos ancho">
      <legend>Para</legend>
      {(Object.keys(TIPOS) as TipoInforme[]).map((t) => (
        <label key={t} className="formato">
          <input type="radio" name="tipo" value={t} defaultChecked={valor === t} className="oculto" />
          <span>
            <b>{TIPOS[t].nombre}</b>
            <span className="meta">{TIPOS[t].ayuda}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
