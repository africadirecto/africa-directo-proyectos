'use client';

// Mapa de proyectos con Leaflet y teselas de OpenStreetMap (con su atribución,
// como pide su política de uso). Se carga solo en el navegador.
// Al pasar el ratón por un punto (o al tocarlo, en el móvil) sale una tarjeta con el
// título, el año, el lugar y un botón para abrir el proyecto.

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';

export interface PuntoMapa {
  codigo: string;
  lat: number;
  lng: number;
  color: string;
  aproximado: boolean;
  titulo: string;
  anio: number;
  lugar: string;
}

/** Tarjeta de la ventana emergente, construida con nodos (sin HTML con datos sin escapar). */
function tarjeta(p: PuntoMapa, abrir: (codigo: string) => void): HTMLElement {
  const div = L.DomUtil.create('div', 'mapa-tarjeta');
  L.DomUtil.create('strong', 'mapa-tarjeta-titulo', div).textContent = p.titulo;
  L.DomUtil.create('span', 'mapa-tarjeta-meta', div).textContent = [String(p.anio), p.lugar + (p.aproximado ? ' (aproximada)' : '')]
    .filter(Boolean)
    .join(' · ');
  const a = L.DomUtil.create('a', 'btn btn-p btn-peq', div);
  a.href = `/proyectos/${p.codigo}`;
  a.textContent = 'Abrir proyecto';
  a.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    abrir(p.codigo);
  });
  return div;
}

export default function Mapa({ puntos }: { puntos: PuntoMapa[] }) {
  const router = useRouter();
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
    const abrir = (codigo: string) => router.push(`/proyectos/${codigo}`);
    for (const p of puntos) {
      const punto = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: '#FFFFFF',
        weight: 2,
        fillColor: p.color,
        fillOpacity: p.aproximado ? 0.55 : 1,
        dashArray: p.aproximado ? '3 3' : undefined,
      })
        .bindPopup(tarjeta(p, abrir), { closeButton: false, className: 'mapa-popup', offset: [0, -6], autoPanPadding: [20, 20] })
        .addTo(g);

      // La tarjeta sigue abierta mientras el ratón esté en el punto o en la propia tarjeta.
      let espera: ReturnType<typeof setTimeout> | undefined;
      const mantener = () => clearTimeout(espera);
      const cerrarLuego = () => {
        espera = setTimeout(() => punto.closePopup(), 300);
      };
      punto.on('mouseover', () => {
        mantener();
        if (!punto.isPopupOpen()) punto.openPopup();
      });
      punto.on('mouseout', cerrarLuego);
      punto.on('popupopen', (e) => {
        const el = (e as L.PopupEvent).popup.getElement();
        el?.addEventListener('mouseenter', mantener);
        el?.addEventListener('mouseleave', cerrarLuego);
      });
    }
    // Encuadra solo cuando cambia el conjunto de proyectos.
    const clave = puntos.map((p) => p.codigo).join();
    if (clave !== encuadre.current && puntos.length) {
      encuadre.current = clave;
      m.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 6 });
    }
  }, [puntos, router]);

  return <div ref={div} className="mapa" role="region" aria-label="Mapa de proyectos" />;
}
