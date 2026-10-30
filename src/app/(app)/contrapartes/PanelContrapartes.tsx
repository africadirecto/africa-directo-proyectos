'use client';

// Contrapartes: filtros, analíticas y tabla. Todo se calcula en el navegador con la lista
// de contrapartes y el índice de proyectos (sin más lecturas de la base de datos).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ACTIVOS } from '@/lib/estados';
import { nombrePais } from '@/lib/paises';
import { IDIOMAS_ES } from '@/lib/formulario/textos';
import { dinero } from '@/lib/formato';
import { Bandera, Desplegable } from '@/componentes/Desplegable';
import { Dialogo } from '@/componentes/Dialogo';
import { Barras, Cifras, formatear } from '@/componentes/Graficos';
import { eurDe } from '@/lib/panel';
import { FormContraparte } from './FormContraparte';
import type { Contraparte, FilaPanel, Idioma } from '@/lib/tipos';

type C = Contraparte & { id: string };
const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

export function PanelContrapartes({ contrapartes, filas, admin }: { contrapartes: C[]; filas: FilaPanel[]; admin: boolean }) {
  const [buscar, setBuscar] = useState('');
  const [paises, setPaises] = useState<string[]>([]);
  const [idiomas, setIdiomas] = useState<string[]>([]);
  const [conActivos, setConActivos] = useState<string[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);

  const resumen = useMemo(() => {
    const m = new Map<string, { proyectos: number; activos: number; presupuesto: number; comprometido: number; ultimo: number }>();
    for (const f of filas) {
      const r = m.get(f.contraparteId) ?? { proyectos: 0, activos: 0, presupuesto: 0, comprometido: 0, ultimo: 0 };
      r.proyectos += 1;
      if (ACTIVOS.includes(f.estado)) r.activos += 1;
      r.presupuesto += eurDe(f);
      r.comprometido += f.comprometido ?? 0;
      r.ultimo = Math.max(r.ultimo, f.anio);
      m.set(f.contraparteId, r);
    }
    return m;
  }, [filas]);
  const de = (id: string) => resumen.get(id) ?? { proyectos: 0, activos: 0, presupuesto: 0, comprometido: 0, ultimo: 0 };

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return contrapartes.filter((c) => {
      if (paises.length && !paises.includes(c.pais)) return false;
      if (idiomas.length && !idiomas.includes(c.idioma)) return false;
      if (conActivos.length && !conActivos.includes(de(c.id).activos ? 'si' : 'no')) return false;
      if (elegidas.length && !elegidas.includes(c.id)) return false;
      if (q && ![c.nombre, c.tipo, c.contactoNombre, nombrePais(c.pais)].some((t) => (t ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrapartes, buscar, paises, idiomas, conActivos, elegidas, resumen]);

  const contar = (clave: (c: C) => string) => {
    const m = new Map<string, number>();
    for (const c of visibles) m.set(clave(c), (m.get(clave(c)) ?? 0) + 1);
    return m;
  };
  const porPais = contar((c) => c.pais);
  const porIdioma = contar((c) => c.idioma);
  const presupuesto = visibles.reduce((s, c) => s + de(c.id).presupuesto, 0);
  const opcionesPais = [...new Set(contrapartes.map((c) => c.pais))]
    .sort((a, b) => nombrePais(a).localeCompare(nombrePais(b), 'es'))
    .map((p) => ({ valor: p, texto: nombrePais(p), icono: <Bandera codigo={p} /> }));
  const contrapartes1 = (n: number) => `${n} contraparte${n === 1 ? '' : 's'}`;

  return (
    <>
      <form className="filtros" aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
        <label className="field" style={{ flex: '3 1 240px' }}>
          Buscar
          <input type="search" placeholder="Nombre, tipo, contacto o país" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          País
          <Desplegable multiple value={paises} onChange={setPaises} opciones={opcionesPais} placeholder="Todos" textoBuscar="Buscar país…" />
        </label>
        <label className="field" style={{ flex: '1 1 140px' }}>
          Idioma
          <Desplegable
            multiple
            value={idiomas}
            onChange={setIdiomas}
            placeholder="Todos"
            opciones={(Object.keys(IDIOMAS_ES) as Idioma[]).map((i) => ({ valor: i, texto: IDIOMAS_ES[i] }))}
          />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          Proyectos activos
          <Desplegable
            multiple
            value={conActivos}
            onChange={setConActivos}
            placeholder="Todas"
            opciones={[
              { valor: 'si', texto: 'Con proyectos activos' },
              { valor: 'no', texto: 'Sin proyectos activos' },
            ]}
          />
        </label>
        <button
          type="button"
          className="btn btn-s"
          style={{ flex: '0 0 auto' }}
          onClick={() => {
            setBuscar('');
            setPaises([]);
            setIdiomas([]);
            setConActivos([]);
            setElegidas([]);
          }}
        >
          Limpiar
        </button>
      </form>

      <section className="tabla-marco">
        <div className="desliza">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Contraparte</th>
                <th scope="col">País</th>
                <th scope="col">Idioma</th>
                <th scope="col">Proyectos</th>
                <th scope="col" className="der">
                  Presupuesto
                </th>
                {admin ? (
                  <th scope="col">
                    <span className="oculto">Acciones</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => {
                const r = de(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="fuerte" href={`/contrapartes/${c.id}`}>
                        {c.nombre}
                      </Link>
                      <span className="sub">{[c.tipo, c.contactoNombre].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Bandera codigo={c.pais} /> {nombrePais(c.pais)}
                      </span>
                    </td>
                    <td>{IDIOMAS_ES[c.idioma]}</td>
                    <td>
                      {r.proyectos || '—'}
                      {r.proyectos ? <span className="sub">{r.activos ? `${r.activos} activo${r.activos === 1 ? '' : 's'}` : 'ninguno activo'}</span> : null}
                    </td>
                    <td className="der">{r.presupuesto ? dinero(r.presupuesto) : <span className="meta">—</span>}</td>
                    {admin ? (
                      <td className="der">
                        <Dialogo boton="Editar" claseBoton="btn btn-s btn-peq" titulo={c.nombre}>
                          <FormContraparte c={c} />
                        </Dialogo>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibles.length ? <p className="vacio">No hay contrapartes con estos filtros.</p> : null}
        </div>
        <p className="pie-tabla">
          Mostrando {visibles.length} de {contrapartes.length} contrapartes
        </p>
      </section>

      <section className="analiticas" aria-labelledby="analiticas-titulo">
        <div>
          <h2 id="analiticas-titulo" className="grp">
            Analíticas
          </h2>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            Con las contrapartes filtradas. Importes en euros, de sus proyectos. Pulsa una barra para filtrar.
          </p>
        </div>
        <Cifras
          items={[
            { etiqueta: 'Contrapartes', valor: formatear(visibles.length) },
            { etiqueta: 'Con proyectos activos', valor: formatear(visibles.filter((c) => de(c.id).activos).length) },
            { etiqueta: 'Proyectos', valor: formatear(visibles.reduce((s, c) => s + de(c.id).proyectos, 0)) },
            { etiqueta: 'Presupuesto de sus proyectos', valor: formatear(presupuesto, 'euros') },
            { etiqueta: 'Países', valor: formatear(porPais.size) },
          ]}
        />
        <div className="analiticas-rejilla">
          <Barras
            titulo="Presupuesto de sus proyectos"
            formato="euros"
            datos={visibles.map((c) => ({ clave: c.id, etiqueta: c.nombre, valor: de(c.id).presupuesto, detalle: `${de(c.id).proyectos} proyectos` }))}
            seleccion={elegidas}
            onElegir={(id) => setElegidas((x) => alternar(x, id))}
            vacio="Sus proyectos aún no tienen presupuesto."
          />
          <Barras
            titulo="Proyectos por contraparte"
            datos={visibles.map((c) => ({ clave: c.id, etiqueta: c.nombre, valor: de(c.id).proyectos, detalle: `${de(c.id).activos} activos` }))}
            seleccion={elegidas}
            onElegir={(id) => setElegidas((x) => alternar(x, id))}
          />
          <Barras
            titulo="Contrapartes por país"
            datos={[...porPais].map(([k, n]) => ({ clave: k, etiqueta: nombrePais(k), valor: n, detalle: contrapartes1(n) }))}
            seleccion={paises}
            onElegir={(p) => setPaises((x) => alternar(x, p))}
          />
          <Barras
            titulo="Contrapartes por idioma"
            datos={[...porIdioma].map(([k, n]) => ({ clave: k, etiqueta: IDIOMAS_ES[k as Idioma] ?? k, valor: n, detalle: contrapartes1(n) }))}
            seleccion={idiomas}
            onElegir={(i) => setIdiomas((x) => alternar(x, i))}
          />
        </div>
      </section>
    </>
  );
}
