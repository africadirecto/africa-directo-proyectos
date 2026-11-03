'use server';

// Administración › Ajustes de IA. Todo es cosa de administración.

import { revalidatePath } from 'next/cache';
import { permitido, persona } from '../sesion';
import { intentar, texto, type Resultado } from './resultado';
import { ajustesIa, guardarAjustesIa, guardarClaveIa, type AjustesIa, type NombreClave, type TareaIa } from '../ia/ajustes';
import { ErrorIA, pedirJson } from '../ia/openrouter';
import { catalogoModelos } from '../ia/modelos';

const TAREAS: (TareaIa | 'lotes')[] = ['rapida', 'redaccion', 'vision', 'plantillas', 'lotes'];
const MODELO = /^[\w.-]+\/[\w.:-]+$/;

const revalidar = () => revalidatePath('/admin', 'layout');

export async function guardarAjustesIaAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const modelos = {} as AjustesIa['modelos'];
    for (const t of TAREAS) {
      const m = texto(fd, `modelo.${t}`, 120);
      if (!MODELO.test(m)) throw new Error(`Elige un modelo válido (proveedor/modelo) para «${t}».`);
      modelos[t] = m;
    }
    const modo = texto(fd, 'modo', 20);
    if (modo !== 'lotes' && modo !== 'directo') throw new Error('Elige cómo se redactan los informes.');
    const limite = Number(texto(fd, 'limiteMensual', 10).replace(',', '.') || '0');
    if (!Number.isFinite(limite) || limite < 0 || limite > 1000) throw new Error('El límite de gasto tiene que ser un número entre 0 y 1000.');
    await guardarAjustesIa(
      {
        activa: fd.get('activa') === 'on',
        modo,
        modelos,
        limiteMensual: Math.round(limite * 100) / 100,
        fotos: fd.get('fotos') === 'on',
      },
      persona(yo),
    );
    revalidar();
    return 'Ajustes guardados. Se aplican a lo que se pida a partir de ahora.';
  });
}

/** Lo que dice OpenRouter de una clave: si vale, cuánto lleva gastado y su límite. */
async function infoClave(clave: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${clave}` }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res) return 'No se ha podido contactar con OpenRouter.';
  if (res.status === 401) throw new Error('OpenRouter no reconoce esa clave.');
  if (!res.ok) return `OpenRouter respondió ${res.status}.`;
  const d = ((await res.json()) as { data?: { usage?: number; limit?: number | null; limit_remaining?: number | null } }).data ?? {};
  const dolares = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} $`;
  return `La clave funciona. Gastado con ella: ${dolares(d.usage ?? 0)}${d.limit != null ? `; límite de la clave: ${dolares(d.limit)} (quedan ${dolares(d.limit_remaining ?? 0)})` : '; la clave no tiene límite de gasto en OpenRouter'}.`;
}

export async function guardarClaveAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const nombre = texto(fd, 'nombre', 20) as NombreClave;
    if (nombre !== 'clave' && nombre !== 'secretoWebhook') throw new Error('Clave no válida.');
    const valor = texto(fd, 'valor', 500).replace(/\s/g, '');
    if (valor.length < 8) throw new Error('Pega la clave entera.');
    // La de OpenRouter se comprueba antes de guardarla.
    const info = nombre === 'clave' ? await infoClave(valor) : '';
    await guardarClaveIa(nombre, valor, persona(yo));
    revalidar();
    return `Guardada. ${info}`.trim();
  });
}

export async function quitarClaveAccion(_: Resultado, fd: FormData): Promise<Resultado> {
  return intentar(async () => {
    const yo = await permitido('admin');
    const nombre = texto(fd, 'nombre', 20) as NombreClave;
    if (nombre !== 'clave' && nombre !== 'secretoWebhook') throw new Error('Clave no válida.');
    await guardarClaveIa(nombre, '', persona(yo));
    revalidar();
    return 'Quitada de la app. Si hay variable de entorno, se usa esa.';
  });
}

export async function comprobarClaveAccion(_: Resultado): Promise<Resultado> {
  return intentar(async () => {
    await permitido('admin');
    const { clave } = await ajustesIa();
    if (!clave) throw new Error('No hay clave de OpenRouter.');
    return infoClave(clave);
  });
}

export interface ResultadoPrueba extends Resultado {
  pruebas?: { tarea: string; modelo: string; ok: boolean; detalle: string }[];
}

// Una imagen de 1 × 1 píxel, para ver que el modelo de fotos acepta imágenes.
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Una petición mínima a cada modelo, con las mismas condiciones de privacidad que las de verdad. */
export async function probarModelosAccion(_: ResultadoPrueba): Promise<ResultadoPrueba> {
  const pruebas: NonNullable<ResultadoPrueba['pruebas']> = [];
  const r = await intentar(async () => {
    await permitido('admin');
    const a = await ajustesIa();
    if (!a.clave) throw new Error('Falta la clave de OpenRouter.');
    const esquema = { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } };
    await Promise.all(
      (['rapida', 'redaccion', 'vision', 'plantillas'] as TareaIa[]).map(async (tarea) => {
        const inicio = Date.now();
        try {
          await pedirJson({
            tarea,
            nombre: 'prueba',
            esquema,
            instrucciones: 'Responde {"ok": true}.',
            entrada: tarea === 'vision' ? [{ type: 'text', text: 'Prueba.' }, { type: 'image_url', image_url: { url: PIXEL } }] : 'Prueba.',
            maxTokens: 2000,
            timeoutMs: 60_000,
          });
          pruebas.push({ tarea, modelo: a.modelos[tarea], ok: true, detalle: `responde en ${((Date.now() - inicio) / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} s` });
        } catch (e) {
          const m = e instanceof ErrorIA ? e.message.replace(/^OpenRouter \d+: /, '') : String(e);
          pruebas.push({ tarea, modelo: a.modelos[tarea], ok: false, detalle: m.slice(0, 200) || 'no responde' });
        }
      }),
    );
    // Los lotes no se pueden probar al momento: se mira que el modelo tenga variante de lotes.
    const catalogo = await catalogoModelos();
    const enCatalogo = catalogo.find((m) => m.id === a.modelos.lotes);
    pruebas.push({
      tarea: 'lotes',
      modelo: a.modelos.lotes,
      ok: !catalogo.length || !!enCatalogo?.lotes,
      detalle: !catalogo.length ? 'no se ha podido comprobar' : enCatalogo?.lotes ? 'tiene variante de lotes' : 'no tiene variante de lotes en OpenRouter',
    });
    const fallos = pruebas.filter((p) => !p.ok).length;
    return fallos ? `${fallos} de ${pruebas.length} no funcionan.` : 'Todos los modelos funcionan.';
  });
  const orden = ['rapida', 'redaccion', 'vision', 'plantillas', 'lotes'];
  return { ...r, pruebas: pruebas.sort((x, y) => orden.indexOf(x.tarea) - orden.indexOf(y.tarea)) };
}
