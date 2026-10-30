'use client';

// Cambia el estado de una aportación en cuanto se elige otro en la lista.

import { useActionState, useRef } from 'react';
import { cambiarAportacion } from '@/lib/acciones/financiacion';
import { ESTADOS_APORTACION } from '@/lib/estados';
import { INICIAL } from '@/lib/acciones/resultado';
import { Desplegable } from '@/componentes/Desplegable';
import type { EstadoAportacion } from '@/lib/tipos';

export function SelectorAportacion({ id, codigo, estado }: { id: string; codigo: string; estado: EstadoAportacion }) {
  const [res, accion, pendiente] = useActionState(cambiarAportacion, INICIAL);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={accion} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="codigo" value={codigo} />
      <div style={{ width: 150 }}>
        <Desplegable
          name="estado"
          className="desplegable-peq"
          aria-label="Estado de la aportación"
          defaultValue={estado}
          disabled={pendiente}
          onChange={() => form.current?.requestSubmit()}
          opciones={(Object.keys(ESTADOS_APORTACION) as EstadoAportacion[]).map((e) => ({ valor: e, texto: ESTADOS_APORTACION[e].nombre }))}
        />
      </div>
      {pendiente ? <span className="meta">Guardando…</span> : null}
      {res.vez && !res.ok ? <span className="warn">{res.mensaje}</span> : null}
    </form>
  );
}
