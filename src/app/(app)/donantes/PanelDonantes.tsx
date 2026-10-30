'use client';

// Donantes: filtros, analíticas y tabla, calculados en el navegador con los donantes y
// todas las aportaciones (en euros).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ESTADOS_APORTACION } from '@/lib/estados';
import { dinero } from '@/lib/formato';
import { Desplegable } from '@/componentes/Desplegable';
import { Barras, Cifras, Columnas, formatear } from '@/componentes/Graficos';
import type { Aportacion, Donante, EstadoAportacion, TipoDonante } from '@/lib/tipos';

type D = Donante & { id: string };
type A = Aportacion & { id: string };

const CUENTAN: EstadoAportacion[] = ['comprometida', 'recibida'];
const EN_CURSO: EstadoAportacion[] = ['ofrecida', 'interesado'];
const ORDEN_EMBUDO: EstadoAportacion[] = ['ofrecida', 'interesado', 'comprometida', 'recibida', 'descartada'];
// Colores del embudo: paleta categórica validada, en orden fijo (descartada en gris).
const COLOR_EMBUDO: Record<EstadoAportacion, string> = { ofrecida: '#2a78d6', interesado: '#eb6834', comprometida: '#1baf7a', recibida: '#008300', descartada: '#a3a29b' };
const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

export function PanelDonantes({ donantes, aportaciones, tipos }: { donantes: D[]; aportaciones: A[]; tipos: Record<TipoDonante, string> }) {
  const [buscar, setBuscar] = useState('');
  const [tiposSel, setTipos] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [anios, setAnios] = useState<string[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);

  const anioDe = (a: A) => a.creado.slice(0, 4);
  // Las aportaciones que cumplen los filtros de estado y año.
  const aps = useMemo(
    () => aportaciones.filter((a) => (!estados.length || estados.includes(a.estado)) && (!anios.length || anios.includes(anioDe(a)))),
    [aportaciones, estados, anios],
  );
  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return donantes.filter((d) => {
      if (tiposSel.length && !tiposSel.includes(d.tipo)) return false;
      if (elegidos.length && !elegidos.includes(d.id)) return false;
      if ((estados.length || anios.length) && !aps.some((a) => a.donanteId === d.id)) return false;
      if (q && ![d.nombre, d.contactoNombre, tipos[d.tipo]].some((t) => (t ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [donantes, tiposSel, elegidos, estados, anios, aps, buscar, tipos]);
  const ids = new Set(visibles.map((d) => d.id));
  const susAps = aps.filter((a) => ids.has(a.donanteId));

  const suma = (lista: A[], estadosOk: EstadoAportacion[]) => lista.filter((a) => estadosOk.includes(a.estado)).reduce((s, a) => s + a.importe, 0);
  const de = (id: string) => {
    const l = susAps.filter((a) => a.donanteId === id);
    return { proyectos: new Set(l.map((a) => a.proyecto)).size, comprometido: suma(l, CUENTAN), recibido: suma(l, ['recibida']), enCurso: suma(l, EN_CURSO) };
  };
  const comprometido = suma(susAps, CUENTAN);
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
        <label className="field" style={{ flex: '1 1 170px' }}>
          Estado de la aportación
          <Desplegable
            multiple
            value={estados}
            onChange={setEstados}
            placeholder="Todos"
            opciones={ORDEN_EMBUDO.map((e) => ({ valor: e, texto: ESTADOS_APORTACION[e].nombre }))}
          />
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
            setEstados([]);
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
                  Recibido
                </th>
                <th scope="col" className="der">
                  En conversación
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
                    <td className="der">{r.enCurso ? dinero(r.enCurso) : '—'}</td>
                    <td className="meta">{d.informes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibles.length ? <p className="vacio">No hay donantes con estos filtros.</p> : null}
        </div>
        <p className="pie-tabla">
          Mostrando {visibles.length} de {donantes.length} donantes. Importes en euros; «comprometido» incluye lo ya recibido.
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
            { etiqueta: 'Recibido', valor: formatear(suma(susAps, ['recibida']), 'euros'), detalle: comprometido ? `${Math.round((suma(susAps, ['recibida']) / comprometido) * 100)} % de lo comprometido` : undefined },
            { etiqueta: 'En conversación', valor: formatear(suma(susAps, EN_CURSO), 'euros') },
            { etiqueta: 'Proyectos apoyados', valor: formatear(new Set(susAps.filter((a) => CUENTAN.includes(a.estado)).map((a) => a.proyecto)).size) },
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
            titulo="Aportaciones por estado (embudo)"
            formato="euros"
            ordenar={false}
            datos={ORDEN_EMBUDO.map((e) => {
              const l = susAps.filter((a) => a.estado === e);
              return { clave: e, etiqueta: ESTADOS_APORTACION[e].nombre, valor: l.reduce((s, a) => s + a.importe, 0), color: COLOR_EMBUDO[e], detalle: `${l.length} aportaciones` };
            })}
            seleccion={estados}
            onElegir={(e) => setEstados((x) => alternar(x, e))}
          />
        </div>
        <Columnas
          titulo="Comprometido y recibido por año (según la fecha de la aportación)"
          formato="euros"
          periodos={listaAnios}
          series={[
            { nombre: 'Comprometido', valores: listaAnios.map((y) => suma(susAps.filter((a) => anioDe(a) === y), CUENTAN)) },
            { nombre: 'Recibido', valores: listaAnios.map((y) => suma(susAps.filter((a) => anioDe(a) === y), ['recibida'])) },
          ]}
        />
      </section>
    </>
  );
}
