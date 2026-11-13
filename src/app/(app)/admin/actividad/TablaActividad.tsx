'use client';

// Tabla de la actividad de toda la app. El periodo se pide al servidor; lo demás (buscar,
// proyecto, etiqueta, usuario y el orden) se hace en el navegador con lo ya leído.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Desplegable } from '@/componentes/Desplegable';
import { Globo } from '@/componentes/Globo';
import { IconoQuitarFiltros } from '@/componentes/Iconos';
import { ThOrden, useOrden } from '@/componentes/Ordenar';
import { alElegir, marcadas, pasa, resumenDe, type Eleccion } from '@/componentes/filtros';
import { fechaLarga } from '@/lib/formato';
import { ETIQUETAS, etiquetaDe } from '../../proyectos/[codigo]/Eventos';
import type { Actividad } from '@/lib/dominio/actividad';

const SIN_PROYECTO = '-';
const AUTOMATICO = 'Automático';
const PASO = 200;

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
/** Lo que no es de ningún proyecto (accesos de usuarios) lleva su propia etiqueta. */
const etiqueta = (f: Actividad) => (f.proyecto ? ETIQUETAS[etiquetaDe(f)] : 'Usuarios');
const claseEtiqueta = (f: Actividad) => (f.proyecto ? `ev-${etiquetaDe(f)}` : 'ev-sistema');
const usuario = (f: Actividad) => f.autor?.nombre || AUTOMATICO;

const COLUMNAS = {
  fecha: (f: Actividad) => f.fecha,
  proyecto: (f: Actividad) => f.proyecto?.codigo,
  etiqueta,
  usuario,
};

