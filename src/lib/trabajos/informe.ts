// Generación de informes en segundo plano. Cada informe avanza por estados guardados en su
// documento (proyectos/{codigo}/informes/{id} o informes/{id}):
//
//   en_cola ──preparar──▶ redactando ──▶ componiendo ──▶ listo        (o error)
//
// - preparar: reúne los datos, traduce el texto fijo si hace falta y pide a la IA un texto por
//   cada campo de la plantilla: en un lote de OpenRouter (sin límite de tiempo, mitad de precio)
//   o, en demo o con IA_LOTES=0, por la vía directa.
// - redactando: con lote, espera a que termine (avisa el webhook /api/ia/lotes) y guarda los
//   textos; si alguno falla, se reenvía una vez. Luego se borra el lote en OpenRouter.
// - componiendo: copia la plantilla y la rellena (ver drive/plantilla*.ts).
//
// `avanzarInforme` hace el paso que toque y se puede llamar cuantas veces se quiera: lo llaman la
// acción que pide el informe, el webhook de OpenRouter, la consulta de estado de la pantalla y el
// cron nocturno. Un bloqueo con caducidad evita que dos ejecuciones lo hagan a la vez, y cada paso
// cabe de sobra en los 300 s de una función de Vercel.

import { almacen } from '../almacen';
import { config } from '../config';
import { conFecha, drive } from '../drive';
import { ES_DOC, ES_PRESENTACION, ErrorDrive } from '../drive/tipos';
import { leerDoc, rellenarDoc, textosFijos } from '../drive/plantillaDocs';
import { leerSlides, rellenarSlides, textosFijosSlides } from '../drive/plantillaSlides';
import { rellenarHtml, textosFijosHtml } from '../drive/plantillaHtml';
import { avisarChat } from '../avisos';
import { iaDisponible } from '../ia';
import { ErrorIA } from '../ia/openrouter';
import { borrarLote, enviarLote, leerLote } from '../ia/lotes';
import { leerCampo, peticionCampo, redactarDirecto, resumirInforme, traducirTextos, type CampoPedido } from '../ia/informes';
import { DATOS, type Relleno } from '../dominio/marcadores';
import { anotarEvento } from '../dominio/eventos';
import { contextoProyecto } from '../dominio/informes';
import { contextoConjunto, type TipoInformeGeneral } from '../dominio/informesGenerales';
import { leerPlantilla, sincronizarPlantilla, TIPOS_PLANTILLA, type PlantillaConId } from '../dominio/plantillas';
import type { EventoContexto } from '../dominio/informesComun';
import type { EstadoProyecto, Idioma, Informe, Persona, TipoInforme } from '../tipos';

const DE_PROYECTO: TipoInforme[] = ['seguimiento', 'final', 'financiacion'];
const BLOQUEO_MS = 290_000;
const MAX_INTENTOS = 3;

/** Lo preparado para redactar y componer: trabajo/contexto dentro del informe. */
interface Trabajo {
  contexto: string;
  eventos: EventoContexto[];
  datos: Record<string, string>;
  tablas: Record<string, string[][]>;
  tablasSinCabecera: string[];
  traducciones: Record<string, string>;
  campos: CampoPedido[];
  general: string;
  tipoTexto: string;
  plantillaArchivo: string;
  mime: string;
  /** Datos que usa la plantilla (para contar los que faltan). */
  datosUsados: string[];
  carpetaId: string;
  nombre: string;
}

interface CampoHecho {
  texto: string;
  fuentes: string[];
  pendientes: string[];
  fallido: boolean;
}

// ── Pedir un informe ────────────────────────────────────────────────────────

export interface PedidoInforme {
  plantillaId: string;
  /** Informe de un proyecto. */
  codigo?: string;
  /** Informe de conjunto. */
  conjunto?: { tipo: TipoInformeGeneral; sobre: string; estados: EstadoProyecto[]; paises: string[] };
  desde: string;
  hasta: string;
  donanteId: string;
  idioma: Idioma;
  indicaciones: string;
}

