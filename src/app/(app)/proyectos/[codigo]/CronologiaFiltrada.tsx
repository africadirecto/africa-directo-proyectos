'use client';

// Seguimiento con filtros por etiqueta y por fechas. Se filtra en el navegador, con los eventos
// que ya ha leído la página.

import { useMemo, useState } from 'react';
import { Desplegable } from '@/componentes/Desplegable';
import { diaEnEspana } from '@/lib/formato';
import { ETIQUETAS, ListaEventos, etiquetaDe } from './Eventos';
import type { Evento } from '@/lib/tipos';

export function CronologiaFiltrada({ eventos, limite }: { eventos: Evento[]; limite: number }) {
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // Solo las etiquetas que aparecen en este proyecto.
  const opciones = useMemo(() => {
    const hay = new Set(eventos.map(etiquetaDe));
    return Object.entries(ETIQUETAS)
      .filter(([clave]) => hay.has(clave))
      .map(([valor, texto]) => ({ valor, texto }));
  }, [eventos]);

  const filtrando = etiquetas.length > 0 || !!desde || !!hasta;
  const visibles = eventos.filter((e) => {
    if (etiquetas.length && !etiquetas.includes(etiquetaDe(e))) return false;
    const dia = diaEnEspana(e.fecha);
    return (!desde || dia >= desde) && (!hasta || dia <= hasta);
  });

  if (!eventos.length) return <ListaEventos eventos={eventos} />;
  return (
    <>
      <form className="filtros-ev" aria-label="Filtrar el seguimiento" onSubmit={(e) => e.preventDefault()}>
        <label className="field" style={{ flex: '2 1 200px' }}>
          Etiqueta
          <Desplegable multiple value={etiquetas} onChange={setEtiquetas} opciones={opciones} placeholder="Todas" />
        </label>
        <label className="field" style={{ flex: '1 1 140px' }}>
          Desde
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="field" style={{ flex: '1 1 140px' }}>
          Hasta
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {filtrando ? (
          <button
            type="button"
            className="btn btn-s"
            style={{ flex: '0 0 auto' }}
            onClick={() => {
              setEtiquetas([]);
              setDesde('');
              setHasta('');
            }}
          >
            Limpiar
          </button>
        ) : null}
      </form>
      {filtrando ? (
        <p className="meta" style={{ margin: '4px 0 0' }}>
          {visibles.length} de {eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}.
        </p>
      ) : null}
      <ListaEventos eventos={visibles} vacio="No hay actividad con estos filtros." />
      {eventos.length >= limite ? (
        <p className="meta" style={{ margin: '8px 0 0' }}>
          Se muestran los {limite} eventos más recientes.
        </p>
      ) : null}
    </>
  );
}
