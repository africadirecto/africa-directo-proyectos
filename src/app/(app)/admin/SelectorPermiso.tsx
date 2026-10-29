'use client';

import { useActionState, useRef } from 'react';
import { cambiarPermisoAccion } from '@/lib/acciones/admin';
import { INICIAL } from '@/lib/acciones/resultado';
import type { Permiso } from '@/lib/tipos';

export function SelectorPermiso({ email, nombre, permiso, propio }: { email: string; nombre: string; permiso: Permiso; propio: boolean }) {
  const [res, accion, pendiente] = useActionState(cambiarPermisoAccion, INICIAL);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={accion} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input type="hidden" name="email" value={email} />
      <label>
        <span className="oculto">Permiso de {nombre || email}</span>
        <select name="permiso" defaultValue={permiso} disabled={pendiente || propio} onChange={() => form.current?.requestSubmit()}>
          <option value="lectura">Lectura</option>
          <option value="edicion">Edición</option>
          <option value="admin">Administración</option>
        </select>
      </label>
      {pendiente ? <span className="meta">Guardando…</span> : null}
      {res.vez && !res.ok ? <span className="warn">{res.mensaje}</span> : null}
    </form>
  );
}
