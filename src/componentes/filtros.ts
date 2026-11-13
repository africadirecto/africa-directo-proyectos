// Filtros de varias opciones en los que lo marcado es lo que se ve (Proyectos, Actividad).
// `null` es «todos» (también las opciones que aparezcan después); una lista vacía, ninguno.

export type Eleccion = string[] | null;

type Opciones = { valor: string; texto: string }[];

export const pasa = (e: Eleccion, valor: string) => !e || e.includes(valor);

/** Para el `value` del desplegable: con «todos», todas las opciones marcadas. */
export const marcadas = (e: Eleccion, opciones: Opciones) => e ?? opciones.map((o) => o.valor);

/** Para el `onChange` del desplegable: con todo marcado se guarda «todos». */
export const alElegir = (set: (e: Eleccion) => void, opciones: Opciones) => (v: string[]) => set(v.length === opciones.length ? null : v);

/** Texto del botón del desplegable: «Todos», «Ninguno», la opción o «X y N más». */
export const resumenDe = (todos: string, ninguno: string, opciones: Opciones) => (sel: string[]) => {
  if (!sel.length) return ninguno;
  if (sel.length === opciones.length) return todos;
  const primera = opciones.find((o) => o.valor === sel[0])?.texto ?? '';
  return sel.length === 1 ? primera : `${primera} y ${sel.length - 1} más`;
};