const claveTrabajo = (ruta: string) => ruta.replace(/\//g, '~');

/** Crea el informe en cola y devuelve su ruta. Después hay que llamar a avanzarInforme. */
export async function pedirInforme(o: PedidoInforme, autor: Persona): Promise<string> {
  const p = await leerPlantilla(o.plantillaId);
  if (!p || p.estado !== 'activa') throw new Error('Elige una plantilla activa.');
  const deProyecto = DE_PROYECTO.includes(p.tipo);
  if (o.codigo && !deProyecto) throw new Error('Esa plantilla es para informes de conjunto.');
  if (o.conjunto && p.tipo !== o.conjunto.tipo) throw new Error(`Esa plantilla es para «${TIPOS_PLANTILLA[p.tipo]}».`);
  if (!o.codigo && !o.conjunto) throw new Error('Falta el proyecto.');
  if (p.tipo !== 'financiacion' && (!o.desde || !o.hasta || o.desde > o.hasta)) throw new Error('Revisa las fechas del periodo.');

  const ahora = new Date().toISOString();
  const informe: Informe = {
    titulo: `${p.nombre}${o.codigo ? ` ${o.codigo}` : ''}`,
    tipo: p.tipo,
    formato: p.formato,
    sobre: null,
    ...(o.conjunto ? { filtros: { estados: o.conjunto.estados, paises: o.conjunto.paises } } : {}),
    plantilla: { id: p.id, nombre: p.nombre, version: p.version },
    desde: p.tipo === 'financiacion' ? ahora.slice(0, 10) : o.desde,
    hasta: p.tipo === 'financiacion' ? ahora.slice(0, 10) : o.hasta,
    donante: o.donanteId ? { id: o.donanteId, nombre: '' } : null,
    idioma: o.idioma,
    indicaciones: o.indicaciones,
    docId: '',
    url: '',
    pendientes: 0,
    resumen: '',
    hechoPorIA: iaDisponible(),
    estado: 'en_cola',
    progreso: { campos: 0, hechos: 0 },
    intentos: 0,
    creado: ahora,
    creadoPor: autor,
    actualizado: ahora,
  };
  const db = await almacen();
  const coleccion = o.codigo ? `proyectos/${o.codigo}/informes` : 'informes';
  // En los de conjunto, «sobre» guarda el id hasta que se lea su nombre al preparar.
  const id = await db.crear(coleccion, { ...informe, ...(o.conjunto ? { sobre: o.conjunto.sobre ? { id: o.conjunto.sobre, nombre: '' } : null } : {}) });
  const ruta = `${coleccion}/${id}`;
  await db.guardar(`trabajos/${claveTrabajo(ruta)}`, { ruta, tipo: 'informe', lote: '', creado: ahora });
  return ruta;
}

/** Vuelve a poner en marcha un informe con error. Lo ya redactado se conserva. */
export async function reintentarInforme(ruta: string): Promise<void> {
  const db = await almacen();
  const i = await db.leer<Informe>(ruta);
  if (!i || i.estado !== 'error') throw new Error('Ese informe no tiene nada que reintentar.');
  await db.guardar(ruta, { estado: i.docId ? 'componiendo' : 'en_cola', error: '', intentos: 0, bloqueo: '', lote: null, actualizado: new Date().toISOString() }, { fusionar: true });
  await db.guardar(`trabajos/${claveTrabajo(ruta)}`, { ruta, tipo: 'informe', lote: '', creado: new Date().toISOString() });
}

// ── Avanzar ─────────────────────────────────────────────────────────────────

const final = (i: Informe | null) => !i || (i.estado ?? 'listo') === 'listo' || i.estado === 'error';

async function tomar(ruta: string): Promise<boolean> {
  const db = await almacen();
  return db.transaccion(async (tx) => {
    const i = await tx.leer<Informe>(ruta);
    if (final(i) || (i!.bloqueo && i!.bloqueo > new Date().toISOString())) return false;
    tx.guardar(ruta, { ...i!, bloqueo: new Date(Date.now() + BLOQUEO_MS).toISOString() });
    return true;
  });
}

/** Hace el paso que toque (o varios, si son rápidos). No lanza: los errores quedan en el informe. */
export async function avanzarInforme(ruta: string): Promise<void> {
  const inicio = Date.now();
  if (!(await tomar(ruta))) return;
  const db = await almacen();
  try {
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const i = await db.leer<Informe>(ruta);
      if (final(i)) break;
      const antes = i!.estado;
      if (antes === 'en_cola') await preparar(ruta, i!);
      else if (antes === 'redactando') await redactar(ruta, i!);
      else if (antes === 'componiendo') await componer(ruta, i!);
      const despues = await db.leer<Informe>(ruta);
      // Un paso que no cambia de estado está esperando (al lote); un lote recién enviado tampoco
      // se mira enseguida (avisará al terminar). Y no se sigue si ya va largo.
      if (despues?.estado === antes || (despues?.estado === 'redactando' && despues.modo === 'lote') || Date.now() - inicio > 90_000) break;
    }
  } catch (e) {
    await fallo(ruta, e);
  } finally {
    await db.guardar(ruta, { bloqueo: '' }, { fusionar: true }).catch(() => undefined);
  }
}

