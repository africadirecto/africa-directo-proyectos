'use client';

// Fotos y archivos para un informe de proyecto (dentro del diálogo de Generar informe). Las
// listas se piden a Drive solo al abrir cada parte. Si no se abren las fotos, la app elige sola
// las publicables del periodo; los archivos son opcionales y su texto se da a la IA.

import { useState, useTransition } from 'react';
import { materialesParaInformeAccion } from '@/lib/acciones/informes';
import { fechaCorta } from '@/lib/formato';
import type { MaterialInforme } from '@/lib/dominio/archivos';

const MAX_FOTOS = 12;
const MAX_ADJUNTOS = 8;

const CARPETAS: Record<string, string> = { solicitud: 'Solicitud', seguimiento: 'Seguimiento', informes: 'Informes', administracion: 'Administración' };

export function FotosYAdjuntos({ codigo, conFotos, desde, hasta }: { codigo: string; conFotos: boolean; desde: string; hasta: string }) {
  const [materiales, setMateriales] = useState<{ fotos: MaterialInforme[]; archivos: MaterialInforme[]; error?: string } | null>(null);
  const [cargando, cargar] = useTransition();
  const [fotos, setFotos] = useState<string[] | null>(null);
  const [adjuntos, setAdjuntos] = useState<string[]>([]);

  const pedir = () => {
    if (materiales || cargando) return;
    cargar(async () => {
      const m = await materialesParaInformeAccion(codigo);
      setMateriales(m);
      // Marcadas de entrada: las del periodo y, si no llegan, las más recientes (como hará la app).
      const delPeriodo = m.fotos.filter((f) => f.fecha.slice(0, 10) >= desde && f.fecha.slice(0, 10) <= hasta);
      setFotos([...delPeriodo, ...m.fotos.filter((f) => !delPeriodo.includes(f))].slice(0, MAX_FOTOS).map((f) => f.id));
    });
  };
  const alternar = (lista: string[], id: string, max: number) => (lista.includes(id) ? lista.filter((x) => x !== id) : lista.length < max ? [...lista, id] : lista);
  const espera = cargando || !materiales ? <p className="meta">Leyendo la carpeta del proyecto…</p> : materiales.error ? <p className="aviso-error">{materiales.error}</p> : null;

  return (
    <>
      {conFotos ? (
        <details className="desplegable ancho" onToggle={(e) => (e.currentTarget.open ? pedir() : undefined)}>
          <summary className="btn-enlace">
            Fotos{fotos ? ` (${fotos.length} elegidas)` : ': si no eliges, van las publicables del periodo'}
          </summary>
          {espera ?? (
            <div className="pila">
              {/* Al abrir esta parte, mandan las marcadas aquí. */}
              <input type="hidden" name="fotosElegidas" value="1" />
              {materiales!.fotos.length ? (
                <>
                  <p className="meta" style={{ margin: 0 }}>
                    Solo aparecen las fotos marcadas como publicables. La IA decide en qué hueco de la plantilla va cada una y escribe su pie. Como mucho, {MAX_FOTOS}.
                  </p>
                  <div className="fotos">
                    {materiales!.fotos.map((f) => (
                      <label key={f.id} className="foto" style={{ cursor: 'pointer' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.miniatura} alt={f.nombre} loading="lazy" />
                        <span className="check" style={{ minHeight: 0 }}>
                          <input type="checkbox" name="fotos" value={f.id} checked={fotos?.includes(f.id) ?? false} onChange={() => setFotos(alternar(fotos ?? [], f.id, MAX_FOTOS))} />
                          {fechaCorta(f.fecha)}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <p className="meta">Este proyecto no tiene fotos publicables. Márcalas en la pestaña Archivos.</p>
              )}
            </div>
          )}
        </details>
      ) : null}
      <details className="desplegable ancho" onToggle={(e) => (e.currentTarget.open ? pedir() : undefined)}>
        <summary className="btn-enlace">Archivos del proyecto para la IA{adjuntos.length ? ` (${adjuntos.length})` : ' (opcional)'}</summary>
        {espera ?? (
          <div className="pila">
            <p className="meta" style={{ margin: 0 }}>
              La IA leerá el texto de los archivos que marques (sin correos ni teléfonos) para usarlo en el informe: actas, presupuestos, informes de la contraparte… No marques listas de beneficiarios ni documentos con datos personales. Como mucho, {MAX_ADJUNTOS}.
            </p>
            {materiales!.archivos.length ? (
              <div className="pila" style={{ gap: 0 }}>
                {materiales!.archivos.map((a) => (
                  <label key={a.id} className="check">
                    <input type="checkbox" name="adjuntos" value={a.id} checked={adjuntos.includes(a.id)} onChange={() => setAdjuntos(alternar(adjuntos, a.id, MAX_ADJUNTOS))} />
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {a.nombre} <span className="meta">· {CARPETAS[a.carpeta] ?? a.carpeta}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="meta">No hay archivos en las carpetas del proyecto.</p>
            )}
          </div>
        )}
      </details>
    </>
  );
}
