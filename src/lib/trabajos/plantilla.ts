// Plantilla a partir de un informe de ejemplo, en segundo plano como los informes. El estado va en
// la propia plantilla (estado «procesando» y proceso.paso):
//
//   convertir ──▶ analizar ──▶ (esperando el lote) ──▶ escribir ──▶ borrador   (o error)
//
// - convertir: copia el ejemplo como Google Doc o Slides en «AD · Plantillas / ONG» (o en la
//   carpeta del donante). El original se queda donde estaba.
// - analizar: la IA decide, bloque a bloque, qué es texto fijo, qué datos de la app hay y qué
//   apartados redactará la IA, y escribe las instrucciones (ia/plantillas.ts). En un lote de
//   OpenRouter si hay dirección pública; si no, por la vía directa.
// - escribir: pone los marcadores en la copia, guarda las instrucciones (versión 1) y la deja en
//   borrador para que una persona la revise, la pruebe y la active.
// Probado contra Google y OpenRouter con un .docx de ejemplo (src/lib/drive/plantillas.google.test.ts).

import { almacen } from '../almacen';
import { drive } from '../drive';
import { ES_DOC, ES_PRESENTACION } from '../drive/tipos';
import { aplicarAnalisisDoc, bloquesDoc, leerDoc } from '../drive/plantillaDocs';
import { aplicarAnalisisSlides, bloquesSlides, leerSlides } from '../drive/plantillaSlides';
import { enviarLote, leerLote, borrarLote } from '../ia/lotes';
import { analizarEjemploDirecto, FORMATO_EJEMPLO, peticionEjemplo, validarAnalisis, type AnalisisEjemplo, type BloqueEjemplo } from '../ia/plantillas';
import { carpetaPlantillas, guardarInstrucciones, leerMarcadores, sincronizarPlantilla, type DatosPlantilla } from '../dominio/plantillas';
import { apuntarLote, apuntarTrabajo, loteReciente, lotePorBorrar, quitarTrabajo, urlAviso, usarLotes } from './comun';
import type { Persona, Plantilla } from '../tipos';

/** Formatos que se aceptan como ejemplo: los de Google tal cual; Office y PDF, convertidos. */
export const MIMES_EJEMPLO: Record<string, 'docs' | 'slides'> = {
  [ES_DOC]: 'docs',
  [ES_PRESENTACION]: 'slides',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs',
  'application/msword': 'docs',
  'application/vnd.oasis.opendocument.text': 'docs',
  'application/rtf': 'docs',
  'application/pdf': 'docs',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slides',
  'application/vnd.ms-powerpoint': 'slides',
};

type Paso = 'convertir' | 'analizar' | 'esperando' | 'escribir';
interface Proceso {
  paso: Paso;
  lote?: { id: string; enviado: string; comprobado: string; reenviado: boolean } | null;
  bloqueo?: string;
  intentos?: number;
}
type PlantillaEnProceso = Plantilla & { proceso?: Proceso | null };

const ruta = (id: string) => `plantillas/${id}`;

/** Registra la plantilla «procesando» y devuelve su id. Después hay que llamar a avanzarPlantilla. */
export async function crearDesdeEjemplo(ejemploId: string, datos: DatosPlantilla, autor: Persona): Promise<string> {
  const meta = await (await drive()).metadatos(ejemploId);
  if (!meta) throw new Error('No se encuentra el archivo de ejemplo en Drive.');
  const formato = MIMES_EJEMPLO[meta.mime];
  if (!formato) throw new Error('El ejemplo tiene que ser un Word, un PowerPoint, un PDF o un documento de Google.');
  const ahora = new Date().toISOString();
  const p: PlantillaEnProceso = {
    ...datos,
    formato,
    estado: 'procesando',
    porDefecto: false,
    archivoId: '',
    url: '',
    origen: 'ejemplo',
    ejemplo: { archivoId: ejemploId, nombre: meta.nombre },
    version: 0,
    instrucciones: { general: '', campos: {} },
    estructura: { campos: [], datos: [], tablas: [] },
    sincronizado: null,
    proceso: { paso: 'convertir' },
    creado: ahora,
    creadoPor: autor,
    actualizado: ahora,
    actualizadoPor: autor,
  };
  const id = await (await almacen()).crear('plantillas', { ...p });
  await apuntarTrabajo(ruta(id), 'plantilla');
  return id;
}