/** Un fallo pasajero se reintenta en el siguiente aviso; los demás, o tras varios intentos, dejan el informe con error. */
async function fallo(ruta: string, e: unknown) {
  console.error('Informe: error en', ruta, e);
  const db = await almacen();
  const i = await db.leer<Informe>(ruta);
  const pasajero = (e instanceof ErrorIA && e.reintentable) || (e instanceof ErrorDrive && (e.status === 429 || e.status >= 500));
  const intentos = (i?.intentos ?? 0) + 1;
  if (pasajero && intentos < MAX_INTENTOS) {
    await db.guardar(ruta, { intentos, actualizado: new Date().toISOString() }, { fusionar: true });
    return;
  }
  const mensaje = (e instanceof Error ? e.message : String(e)).replace(/https?:\/\/\S+/g, '').slice(0, 300);
  await db.guardar(ruta, { estado: 'error', error: mensaje || 'Algo ha fallado.', intentos, lote: null, actualizado: new Date().toISOString() }, { fusionar: true });
  await db.borrar(`trabajos/${claveTrabajo(ruta)}`).catch(() => undefined);
  if (i?.lote) await lotePorBorrar(i.lote.id);
}

/** Un lote que ya no se va a leer: se borra en OpenRouter ahora o, si aún está en curso, en el cron. */
async function lotePorBorrar(id: string) {
  try {
    await borrarLote(id);
  } catch {
    await (await almacen()).guardar(`lotesPorBorrar/${id}`, { creado: new Date().toISOString() });
  }
}

/** Lo llama el cron: borra en OpenRouter los lotes abandonados (cuando ya han terminado). */
export async function borrarLotesAbandonados(): Promise<number> {
  const db = await almacen();
  let borrados = 0;
  for (const l of await db.consultar('lotesPorBorrar')) {
    try {
      await borrarLote(l.id);
      await db.borrar(`lotesPorBorrar/${l.id}`);
      borrados += 1;
    } catch (e) {
      // 404: ya no existe. Otro error (p. ej. aún en curso): se intenta la noche siguiente.
      if (e instanceof ErrorIA && e.status === 404) await db.borrar(`lotesPorBorrar/${l.id}`);
    }
  }
  return borrados;
}

/** Lo llama el cron: avanza los informes a medias y da por fallidos los que llevan días sin terminar. */
export async function avanzarPendientes(): Promise<{ avanzados: number; caducados: number }> {
  const db = await almacen();
  let avanzados = 0;
  let caducados = 0;
  const inicio = Date.now();
  const limite = new Date(Date.now() - 4 * 86_400_000).toISOString();
  for (const t of await db.consultar<{ ruta: string; creado: string }>('trabajos')) {
    // La función del cron tiene 300 s; lo que no dé tiempo, la noche siguiente.
    if (Date.now() - inicio > 200_000) break;
    if (t.creado < limite) {
      await db.guardar(t.ruta, { estado: 'error', error: 'Lleva varios días sin terminar. Pulsa «Reintentar».' }, { fusionar: true }).catch(() => undefined);
      await db.borrar(`trabajos/${t.id}`);
      caducados += 1;
    } else {
      await avanzarInforme(t.ruta);
      avanzados += 1;
    }
  }
  return { avanzados, caducados };
}

/** Rutas de los informes que esperan a un lote (para el webhook de OpenRouter). */
export async function informesDelLote(lote: string): Promise<string[]> {
  return (await (await almacen()).consultar<{ ruta: string }>('trabajos', { donde: [['lote', '==', lote]] })).map((t) => t.ruta);
}

// ── Pasos ───────────────────────────────────────────────────────────────────

/** Lotes solo si la app tiene una dirección pública a la que OpenRouter pueda avisar (en local y en demo, no). */
function usarLotes(): boolean {
  return config.ia.lotes && /^https:\/\//.test(config.appUrl) && !/localhost|127\.0\.0\.1/.test(config.appUrl);
}

