'use client';

// Desplegable propio para toda la app, en lugar del <select> del navegador: de una opción
// o de varias, con icono (banderas), búsqueda en las listas largas y manejo con teclado
// (patrón "combobox" de WAI-ARIA). Con `name`, envía su valor en los formularios igual que
// un <select>: un campo oculto por cada valor elegido.
//
// La lista se coloca con position: fixed para que no la corten las tablas ni las tarjetas
// con overflow; no se usa un portal para que siga funcionando dentro de <dialog>.

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { urlBandera } from '@/lib/paises';

export interface Opcion {
  valor: string;
  texto: string;
  /** Icono a la izquierda; por ejemplo, <Bandera codigo="CD" />. */
  icono?: React.ReactNode;
  desactivada?: boolean;
  /** Las opciones seguidas con el mismo grupo van bajo un encabezado con ese texto. */
  grupo?: string;
}

interface Comunes {
  opciones: Opcion[];
  name?: string;
  id?: string;
  /** Texto cuando no hay nada elegido. */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Caja de búsqueda; por defecto, en las listas de más de 12 opciones. */
  buscar?: boolean;
  textoBuscar?: string;
  sinResultados?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

interface DeUna extends Comunes {
  multiple?: false;
  value?: string;
  defaultValue?: string;
  onChange?: (valor: string) => void;
}

interface DeVarias extends Comunes {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onChange?: (valores: string[]) => void;
  /** Botones rápidos arriba de la lista (por ejemplo, «Activos» o «Todos»). */
  atajos?: { texto: string; valores: string[] }[];
  /** Texto del botón según lo elegido; por defecto, la opción o «X y N más». */
  resumen?: (valores: string[]) => string;
}

export type PropsDesplegable = DeUna | DeVarias;

export function Bandera({ codigo }: { codigo: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- SVG pequeño y estático de public/banderas
  return <img className="bandera" src={urlBandera(codigo)} alt="" width={20} height={15} loading="lazy" />;
}

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function Desplegable(props: PropsDesplegable) {
  const { opciones, name, id, placeholder = 'Elige…', required, disabled, className, textoBuscar = 'Buscar…', sinResultados = 'Sin resultados' } = props;
  const multiple = props.multiple === true;
  const conBuscador = props.buscar ?? opciones.length > 12;

  const inicial = (): string[] => {
    const d = props.defaultValue;
    return Array.isArray(d) ? d : d ? [d] : [];
  };
  const [interno, setInterno] = useState<string[]>(inicial);
  const controlado = props.value !== undefined;
  const elegidos = useMemo<string[]>(() => {
    if (!controlado) return interno;
    const v = props.value;
    return Array.isArray(v) ? v : v ? [v] : [];
  }, [controlado, interno, props.value]);

  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [activa, setActiva] = useState(-1);
  const [posicion, setPosicion] = useState<React.CSSProperties>({});

  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const tecleado = useRef({ texto: '', hasta: 0 });
  const base = useId();
  const idLista = `${base}-lista`;
  const idOpcion = (i: number) => `${base}-op-${i}`;

  const visibles = useMemo(() => {
    const q = normalizar(filtro.trim());
    return q ? opciones.filter((o) => normalizar(o.texto).includes(q)) : opciones;
  }, [opciones, filtro]);

  const cambiar = (nuevos: string[]) => {
    if (!controlado) flushSync(() => setInterno(nuevos));
    if (props.multiple === true) props.onChange?.(nuevos);
    else props.onChange?.(nuevos[0] ?? '');
  };

  const cerrar = useCallback((enfocar = true) => {
    setAbierto(false);
    setFiltro('');
    if (enfocar) boton.current?.focus();
  }, []);

  const abrir = () => {
    if (disabled) return;
    const i = opciones.findIndex((o) => elegidos.includes(o.valor));
    setActiva(i >= 0 ? i : 0);
    setAbierto(true);
  };

  const elegir = (o: Opcion) => {
    if (o.desactivada) return;
    if (multiple) {
      cambiar(elegidos.includes(o.valor) ? elegidos.filter((v) => v !== o.valor) : [...elegidos, o.valor]);
    } else {
      cambiar([o.valor]);
      cerrar();
    }
  };

  // Posición de la lista: debajo del botón o, si no cabe, encima.
  const colocar = useCallback(() => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const margen = 8;
    const abajo = window.innerHeight - r.bottom - margen;
    const arriba = r.top - margen;
    const haciaArriba = abajo < 240 && arriba > abajo;
    const ancho = Math.min(Math.max(r.width, 240), window.innerWidth - 2 * margen);
    const izquierda = Math.min(Math.max(r.left, margen), window.innerWidth - ancho - margen);
    setPosicion({
      left: izquierda,
      width: ancho,
      maxHeight: Math.min(360, haciaArriba ? arriba : abajo),
      ...(haciaArriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!abierto) return;
    colocar();
    if (conBuscador) buscador.current?.focus();
    window.addEventListener('resize', colocar);
    window.addEventListener('scroll', colocar, true);
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) cerrar(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => {
      window.removeEventListener('resize', colocar);
      window.removeEventListener('scroll', colocar, true);
      document.removeEventListener('pointerdown', fuera);
    };
  }, [abierto, colocar, cerrar, conBuscador]);

  // La opción activa siempre a la vista (también al abrir, cuando la lista ya tiene su altura).
  useEffect(() => {
    if (abierto && activa >= 0) document.getElementById(idOpcion(activa))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, activa, posicion]);

  useEffect(() => setActiva(visibles.length ? 0 : -1), [filtro, visibles.length]);

  // Como un <select>: al vaciar el formulario (form.reset()) vuelve al valor inicial.
  useEffect(() => {
    const form = raiz.current?.closest('form');
    if (!form || controlado) return;
    const reiniciar = () => setInterno(inicial());
    form.addEventListener('reset', reiniciar);
    return () => form.removeEventListener('reset', reiniciar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlado]);

  const mover = (desde: number, paso: number) => {
    if (!visibles.length) return -1;
    let i = desde;
    for (let n = 0; n < visibles.length; n++) {
      i = (i + paso + visibles.length) % visibles.length;
      if (!visibles[i].desactivada) return i;
    }
    return desde;
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiva((a) => mover(a, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiva((a) => mover(a, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActiva(mover(-1, 1));
        break;
      case 'End':
        e.preventDefault();
        setActiva(mover(visibles.length, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (visibles[activa]) elegir(visibles[activa]);
        break;
      case ' ':
        if (conBuscador) break;
        e.preventDefault();
        if (visibles[activa]) elegir(visibles[activa]);
        break;
      case 'Escape':
        e.preventDefault();
        cerrar();
        break;
      case 'Tab':
        // Se devuelve el foco al botón antes de que el tabulador avance desde él.
        cerrar();
        break;
      default:
        // Sin buscador, escribir salta a la opción que empieza por esas letras (como un <select>).
        if (!conBuscador && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const t = tecleado.current;
          t.texto = (Date.now() < t.hasta ? t.texto : '') + normalizar(e.key);
          t.hasta = Date.now() + 700;
          const i = visibles.findIndex((o) => normalizar(o.texto).startsWith(t.texto));
          if (i >= 0) setActiva(i);
        }
    }
  };

  const delMapa = new Map(opciones.map((o) => [o.valor, o]));
  const primera = elegidos.length ? delMapa.get(elegidos[0]) : undefined;
  let texto: string;
  if (props.multiple === true && props.resumen) texto = props.resumen(elegidos);
  else if (!elegidos.length || !primera) texto = '';
  else if (elegidos.length === 1) texto = primera.texto;
  else texto = `${primera.texto} y ${elegidos.length - 1} más`;
  const vacio = !texto;
  const icono = elegidos.length === 1 ? primera?.icono : undefined;

  return (
    <div ref={raiz} className={`desplegable${className ? ` ${className}` : ''}`}>
      <button
        ref={boton}
        id={id}
        type="button"
        role="combobox"
        className="desplegable-boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={abierto && !conBuscador && activa >= 0 ? idOpcion(activa) : undefined}
        aria-label={props['aria-label']}
        aria-describedby={props['aria-describedby']}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={teclas}
      >
        {icono}
        <span className={`desplegable-texto${vacio ? ' desplegable-placeholder' : ''}`}>{texto || placeholder}</span>
        <svg className="desplegable-flecha" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {name ? (
        required && !multiple ? (
          // Campo invisible pero validable: el navegador avisa si se envía sin elegir.
          <input className="desplegable-requerido" name={name} value={elegidos[0] ?? ''} required tabIndex={-1} aria-hidden="true" onChange={() => undefined} />
        ) : multiple ? (
          elegidos.map((v) => <input key={v} type="hidden" name={name} value={v} />)
        ) : (
          <input type="hidden" name={name} value={elegidos[0] ?? ''} />
        )
      ) : null}

      {abierto ? (
        // preventDefault en el clic: el desplegable suele estar dentro de un <label>, que si no
        // reenviaría el clic al botón y lo cerraría.
        <div className="desplegable-panel" style={posicion} onClick={(e) => e.preventDefault()}>
          {conBuscador ? (
            <input
              ref={buscador}
              className="desplegable-buscar"
              type="search"
              role="combobox"
              aria-controls={idLista}
              aria-expanded="true"
              aria-autocomplete="list"
              aria-activedescendant={activa >= 0 ? idOpcion(activa) : undefined}
              aria-label={textoBuscar}
              placeholder={textoBuscar}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              onKeyDown={teclas}
            />
          ) : null}
          {props.multiple === true && (props.atajos?.length || elegidos.length) ? (
            <div className="desplegable-atajos">
              {props.atajos?.map((a) => (
                <button key={a.texto} type="button" onClick={() => cambiar(a.valores)}>
                  {a.texto}
                </button>
              ))}
              {!props.atajos?.length && elegidos.length ? (
                <button type="button" onClick={() => cambiar([])}>
                  Quitar selección
                </button>
              ) : null}
            </div>
          ) : null}
          <ul ref={lista} id={idLista} role="listbox" className="desplegable-lista" aria-multiselectable={multiple || undefined} tabIndex={-1}>
            {visibles.map((o, i) => {
              const sel = elegidos.includes(o.valor);
              const cabecera = o.grupo && o.grupo !== visibles[i - 1]?.grupo;
              return [
                cabecera ? (
                  <li key={`grupo-${o.grupo}-${i}`} role="presentation" className="desplegable-grupo">
                    {o.grupo}
                  </li>
                ) : null,
                <li
                  key={o.valor}
                  id={idOpcion(i)}
                  role="option"
                  aria-selected={sel}
                  aria-disabled={o.desactivada || undefined}
                  className="desplegable-opcion"
                  data-activa={i === activa ? '' : undefined}
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerMove={() => setActiva(i)}
                  onClick={() => elegir(o)}
                >
                  {multiple ? (
                    <span className="desplegable-check" aria-hidden="true">
                      {sel ? '✓' : ''}
                    </span>
                  ) : null}
                  {o.icono}
                  <span className="desplegable-texto">{o.texto}</span>
                  {!multiple && sel ? (
                    <span className="desplegable-marca" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </li>,
              ];
            })}
            {!visibles.length ? <li className="desplegable-vacio">{sinResultados}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
