'use client';

// Menú «Más» con las acciones secundarias de una página, cada una con su icono. Una opción abre
// un diálogo (rendido aparte, con <Dialogo id=…>) o ejecuta una acción de servidor; el resultado
// sale en un aviso junto al botón. Las que no se deshacen fácilmente piden confirmación.

import { useEffect, useRef, useState, useTransition } from 'react';
import { abrirDialogo } from './Dialogo';
import { IconoMas } from './Iconos';
import type { Resultado } from '@/lib/acciones/resultado';

export interface OpcionMenu {
  texto: string;
  icono?: React.ReactNode;
  /** Abre el diálogo con este id. */
  dialogo?: string;
  /** O ejecuta esta acción con estos campos. */
  accion?: (previo: Resultado, fd: FormData) => Promise<Resultado>;
  campos?: Record<string, string>;
  confirmar?: string;
  /** En rojo (borrar). */
  peligro?: boolean;
  /** Con una raya encima, para separarla de las anteriores. */
  separada?: boolean;
}

export function MenuAcciones({ opciones, texto = 'Más' }: { opciones: OpcionMenu[]; texto?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enMarcha, setEnMarcha] = useState('');
  const [, iniciar] = useTransition();
  // El panel y el aviso, alineados con el botón y siempre dentro de la pantalla.
  const [lado, setLado] = useState<React.CSSProperties>({ right: 0 });
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    panel.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  // Los avisos de que ha ido bien se van solos.
  useEffect(() => {
    if (!resultado?.ok) return;
    const t = setTimeout(() => setResultado(null), 6000);
    return () => clearTimeout(t);
  }, [resultado]);

  const elegir = (o: OpcionMenu) => {
    setAbierto(false);
    if (o.dialogo) return abrirDialogo(o.dialogo);
    if (!o.accion || enMarcha || (o.confirmar && !window.confirm(o.confirmar))) return;
    const fd = new FormData();
    for (const [k, v] of Object.entries(o.campos ?? {})) fd.set(k, v);
    setResultado(null);
    setEnMarcha(o.texto);
    iniciar(async () => {
      const r = await o.accion!({ ok: false }, fd);
      setResultado(r);
      setEnMarcha('');
    });
  };

  return (
    <div ref={raiz} className="menu-acciones">
      <button
        ref={boton}
        type="button"
        className="btn btn-s"
        aria-haspopup="menu"
        aria-expanded={abierto}
        disabled={!!enMarcha}
        onClick={() => {
          const r = boton.current!.getBoundingClientRect();
          const izquierda = raiz.current!.getBoundingClientRect().left;
          // A la derecha del botón si cabe (unos 260 px hacia la izquierda); si no, desde el borde de la pantalla.
          setLado(r.right > 268 ? { right: 0 } : { left: Math.min(0, 8 - izquierda) });
          setAbierto((a) => !a);
        }}
      >
        <IconoMas tamano={18} />
        {enMarcha ? `${enMarcha}…` : texto}
      </button>
      {abierto ? (
        <div ref={panel} className="menu-acciones-panel" role="menu" style={lado}>
          {opciones.map((o) => (
            <button key={o.texto} type="button" role="menuitem" className="menu-opcion" data-peligro={o.peligro || undefined} data-separada={o.separada || undefined} onClick={() => elegir(o)}>
              {o.icono}
              {o.texto}
            </button>
          ))}
        </div>
      ) : null}
      {resultado?.mensaje && !abierto ? (
        <p role="status" className={`menu-acciones-aviso ${resultado.ok ? 'aviso-ok' : 'aviso-error'}`} style={lado} onClick={() => setResultado(null)}>
          {resultado.mensaje}
        </p>
      ) : null}
    </div>
  );
}