const codigoDe = (ruta: string) => ruta.match(/^proyectos\/([^/]+)\/informes\//)?.[1] ?? '';

async function preparar(ruta: string, i: Informe) {
  const db = await almacen();
  const plantilla = await sincronizarPlantilla(i.plantilla.id, i.creadoPor).catch(() => null);
  if (!plantilla) throw new Error('La plantilla ya no existe.');
  const d = await drive();
  const meta = await d.metadatos(plantilla.archivoId);
  if (!meta) throw new Error('No se encuentra el documento de la plantilla en Drive.');

  const codigo = codigoDe(ruta);
  const ctx = codigo
    ? await contextoProyecto(codigo, { tipo: i.tipo, desde: i.desde, hasta: i.hasta, donanteId: i.donante?.id ?? '', idioma: i.idioma })
    : await contextoConjunto({ tipo: i.tipo as TipoInformeGeneral, sobre: i.sobre?.id ?? '', estados: i.filtros?.estados ?? [], paises: i.filtros?.paises ?? [], desde: i.desde, hasta: i.hasta, idioma: i.idioma });

  const campos: CampoPedido[] = plantilla.estructura.campos
    .filter((c) => c.tipo === 'ia' && !c.huerfano)
    .map((c) => ({ clave: c.clave, instruccion: plantilla.instrucciones.campos[c.clave] ?? '', enLinea: c.enLinea, ...(c.caja ? { caja: c.caja } : {}) }));
  const trabajo: Trabajo = {
    contexto: JSON.stringify(ctx.contexto),
    eventos: ctx.eventos,
    datos: ctx.datos,
    tablas: ctx.tablas,
    tablasSinCabecera: ctx.tablasSinCabecera,
    traducciones: i.idioma !== plantilla.idioma ? await traduccionesDe(plantilla, meta.mime, i.idioma) : {},
    campos,
    general: plantilla.instrucciones.general,
    tipoTexto: TIPOS_PLANTILLA[plantilla.tipo],
    plantillaArchivo: plantilla.archivoId,
    mime: meta.mime,
    datosUsados: plantilla.estructura.datos,
    carpetaId: ctx.carpetaId,
    nombre: ctx.nombre,
  };
  await db.guardar(`${ruta}/trabajo/contexto`, { ...trabajo });

  // Lo ya redactado (en un reintento) no se vuelve a pedir.
  const hechos = new Set((await db.consultar(`${ruta}/campos`)).map((c) => c.id));
  const faltan = campos.filter((c) => !hechos.has(c.clave));
  const cambios: Partial<Informe> = {
    titulo: ctx.nombre,
    progreso: { campos: campos.length, hechos: campos.length - faltan.length },
    actualizado: new Date().toISOString(),
    ...('donante' in ctx ? { donante: ctx.donante } : {}),
    // En el informe para un donante, el donante es el propio «sobre».
    ...('sobre' in ctx ? { sobre: ctx.sobre, donante: i.tipo === 'donante' ? ctx.sobre : null } : {}),
  };

  if (!faltan.length) cambios.estado = 'componiendo';
  else if (!iaDisponible()) {
    // Sin IA (demo sin clave): cada campo queda como hueco con su instrucción, para ver el resultado.
    for (const c of faltan) await guardarCampo(ruta, c, `[PENDIENTE: ${c.instruccion || c.clave}]`, true);
    Object.assign(cambios, { estado: 'componiendo', hechoPorIA: false, progreso: { campos: campos.length, hechos: campos.length } });
  } else if (usarLotes()) {
    const lote = await enviarLote(faltan.map((c) => peticion(trabajo, i, c)), `${config.appUrl.replace(/\/$/, '')}/api/ia/lotes`);
    const ahora = new Date().toISOString();
    Object.assign(cambios, { estado: 'redactando', modo: 'lote', lote: { id: lote, enviado: ahora, comprobado: ahora, reenviado: false } });
    await db.guardar(`trabajos/${claveTrabajo(ruta)}`, { lote }, { fusionar: true });
  } else Object.assign(cambios, { estado: 'redactando', modo: 'directo', lote: null });
  await db.guardar(ruta, cambios, { fusionar: true });
}

function peticion(t: Trabajo, i: Informe, c: CampoPedido) {
  return peticionCampo({
    contexto: t.contexto,
    tipo: t.tipoTexto,
    formato: i.formato === 'slides' ? 'slides' : 'docs',
    idioma: i.idioma,
    general: t.general,
    campo: c,
    otros: t.campos.filter((x) => x.clave !== c.clave),
    indicaciones: i.indicaciones ?? '',
  });
}

async function guardarCampo(ruta: string, c: CampoPedido, texto: string, fallido = false) {
  const leido = leerCampo(texto, c);
  const hecho: CampoHecho = { ...leido, fallido };
  await (await almacen()).guardar(`${ruta}/campos/${c.clave}`, { ...hecho });
}

async function redactar(ruta: string, i: Informe) {
  const db = await almacen();
  const t = await db.leer<Trabajo>(`${ruta}/trabajo/contexto`);
  if (!t) throw new Error('Falta lo preparado para el informe: pulsa «Reintentar».');
  const hechos = new Set((await db.consultar(`${ruta}/campos`)).map((c) => c.id));
  const faltan = t.campos.filter((c) => !hechos.has(c.clave));
  const ahora = new Date().toISOString();

  if (i.modo === 'directo' || !i.lote) {
    // En paralelo; un fallo pasajero se reintenta en el siguiente aviso (lo hecho se conserva).
    let pasajero: unknown = null;
    await Promise.all(
      faltan.map(async (c) => {
        try {
          await guardarCampo(ruta, c, await redactarDirecto(peticion(t, i, c)));
        } catch (e) {
          if (e instanceof ErrorIA && e.reintentable) pasajero = e;
          else await guardarCampo(ruta, c, `[PENDIENTE: redactar «${c.clave}»]`, true);
        }
      }),
    );
    const n = (await db.consultar(`${ruta}/campos`)).length;
    await db.guardar(ruta, { progreso: { campos: t.campos.length, hechos: n }, actualizado: ahora, ...(pasajero ? {} : { estado: 'componiendo' }) }, { fusionar: true });
    if (pasajero) throw pasajero;
    return;
  }

  // Recién creado, OpenRouter tarda un poco en poder consultarlo (responde 404): sigue en curso.
  const reciente = Date.now() - Date.parse(i.lote.enviado) < 10 * 60_000;
  const l = await leerLote(i.lote.id).catch((e) => {
    if (e instanceof ErrorIA && e.status === 404 && reciente) return { estado: 'en_curso' as const, resultados: {} };
    throw e;
  });
  if (l.estado === 'en_curso') {
    await db.guardar(ruta, { lote: { ...i.lote, comprobado: ahora } }, { fusionar: true });
    return;
  }
  const fallidos: CampoPedido[] = [];
  if (l.estado === 'fallido') fallidos.push(...faltan);
  else {
    for (const c of faltan) {
      const r = l.resultados[c.clave];
      if (r?.texto) await guardarCampo(ruta, c, r.texto);
      else fallidos.push(c);
    }
  }
  // Leído: se borra en OpenRouter (y en el proveedor) para no dejar datos allí.
  await borrarLote(i.lote.id).catch((e) => console.error('Lotes: no se pudo borrar', i.lote?.id, e));

  if (fallidos.length && !i.lote.reenviado) {
    const lote = await enviarLote(fallidos.map((c) => peticion(t, i, c)), `${config.appUrl.replace(/\/$/, '')}/api/ia/lotes`);
    await db.guardar(ruta, { lote: { id: lote, enviado: ahora, comprobado: ahora, reenviado: true }, actualizado: ahora }, { fusionar: true });
    await db.guardar(`trabajos/${claveTrabajo(ruta)}`, { lote }, { fusionar: true });
    return;
  }
  for (const c of fallidos) await guardarCampo(ruta, c, `[PENDIENTE: redactar «${c.clave}»]`, true);
  await db.guardar(ruta, { estado: 'componiendo', lote: null, progreso: { campos: t.campos.length, hechos: t.campos.length }, actualizado: ahora }, { fusionar: true });
  await db.guardar(`trabajos/${claveTrabajo(ruta)}`, { lote: '' }, { fusionar: true });
}

async function componer(ruta: string, i: Informe) {
  const db = await almacen();
  const t = await db.leer<Trabajo>(`${ruta}/trabajo/contexto`);
  if (!t) throw new Error('Falta lo preparado para el informe: pulsa «Reintentar».');
  const campos = await db.consultar<CampoHecho>(`${ruta}/campos`);
  const d = await drive();

  const relleno: Relleno = {
    // Un dato que no consta queda como hueco resaltado con lo que es.
    datos: Object.fromEntries(Object.entries(t.datos).map(([k, v]) => [k, v || `[PENDIENTE: ${(DATOS[k]?.descripcion ?? k).toLowerCase()}]`])),
    textos: Object.fromEntries(campos.map((c) => [c.id, c.texto])),
    fotos: {},
    tablas: t.tablas,
    tablasSinCabecera: t.tablasSinCabecera,
    traducciones: t.traducciones,
  };
  const nombre = conFecha(t.nombre);
  let { docId, url } = i;
  let resultado;
  if (t.mime === 'text/html') {
    // Demo: la plantilla es HTML; se rellena y se guarda como archivo nuevo.
    const { html, resultado: r } = rellenarHtml((await d.descargar(t.plantillaArchivo)).bytes.toString('utf8'), relleno);
    docId = (await d.subir(t.carpetaId, `${nombre}.html`, 'text/html', Buffer.from(html))).id;
    url = d.urlDocumento(docId);
    resultado = r;
  } else {
    if (!docId) {
      docId = (await d.copiar(t.plantillaArchivo, t.carpetaId, nombre)).id;
      url = t.mime === ES_PRESENTACION ? d.urlPresentacion(docId) : d.urlDocumento(docId);
      // Se guarda ya: si algo falla después, el reintento sigue con esta copia.
      await db.guardar(ruta, { docId, url }, { fusionar: true });
    }
    resultado = t.mime === ES_PRESENTACION ? await rellenarSlides(docId, relleno) : await rellenarDoc(docId, relleno);
  }

  const vacios = t.datosUsados.filter((k) => k in t.datos && !t.datos[k]).length;
  const pendientes = campos.reduce((s, c) => s + c.pendientes.length, 0) + vacios + resultado.desconocidos.length + resultado.fotosFallidas.length;
  const porId = new Map(t.eventos.map((e) => [e.id, `${e.fecha}: ${e.texto.slice(0, 90)}${e.texto.length > 90 ? '…' : ''}`]));
  const NOMBRES: Record<string, string> = { ficha: 'Ficha del proyecto', financiacion: 'Financiación', solicitud: 'Solicitud', adjunto: 'Archivos adjuntos' };
  const fuentes = Object.fromEntries(campos.map((c) => [c.id, c.fuentes.map((f) => porId.get(f) ?? NOMBRES[f.toLowerCase()] ?? f)]));
  const resumen = await resumirInforme(campos.filter((c) => !c.fallido).map((c) => c.texto));

  const ahora = new Date().toISOString();
  await db.guardar(ruta, { estado: 'listo', titulo: nombre, docId, url, pendientes, fuentes, resumen, lote: null, error: '', actualizado: ahora }, { fusionar: true });

  const codigo = codigoDe(ruta);
  const que = `${i.formato === 'slides' ? 'Presentación' : 'Informe'} «${i.plantilla.nombre}»${i.donante?.nombre ? ` para ${i.donante.nombre}` : ''}`;
  if (codigo) {
    await anotarEvento(codigo, {
      tipo: 'sistema',
      autor: i.creadoPor,
      texto: `Borrador listo: ${que}. Revísalo antes de enviarlo.`,
      enlaces: [{ texto: i.formato === 'slides' ? 'Abrir en Google Slides' : 'Abrir en Google Docs', url }],
    });
  }
  // Con lote puede tardar horas: se avisa en el espacio de los voluntarios.
  if (i.modo === 'lote') await avisarChat(`📝 Borrador listo: ${que}${codigo ? ` (${codigo})` : ''}. Revísalo antes de enviarlo: ${url}`).catch(() => undefined);

  for (const c of campos) await db.borrar(`${ruta}/campos/${c.id}`);
  await db.borrar(`${ruta}/trabajo/contexto`);
  await db.borrar(`trabajos/${claveTrabajo(ruta)}`).catch(() => undefined);
}

/** Traducciones del texto fijo de la plantilla, con caché por plantilla e idioma. */
async function traduccionesDe(p: PlantillaConId, mime: string, idioma: Idioma): Promise<Record<string, string>> {
  if (!iaDisponible()) return {};
  const textos =
    mime === ES_DOC
      ? textosFijos(await leerDoc(p.archivoId))
      : mime === ES_PRESENTACION
        ? textosFijosSlides(await leerSlides(p.archivoId))
        : textosFijosHtml((await (await drive()).descargar(p.archivoId)).bytes.toString('utf8'));
  const db = await almacen();
  const cache = (await db.leer<{ pares: Record<string, string> }>(`plantillas/${p.id}/traducciones/${idioma}`))?.pares ?? {};
  const faltan = textos.filter((t) => !cache[t]);
  if (faltan.length) {
    Object.assign(cache, await traducirTextos(faltan, p.idioma, idioma));
    await db.guardar(`plantillas/${p.id}/traducciones/${idioma}`, { pares: cache, actualizado: new Date().toISOString() });
  }
  return Object.fromEntries(textos.filter((t) => cache[t]).map((t) => [t, cache[t]]));
}
