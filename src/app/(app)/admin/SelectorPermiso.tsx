'use client';

import { useActionState, useRef } from 'react';
import { cambiarPermisoAccion } from '@/lib/acciones/admin';
import { INICIAL } from '@/lib/acciones/resultado';
import { Desplegable } from '@/componentes/Desplegable';
import type { Permiso } from '@/lib/tipos';

export function SelectorPermiso({ email, nombre, permiso, propio }: { email: string; nombre: string; permiso: Permiso; propio: boolean }) {
  const [res, accion, pendiente] = useActionState(cambiarPermisoAccion, INICIAL);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={accion} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input type="hidden" name="email" value={email} />
      <div style={{ width: 170 }}>
        <Desplegable
          name="permiso"
          className="desplegable-peq"
          aria-label={`Permiso de ${nombre || email}`}
          defaultValue={permiso}
          disabled={pendiente || propio}
          onChange={() => form.current?.requestSubmit()}
          opciones={[
            { valor: 'lectura', texto: 'Lectura' },
            { valor: 'edicion', texto: 'Edición' },
            { valor: 'admin', texto: 'Administración' },
          ]}
        />
      </div>
      {pendiente ? <span className="meta">Guardando…</span> : null}
      {res.vez && !res.ok ? <span className="warn">{res.mensaje}</span> : null}
    </form>
  );
}
