'use client';

// Gráficas sencillas para las analíticas, sin librerías: cifras destacadas, barras
// horizontales (por categoría) y columnas (por año). Cada barra lleva su etiqueta y su
// valor a la vista; al pasar el ratón o con el teclado sale un detalle, y si la gráfica
// filtra, al pulsar una barra se filtra la página por ese valor.
//
// Colores: una sola serie va en el color de la marca; los estados usan su color propio.
// Con dos series se usan los dos primeros colores de la paleta categórica validada
// (azul y naranja) y siempre hay leyenda.

import { useState } from 'react';

export type Formato = 'numero' | 'euros';

const SERIE = ['#2a78d6', '#eb6834'];

export function formatear(v: number, f: Formato = 'numero'): string {
  if (f === 'euros') {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
    return `${Math.round(v).toLocaleString('es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions)} €`;
  }
  return Math.round(v).toLocaleString('es-ES');
}

export function Cifras({ items }: { items: { etiqueta: string; valor: string; detalle?: string }[] }) {
  return (
    <div className="cifras">
      {items.map((c) => (
        <div key={c.etiqueta} className="cifra-tile">
          <p className="cifra-etiqueta">{c.etiqueta}</p>
          <p className="cifra-valor">{c.valor}</p>
          {c.detalle ? <p className="cifra-detalle">{c.detalle}</p> : null}
        </div>
      ))}
    </div>
  );
}

export interface Dato {
  clave: string;
  etiqueta: string;
  valor: number;
  /** Color propio (por ejemplo, el de un estado). Si no, el de la marca. */
  color?: string;
  /** Texto extra para el detalle (por ejemplo, «3 proyectos»). */
  detalle?: string;
}

