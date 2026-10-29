// Piezas pequeñas de la interfaz (sin estado, valen en servidor y navegador).

import { ESTADOS } from '@/lib/estados';
import { porcentaje } from '@/lib/formato';
import type { EstadoProyecto } from '@/lib/tipos';

export function Estado({ estado }: { estado: EstadoProyecto }) {
  const e = ESTADOS[estado];
  return <span className={`st ${e.clase}`}>{e.nombre}</span>;
}

export function Etiqueta({ clase, children }: { clase: string; children: React.ReactNode }) {
  return <span className={`st ${clase}`}>{children}</span>;
}

export function Barra({ parte, total, grande = false }: { parte: number; total: number | null; grande?: boolean }) {
  const pct = porcentaje(parte, total);
  return (
    <div className={grande ? 'bar bar-grande' : 'bar'} role="img" aria-label={`Financiado al ${pct} %`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Financiado({ parte, total }: { parte: number; total: number | null }) {
  if (!total) return <span className="meta">—</span>;
  return (
    <div className="con-barra">
      <Barra parte={parte} total={total} />
      {porcentaje(parte, total)} %
    </div>
  );
}