/** Vuelve a intentarlo desde donde se quedó (convertir o analizar). */
export async function reintentarPlantilla(id: string): Promise<void> {
  const db = await almacen();
  const p = await db.leer<PlantillaEnProceso>(ruta(id));
  if (!p || p.estado !== 'error' || p.origen !== 'ejemplo') throw new Error('Esa plantilla no tiene nada que reintentar.');
  await db.guardar(ruta(id), { estado: 'procesando', error: '', proceso: { paso: p.archivoId ? 'analizar' : 'convertir' } }, { fusionar: true });
  await apuntarTrabajo(ruta(id), 'plantilla');
}

async function tomar(id: string): Promise<boolean> {
  return (await almacen()).transaccion(async (tx) => {
    const p = await tx.leer<PlantillaEnProceso>(ruta(id));
    if (!p || p.estado !== 'procesando' || !p.proceso || (p.proceso.bloqueo && p.proceso.bloqueo > new Date().toISOString())) return false;
    tx.guardar(ruta(id), { ...p, proceso: { ...p.proceso, bloqueo: new Date(Date.now() + 290_000).toISOString() } });
    return true;
  });
}

/** Hace el paso que toque. No lanza: los errores quedan en la plantilla. */
export async function avanzarPlantilla(id: string): Promise<void> {
  if (!(await tomar(id))) return;
  const db = await almacen();
  const inicio = Date.now();
  try {
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const p = await db.leer<PlantillaEnProceso>(ruta(id));
      if (!p || p.estado !== 'procesando' || !p.proceso) break;
      const antes = p.proceso.paso;
      if (antes === 'convertir') await convertir(id, p);
      else if (antes === 'analizar') await analizar(id, p);
      else if (antes === 'esperando') await esperar(id, p);
      else if (antes === 'escribir') await escribir(id, p);
      const despues = (await db.leer<PlantillaEnProceso>(ruta(id)))?.proceso?.paso;
      if (despues === antes || despues === 'esperando' || Date.now() - inicio > 90_000) break;
    }
  } catch (e) {
    console.error('Plantilla: error al crearla desde el ejemplo', id, e);
    const p = await db.leer<PlantillaEnProceso>(ruta(id));
    const mensaje = (e instanceof Error ? e.message : String(e)).replace(/https?:\/\/\S+/g, '').slice(0, 300);
    await db.guardar(ruta(id), { estado: 'error', error: mensaje || 'Algo ha fallado.', proceso: null }, { fusionar: true });
    await quitarTrabajo(ruta(id));
    if (p?.proceso?.lote) await lotePorBorrar(p.proceso.lote.id);
    return;
  }
  await db
    .leer<PlantillaEnProceso>(ruta(id))
    .then((p) => (p?.proceso ? db.guardar(ruta(id), { proceso: { ...p.proceso, bloqueo: '' } }, { fusionar: true }) : undefined))
    .catch(() => undefined);
}

const paso = async (id: string, p: PlantillaEnProceso, cambios: Partial<Proceso>, extra: Partial<PlantillaEnProceso> = {}) =>
  (await almacen()).guardar(ruta(id), { ...extra, proceso: { ...p.proceso!, ...cambios } }, { fusionar: true });

async function convertir(id: string, p: PlantillaEnProceso) {
  const d = await drive();
  const meta = await d.metadatos(p.ejemplo!.archivoId);
  if (!meta) throw new Error('No se encuentra el archivo de ejemplo en Drive.');
  const carpeta = p.donante ? await d.carpetaHija(p.donante.nombre, await carpetaPlantillas('Donantes')) : await carpetaPlantillas('ONG');
  const destino = p.formato === 'slides' ? ES_PRESENTACION : ES_DOC;
  // Los de Google se copian tal cual; Word, PowerPoint y PDF se convierten (PDF con OCR).
  const copia = meta.mime === destino ? await d.copiar(meta.id, carpeta, p.nombre) : await d.copiarConvirtiendo(meta.id, carpeta, p.nombre, destino);
  await paso(id, p, { paso: 'analizar' }, { archivoId: copia.id, url: p.formato === 'slides' ? d.urlPresentacion(copia.id) : d.urlDocumento(copia.id) });
}

async function bloquesDe(p: PlantillaEnProceso): Promise<BloqueEjemplo[]> {
  if (p.formato === 'slides') return bloquesSlides(await leerSlides(p.archivoId)).map((b) => ({ id: b.id, tipo: b.tipo, texto: b.texto }));
  return bloquesDoc(await leerDoc(p.archivoId)).map((b) => ({ id: b.id, tipo: b.tipo, texto: b.texto, ...(b.tabla ? { tabla: b.tabla } : {}) }));
}