export function TablaActividad({ filas, dias, periodos }: { filas: Actividad[]; dias: number; periodos: number[] }) {
  const router = useRouter();
  const [buscar, setBuscar] = useState('');
  const [proyectos, setProyectos] = useState<Eleccion>(null);
  const [etiquetas, setEtiquetas] = useState<Eleccion>(null);
  const [usuarios, setUsuarios] = useState<Eleccion>(null);
  const [cuantas, setCuantas] = useState(PASO);

  // Las opciones de cada filtro: solo lo que aparece en el periodo.
  const { opProyectos, opEtiquetas, opUsuarios } = useMemo(() => {
    const p = new Map<string, string>();
    for (const f of filas) p.set(f.proyecto?.codigo ?? SIN_PROYECTO, f.proyecto ? `${f.proyecto.codigo} · ${f.proyecto.titulo}` : 'Sin proyecto');
    const distintos = (de: (f: Actividad) => string) => [...new Set(filas.map(de))].sort((a, b) => a.localeCompare(b, 'es')).map((v) => ({ valor: v, texto: v }));
    return {
      opProyectos: [...p].map(([valor, texto]) => ({ valor, texto })).sort((a, b) => b.valor.localeCompare(a.valor)),
      opEtiquetas: distintos(etiqueta),
      opUsuarios: distintos(usuario),
    };
  }, [filas]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return filas.filter(
      (f) =>
        pasa(proyectos, f.proyecto?.codigo ?? SIN_PROYECTO) &&
        pasa(etiquetas, etiqueta(f)) &&
        pasa(usuarios, usuario(f)) &&
        (!q || [f.texto, f.proyecto?.codigo, f.proyecto?.titulo, usuario(f)].some((t) => t?.toLowerCase().includes(q))),
    );
  }, [filas, buscar, proyectos, etiquetas, usuarios]);

  const { ordenadas, orden, alternar } = useOrden<Actividad, keyof typeof COLUMNAS>(visibles, COLUMNAS, { columna: 'fecha', dir: 'desc' });
  const th = { orden, alternar };

  const limpiar = () => {
    setBuscar('');
    setProyectos(null);
    setEtiquetas(null);
    setUsuarios(null);
  };

  return (
    <>
      <form className="filtros" aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
        <label className="field" style={{ flex: '3 1 220px' }}>
          Buscar
          <input type="search" placeholder="Texto, proyecto o usuario" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '1 1 150px' }}>
          Periodo
          <Desplegable
            value={String(dias)}
            onChange={(v) => router.push(`/admin/actividad?dias=${v}`)}
            opciones={periodos.map((d) => ({ valor: String(d), texto: d === 365 ? 'Último año' : `Últimos ${d} días` }))}
          />
        </label>
        <label className="field" style={{ flex: '2 1 200px' }}>
          Proyecto
          <Desplegable
            multiple
            value={marcadas(proyectos, opProyectos)}
            onChange={alElegir(setProyectos, opProyectos)}
            opciones={opProyectos}
            resumen={resumenDe('Todos', 'Ninguno', opProyectos)}
            textoBuscar="Buscar proyecto…"
          />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          Etiqueta
          <Desplegable multiple value={marcadas(etiquetas, opEtiquetas)} onChange={alElegir(setEtiquetas, opEtiquetas)} opciones={opEtiquetas} resumen={resumenDe('Todas', 'Ninguna', opEtiquetas)} />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          Usuario
          <Desplegable multiple value={marcadas(usuarios, opUsuarios)} onChange={alElegir(setUsuarios, opUsuarios)} opciones={opUsuarios} resumen={resumenDe('Todos', 'Ninguno', opUsuarios)} />
        </label>
        <Globo texto="Quitar filtros" clase="btn btn-s btn-solo-icono" etiqueta="Quitar filtros" alPulsar={limpiar}>
          <IconoQuitarFiltros tamano={20} />
        </Globo>
      </form>

      <section aria-label="Actividad" className="tabla-marco">
        <div className="desliza">
          <table className="tbl">
            <thead>
              <tr>
                <ThOrden columna="fecha" {...th}>
                  Fecha y hora
                </ThOrden>
                <ThOrden columna="proyecto" {...th}>
                  Proyecto
                </ThOrden>
                <ThOrden columna="etiqueta" {...th}>
                  Etiqueta
                </ThOrden>
                <ThOrden columna="usuario" {...th}>
                  Usuario
                </ThOrden>
                <th scope="col">Qué pasó</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.slice(0, cuantas).map((f) => (
                <tr key={f.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {fechaLarga(f.fecha)}
                    <span className="sub">{hora(f.fecha)}</span>
                  </td>
                  <td style={{ minWidth: 160 }}>
                    {!f.proyecto ? (
                      <span className="meta">—</span>
                    ) : f.proyecto.eliminado ? (
                      <>
                        {f.proyecto.codigo}
                        <span className="sub">{f.proyecto.titulo} (eliminado)</span>
                      </>
                    ) : (
                      <>
                        <Link className="fuerte" href={`/proyectos/${f.proyecto.codigo}`}>
                          {f.proyecto.codigo}
                        </Link>
                        <span className="sub">{f.proyecto.titulo}</span>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`st ${claseEtiqueta(f)}`}>{etiqueta(f)}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{f.autor?.nombre || <span className="meta">{AUTOMATICO}</span>}</td>
                  <td style={{ minWidth: 260, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {f.texto}
                    {f.enlaces?.map((l, i) => (
                      <span key={i}>
                        {' · '}
                        <a href={l.url} target="_blank" rel="noreferrer">
                          {l.texto} ↗
                        </a>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibles.length ? <p className="vacio">No hay actividad con estos filtros.</p> : null}
        </div>
        <p className="pie-tabla">
          Mostrando {Math.min(cuantas, visibles.length)} de {visibles.length} {visibles.length === 1 ? 'evento' : 'eventos'}
          {visibles.length > cuantas ? (
            <>
              {' · '}
              <button type="button" className="btn-enlace" onClick={() => setCuantas((n) => n + PASO)}>
                Ver más
              </button>
            </>
          ) : null}
        </p>
      </section>
    </>
  );
}
