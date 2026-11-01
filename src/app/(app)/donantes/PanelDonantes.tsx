'use client';

// Donantes: filtros, analíticas y tabla, calculados en el navegador con los donantes y
// todas las aportaciones (en euros).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { dinero } from '@/lib/formato';
import { Desplegable } from '@/componentes/Desplegable';
import { Barras, Cifras, Columnas, formatear } from '@/componentes/Graficos';
import type { Aportacion, Donante, TipoDonante } from '@/lib/tipos';

type D = Donante & { id: string };
type A = Aportacion & { id: string };

// Como en la ficha del proyecto: más claro lo comprometido, más oscuro lo cobrado.
const COLOR = { porCobrar: '#f4b49a', cobrado: '#e54611' };
const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

export function PanelDonantes({ donantes, aportaciones, tipos }: { donantes: D[]; aportaciones: A[]; tipos: Record<TipoDonante, string> }) {
  const [buscar, setBuscar] = useState('');
  const [tiposSel, setTipos] = useState<string[]>([]);
  const [anios, setAnios] = useState<string[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);

  const anioDe = (a: A) => a.creado.slice(0, 4);
  // Las aportaciones que cumplen el filtro de año.
  const aps = useMemo(() => aportaciones.filter((a) => !anios.length || anios.includes(anioDe(a))), [aportaciones, anios]);
  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return donantes.filter((d) => {
      if (tiposSel.length && !tiposSel.includes(d.tipo)) return false;
      if (elegidos.length && !elegidos.includes(d.id)) return false;
      if (anios.length && !aps.some((a) => a.donanteId === d.id)) return false;
      if (q && ![d.nombre, d.contactoNombre, tipos[d.tipo]].some((t) => (t ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [donantes, tiposSel, elegidos, anios, aps, buscar, tipos]);
  const ids = new Set(visibles.map((d) => d.id));
  const susAps = aps.filter((a) => ids.has(a.donanteId));

  const suma = (lista: A[], campo: 'importe' | 'recibido') => lista.reduce((s, a) => s + (a[campo] ?? 0), 0);
  const de = (id: string) => {
    const l = susAps.filter((a) => a.donanteId === id);
    return { proyectos: new Set(l.map((a) => a.proyecto)).size, comprometido: suma(l, 'importe'), recibido: suma(l, 'recibido') };
  };
  const comprometido = suma(susAps, 'importe');
  const recibido = suma(susAps, 'recibido');
  const porTipo = new Map<string, number>();
  for (const d of visibles) porTipo.set(d.tipo, (porTipo.get(d.tipo) ?? 0) + de(d.id).comprometido);
  const listaAnios = [...new Set(aportaciones.map(anioDe))].sort();

  return (
    <>
      <form className="filtros" aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
        <label className="field" style={{ flex: '3 1 220px' }}>
          Buscar
          <input type="search" placeholder="Nombre o persona de contacto" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          Tipo
          <Desplegable multiple value={tiposSel} onChange={setTipos} placeholder="Todos" opciones={Object.entries(tipos).map(([valor, texto]) => ({ valor, texto }))} />
        </label>
        <label className="field" style={{ flex: '1 1 110px' }}>
          Año
          <Desplegable multiple value={anios} onChange={setAnios} placeholder="Todos" opciones={[...listaAnios].reverse().map((a) => ({ valor: a, texto: a }))} />
        </label>
        <button
          type="button"
          className="btn btn-s"
          style={{ flex: '0 0 auto' }}
          onClick={() => {
            setBuscar('');
            setTipos([]);
            setAnios([]);
            setElegidos([]);
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
                <th scope="col">Donante</th>
                <th scope="col">Tipo</th>
                <th scope="col">Proyectos</th>
                <th scope="col" className="der">
                  Comprometido
                </th>
                <th scope="col" className="der">
                  Cobrado
                </th>
                <th scope="col" className="der">
                  Por cobrar
                </th>
                <th scope="col">Informes que pide</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((d) => {
                const r = de(d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link className="fuerte" href={`/donantes/${d.id}`}>
                        {d.nombre}
                      </Link>
                      {d.contactoNombre ? <span className="sub">{d.contactoNombre}</span> : null}
                    </td>
                    <td>{tipos[d.tipo]}</td>
                    <td>{r.proyectos || '—'}</td>
                    <td className="der">{r.comprometido ? dinero(r.comprometido) : '—'}</td>
                    <td className="der">{r.recibido ? dinero(r.recibido) : '—'}</td>
                    <td className="der">{r.comprometido > r.recibido ? dinero(r.comprometido - r.recibido) : '—'}</td>
                    <td className="meta">{d.informes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibles.length ? <p className="vacio">No hay donantes con estos filtros.</p> : null}
        </div>
        <p className="pie-tabla">
          Mostrando {visibles.length} de {donantes.length} donantes. Importes en euros; «cobrado» es lo que ya ha llegado a AD.
        </p>
      </section>

      <section className="analiticas" aria-labelledby="analiticas-titulo">
        <div>
          <h2 id="analiticas-titulo" className="grp">
            Analíticas
          </h2>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            Con los donantes y aportaciones filtrados. Importes en euros. Pulsa una barra para filtrar.
          </p>
        </div>
        <Cifras
          items={[
            { etiqueta: 'Donantes', valor: formatear(visibles.length) },
            { etiqueta: 'Comprometido', valor: formatear(comprometido, 'euros') },
            { etiqueta: 'Cobrado', valor: formatear(recibido, 'euros'), detalle: comprometido ? `${Math.round((recibido / comprometido) * 100)} % de lo comprometido` : undefined },
            { etiqueta: 'Por cobrar', valor: formatear(Math.max(0, comprometido - recibido), 'euros') },
            { etiqueta: 'Proyectos apoyados', valor: formatear(new Set(susAps.filter((a) => a.importe > 0).map((a) => a.proyecto)).size) },
          ]}
        />
        <div className="analiticas-rejilla">
          <Barras
            titulo="Comprometido por donante"
            formato="euros"
            datos={visibles.map((d) => ({ clave: d.id, etiqueta: d.nombre, valor: de(d.id).comprometido, detalle: `${de(d.id).proyectos} proyectos` }))}
            seleccion={elegidos}
            onElegir={(id) => setElegidos((x) => alternar(x, id))}
            vacio="Aún no hay aportaciones comprometidas."
          />
          <Barras
            titulo="Comprometido por tipo de donante"
            formato="euros"
            datos={[...porTipo].map(([k, v]) => ({ clave: k, etiqueta: tipos[k as TipoDonante] ?? k, valor: v }))}
            seleccion={tiposSel}
            onElegir={(t) => setTipos((x) => alternar(x, t))}
            vacio="Aún no hay aportaciones comprometidas."
          />
          <Barras
            titulo="Comprometido: cobrado y por cobrar"
            formato="euros"
            ordenar={false}
            datos={[
              { clave: 'cobrado', etiqueta: 'Cobrado', valor: recibido, color: COLOR.cobrado, detalle: 'Ya ha llegado a AD' },
              { clave: 'porCobrar', etiqueta: 'Por cobrar', valor: Math.max(0, comprometido - recibido), color: COLOR.porCobrar, detalle: 'Comprometido, aún sin llegar a AD' },
            ]}
          />
        </div>
        <Columnas
          titulo="Comprometido y cobrado por año (según la fecha de la aportación)"
          formato="euros"
          periodos={listaAnios}
          series={[
            { nombre: 'Comprometido', valores: listaAnios.map((y) => suma(susAps.filter((a) => anioDe(a) === y), 'importe')) },
            { nombre: 'Cobrado', valores: listaAnios.map((y) => suma(susAps.filter((a) => anioDe(a) === y), 'recibido')) },
          ]}
        />
      </section>
    </>
  );
}