async function analizar(id: string, p: PlantillaEnProceso) {
  const db = await almacen();
  const bloques = await bloquesDe(p);
  if (!bloques.some((b) => b.texto.trim())) throw new Error('No se ha podido leer texto en el ejemplo. Si es un PDF escaneado de mala calidad, prueba con el Word original.');
  const pet = peticionEjemplo({ bloques, tipo: p.tipo, formato: p.formato, donante: p.donante?.nombre ?? '' });
  if (usarLotes()) {
    const lote = await enviarLote([{ id: 'ejemplo', ...pet }], urlAviso(), FORMATO_EJEMPLO);
    const ahora = new Date().toISOString();
    await apuntarLote(ruta(id), lote);
    await paso(id, p, { paso: 'esperando', lote: { id: lote, enviado: ahora, comprobado: ahora, reenviado: p.proceso?.lote?.reenviado ?? false } });
    return;
  }
  const analisis = await analizarEjemploDirecto(pet, bloques, p.tipo);
  await db.guardar(`${ruta(id)}/trabajo/analisis`, { ...analisis });
  await paso(id, p, { paso: 'escribir', lote: null });
}

async function esperar(id: string, p: PlantillaEnProceso) {
  const lote = p.proceso!.lote!;
  const l = await leerLote(lote.id).catch((e) => {
    if (loteReciente(lote.enviado, e)) return { estado: 'en_curso' as const, resultados: {} as Record<string, { texto?: string; error?: string }> };
    throw e;
  });
  if (l.estado === 'en_curso') return paso(id, p, { lote: { ...lote, comprobado: new Date().toISOString() } });
  await borrarLote(lote.id).catch((e) => console.error('Lotes: no se pudo borrar', lote.id, e));
  await apuntarLote(ruta(id), '');
  const texto = l.estado === 'terminado' ? l.resultados.ejemplo?.texto : undefined;
  let analisis: AnalisisEjemplo | null = null;
  if (texto) {
    try {
      analisis = validarAnalisis(texto, await bloquesDe(p), p.tipo);
    } catch (e) {
      console.error('Plantilla: respuesta de la IA no válida', e);
    }
  }
  if (!analisis) {
    // Una vez se reintenta; si vuelve a fallar, error.
    if (lote.reenviado) throw new Error(l.error || 'La IA no devolvió un análisis válido del ejemplo.');
    return paso(id, p, { paso: 'analizar', lote: { ...lote, reenviado: true } });
  }
  await (await almacen()).guardar(`${ruta(id)}/trabajo/analisis`, { ...analisis });
  await paso(id, p, { paso: 'escribir', lote: null });
}

async function escribir(id: string, p: PlantillaEnProceso) {
  const db = await almacen();
  const analisis = await db.leer<AnalisisEjemplo>(`${ruta(id)}/trabajo/analisis`);
  if (!analisis) throw new Error('Falta el análisis del ejemplo: pulsa «Reintentar».');
  const mime = p.formato === 'slides' ? ES_PRESENTACION : ES_DOC;
  // Si un intento anterior ya escribió los marcadores, no se repite.
  let avisos: string[] = [];
  if (!(await leerMarcadores(p.archivoId, mime)).length) {
    avisos =
      p.formato === 'slides'
        ? await aplicarAnalisisSlides(p.archivoId, bloquesSlides(await leerSlides(p.archivoId)), analisis)
        : await aplicarAnalisisDoc(p.archivoId, bloquesDoc(await leerDoc(p.archivoId)), analisis);
  }
  const autor = p.actualizadoPor;
  await db.guardar(ruta(id), { idioma: analisis.idioma, estado: 'borrador', proceso: null, error: '' }, { fusionar: true });
  await guardarInstrucciones(id, analisis.instrucciones, `Creada a partir del ejemplo «${p.ejemplo?.nombre ?? ''}»`, autor);
  const s = await sincronizarPlantilla(id, autor, true);
  const word = /\.(docx?|odt|rtf)$/i.test(p.ejemplo?.nombre ?? '');
  await db.guardar(
    ruta(id),
    {
      sincronizado: {
        ...s.sincronizado!,
        avisos: [
          ...(s.sincronizado?.avisos ?? []),
          ...avisos,
          ...analisis.dudas.map((d) => `Duda de la IA: ${d}`),
          ...(word ? ['Si el Word original tenía cuadros de texto, la app no puede leerlos ni rellenarlos: revisa en Google que no falte nada.'] : []),
          'Revisa la plantilla en Google y sus instrucciones, pruébala con un proyecto y actívala.',
        ],
      },
    },
    { fusionar: true },
  );
  await db.borrar(`${ruta(id)}/trabajo/analisis`);
  await quitarTrabajo(ruta(id));
}