/** Barras horizontales ordenadas de mayor a menor. Más de `max` categorías se juntan en «Otros». */
export function Barras({
  titulo,
  datos,
  formato = 'numero',
  max = 8,
  ordenar = true,
  seleccion = [],
  onElegir,
  vacio = 'Sin datos con estos filtros.',
}: {
  titulo: string;
  datos: Dato[];
  formato?: Formato;
  max?: number;
  ordenar?: boolean;
  seleccion?: string[];
  onElegir?: (clave: string) => void;
  vacio?: string;
}) {
  const [encima, setEncima] = useState<string | null>(null);
  const lista = (ordenar ? [...datos].sort((a, b) => b.valor - a.valor) : datos).filter((d) => d.valor > 0);
  const visibles = lista.length > max ? [...lista.slice(0, max - 1), { clave: '__otros', etiqueta: `Otros (${lista.length - max + 1})`, valor: lista.slice(max - 1).reduce((s, d) => s + d.valor, 0), color: '#a3a29b' }] : lista;
  const tope = Math.max(1, ...visibles.map((d) => d.valor));
  const hayFiltro = seleccion.length > 0;

  return (
    <figure className="grafico">
      <figcaption className="grafico-titulo">{titulo}</figcaption>
      {visibles.length ? (
        <ul className="barras">
          {visibles.map((d) => {
            const elegible = !!onElegir && d.clave !== '__otros';
            const activo = seleccion.includes(d.clave);
            const contenido = (
              <>
                <span className="barra-etiqueta" title={d.etiqueta}>
                  {d.etiqueta}
                </span>
                <span className="barra-pista">
                  <span className="barra-relleno" style={{ width: `${Math.max(1.5, (d.valor / tope) * 100)}%`, background: d.color ?? 'var(--boton)' }} />
                </span>
                <span className="barra-valor">{formatear(d.valor, formato)}</span>
                {encima === d.clave ? (
                  <span className="grafico-tip" role="tooltip">
                    <b>{d.etiqueta}</b>
                    <span>
                      {formatear(d.valor, formato)}
                      {d.detalle ? ` · ${d.detalle}` : ''}
                    </span>
                    {elegible ? <span className="meta">{activo ? 'Pulsa para quitar el filtro' : 'Pulsa para filtrar'}</span> : null}
                  </span>
                ) : null}
              </>
            );
            const comun = {
              className: 'barra',
              'data-apagada': hayFiltro && !activo ? '' : undefined,
              onPointerEnter: () => setEncima(d.clave),
              onPointerLeave: () => setEncima(null),
            };
            return (
              <li key={d.clave}>
                {elegible ? (
                  <button
                    type="button"
                    {...comun}
                    aria-pressed={activo}
                    aria-label={`${d.etiqueta}: ${formatear(d.valor, formato)}`}
                    onFocus={() => setEncima(d.clave)}
                    onBlur={() => setEncima(null)}
                    onClick={() => onElegir!(d.clave)}
                  >
                    {contenido}
                  </button>
                ) : (
                  <div {...comun} tabIndex={0} onFocus={() => setEncima(d.clave)} onBlur={() => setEncima(null)}>
                    {contenido}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="meta" style={{ margin: '8px 0 0' }}>
          {vacio}
        </p>
      )}
    </figure>
  );
}

/** Columnas por periodo (normalmente por año), con una o dos series en la misma escala. */
export function Columnas({
  titulo,
  periodos,
  series,
  formato = 'numero',
  vacio = 'Sin datos con estos filtros.',
}: {
  titulo: string;
  periodos: string[];
  series: { nombre: string; valores: number[] }[];
  formato?: Formato;
  vacio?: string;
}) {
  const [encima, setEncima] = useState<number | null>(null);
  const tope = Math.max(0, ...series.flatMap((s) => s.valores));
  const escala = tope > 0 ? niceMax(tope) : 1;
  const marcas = [0, escala / 2, escala];

  return (
    <figure className="grafico">
      <figcaption className="grafico-titulo">{titulo}</figcaption>
      {series.length > 1 ? (
        <div className="leyenda">
          {series.map((s, i) => (
            <span key={s.nombre}>
              <span className="leyenda-punto" style={{ background: SERIE[i] }} />
              {s.nombre}
            </span>
          ))}
        </div>
      ) : null}
      {tope > 0 ? (
        <div className="columnas">
          <div className="columnas-eje" aria-hidden="true">
            {[...marcas].reverse().map((m) => (
              <span key={m}>{formatear(m, formato)}</span>
            ))}
          </div>
          <div className="columnas-area">
            {marcas.map((m) => (
              // El área deja 22 px abajo para los años: la guía se coloca dentro de lo que queda.
              <span key={m} className="columnas-guia" style={{ bottom: `calc(${(m / escala) * 100}% + ${22 * (1 - m / escala)}px)` }} />
            ))}
            {periodos.map((p, i) => (
              <div
                key={p}
                className="columna-grupo"
                tabIndex={0}
                aria-label={`${p}: ${series.map((s) => `${s.nombre} ${formatear(s.valores[i], formato)}`).join(', ')}`}
                onPointerEnter={() => setEncima(i)}
                onPointerLeave={() => setEncima(null)}
                onFocus={() => setEncima(i)}
                onBlur={() => setEncima(null)}
                data-encima={encima === i ? '' : undefined}
              >
                <div className="columna-barras">
                  {series.map((s, j) => (
                    <span key={s.nombre} className="columna" style={{ height: `${(s.valores[i] / escala) * 100}%`, background: series.length > 1 ? SERIE[j] : 'var(--boton)' }} />
                  ))}
                </div>
                <span className="columna-etiqueta">{p}</span>
                {encima === i ? (
                  <span className="grafico-tip" role="tooltip">
                    <b>{p}</b>
                    {series.map((s, j) => (
                      <span key={s.nombre}>
                        {series.length > 1 ? <span className="leyenda-punto" style={{ background: SERIE[j] }} /> : null}
                        {series.length > 1 ? `${s.nombre}: ` : ''}
                        {formatear(s.valores[i], formato)}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="meta" style={{ margin: '8px 0 0' }}>
          {vacio}
        </p>
      )}
    </figure>
  );
}

/** Un máximo «redondo» para el eje (1, 2 o 5 por una potencia de 10). */
function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
