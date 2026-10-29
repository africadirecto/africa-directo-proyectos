'use client';

// Inicio: avisos, filtros, tabla y mapa. Todo se filtra en el navegador a partir
// del índice del panel, sin más lecturas de la base de datos.

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ACTIVOS, EN_MARCHA, ESTADOS } from '@/lib/estados';
import { dinero, diasDesde, fechaCorta, haceDias, porcentaje } from '@/lib/formato';
import { nombrePais, PAISES } from '@/lib/paises';
import { nombreSector } from '@/lib/formulario/textos';
import { DIAS_SIN_NOTICIAS } from '@/lib/dominio/atencion';
import { Estado, Financiado } from '@/componentes/Basicos';
import type { EstadoProyecto, FilaPanel } from '@/lib/tipos';
import type { PuntoMapa } from './Mapa';

const Mapa = dynamic(() => import('./Mapa'), {
  ssr: false,
  loading: () => <div className="mapa" aria-hidden="true" />,
});

const ORDEN: EstadoProyecto[] = ['ejecucion', 'parado', 'aprobado', 'financiacion', 'validada', 'revision', 'solicitud', 'completado', 'cerrado', 'rechazada', 'cancelado'];

function desplazamiento(codigo: string): [number, number] {
  let h = 0;
  for (const c of codigo) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [((h & 0xff) / 255 - 0.5) * 1.2, (((h >> 8) & 0xff) / 255 - 0.5) * 1.2];
}

