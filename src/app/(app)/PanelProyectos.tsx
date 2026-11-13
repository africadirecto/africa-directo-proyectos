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
import { Globo } from '@/componentes/Globo';
import { IconoQuitarFiltros } from '@/componentes/Iconos';
import { ThOrden, useOrden } from '@/componentes/Ordenar';
import { alElegir, marcadas, pasa, resumenDe, type Eleccion } from '@/componentes/filtros';
import type { EstadoProyecto, FilaPanel } from '@/lib/tipos';
import type { PuntoMapa } from './Mapa';
import { AnaliticasProyectos } from './AnaliticasProyectos';
import { eurDe } from '@/lib/panel';

const Mapa = dynamic(() => import('./Mapa'), {
  ssr: false,
  loading: () => <div className="mapa" aria-hidden="true" />,
});

const ORDEN: EstadoProyecto[] = ['ejecucion', 'parado', 'aprobado', 'financiacion', 'revision', 'solicitud', 'completado', 'cerrado', 'rechazada', 'cancelado'];

// Cada estado, con el color de su etiqueta.
const OPCIONES_ESTADO = ORDEN.map((e) => ({ valor: e, texto: ESTADOS[e].nombre, icono: <span className="dot" style={{ background: ESTADOS[e].color }} /> }));
const ATAJOS_ESTADO = [{ texto: 'Activos', valores: [...ACTIVOS] }];
const mismos = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const resumenEstado = (sel: string[]) =>
  !sel.length
    ? 'Ninguno'
    : sel.length === ORDEN.length
      ? 'Todos'
      : mismos(sel, ACTIVOS)
        ? 'Activos'
        : sel.length === 1
          ? ESTADOS[sel[0] as EstadoProyecto].nombre
          : `${sel.length} estados`;

/** Al pulsar una barra de las analíticas: se filtra por ese valor, se suma a los elegidos o se quita (sin ninguno, vuelven todos). */
function alternarEn(x: Eleccion, valor: string): Eleccion {
  if (!x) return [valor];
  const sin = x.filter((y) => y !== valor);
  return sin.length === x.length ? [...x, valor] : sin.length ? sin : null;
}

/** Por qué se ordena al pulsar la cabecera de cada columna. */
const COLUMNAS = {
  proyecto: (f: FilaPanel) => f.titulo || `Solicitud de ${f.contraparte}`,
  contraparte: (f: FilaPanel) => f.contraparte,
  ubicacion: (f: FilaPanel) => `${nombrePais(f.pais)} ${f.lugar}`,
  estado: (f: FilaPanel) => ORDEN.indexOf(f.estado),
  inicio: (f: FilaPanel) => f.inicio,
  presupuesto: (f: FilaPanel) => eurDe(f) || null,
};

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
  const [paises, setPaises] = useState<Eleccion>(null);
  const [contrapartes, setContrapartes] = useState<Eleccion>(null);
  const [anios, setAnios] = useState<Eleccion>(null);
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
        if (!estados.includes(f.estado)) return false;
        if (!pasa(paises, f.pais) || !pasa(contrapartes, f.contraparteId) || !pasa(anios, String(f.anio))) return false;
        if (q && ![f.titulo, f.codigo, f.contraparte, f.lugar, nombrePais(f.pais)].some((t) => t.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado) || b.codigo.localeCompare(a.codigo));
  }, [filas, buscar, estados, paises, contrapartes, anios, soloSinNoticias, sinNoticias]);

  // Pulsando una cabecera se ordena por esa columna; sin ninguna, por estado y código.
  const { ordenadas, orden, alternar } = useOrden(visibles, COLUMNAS);
  const th = { orden, alternar };

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
    setPaises(null);
    setContrapartes(null);
    setAnios(null);
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
          <Desplegable
            multiple
            value={marcadas(paises, opcionesPais)}
            onChange={alElegir(setPaises, opcionesPais)}
            opciones={opcionesPais}
            resumen={resumenDe('Todos', 'Ninguno', opcionesPais)}
            textoBuscar="Buscar país…"
          />
        </label>
        <label className="field" style={{ flex: '1 1 200px' }}>
          Contraparte
          <Desplegable
            multiple
            value={marcadas(contrapartes, opcionesContraparte)}
            onChange={alElegir(setContrapartes, opcionesContraparte)}
            opciones={opcionesContraparte}
            resumen={resumenDe('Todas', 'Ninguna', opcionesContraparte)}
            textoBuscar="Buscar contraparte…"
          />
        </label>
        <label className="field" style={{ flex: '1 1 110px' }}>
          Año
          <Desplegable
            multiple
            value={marcadas(anios, opcionesAnio)}
            onChange={alElegir(setAnios, opcionesAnio)}
            opciones={opcionesAnio}
            resumen={resumenDe('Todos', 'Ninguno', opcionesAnio)}
          />
        </label>
        <Globo texto="Quitar filtros" clase="btn btn-s btn-solo-icono" etiqueta="Quitar filtros" alPulsar={limpiar}>
          <IconoQuitarFiltros tamano={20} />
        </Globo>
      </form>

      <div className="fila">
        <section aria-label="Lista de proyectos" className="tabla-marco" style={{ flex: '999 1 640px', minWidth: 0 }}>
          <div className="desliza">
            <table className="tbl">
              <thead>
                <tr>
                  <ThOrden columna="proyecto" {...th}>
                    Proyecto
                  </ThOrden>
                  <ThOrden columna="contraparte" {...th}>
                    Contraparte
                  </ThOrden>
                  <ThOrden columna="ubicacion" {...th}>
                    Ubicación
                  </ThOrden>
                  <ThOrden columna="estado" {...th}>
                    Estado
                  </ThOrden>
                  <ThOrden columna="inicio" {...th}>
                    Inicio
                  </ThOrden>
                  <ThOrden columna="presupuesto" className="der" {...th}>
                    Presupuesto
                  </ThOrden>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f) => (
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
                    <td className="der">
                      {eurDe(f) ? dinero(eurDe(f)) : <span className="meta">—</span>}
                      {f.presupuesto && f.moneda !== 'EUR' ? <span className="sub">{dinero(f.presupuesto, f.moneda)}</span> : null}
                    </td>
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

      <AnaliticasProyectos
        filas={visibles}
        estados={mismos(estados, ACTIVOS) ? [] : estados}
        paises={paises ?? []}
        contrapartes={contrapartes ?? []}
        onEstado={(e) => setEstados((x) => (x.length === 1 && x[0] === e ? [...ACTIVOS] : [e]))}
        onPais={(p) => setPaises((x) => alternarEn(x, p))}
        onContraparte={(c) => setContrapartes((x) => alternarEn(x, c))}
      />
    </>
  );
}
