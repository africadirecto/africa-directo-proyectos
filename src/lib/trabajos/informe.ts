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
import { config, modoDemo } from '../config';
import { urlFoto } from '../enlaces';
import { conFecha, drive } from '../drive';
import { ES_DOC, ES_PRESENTACION, ErrorDrive } from '../drive/tipos';
import { leerDoc, rellenarDoc, textosFijos } from '../drive/plantillaDocs';
import { leerSlides, rellenarSlides, textosFijosSlides } from '../drive/plantillaSlides';
import { rellenarHtml, textosFijosHtml } from '../drive/plantillaHtml';
import { avisarChat } from '../avisos';
import { iaDisponible } from '../ia';
import { ErrorIA } from '../ia/openrouter';
import { borrarLote, enviarLote, leerLote } from '../ia/lotes';
import { apuntarLote, apuntarTrabajo, loteReciente, lotePorBorrar, quitarTrabajo, urlAviso, usarLotes } from './comun';
import { asignarFotos, leerCampo, peticionCampo, redactarDirecto, resumirInforme, traducirTextos, type CampoPedido, type HuecoFoto } from '../ia/informes';
import { DATOS, type Relleno } from '../dominio/marcadores';
import { anotarEvento } from '../dominio/eventos';
import { materialesDelProyecto } from '../dominio/archivos';
import { leerProyecto } from '../dominio/proyectos';
import { nombrePais } from '../paises';
import { nombreSector } from '../formulario/textos';
import { leerAdjuntos, prepararFotos, type FotoTrabajo } from './materiales';
import { contextoProyecto } from '../dominio/informes';
import { contextoResumen } from '../dominio/informesGenerales';
import { carpetaPlantillas, leerPlantilla, sincronizarPlantilla, TIPOS_PLANTILLA, type PlantillaConId } from '../dominio/plantillas';
import type { EventoContexto } from '../dominio/informesComun';
import type { EstadoProyecto, Idioma, Informe, Persona } from '../tipos';

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
  /** Fotos publicables para los huecos de foto de la plantilla, con su descripción. */
  fotos: FotoTrabajo[];
  huecosFoto: HuecoFoto[];
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
  /** Resumen de varios proyectos: los filtros con que se eligen. */
  resumen?: { estados: EstadoProyecto[]; paises: string[] };
  desde: string;
  hasta: string;
  donanteId: string;
  idioma: Idioma;
  indicaciones: string;
  /** Fotos elegidas por el voluntario; sin elegir, las elige la app. */
  fotos?: string[] | null;
  /** Archivos del proyecto cuyo texto se da a la IA como contexto. */
  adjuntos?: string[];
  /** Prueba de una plantilla: va aparte, no a la ficha del proyecto. */
  prueba?: boolean;
}

/** Crea el informe en cola y devuelve su ruta. Después hay que llamar a avanzarInforme. */
export async function pedirInforme(o: PedidoInforme, autor: Persona): Promise<string> {
  const p = await leerPlantilla(o.plantillaId);
  if (!p || p.estado !== 'activa') throw new Error(p?.estado === 'archivada' ? 'Esa plantilla está archivada.' : 'Esa plantilla aún no está lista.');
  if (o.prueba && !o.codigo) throw new Error('Elige el proyecto con el que probarla.');
  if (!o.codigo && !o.resumen) throw new Error('Falta el proyecto.');
  if (p.tipo !== (o.codigo ? 'proyecto' : 'resumen')) throw new Error(`Esa plantilla es para «${TIPOS_PLANTILLA[p.tipo]}».`);
  if (!o.desde || !o.hasta || o.desde > o.hasta) throw new Error('Revisa las fechas del periodo.');

  const ahora = new Date().toISOString();
  const informe: Informe = {
    titulo: `${p.nombre}${o.codigo ? ` ${o.codigo}` : ''}`,
    tipo: p.tipo,
    formato: p.formato,
    ...(o.resumen ? { filtros: { estados: o.resumen.estados, paises: o.resumen.paises } } : {}),
    plantilla: { id: p.id, nombre: p.nombre, version: p.version },
    desde: o.desde,
    hasta: o.hasta,
    donante: o.donanteId ? { id: o.donanteId, nombre: '' } : null,
    idioma: o.idioma,
    indicaciones: o.indicaciones,
    fotos: o.fotos ?? null,
    adjuntos: o.adjuntos ?? [],
    docId: '',
    url: '',
    pendientes: 0,
    resumen: '',
    hechoPorIA: await iaDisponible(),
    estado: 'en_cola',
    progreso: { campos: 0, hechos: 0 },
    intentos: 0,
    creado: ahora,
    creadoPor: autor,
    actualizado: ahora,
  };
  const db = await almacen();
  // Las pruebas van en «informes» (no en la ficha del proyecto), con el proyecto en «prueba».
  const coleccion = o.codigo && !o.prueba ? `proyectos/${o.codigo}/informes` : 'informes';
  const id = await db.crear(coleccion, { ...informe, ...(o.prueba ? { prueba: { codigo: o.codigo } } : {}) });
  const ruta = `${coleccion}/${id}`;
  await apuntarTrabajo(ruta, 'informe');
  return ruta;
}