export function PanelProyectos({
  filas,
  yo,
  sinNoticias,
  porRevisar,
  sinResponder,
}: {
  filas: FilaPanel[];
  yo: string;
  sinNoticias: string[];
  porRevisar: number;
  sinResponder: number;
}) {
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('activos');
  const [pais, setPais] = useState('');
  const [anio, setAnio] = useState('');
  const [mios, setMios] = useState(false);
  const [soloSinNoticias, setSoloSinNoticias] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);

  const paises = useMemo(() => [...new Set(filas.map((f) => f.pais).filter(Boolean))].sort((a, b) => nombrePais(a).localeCompare(nombrePais(b), 'es')), [filas]);
  const anios = useMemo(() => [...new Set(filas.map((f) => f.anio))].sort((a, b) => b - a), [filas]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return filas
      .filter((f) => {
        if (soloSinNoticias && !sinNoticias.includes(f.codigo)) return false;
        if (estado === 'activos' && !ACTIVOS.includes(f.estado)) return false;
        if (estado !== 'activos' && estado !== 'todos' && f.estado !== estado) return false;
        if (pais && f.pais !== pais) return false;
        if (anio && String(f.anio) !== anio) return false;
        if (mios && f.responsableId !== yo) return false;
        if (q && ![f.titulo, f.codigo, f.contraparte, f.lugar, nombrePais(f.pais)].some((t) => t.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado) || b.codigo.localeCompare(a.codigo));
  }, [filas, buscar, estado, pais, anio, mios, soloSinNoticias, sinNoticias, yo]);

  const puntos = useMemo<PuntoMapa[]>(
    () =>
      visibles.flatMap((f): PuntoMapa[] => {
        const titulo = `${f.titulo || f.contraparte} (${ESTADOS[f.estado].nombre})`;
        if (f.lat != null && f.lng != null) return [{ codigo: f.codigo, lat: f.lat, lng: f.lng, color: ESTADOS[f.estado].color, aproximado: false, titulo }];
        const centro = PAISES[f.pais];
        if (!centro) return [];
        const [dy, dx] = desplazamiento(f.codigo);
        return [{ codigo: f.codigo, lat: centro[0] + dy, lng: centro[1] + dx, color: ESTADOS[f.estado].color, aproximado: true, titulo }];
      }),
    [visibles],
  );

  const seleccionar = useCallback((c: string) => setElegido(c), []);
  const fila = visibles.find((f) => f.codigo === elegido) ?? null;
  const limpiar = () => {
    setBuscar('');
    setEstado('activos');
    setPais('');
    setAnio('');
    setMios(false);
    setSoloSinNoticias(false);
  };

  return (
    <>
      {sinNoticias.length || porRevisar || sinResponder ? (
        <section aria-labelledby="atencion-titulo" className="pila" style={{ gap: 10 }}>
          <h2 id="atencion-titulo" className="grp">
            Requiere atención
          </h2>
          <div className="chips">
            {sinNoticias.length ? (
              <button type="button" className="chip" aria-pressed={soloSinNoticias} onClick={() => setSoloSinNoticias((v) => !v)}>
                <span className="dot" style={{ background: '#C0281C' }} />
                <b>{sinNoticias.length}</b> sin noticias en más de {DIAS_SIN_NOTICIAS} días
              </button>
            ) : null}
            {porRevisar ? (
              <Link className="chip" href="/solicitudes">
                <span className="dot" style={{ background: '#1F4E8C' }} />
                <b>{porRevisar}</b> {porRevisar === 1 ? 'solicitud por revisar' : 'solicitudes por revisar'}
              </Link>
            ) : null}
            {sinResponder ? (
              <Link className="chip" href="/solicitudes">
                <span className="dot" style={{ background: '#B26B00' }} />
                <b>{sinResponder}</b> {sinResponder === 1 ? 'formulario sin responder' : 'formularios sin responder'}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <form className="filtros" aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
        <label className="field" style={{ flex: '3 1 260px' }}>
          Buscar
          <input type="search" placeholder="Nombre, código, lugar o contraparte" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="activos">Activos</option>
            <option value="todos">Todos</option>
            {(Object.keys(ESTADOS) as EstadoProyecto[]).map((e) => (
              <option key={e} value={e}>
                {ESTADOS[e].nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          País
          <select value={pais} onChange={(e) => setPais(e.target.value)}>
            <option value="">Todos</option>
            {paises.map((p) => (
              <option key={p} value={p}>
                {nombrePais(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 120px' }}>
          Año
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>
            <option value="">Todos</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="check" style={{ flex: '0 0 auto' }}>
          <input type="checkbox" checked={mios} onChange={(e) => setMios(e.target.checked)} />
          Solo los míos
        </label>
        <button type="button" className="btn btn-s" style={{ flex: '0 0 auto' }} onClick={limpiar}>
          Limpiar
        </button>
      </form>

      <div className="fila">
        <section aria-label="Lista de proyectos" className="tabla-marco" style={{ flex: '999 1 640px', minWidth: 0 }}>
          <div className="desliza">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Proyecto</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="der">
                    Presupuesto
                  </th>
                  <th scope="col">Financiado</th>
                  <th scope="col">Última noticia</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const dias = diasDesde(f.ultimaNoticia);
                  const tarde = EN_MARCHA.includes(f.estado) && dias > DIAS_SIN_NOTICIAS;
                  return (
                    <tr key={f.codigo}>
                      <td>
                        <Link className="fuerte" href={`/proyectos/${f.codigo}`}>
                          {f.titulo || `Solicitud de ${f.contraparte}`}
                        </Link>
                        <span className="sub">
                          {f.codigo}
                          {f.sector ? ` · ${nombreSector(f.sector)}` : ''}
                        </span>
                      </td>
                      <td>
                        {f.lugar || '—'}
                        <span className="sub">{nombrePais(f.pais)}</span>
                      </td>
                      <td>
                        <Estado estado={f.estado} />
                      </td>
                      <td className="der">{f.presupuesto ? dinero(f.presupuesto, f.moneda) : <span className="meta">—</span>}</td>
                      <td>{['solicitud', 'revision'].includes(f.estado) ? <span className="meta">—</span> : <Financiado parte={f.comprometido} total={f.presupuesto} />}</td>
                      <td>
                        <span className={tarde ? 'warn' : undefined}>{fechaCorta(f.ultimaNoticia)}</span>
                        <span className="sub">{['cerrado', 'cancelado', 'rechazada'].includes(f.estado) ? ESTADOS[f.estado].nombre.toLowerCase() : haceDias(f.ultimaNoticia)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibles.length ? <p className="vacio">No hay proyectos con estos filtros.</p> : null}
          </div>
          <p className="pie-tabla">
            Mostrando {visibles.length} de {filas.length} proyectos
          </p>
        </section>

        <aside aria-labelledby="mapa-titulo" className="mapa-marco">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 id="mapa-titulo" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              Mapa
            </h2>
            <span className="meta">Muestra los proyectos filtrados</span>
          </div>
          <Mapa puntos={puntos} seleccionado={elegido} onSeleccionar={seleccionar} />
          {fila ? (
            <div className="mapa-tarjeta">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{fila.titulo || `Solicitud de ${fila.contraparte}`}</span>
                <Estado estado={fila.estado} />
              </div>
              <span className="meta" style={{ fontSize: 14 }}>
                {[fila.lugar, nombrePais(fila.pais)].filter(Boolean).join(', ')}
                {fila.presupuesto ? ` · ${dinero(fila.presupuesto, fila.moneda)} · financiado al ${porcentaje(fila.comprometido, fila.presupuesto)} %` : ''}
                {fila.lat == null ? ' · ubicación aproximada' : ''}
              </span>
              <Link href={`/proyectos/${fila.codigo}`} style={{ fontSize: 14, fontWeight: 600 }}>
                Abrir proyecto →
              </Link>
            </div>
          ) : null}
          <p className="meta" style={{ margin: 0 }}>
            Pulsa un punto para ver el proyecto; el color es su estado. Los puntos con borde discontinuo aún no tienen coordenadas.
          </p>
        </aside>
      </div>
    </>
  );
}
