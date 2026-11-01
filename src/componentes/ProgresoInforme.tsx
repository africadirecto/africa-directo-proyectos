'use client';

// Cómo va un informe que se hace en segundo plano. Pregunta a /api/informes/estado cada pocos
// segundos (menos a menudo pasado el primer minuto) y, al terminar, refresca la página para que
// aparezca en la lista. Se puede cerrar: el informe sigue haciéndose.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormAccion, Enviar } from './FormAccion';
import { reintentarInformeAccion } from '@/lib/acciones/informes';
import type { EstadoInforme } from '@/lib/tipos';

export interface EstadoVisible {
  estado: EstadoInforme;
  progreso: { campos: number; hechos: number } | null;
  modo: 'lote' | 'directo' | null;
  error: string;
  url: string;
  pendientes: number;
}

function texto(e: EstadoVisible): string {
  const p = e.progreso;
  const cuenta = p && p.campos ? ` (${p.hechos} de ${p.campos} apartados)` : '';
  if (e.estado === 'en_cola') return 'Preparando los datos del informe…';
  if (e.estado === 'redactando') {
    return e.modo === 'lote'
      ? `La IA está redactando${cuenta}. Suele tardar unos minutos, pero puede tardar hasta un día: puedes cerrar esta ventana, aparecerá en la lista y se avisará en Google Chat.`
      : `La IA está redactando${cuenta}…`;
  }
  if (e.estado === 'componiendo') return 'Montando el documento a partir de la plantilla…';
  if (e.estado === 'listo') return e.pendientes ? `Listo. Tiene ${e.pendientes} hueco${e.pendientes === 1 ? '' : 's'} resaltado${e.pendientes === 1 ? '' : 's'} en amarillo para completar.` : 'Listo.';
  return e.error || 'No se pudo hacer el informe.';
}

export function ProgresoInforme({ ruta, inicial, editable = true }: { ruta: string; inicial?: EstadoVisible; editable?: boolean }) {
  const [e, setE] = useState<EstadoVisible | null>(inicial ?? null);
  const router = useRouter();

  useEffect(() => {
    let parar = false;
    let vez = 0;
    const inicio = Date.now();
    async function mirar() {
      if (parar) return;
      try {
        const r = await fetch(`/api/informes/estado?r=${encodeURIComponent(ruta)}`, { cache: 'no-store' });
        if (r.ok) {
          const d = (await r.json()) as EstadoVisible;
          if (parar) return;
          setE(d);
          if (d.estado === 'listo' || d.estado === 'error') {
            router.refresh();
            return;
          }
        }
      } catch {
        // Sin conexión: se vuelve a intentar.
      }
      vez += 1;
      if (Date.now() - inicio > 20 * 60_000) return;
      setTimeout(mirar, vez < 15 ? 4000 : 10_000);
    }
    if (!inicial || (inicial.estado !== 'listo' && inicial.estado !== 'error')) void mirar();
    return () => {
      parar = true;
    };
  }, [ruta, inicial, router]);

  if (!e) return <p className="meta" role="status" style={{ margin: 0 }}>Preparando…</p>;
  const clase = e.estado === 'error' ? 'aviso-error' : e.estado === 'listo' ? 'aviso-ok' : 'nota';
  return (
    <div role="status" className={clase} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span>{texto(e)}</span>
      {e.estado === 'listo' && e.url ? (
        <a className="btn btn-s btn-peq" href={e.url} target="_blank" rel="noreferrer">
          Abrir
        </a>
      ) : null}
      {e.estado === 'error' && editable ? (
        <FormAccion accion={reintentarInformeAccion} ocultarOk>
          <input type="hidden" name="ruta" value={ruta} />
          <Enviar clase="btn btn-s btn-peq" pendiente="…">
            Reintentar
          </Enviar>
        </FormAccion>
      ) : null}
    </div>
  );
}