/** Vuelve a poner en marcha un informe con error. Lo ya redactado se conserva. */
export async function reintentarInforme(ruta: string): Promise<void> {
  const db = await almacen();
  const i = await db.leer<Informe>(ruta);
  if (!i || i.estado !== 'error') throw new Error('Ese informe no tiene nada que reintentar.');
  await db.guardar(ruta, { estado: i.docId ? 'componiendo' : 'en_cola', error: '', intentos: 0, bloqueo: '', lote: null, actualizado: new Date().toISOString() }, { fusionar: true });
  await apuntarTrabajo(ruta, 'informe');
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
  await quitarTrabajo(ruta);
  if (i?.lote) await lotePorBorrar(i.lote.id);
}

// ── Pasos ───────────────────────────────────────────────────────────────────

/** El proyecto de un informe guardado en su ficha (las pruebas no lo están: codigoDeInforme). */
const codigoDe = (ruta: string) => ruta.match(/^proyectos\/([^/]+)\/informes\//)?.[1] ?? '';
/** El proyecto cuyos datos usa el informe, también en las pruebas de una plantilla. */
const codigoDeInforme = (ruta: string, i: Informe) => i.prueba?.codigo ?? codigoDe(ruta);

async function preparar(ruta: string, i: Informe) {
  const db = await almacen();
  const plantilla = await sincronizarPlantilla(i.plantilla.id, i.creadoPor).catch(() => null);
  if (!plantilla) throw new Error('La plantilla ya no existe.');
  const d = await drive();
  const meta = await d.metadatos(plantilla.archivoId);
  if (!meta) throw new Error('No se encuentra el documento de la plantilla en Drive.');

  const codigo = codigoDeInforme(ruta, i);
  const ctx = codigo
    ? await contextoProyecto(codigo, { plantilla: plantilla.nombre, desde: i.desde, hasta: i.hasta, donanteId: i.donante?.id ?? '', idioma: i.idioma })
    : { ...(await contextoResumen({ plantilla: plantilla.nombre, estados: i.filtros?.estados ?? [], paises: i.filtros?.paises ?? [], desde: i.desde, hasta: i.hasta, idioma: i.idioma })), donante: null };

  const campos: CampoPedido[] = plantilla.estructura.campos
    .filter((c) => c.tipo === 'ia' && !c.huerfano)
    .map((c) => ({ clave: c.clave, instruccion: plantilla.instrucciones.campos[c.clave] ?? '', enLinea: c.enLinea, ...(c.caja ? { caja: c.caja } : {}) }));

  // Fotos y adjuntos, solo en los informes de un proyecto.
  const huecosFoto: HuecoFoto[] = plantilla.estructura.campos
    .filter((c) => (c.tipo === 'foto' || c.tipo === 'fotos') && !c.huerfano)
    .map((c) => ({ clave: c.clave, tipo: c.tipo as 'foto' | 'fotos', instruccion: plantilla.instrucciones.campos[c.clave] ?? '' }));
  let fotos: FotoTrabajo[] = [];
  let adjuntos: { nombre: string; texto: string }[] = [];
  if (codigo && (huecosFoto.length || i.adjuntos?.length)) {
    const p = await leerProyecto(codigo);
    const materiales = p ? await materialesDelProyecto(p) : { fotos: [], archivos: [] };
    if (p && huecosFoto.length) {
      fotos = await prepararFotos(codigo, materiales.fotos, i.fotos, { desde: i.desde, hasta: i.hasta, pista: `Proyecto de ${nombreSector(p.sector).toLowerCase()} en ${nombrePais(p.pais)}: ${p.titulo}` });
    }
    if (i.adjuntos?.length) adjuntos = await leerAdjuntos(materiales.archivos, i.adjuntos);
  }

  const trabajo: Trabajo = {
    // Lo que va a la IA: los datos y, si los hay, el texto de los adjuntos (nunca las fotos).
    contexto: JSON.stringify(adjuntos.length ? { ...ctx.contexto, adjuntos } : ctx.contexto),
    eventos: ctx.eventos,
    datos: ctx.datos,
    tablas: ctx.tablas,
    tablasSinCabecera: ctx.tablasSinCabecera,
    traducciones: i.idioma !== plantilla.idioma ? await traduccionesDe(plantilla, meta.mime, i.idioma) : {},
    campos,
    general: plantilla.instrucciones.general,
    // El tipo de informe lo dice el nombre de la plantilla (y su descripción, si la tiene).
    tipoTexto: [plantilla.nombre, plantilla.descripcion].filter(Boolean).join(': '),
    plantillaArchivo: plantilla.archivoId,
    mime: meta.mime,
    datosUsados: plantilla.estructura.datos,
    fotos,
    huecosFoto,
    // Las pruebas de una plantilla, en su unidad, no en la carpeta del proyecto.
    carpetaId: i.prueba ? await carpetaPlantillas('_Pruebas') : ctx.carpetaId,
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
    donante: ctx.donante,
  };

  if (!faltan.length) cambios.estado = 'componiendo';
  else if (!(await iaDisponible())) {
    // Sin IA (demo sin clave): cada campo queda como hueco con su instrucción, para ver el resultado.
    for (const c of faltan) await guardarCampo(ruta, c, `[PENDIENTE: ${c.instruccion || c.clave}]`, true);
    Object.assign(cambios, { estado: 'componiendo', hechoPorIA: false, progreso: { campos: campos.length, hechos: campos.length } });
  } else if (await usarLotes()) {
    const lote = await enviarLote(faltan.map((c) => peticion(trabajo, i, c)), urlAviso());
    const ahora = new Date().toISOString();
    Object.assign(cambios, { estado: 'redactando', modo: 'lote', lote: { id: lote, enviado: ahora, comprobado: ahora, reenviado: false } });
    await apuntarLote(ruta, lote);
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
  const l = await leerLote(i.lote.id).catch((e) => {
    if (loteReciente(i.lote!.enviado, e)) return { estado: 'en_curso' as const, resultados: {} };
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
    const lote = await enviarLote(fallidos.map((c) => peticion(t, i, c)), urlAviso());
    await db.guardar(ruta, { lote: { id: lote, enviado: ahora, comprobado: ahora, reenviado: true }, actualizado: ahora }, { fusionar: true });
    await apuntarLote(ruta, lote);
    return;
  }
  for (const c of fallidos) await guardarCampo(ruta, c, `[PENDIENTE: redactar «${c.clave}»]`, true);
  await db.guardar(ruta, { estado: 'componiendo', lote: null, progreso: { campos: t.campos.length, hechos: t.campos.length }, actualizado: ahora }, { fusionar: true });
  await apuntarLote(ruta, '');
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
    fotos: await fotosDelRelleno(t, i, codigoDeInforme(ruta, i)),
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
      tipo: 'informe',
      autor: i.creadoPor,
      texto: `Borrador listo: ${que}. Revísalo antes de enviarlo.`,
      enlaces: [{ texto: i.formato === 'slides' ? 'Abrir en Google Slides' : 'Abrir en Google Docs', url }],
    });
  }
  // Con lote puede tardar horas: se avisa en el espacio de los voluntarios.
  if (i.modo === 'lote' && !i.prueba) await avisarChat(`📝 Borrador listo: ${que}${codigo ? ` (${codigo})` : ''}. Revísalo antes de enviarlo: ${url}`).catch(() => undefined);

  for (const c of campos) await db.borrar(`${ruta}/campos/${c.id}`);
  await db.borrar(`${ruta}/trabajo/contexto`);
  await quitarTrabajo(ruta);
}

