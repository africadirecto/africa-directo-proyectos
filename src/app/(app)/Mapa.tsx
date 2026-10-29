'use client';

// Mapa de proyectos con Leaflet y teselas de OpenStreetMap (con su atribución,
// como pide su política de uso). Se carga solo en el navegador.

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface PuntoMapa {
  codigo: string;
  lat: number;
  lng: number;
  color: string;
  aproximado: boolean;
  titulo: string;
}

export default function Mapa({
  puntos,
  seleccionado,
  onSeleccionar,
}: {
  puntos: PuntoMapa[];
  seleccionado: string | null;
  onSeleccionar: (codigo: string) => void;
}) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const encuadre = useRef('');

  useEffect(() => {
    if (!div.current || mapa.current) return;
    const m = L.map(div.current, { scrollWheelZoom: false, worldCopyJump: true }).setView([2, 20], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const p of puntos) {
      const elegido = p.codigo === seleccionado;
      if (elegido) {
        L.circleMarker([p.lat, p.lng], { radius: 14, color: p.color, weight: 2, fill: false, interactive: false }).addTo(g);
      }
      L.circleMarker([p.lat, p.lng], {
        radius: elegido ? 9 : 7,
        color: '#FFFFFF',
        weight: 2,
        fillColor: p.color,
        fillOpacity: p.aproximado ? 0.55 : 1,
        dashArray: p.aproximado ? '3 3' : undefined,
      })
        .bindTooltip(p.titulo)
        .on('click', () => onSeleccionar(p.codigo))
        .addTo(g);
    }
    // Encuadra solo cuando cambia el conjunto de proyectos, no al seleccionar uno.
    const clave = puntos.map((p) => p.codigo).join();
    if (clave !== encuadre.current && puntos.length) {
      encuadre.current = clave;
      m.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 6 });
    }
  }, [puntos, seleccionado, onSeleccionar]);

  return <div ref={div} className="mapa" role="region" aria-label="Mapa de proyectos" />;
}
