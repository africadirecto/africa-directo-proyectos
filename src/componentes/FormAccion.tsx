'use client';

// Formulario que llama a una acción de servidor y muestra su resultado.
// Dentro de un <Dialogo>, se cierra solo cuando la acción va bien.

import { useActionState, useContext, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { INICIAL, type Resultado } from '@/lib/acciones/resultado';
import { ContextoDialogo } from './Dialogo';

type Accion = (previo: Resultado, fd: FormData) => Promise<Resultado>;

export function FormAccion({
  accion,
  children,
  className,
  confirmar,
  limpiar = false,
  ocultarOk = false,
}: {
  accion: Accion;
  children: React.ReactNode;
  className?: string;
  /** Pregunta antes de enviar (para acciones que no se deshacen fácilmente). */
  confirmar?: string;
  /** Vacía el formulario tras un envío correcto. */
  limpiar?: boolean;
  ocultarOk?: boolean;
}) {
  const [estado, ejecutar] = useActionState(accion, INICIAL);
  const form = useRef<HTMLFormElement>(null);
  const dialogo = useContext(ContextoDialogo);

  useEffect(() => {
    if (!estado.vez || !estado.ok) return;
    if (limpiar) form.current?.reset();
    dialogo?.cerrar();
  }, [estado, limpiar, dialogo]);

  return (
    <form
      ref={form}
      action={ejecutar}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      {estado.vez && estado.mensaje && !(estado.ok && ocultarOk) ? (
        <p role="status" className={estado.ok ? 'aviso-ok' : 'aviso-error'} style={{ margin: 0 }}>
          {estado.mensaje}
        </p>
      ) : null}
    </form>
  );
}

/** Botón de envío que se desactiva mientras la acción está en marcha. */
export function Enviar({
  children,
  clase = 'btn btn-p',
  pendiente = 'Un momento…',
  name,
  value,
}: {
  children: React.ReactNode;
  clase?: string;
  pendiente?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  const esEste = !name || data?.get(name) === value;
  return (
    <button type="submit" className={clase} disabled={pending} name={name} value={value}>
      {pending && esEste ? pendiente : children}
    </button>
  );
}