/**
 * Qué foto va en cada hueco y su dirección. Google descarga las fotos de /api/foto con un enlace
 * que caduca; en demo, el HTML las muestra desde el Drive local.
 */
async function fotosDelRelleno(t: Trabajo, i: Informe, codigo: string): Promise<Relleno['fotos']> {
  if (!codigo || !t.fotos?.length || !t.huecosFoto?.length) return {};
  const d = await drive();
  const asignacion = await asignarFotos(t.fotos.map((f) => ({ id: f.id, fecha: f.fecha, descripcion: f.descripcion })), t.huecosFoto, i.idioma);
  const porId = new Map(t.fotos.map((f) => [f.id, f]));
  return Object.fromEntries(
    Object.entries(asignacion).map(([clave, lista]) => [
      clave,
      lista.flatMap((x) => {
        const f = porId.get(x.id);
        return f ? [{ url: modoDemo ? d.urlArchivo(f.id) : urlFoto(codigo, f.id), nombre: f.nombre, pie: x.pie, ...(f.ancho && f.alto ? { ancho: f.ancho, alto: f.alto } : {}) }] : [];
      }),
    ]),
  );
}

/** Traducciones del texto fijo de la plantilla, con caché por plantilla e idioma. */
async function traduccionesDe(p: PlantillaConId, mime: string, idioma: Idioma): Promise<Record<string, string>> {
  if (!(await iaDisponible())) return {};
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
