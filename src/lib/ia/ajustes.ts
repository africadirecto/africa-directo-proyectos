// Ajustes de la IA que se cambian en Administración › Ajustes de IA (ajustes/configIa): claves,
// modelo de cada función, modo de los informes (lotes o directo), límite de gasto y otras
// opciones. Lo que no esté guardado sale de las variables de entorno (config.ts), así que una
// instalación sin ajustes guardados funciona igual que antes.
//
// Las claves se guardan cifradas (../cifrado.ts) y nunca llegan al navegador: la pantalla solo
// ve sus cuatro últimos caracteres.

import { almacen } from '../almacen';
import { config } from '../config';
import { cifrar, descifrar, type Cifrado } from '../cifrado';
import type { Persona } from '../tipos';

/** Cada función de la app que usa la IA tiene su modelo. */
export type TareaIa = 'rapida' | 'redaccion' | 'vision' | 'plantillas';
export type ModoInformes = 'lotes' | 'directo';
export type Razonamiento = 'low' | 'medium' | 'high';
export type NombreClave = 'clave' | 'secretoWebhook';

export interface AjustesIa {
  /** Con la IA apagada, la app hace lo mismo que sin clave: solo las comprobaciones automáticas. */
  activa: boolean;
  /** Cómo se redactan los informes y las plantillas desde un ejemplo. */
  modo: ModoInformes;
  modelos: Record<TareaIa | 'lotes', string>;
  razonamiento: Razonamiento;
  /** Gasto máximo del mes en dólares; al llegar, la IA se para hasta el mes siguiente. 0: sin límite. */
  limiteMensual: number;
  /** Describir las fotos publicables con IA para repartirlas en el informe y escribir sus pies. */
  fotos: boolean;
  /** Proveedores permitidos en los lotes (vacío: cualquiera). */
  proveedoresLotes: string[];
}

export interface AjustesIaEfectivos extends AjustesIa {
  clave: string;
  secretoWebhook: string;
  /** De dónde sale cada clave; «ilegible»: guardada, pero no se puede descifrar. */
  origen: Record<NombreClave, 'app' | 'entorno' | 'ilegible' | ''>;
  /** Los cuatro últimos caracteres de cada clave, para reconocerla. */
  final: Record<NombreClave, string>;
  actualizado: string;
  actualizadoPor: Persona | null;
}

interface Guardado extends Partial<AjustesIa> {
  claves?: Partial<Record<NombreClave, Cifrado | null>>;
  actualizado?: string;
  actualizadoPor?: Persona;
}

const RUTA = 'ajustes/configIa';

/** Los valores de las variables de entorno: lo que se usa mientras no se guarde otra cosa. */
export function ajustesDeEntorno(): AjustesIa {
  return {
    activa: true,
    modo: config.ia.lotes ? 'lotes' : 'directo',
    modelos: {
      rapida: config.ia.modeloRapido,
      redaccion: config.ia.modeloRedaccion,
      vision: config.ia.modeloVision,
      plantillas: config.ia.modeloPlantillas,
      lotes: config.ia.modeloLotes,
    },
    razonamiento: 'low',
    limiteMensual: 0,
    fotos: true,
    proveedoresLotes: config.ia.proveedoresLotes,
  };
}

// Cada llamada a la IA lee los ajustes: se guardan unos segundos para no gastar lecturas.
let cache: { valor: AjustesIaEfectivos; hasta: number } | null = null;

export async function ajustesIa(): Promise<AjustesIaEfectivos> {
  if (cache && cache.hasta > Date.now()) return cache.valor;
  const g = (await (await almacen()).leer<Guardado>(RUTA)) ?? {};
  const base = ajustesDeEntorno();
  const entorno: Record<NombreClave, string> = { clave: config.ia.clave, secretoWebhook: config.ia.secretoWebhook };
  const claves = {} as Record<NombreClave, string>;
  const origen = {} as AjustesIaEfectivos['origen'];
  for (const k of ['clave', 'secretoWebhook'] as NombreClave[]) {
    const guardada = g.claves?.[k];
    const texto = guardada ? descifrar(guardada) : null;
    claves[k] = texto ?? entorno[k];
    origen[k] = texto ? 'app' : guardada ? 'ilegible' : entorno[k] ? 'entorno' : '';
  }
  const valor: AjustesIaEfectivos = {
    activa: g.activa ?? base.activa,
    modo: g.modo ?? base.modo,
    modelos: { ...base.modelos, ...Object.fromEntries(Object.entries(g.modelos ?? {}).filter(([, v]) => v)) },
    razonamiento: g.razonamiento ?? base.razonamiento,
    limiteMensual: g.limiteMensual ?? base.limiteMensual,
    fotos: g.fotos ?? base.fotos,
    proveedoresLotes: g.proveedoresLotes ?? base.proveedoresLotes,
    ...claves,
    origen,
    final: { clave: claves.clave.slice(-4), secretoWebhook: claves.secretoWebhook.slice(-4) },
    actualizado: g.actualizado ?? '',
    actualizadoPor: g.actualizadoPor ?? null,
  };
  cache = { valor, hasta: Date.now() + 30_000 };
  return valor;
}

export async function guardarAjustesIa(cambios: Partial<AjustesIa>, autor: Persona): Promise<void> {
  await (await almacen()).guardar(RUTA, { ...cambios, actualizado: new Date().toISOString(), actualizadoPor: autor }, { fusionar: true });
  cache = null;
}

/** Guarda una clave cifrada; vacía, la quita (y vuelve a usarse la variable de entorno, si la hay). */
export async function guardarClaveIa(nombre: NombreClave, valor: string, autor: Persona): Promise<void> {
  const db = await almacen();
  const g = (await db.leer<Guardado>(RUTA)) ?? {};
  const claves = { ...g.claves, [nombre]: valor ? cifrar(valor) : null };
  await db.guardar(RUTA, { claves, actualizado: new Date().toISOString(), actualizadoPor: autor }, { fusionar: true });
  cache = null;
}

/** Gasto anotado este mes, en dólares (ver openrouter.ts › anotarUso). */
export async function gastoDelMes(): Promise<number> {
  const mes = new Date().toISOString().slice(0, 7);
  return (await (await almacen()).leer<{ meses?: Record<string, { coste?: number }> }>('ajustes/ia'))?.meses?.[mes]?.coste ?? 0;
}
