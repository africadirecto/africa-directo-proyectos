'use client';

// Cambia el permiso de un usuario en cuanto se elige otro en la lista.
// La lista es controlada: muestra lo elegido mientras se guarda y, si el servidor lo
// rechaza (por ejemplo, porque no quedaría ningún administrador), vuelve al permiso guardado.

import { startTransition, useActionState, useEffect, useState } from 'react';
import { cambiarPermisoAccion } from '@/lib/acciones/admin';
import { INICIAL } from '@/lib/acciones/resultado';
import { Desplegable } from '@/componentes/Desplegable';
import type { Permiso } from '@/lib/tipos';

export function SelectorPermiso({ email, nombre, permiso, propio }: { email: string; nombre: string; permiso: Permiso; propio: boolean }) {
  const [res, accion, pendiente] = useActionState(cambiarPermisoAccion, INICIAL);
  const [valor, setValor] = useState<string>(permiso);

  useEffect(() => setValor(permiso), [permiso]);
  useEffect(() => {
    if (res.vez && !res.ok) setValor(permiso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ width: 170 }}>
        <Desplegable
          className="desplegable-peq"
          aria-label={`Permiso de ${nombre || email}`}
          value={valor}
          disabled={pendiente || propio}
          onChange={(v) => {
            if (v === valor) return;
            setValor(v);
            const fd = new FormData();
            fd.set('email', email);
            fd.set('permiso', v);
            startTransition(() => accion(fd));
          }}
          opciones={[
            { valor: 'lectura', texto: 'Lectura' },
            { valor: 'edicion', texto: 'Edición' },
            { valor: 'admin', texto: 'Administración' },
          ]}
        />
      </div>
      {pendiente ? <span className="meta">Guardando…</span> : null}
      {!pendiente && res.vez && res.ok ? <span className="meta">Guardado</span> : null}
      {res.vez && !res.ok ? <span className="warn">{res.mensaje}</span> : null}
    </div>
  );
}
