'use client';

// Analíticas de la página de proyectos: se calculan con los proyectos que dejan ver los
// filtros. Pulsar una barra de estado, país o contraparte filtra por ese valor.

import { ESTADOS } from '@/lib/estados';
import { nombrePais } from '@/lib/paises';
import { nombreSector } from '@/lib/formulario/textos';
import { Barras, Cifras, Columnas, formatear } from '@/componentes/Graficos';
import { eurDe } from '@/lib/panel';
import type { EstadoProyecto, FilaPanel } from '@/lib/tipos';


function agrupar(filas: FilaPanel[], clave: (f: FilaPanel) => string, valor: (f: FilaPanel) => number) {
  const m = new Map<string, { valor: number; n: number }>();
  for (const f of filas) {
    const k = clave(f);
    if (!k) continue;
    const a = m.get(k) ?? { valor: 0, n: 0 };
    m.set(k, { valor: a.valor + valor(f), n: a.n + 1 });
  }
  return m;
}

const proyectos = (n: number) => `${n} proyecto${n === 1 ? '' : 's'}`;

export function AnaliticasProyectos({
  filas,
  estados,
  paises,
  contrapartes,
  onEstado,
  onPais,
  onContraparte,
}: {
  filas: FilaPanel[];
  estados: string[];
  paises: string[];
  contrapartes: string[];
  onEstado: (e: string) => void;
  onPais: (p: string) => void;
  onContraparte: (c: string) => void;
}) {
  const presupuesto = filas.reduce((s, f) => s + eurDe(f), 0);
  const comprometido = filas.reduce((s, f) => s + (f.comprometido ?? 0), 0);

  const porEstado = agrupar(filas, (f) => f.estado, () => 1);
  const porPais = agrupar(filas, (f) => f.pais, eurDe);
  const porSector = agrupar(filas, (f) => f.sector, () => 1);
  const nombres = new Map(filas.map((f) => [f.contraparteId, f.contraparte]));
  const porContraparte = agrupar(filas, (f) => f.contraparteId, eurDe);
  const anios = [...new Set(filas.map((f) => f.anio))].sort();

  return (
    <section className="analiticas" aria-labelledby="analiticas-titulo">
      <div>
        <h2 id="analiticas-titulo" className="grp">
          Analíticas
        </h2>
        <p className="meta" style={{ margin: '4px 0 0' }}>
          Con los proyectos filtrados. Importes en euros. Pulsa una barra de estado, país o contraparte para filtrar por ella.
        </p>
      </div>
      <Cifras
        items={[
          { etiqueta: 'Proyectos', valor: formatear(filas.length) },
          { etiqueta: 'Presupuesto', valor: formatear(presupuesto, 'euros') },
          { etiqueta: 'Comprometido', valor: formatear(comprometido, 'euros'), detalle: presupuesto ? `${Math.round((comprometido / presupuesto) * 100)} % del presupuesto` : undefined },
          { etiqueta: 'Países', valor: formatear(new Set(filas.map((f) => f.pais).filter(Boolean)).size) },
          { etiqueta: 'Contrapartes', valor: formatear(new Set(filas.map((f) => f.contraparteId).filter(Boolean)).size) },
        ]}
      />
      <div className="analiticas-rejilla">
        <Barras
          titulo="Proyectos por estado"
          ordenar={false}
          max={12}
          datos={(Object.keys(ESTADOS) as EstadoProyecto[])
            .filter((e) => porEstado.has(e))
            .map((e) => ({ clave: e, etiqueta: ESTADOS[e].nombre, valor: porEstado.get(e)!.n, color: ESTADOS[e].color }))}
          seleccion={estados}
          onElegir={onEstado}
        />
        <Barras
          titulo="Presupuesto por país"
          formato="euros"
          datos={[...porPais].map(([k, v]) => ({ clave: k, etiqueta: nombrePais(k), valor: v.valor, detalle: proyectos(v.n) }))}
          seleccion={paises}
          onElegir={onPais}
          vacio="Ningún proyecto tiene presupuesto todavía."
        />
        <Barras
          titulo="Presupuesto por contraparte"
          formato="euros"
          datos={[...porContraparte].map(([k, v]) => ({ clave: k, etiqueta: nombres.get(k) || k, valor: v.valor, detalle: proyectos(v.n) }))}
          seleccion={contrapartes}
          onElegir={onContraparte}
          vacio="Ningún proyecto tiene presupuesto todavía."
        />
        <Barras titulo="Proyectos por sector" datos={[...porSector].map(([k, v]) => ({ clave: k, etiqueta: nombreSector(k), valor: v.n }))} />
      </div>
      <Columnas
        titulo="Presupuesto y financiación comprometida por año"
        formato="euros"
        periodos={anios.map(String)}
        series={[
          { nombre: 'Presupuesto', valores: anios.map((a) => filas.filter((f) => f.anio === a).reduce((s, f) => s + eurDe(f), 0)) },
          { nombre: 'Comprometido', valores: anios.map((a) => filas.filter((f) => f.anio === a).reduce((s, f) => s + (f.comprometido ?? 0), 0)) },
        ]}
      />
    </section>
  );
}
