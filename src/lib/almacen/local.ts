// Almacén en un fichero JSON (.datos/almacen.json), solo para el modo demo
// y el desarrollo en local. No sirve en Vercel: su disco no es persistente.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Almacen, Consulta, Datos, Transaccion } from './tipos';

const FICHERO = path.join(process.cwd(), '.datos', 'almacen.json');

type Estado = { docs: Record<string, Datos>; mtime: number };
const global_ = globalThis as unknown as { __almacenLocal?: Estado; __almacenCola?: Promise<unknown> };

function cargar(): Record<string, Datos> {
  let mtime = 0;
  try {
    mtime = fs.statSync(FICHERO).mtimeMs;
  } catch {
    /* todavía no existe */
  }
  const actual = global_.__almacenLocal;
  if (actual && actual.mtime === mtime) return actual.docs;
  const docs = mtime ? (JSON.parse(fs.readFileSync(FICHERO, 'utf8')) as Record<string, Datos>) : {};
  global_.__almacenLocal = { docs, mtime };
  return docs;
}

function escribir(docs: Record<string, Datos>) {
  fs.mkdirSync(path.dirname(FICHERO), { recursive: true });
  const tmp = `${FICHERO}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(docs, null, 1));
  fs.renameSync(tmp, FICHERO);
  global_.__almacenLocal = { docs, mtime: fs.statSync(FICHERO).mtimeMs };
}

/** Ejecuta las escrituras de una en una para no pisarse. */
function enCola<R>(fn: () => Promise<R> | R): Promise<R> {
  const previa = global_.__almacenCola ?? Promise.resolve();
  const siguiente = previa.catch(() => undefined).then(fn);
  global_.__almacenCola = siguiente;
  return siguiente;
}

const copia = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

function esObjeto(v: unknown): v is Datos {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fusionar(base: Datos, cambios: Datos): Datos {
  const r: Datos = { ...base };
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) continue;
    r[k] = esObjeto(v) && esObjeto(r[k]) ? fusionar(r[k] as Datos, v) : v;
  }
  return r;
}

function sinIndefinidos(d: Datos): Datos {
  return JSON.parse(JSON.stringify(d)) as Datos;
}

function valorCampo(doc: Datos, campo: string): unknown {
  return campo.split('.').reduce<unknown>((v, k) => (esObjeto(v) ? v[k] : undefined), doc);
}

function cumple(doc: Datos, [campo, op, valor]: [string, string, unknown]): boolean {
  const v = valorCampo(doc, campo) as never;
  switch (op) {
    case '==': return v === valor;
    case '!=': return v !== valor && v !== undefined;
    case '<': return v < (valor as never);
    case '<=': return v <= (valor as never);
    case '>': return v > (valor as never);
    case '>=': return v >= (valor as never);
    case 'in': return (valor as unknown[]).includes(v);
    case 'array-contains': return Array.isArray(v) && (v as unknown[]).includes(valor);
    default: return false;
  }
}

export const almacenLocal: Almacen = {
  async leer<T>(ruta: string) {
    return (copia(cargar()[ruta]) as T) ?? null;
  },

  crear(coleccion, datos) {
    return enCola(() => {
      const docs = cargar();
      const id = crypto.randomBytes(10).toString('base64url');
      docs[`${coleccion}/${id}`] = sinIndefinidos(datos);
      escribir(docs);
      return id;
    });
  },

  guardar(ruta, datos, opciones) {
    return enCola(() => {
      const docs = cargar();
      docs[ruta] = sinIndefinidos(opciones?.fusionar && docs[ruta] ? fusionar(docs[ruta], datos) : datos);
      escribir(docs);
    });
  },

  borrarCampo(ruta, campo) {
    return enCola(() => {
      const docs = cargar();
      let nodo: unknown = docs[ruta];
      for (const k of campo.slice(0, -1)) nodo = esObjeto(nodo) ? nodo[k] : undefined;
      if (esObjeto(nodo)) delete nodo[campo[campo.length - 1]];
      escribir(docs);
    });
  },

  borrar(ruta) {
    return enCola(() => {
      const docs = cargar();
      delete docs[ruta];
      escribir(docs);
    });
  },

  async consultar<T>(coleccion: string, consulta: Consulta = {}) {
    const prefijo = `${coleccion}/`;
    let filas = Object.entries(cargar())
      .filter(([ruta]) => ruta.startsWith(prefijo) && !ruta.slice(prefijo.length).includes('/'))
      .map(([ruta, d]) => ({ ...copia(d), id: ruta.slice(prefijo.length) }) as Datos & { id: string });
    for (const f of consulta.donde ?? []) filas = filas.filter((d) => cumple(d, f));
    if (consulta.orden) {
      const [campo, dir] = consulta.orden;
      const s = dir === 'desc' ? -1 : 1;
      filas.sort((a, b) => {
        const va = valorCampo(a, campo) as never;
        const vb = valorCampo(b, campo) as never;
        return va === vb ? 0 : va > vb ? s : -s;
      });
    }
    if (consulta.limite) filas = filas.slice(0, consulta.limite);
    return filas as (T & { id: string })[];
  },

  transaccion(fn) {
    return enCola(async () => {
      const docs = cargar();
      const pendientes: [string, Datos][] = [];
      const tx: Transaccion = {
        async leer<T>(ruta: string) {
          return (copia(docs[ruta]) as T) ?? null;
        },
        guardar(ruta, datos) {
          pendientes.push([ruta, datos]);
        },
      };
      const r = await fn(tx);
      for (const [ruta, datos] of pendientes) docs[ruta] = sinIndefinidos(datos);
      escribir(docs);
      return r;
    });
  },

  async volcar() {
    return copia(cargar());
  },
};
