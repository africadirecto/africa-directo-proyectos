'use client';

// Formulario que llama a una acción de servidor y muestra su resultado.
// Dentro de un <Dialogo>, se cierra solo cuando la acción va bien.
//
// No usa <form action={…}>: React vacía esos formularios tras cada envío, y se perdería lo
// escrito si la acción devuelve un error (por ejemplo, el comentario de una revisión).

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { INICIAL, type Resultado } from '@/lib/acciones/resultado';
import { ContextoDialogo } from './Dialogo';
import { confirmar as preguntar } from './confirmar';

type Accion = (previo: Resultado, fd: FormData) => Promise<Resultado>;

/** Si hay un envío en marcha y con qué datos (para el texto del botón pulsado). */
const ContextoEnvio = createContext<{ pendiente: boolean; datos: FormData | null } | null>(null);

export function FormAccion({
  accion,
  children,
  className,
  confirmar,
  peligro = false,
  limpiar = false,
  ocultarOk = false,
}: {
  accion: Accion;
  children: React.ReactNode;
  className?: string;
  /** Pregunta antes de enviar (para acciones que no se deshacen fácilmente). */
  confirmar?: string;
  /** Con `confirmar`: el botón de aceptar en rojo (para lo que elimina o quita algo). */
  peligro?: boolean;
  /** Vacía el formulario tras un envío correcto. */
  limpiar?: boolean;
  ocultarOk?: boolean;
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, INICIAL);
  const [datos, setDatos] = useState<FormData | null>(null);
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
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        if (pendiente) return;
        // El botón pulsado va en los datos (por ejemplo, name="decision" value="validar").
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        if (confirmar && !(await preguntar(confirmar, { peligro }))) return;
        setDatos(fd);
        startTransition(() => ejecutar(fd));
      }}
    >
      <ContextoEnvio.Provider value={{ pendiente, datos }}>{children}</ContextoEnvio.Provider>
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
  disabled = false,
}: {
  children: React.ReactNode;
  clase?: string;
  pendiente?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  // Dentro de un FormAccion, el estado viene de él; en un <form action> normal, de React.
  const envio = useContext(ContextoEnvio);
  const status = useFormStatus();
  const enMarcha = envio ? envio.pendiente : status.pending;
  const data = envio ? envio.datos : status.data;
  const esEste = !name || data?.get(name) === value;
  return (
    <button type="submit" className={clase} disabled={enMarcha || disabled} name={name} value={value}>
      {enMarcha && esEste ? pendiente : children}
    </button>
  );
}
