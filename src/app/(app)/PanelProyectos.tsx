'use client';

// Inicio: avisos, filtros, tabla y mapa. Todo se filtra en el navegador a partir
// del índice del panel, sin más lecturas de la base de datos.

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ACTIVOS, ESTADOS } from '@/lib/estados';
import { dinero, fechaLarga } from '@/lib/formato';
import { nombrePais, PAISES } from '@/lib/paises';
import { nombreSector } from '@/lib/formulario/textos';
import { DIAS_SIN_NOTICIAS } from '@/lib/dominio/atencion';
import { Estado } from '@/componentes/Basicos';
import { Bandera, Desplegable } from '@/componentes/Desplegable';
import type { EstadoProyecto, FilaPanel } from '@/lib/tipos';
import type { PuntoMapa } from './Mapa';

const Mapa = dynamic(() => import('./Mapa'), {
  ssr: false,
  loading: () => <div className="mapa" aria-hidden="true" />,
});

const ORDEN: EstadoProyecto[] = ['ejecucion', 'parado', 'aprobado', 'financiacion', 'validada', 'revision', 'solicitud', 'completado', 'cerrado', 'rechazada', 'cancelado'];

const OPCIONES_ESTADO = ORDEN.map((e) => ({ valor: e, texto: ESTADOS[e].nombre }));
const ATAJOS_ESTADO = [
  { texto: 'Activos', valores: [...ACTIVOS] },
  { texto: 'Todos', valores: [] },
];
const mismos = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const resumenEstado = (sel: string[]) =>
  !sel.length ? 'Todos' : mismos(sel, ACTIVOS) ? 'Activos' : sel.length === 1 ? ESTADOS[sel[0] as EstadoProyecto].nombre : `${sel.length} estados`;

/** Desplazamiento fijo por proyecto para que los que no tienen coordenadas no caigan todos en el centro del país. */
function desplazamiento(codigo: string): [number, number] {
  // FNV-1a con mezcla final: códigos consecutivos (P-2026-001, P-2026-002) quedan bien separados.
  let h = 2166136261;
  for (const c of codigo) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return [((h & 0xff) / 255 - 0.5) * 1.6, (((h >>> 8) & 0xff) / 255 - 0.5) * 1.6];
}

export function PanelProyectos({
  filas,
  sinNoticias,
  porRevisar,
  sinResponder,
}: {
  filas: FilaPanel[];
  sinNoticias: string[];
  porRevisar: number;
  sinResponder: number;
}) {
  const [buscar, setBuscar] = useState('');
  const [estados, setEstados] = useState<string[]>([...ACTIVOS]);
  const [paises, setPaises] = useState<string[]>([]);
  const [contrapartes, setContrapartes] = useState<string[]>([]);
  const [anios, setAnios] = useState<string[]>([]);
  const [soloSinNoticias, setSoloSinNoticias] = useState(false);

  const opcionesPais = useMemo(
    () =>
      [...new Set(filas.map((f) => f.pais).filter(Boolean))]
        .sort((a, b) => nombrePais(a).localeCompare(nombrePais(b), 'es'))
        .map((p) => ({ valor: p, texto: nombrePais(p), icono: <Bandera codigo={p} /> })),
    [filas],
  );
  const opcionesContraparte = useMemo(() => {
    const nombres = new Map(filas.map((f) => [f.contraparteId, f.contraparte]));
    return [...nombres].map(([valor, texto]) => ({ valor, texto })).sort((a, b) => a.texto.localeCompare(b.texto, 'es'));
  }, [filas]);
  const opcionesAnio = useMemo(() => [...new Set(filas.map((f) => f.anio))].sort((a, b) => b - a).map((a) => ({ valor: String(a), texto: String(a) })), [filas]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return filas
      .filter((f) => {
        if (soloSinNoticias && !sinNoticias.includes(f.codigo)) return false;
        // Sin nada elegido en un filtro, no se filtra por él.
        if (estados.length && !estados.includes(f.estado)) return false;
        if (paises.length && !paises.includes(f.pais)) return false;
        if (contrapartes.length && !contrapartes.includes(f.contraparteId)) return false;
        if (anios.length && !anios.includes(String(f.anio))) return false;
        if (q && ![f.titulo, f.codigo, f.contraparte, f.lugar, nombrePais(f.pais)].some((t) => t.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado) || b.codigo.localeCompare(a.codigo));
  }, [filas, buscar, estados, paises, contrapartes, anios, soloSinNoticias, sinNoticias]);

  const puntos = useMemo<PuntoMapa[]>(
    () =>
      visibles.flatMap((f): PuntoMapa[] => {
        const datos = {
          codigo: f.codigo,
          color: ESTADOS[f.estado].color,
          titulo: f.titulo || `Solicitud de ${f.contraparte}`,
          anio: f.anio,
          lugar: [f.lugar, nombrePais(f.pais)].filter(Boolean).join(', '),
        };
        if (f.lat != null && f.lng != null) return [{ ...datos, lat: f.lat, lng: f.lng, aproximado: false }];
        const centro = PAISES[f.pais];
        if (!centro) return [];
        const [dy, dx] = desplazamiento(f.codigo);
        return [{ ...datos, lat: centro[0] + dy, lng: centro[1] + dx, aproximado: true }];
      }),
    [visibles],
  );

  const limpiar = () => {
    setBuscar('');
    setEstados([...ACTIVOS]);
    setPaises([]);
    setContrapartes([]);
    setAnios([]);
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
          <Desplegable multiple value={estados} onChange={setEstados} opciones={OPCIONES_ESTADO} atajos={ATAJOS_ESTADO} resumen={resumenEstado} />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          País
          <Desplegable multiple value={paises} onChange={setPaises} opciones={opcionesPais} placeholder="Todos" textoBuscar="Buscar país…" />
        </label>
        <label className="field" style={{ flex: '1 1 200px' }}>
          Contraparte
          <Desplegable multiple value={contrapartes} onChange={setContrapartes} opciones={opcionesContraparte} placeholder="Todas" textoBuscar="Buscar contraparte…" />
        </label>
        <label className="field" style={{ flex: '1 1 110px' }}>
          Año
          <Desplegable multiple value={anios} onChange={setAnios} opciones={opcionesAnio} placeholder="Todos" />
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
                  <th scope="col">Contraparte</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Inicio</th>
                  <th scope="col" className="der">
                    Presupuesto
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
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
                    <td>{f.contraparte || '—'}</td>
                    <td>
                      {f.lugar || '—'}
                      <span className="sub">{nombrePais(f.pais)}</span>
                    </td>
                    <td>
                      <Estado estado={f.estado} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{f.inicio ? fechaLarga(f.inicio) : <span className="meta">—</span>}</td>
                    <td className="der">{f.presupuesto ? dinero(f.presupuesto, f.moneda) : <span className="meta">—</span>}</td>
                  </tr>
                ))}
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
          <Mapa puntos={puntos} />
          <p className="meta" style={{ margin: 0 }}>
            Pasa el ratón por un punto (o tócalo en el móvil) para ver el proyecto; el color es su estado. Los puntos con borde discontinuo aún no tienen coordenadas.
          </p>
        </aside>
      </div>
    </>
  );
}
