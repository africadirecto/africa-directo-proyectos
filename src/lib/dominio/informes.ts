// Informes de un proyecto para donantes: borradores en Google Docs o Slides redactados con
// IA a partir de los datos del proyecto. Un voluntario los revisa y los aprueba antes de
// enviarlos. Tipos: seguimiento, final y financiación (para presentar el proyecto a donantes).
//
// Plantillas:
// - Las de la app se crean a partir del contenido (ver informesComun.ts).
// - Cualquier Google Doc o Slides de la unidad «Plantillas» (DRIVE_UNIDAD_PLANTILLAS_ID) con marcadores:
//     {{proyecto.titulo}}                         un dato (ver valoresDatos)
//     {{ia:avance}}                               un apartado redactado por la IA
//     {{ia:avance|150 palabras|Describe la obra}} con extensión e instrucción
//   Se copia en 05_Informes y se sustituyen los marcadores sin tocar el formato.

import { almacen } from '../almacen';
import { drive, conFecha } from '../drive';
import { reemplazar, textoDocumento } from '../drive/docs';
import { reemplazarEnPresentacion, textoPresentacion } from '../drive/slides';
import { redactarInforme, type ApartadoPedido, type Redaccion } from '../ia';
import { ESTADOS } from '../estados';
import { nombrePais } from '../paises';
import { nombreSector } from '../formulario/textos';
import { totalPresupuesto } from '../formulario/respuestas';
import { aportacionesDeProyecto, presupuestoEnEuros, totales } from './aportaciones';
import { anotarEvento, listarEventos } from './eventos';
import { leerIndice } from './indice';
import { leerProyecto } from './proyectos';
import { listarVersiones } from './solicitudes';
import {
  aprobar,
  contarPendientes,
  crearArchivoInforme,
  FACTOR,
  LOCALE,
  notasRevision,
  plantillasDeDrive,
  sinContactos,
  TITULO_NOTAS,
  type Contenido,
  type EventoContexto,
  type InformeConId,
  type PlantillaInforme,
} from './informesComun';
import type { ArchivoProyecto, ExtensionInforme, FormatoInforme, Idioma, Informe, Persona, Proyecto } from '../tipos';

export type { InformeConId, PlantillaInforme };

/** Tipos de informe de un proyecto. */
export type TipoInformeProyecto = 'seguimiento' | 'final' | 'financiacion';

export interface OpcionesInforme {
  plantilla: string;
  formato: FormatoInforme;
  tipo: TipoInformeProyecto;
  desde: string;
  hasta: string;
  donanteId: string;
  idioma: Idioma;
  extension: ExtensionInforme;
  fotos: boolean;
  instrucciones: string;
}

// ── Plantillas de la app ────────────────────────────────────────────────────

const APARTADOS: Record<TipoInformeProyecto, ApartadoPedido[]> = {
  seguimiento: [
    { clave: 'resumen', titulo: 'Resumen del periodo', palabras: 100, instruccion: 'Qué se ha hecho en el periodo y en qué punto está el proyecto.' },
    { clave: 'actividades', titulo: 'Actividades realizadas', palabras: 200, instruccion: 'Avance de las obras o actividades, con las fechas y cifras que consten.' },
    { clave: 'incidencias', titulo: 'Incidencias', palabras: 100, instruccion: 'Problemas o retrasos y cómo se han resuelto. Si no hubo, dilo en una frase.' },
    { clave: 'economia', titulo: 'Situación económica', palabras: 100, instruccion: 'Presupuesto, financiación comprometida y recibida y gastos que consten.' },
    { clave: 'proximos', titulo: 'Próximos pasos', palabras: 80, instruccion: 'Qué falta por hacer y cuándo está previsto.' },
  ],
  final: [
    { clave: 'resumen', titulo: 'Resumen', palabras: 120, instruccion: 'Qué se ha conseguido con el proyecto, en pocas frases.' },
    { clave: 'objetivos', titulo: 'Objetivos y resultados', palabras: 200, instruccion: 'Objetivos de la solicitud y resultados alcanzados, con cifras si constan.' },
    { clave: 'beneficiarios', titulo: 'Beneficiarios', palabras: 100, instruccion: 'Quiénes y cuántos se benefician, sin nombres de personas.' },
    { clave: 'ejecucion', titulo: 'Desarrollo del proyecto', palabras: 200, instruccion: 'Cómo se ha ejecutado: fases, fechas, incidencias y cómo se resolvieron.' },
    { clave: 'economia', titulo: 'Balance económico', palabras: 120, instruccion: 'Presupuesto, financiación recibida por donante y gastos que consten.' },
    { clave: 'sostenibilidad', titulo: 'Sostenibilidad', palabras: 100, instruccion: 'Quién mantiene lo construido o la actividad y cómo.' },
    { clave: 'agradecimiento', titulo: 'Agradecimiento', palabras: 60, instruccion: 'Agradecimiento al donante en nombre de la contraparte y de Africa Directo.' },
  ],
  // Para presentar el proyecto a un posible donante y pedirle que lo apoye.
  financiacion: [
    { clave: 'resumen', titulo: 'El proyecto en breve', palabras: 80, instruccion: 'Qué se quiere hacer, dónde, para quién y cuánto cuesta, en pocas frases.' },
    { clave: 'necesidad', titulo: 'La necesidad', palabras: 150, instruccion: 'El problema que hay hoy y por qué es urgente, con los datos de la solicitud.' },
    { clave: 'propuesta', titulo: 'Qué vamos a hacer', palabras: 150, instruccion: 'Lo que se construirá o hará, el plazo y lo que aporta la comunidad local.' },
    { clave: 'beneficiarios', titulo: 'A quién beneficia', palabras: 80, instruccion: 'Quiénes y cuántos se benefician, sin nombres de personas.' },
    { clave: 'contraparte', titulo: 'Quién lo ejecuta', palabras: 80, instruccion: 'La contraparte local y su trayectoria con Africa Directo (otros proyectos), si consta.' },
    { clave: 'colaborar', titulo: 'Cómo colaborar', palabras: 100, instruccion: 'Presupuesto en euros, lo ya comprometido y lo que falta; cómo puede ayudar el donante. Recuerda que el 100 % llega al proyecto.' },
  ],
};

const ETIQUETAS: Record<Idioma, Record<string, string>> = {
  es: { seguimiento: 'Informe de seguimiento', final: 'Informe final', financiacion: 'Presentación del proyecto', datos: 'Datos del proyecto', codigo: 'Código', pais: 'País', lugar: 'Lugar', contraparte: 'Contraparte', sector: 'Sector', presupuesto: 'Presupuesto', financiado: 'Financiación comprometida', falta: 'Falta por financiar', inicio: 'Inicio', fin: 'Fin previsto', plazo: 'Plazo', periodo: 'Periodo', para: 'Para', fecha: 'Fecha', fotos: 'Fotos', desglose: 'Presupuesto detallado', concepto: 'Concepto', importe: 'Importe', total: 'Total', beneficiarios: 'Beneficiarios', meses: 'meses' },
  fr: { seguimiento: 'Rapport de suivi', final: 'Rapport final', financiacion: 'Présentation du projet', datos: 'Données du projet', codigo: 'Code', pais: 'Pays', lugar: 'Lieu', contraparte: 'Partenaire local', sector: 'Secteur', presupuesto: 'Budget', financiado: 'Financement engagé', falta: 'Reste à financer', inicio: 'Début', fin: 'Fin prévue', plazo: 'Durée', periodo: 'Période', para: 'Pour', fecha: 'Date', fotos: 'Photos', desglose: 'Budget détaillé', concepto: 'Poste', importe: 'Montant', total: 'Total', beneficiarios: 'Bénéficiaires', meses: 'mois' },
  en: { seguimiento: 'Progress report', final: 'Final report', financiacion: 'Project proposal', datos: 'Project details', codigo: 'Code', pais: 'Country', lugar: 'Location', contraparte: 'Local partner', sector: 'Sector', presupuesto: 'Budget', financiado: 'Committed funding', falta: 'Still to fund', inicio: 'Start', fin: 'Planned end', plazo: 'Duration', periodo: 'Period', para: 'For', fecha: 'Date', fotos: 'Photos', desglose: 'Detailed budget', concepto: 'Item', importe: 'Amount', total: 'Total', beneficiarios: 'Beneficiaries', meses: 'months' },
  pt: { seguimiento: 'Relatório de acompanhamento', final: 'Relatório final', financiacion: 'Apresentação do projeto', datos: 'Dados do projeto', codigo: 'Código', pais: 'País', lugar: 'Local', contraparte: 'Parceiro local', sector: 'Setor', presupuesto: 'Orçamento', financiado: 'Financiamento comprometido', falta: 'Falta financiar', inicio: 'Início', fin: 'Fim previsto', plazo: 'Prazo', periodo: 'Período', para: 'Para', fecha: 'Data', fotos: 'Fotografias', desglose: 'Orçamento detalhado', concepto: 'Rubrica', importe: 'Montante', total: 'Total', beneficiarios: 'Beneficiários', meses: 'meses' },
};

export async function listarPlantillas(): Promise<PlantillaInforme[]> {
  const propias: PlantillaInforme[] = (['docs', 'slides'] as FormatoInforme[]).flatMap((formato) => [
    { id: `app:${formato}`, nombre: formato === 'docs' ? 'Documento de la app' : 'Presentación de la app', grupo: 'Plantillas de la app', formato },
  ]);
  return [...propias, ...(await plantillasDeDrive())];
}

export async function listarInformes(codigo: string): Promise<InformeConId[]> {
  return (await almacen()).consultar<InformeConId>(`proyectos/${codigo}/informes`, { orden: ['creado', 'desc'] });
}

/** Fecha de inicio propuesta: el final del último informe o, si no hay, el inicio del proyecto. */
export function desdePropuesto(p: Proyecto, informes: Informe[]): string {
  return (informes[0]?.hasta ?? p.fechas.inicio ?? p.fechas.aprobado ?? p.fechas.creado).slice(0, 10);
}

// ── Contexto para la IA ─────────────────────────────────────────────────────

interface Datos {
  p: Proyecto;
  o: OpcionesInforme;
  donante: { id: string; nombre: string; importe: number } | null;
  fotos: { nombre: string; url: string }[];
  /** Líneas del presupuesto de la última solicitud (en castellano si la IA lo tradujo). */
  lineas: { concepto: string; importe: number | null }[];
  plazoMeses: number | null;
  eventos: EventoContexto[];
  contexto: object;
}

async function reunirDatos(p: Proyecto, o: OpcionesInforme): Promise<Datos> {
  const db = await almacen();
  const [aportaciones, eventos, registros, informes, versiones, indice] = await Promise.all([
    aportacionesDeProyecto(p.codigo),
    listarEventos(p.codigo, 500),
    db.consultar<ArchivoProyecto & { id: string }>(`proyectos/${p.codigo}/archivos`),
    listarInformes(p.codigo),
    listarVersiones(p.codigo),
    o.tipo === 'financiacion' ? leerIndice() : Promise.resolve([]),
  ]);
  const validas = aportaciones.filter((a) => a.estado === 'comprometida' || a.estado === 'recibida');
  const delDonante = validas.filter((a) => a.donanteId === o.donanteId);
  const donante = delDonante.length ? { id: o.donanteId, nombre: delDonante[0].donanteNombre, importe: delDonante.reduce((s, a) => s + a.importe, 0) } : null;
  const { comprometido, recibido } = totales(aportaciones);
  const objetivo = presupuestoEnEuros(p);

  // En la presentación para buscar financiación cuenta toda la historia; en el resto, el periodo.
  const hasta = `${o.hasta}T23:59:59.999Z`;
  const delPeriodo = eventos
    .filter((e) => (o.tipo === 'financiacion' || (e.fecha >= o.desde && e.fecha <= hasta)) && !['sistema', 'revision', 'solicitud'].includes(e.tipo))
    .reverse()
    .slice(-80)
    .map((e, i) => ({ id: `E${i + 1}`, fecha: e.fecha.slice(0, 10), tipo: e.tipo, categoria: e.categoria ?? '', texto: sinContactos(e.texto).slice(0, 1500) }));

  const d = await drive();
  const fotos = o.fotos ? registros.filter((r) => r.esFoto && r.publicable).map((r) => ({ nombre: r.nombre, url: d.urlArchivo(r.id) })) : [];
  const anterior = informes.find((i) => i.tipo === o.tipo) ?? informes[0];
  const v = versiones[0];
  const conceptos = v?.analisis?.traduccion?.conceptos ?? [];
  const lineas = (v?.respuestas.lineas ?? []).map((l, i) => ({ concepto: conceptos[i] || l.concepto, importe: l.importe })).filter((l) => l.concepto || l.importe);
  const otros = indice.filter((f) => f.contraparteId === p.contraparte.id && f.codigo !== p.codigo);

  const contexto = {
    tipoInforme: { seguimiento: 'informe de seguimiento', final: 'informe final', financiacion: 'presentación del proyecto para conseguir financiación' }[o.tipo],
    periodo: o.tipo === 'financiacion' ? null : { desde: o.desde, hasta: o.hasta },
    donante: donante ? { nombre: donante.nombre, aportacionEur: donante.importe } : null,
    proyecto: {
      titulo: p.titulo,
      sector: nombreSector(p.sector),
      pais: nombrePais(p.pais),
      lugar: p.lugar,
      contraparte: p.contraparte.nombre,
      estado: ESTADOS[p.estado].nombre,
      descripcion: sinContactos(p.descripcion || ''),
      resumenSolicitud: sinContactos(p.resumen || ''),
      beneficiarios: sinContactos(p.beneficiarios || ''),
      presupuestoEur: objetivo,
      presupuestoLocal: p.presupuesto,
      monedaLocal: p.moneda,
      comprometidoEur: comprometido,
      recibidoEur: recibido,
      faltaEur: objetivo != null ? Math.max(0, objetivo - comprometido) : null,
      plazoMeses: v?.respuestas.plazoMeses ?? null,
      aportacionLocal: sinContactos(v?.analisis?.traduccion?.aportacionLocal || v?.respuestas.aportacionLocal || ''),
      inicio: p.fechas.inicio?.slice(0, 10) ?? null,
      finPrevisto: p.fechas.finPrevisto?.slice(0, 10) ?? null,
    },
    presupuestoDetallado: lineas.length ? { moneda: v?.respuestas.moneda, lineas } : null,
    otrosProyectosDeLaContraparte: otros.map((f) => ({ titulo: f.titulo, estado: ESTADOS[f.estado].nombre, anio: f.anio })),
    aportaciones: validas.map((a) => ({ donante: a.donanteNombre, importeEur: a.importe, estado: a.estado })),
    eventos: delPeriodo,
    fotosPublicables: fotos.length,
    informeAnterior: anterior ? { fecha: anterior.creado.slice(0, 10), resumen: anterior.resumen } : null,
  };
  return { p, o, donante, fotos, lineas, plazoMeses: v?.respuestas.plazoMeses ?? null, eventos: delPeriodo, contexto };
}

// ── Datos de las plantillas ─────────────────────────────────────────────────

/** Marcadores de datos que se pueden poner en una plantilla de Google Docs o Slides. */
function valoresDatos({ p, o, donante }: Datos): Record<string, string> {
  const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(LOCALE[o.idioma], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }) : '');
  const dinero = (n: number | null | undefined, moneda = 'EUR') =>
    n == null ? '' : new Intl.NumberFormat(LOCALE[o.idioma], { style: 'currency', currency: moneda, maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions).format(n);
  const objetivo = presupuestoEnEuros(p);
  return {
    'proyecto.codigo': p.codigo,
    'proyecto.titulo': p.titulo,
    'proyecto.sector': nombreSector(p.sector, o.idioma),
    'proyecto.pais': nombrePais(p.pais, o.idioma),
    'proyecto.lugar': p.lugar,
    'proyecto.contraparte': p.contraparte.nombre,
    'proyecto.beneficiarios': p.beneficiarios,
    // La financiación va en euros; el presupuesto local es el de la solicitud.
    'proyecto.presupuesto': dinero(objetivo),
    'proyecto.presupuesto_local': dinero(p.presupuesto, p.moneda),
    'proyecto.financiado': dinero(p.comprometido),
    'proyecto.recibido': dinero(p.recibido),
    'proyecto.falta': objetivo != null ? dinero(Math.max(0, objetivo - p.comprometido)) : '',
    'proyecto.moneda': p.moneda,
    'proyecto.inicio': fecha(p.fechas.inicio),
    'proyecto.fin_previsto': fecha(p.fechas.finPrevisto),
    'proyecto.estado': ESTADOS[p.estado].nombre,
    'informe.fecha': fecha(new Date().toISOString()),
    'informe.desde': fecha(o.desde),
    'informe.hasta': fecha(o.hasta),
    'informe.periodo': `${fecha(o.desde)} – ${fecha(o.hasta)}`,
    'donante.nombre': donante?.nombre ?? '',
    'donante.importe': donante ? dinero(donante.importe) : '',
  };
}

/** Interpreta {{ia:clave|150 palabras|instrucción}}. */
function apartadoDeMarcador(interior: string, factor: number): ApartadoPedido {
  const [cabeza, ...resto] = interior.split('|').map((s) => s.trim());
  const clave = cabeza.slice(3).trim() || 'apartado';
  const extension = resto.find((r) => /^\d+\s*palabras?$/i.test(r));
  const instruccion = resto.filter((r) => r !== extension).join(' ') || `Apartado «${clave.replace(/_/g, ' ')}» del informe.`;
  return { clave, titulo: clave.replace(/_/g, ' '), palabras: Math.round((extension ? parseInt(extension, 10) : 120) * factor), instruccion };
}

function contenidoProyecto(datos: Datos, r: Redaccion, notas: string[]): Contenido {
  const { p, o, donante, fotos, lineas, plazoMeses } = datos;
  const t = ETIQUETAS[o.idioma];
  const v = valoresDatos(datos);
  const dineroLocal = (n: number | null) => (n == null ? '' : new Intl.NumberFormat(LOCALE[o.idioma], { maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions).format(n));
  const subtitulo =
    o.tipo === 'financiacion'
      ? [p.titulo, `${t.fecha}: ${v['informe.fecha']}`].join(' · ')
      : [p.titulo, `${t.periodo}: ${v['informe.periodo']}`, donante ? `${t.para}: ${donante.nombre}` : '', `${t.fecha}: ${v['informe.fecha']}`].filter(Boolean).join(' · ');
  const filas: [string, string][] = [
    [t.codigo, p.codigo],
    [t.pais, v['proyecto.pais']],
    [t.lugar, p.lugar],
    [t.contraparte, p.contraparte.nombre],
    [t.sector, v['proyecto.sector']],
    [t.beneficiarios, o.tipo === 'financiacion' ? p.beneficiarios : ''],
    [t.presupuesto, v['proyecto.presupuesto']],
    [t.financiado, v['proyecto.financiado']],
    [t.falta, o.tipo === 'financiacion' ? v['proyecto.falta'] : ''],
    [t.plazo, o.tipo === 'financiacion' && plazoMeses ? `${plazoMeses} ${t.meses}` : ''],
    [t.inicio, o.tipo === 'financiacion' ? '' : v['proyecto.inicio']],
    [t.fin, o.tipo === 'financiacion' ? '' : v['proyecto.fin_previsto']],
  ].filter(([, x]) => x) as [string, string][];
  const monedaLineas = p.moneda;
  return {
    titulo: o.tipo === 'financiacion' ? p.titulo : t[o.tipo],
    subtitulo: o.tipo === 'financiacion' ? `${t.financiacion} · Africa Directo` : subtitulo,
    datos: { titulo: t.datos, filas },
    apartados: r.apartados.map((a) => ({ titulo: a.titulo, texto: a.texto })),
    tablas:
      o.tipo === 'financiacion' && lineas.length
        ? [
            {
              titulo: `${t.desglose} (${monedaLineas})`,
              filas: [[t.concepto, t.importe], ...lineas.map((l) => [l.concepto, dineroLocal(l.importe)]), [t.total, dineroLocal(totalPresupuesto(lineas))]],
            },
          ]
        : [],
    porProyecto: [],
    enlaces: fotos.length ? { titulo: t.fotos, lista: fotos.map((f) => ({ texto: f.nombre, url: f.url })) } : null,
    notas,
  };
}

// ── Generación ──────────────────────────────────────────────────────────────

export async function generarInforme(codigo: string, o: OpcionesInforme, autor: Persona): Promise<InformeConId> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  if (!p.drive) throw new Error('El proyecto no tiene carpeta en Drive.');
  if (o.tipo !== 'financiacion' && (!o.desde || !o.hasta || o.desde > o.hasta)) throw new Error('Revisa las fechas del periodo.');

  const plantilla = (await listarPlantillas()).find((x) => x.id === o.plantilla && x.formato === o.formato);
  if (!plantilla) throw new Error('Elige una plantilla.');

  const datos = await reunirDatos(p, o);
  const factor = FACTOR[o.extension];
  const d = await drive();
  const etiqueta = { seguimiento: 'de seguimiento', final: 'final', financiacion: 'de financiación' }[o.tipo];
  const clase = o.formato === 'slides' ? 'Presentación' : 'Informe';
  const nombre = conFecha(`${clase} ${etiqueta} ${p.codigo}${datos.donante ? ` - ${datos.donante.nombre}` : ''}`);
  const carpeta = p.drive.subcarpetas.informes;

  let archivo: { id: string; url: string };
  let r: Redaccion;
  let notas: string[];
  if (plantilla.id.startsWith('app:')) {
    const pedidos = APARTADOS[o.tipo].map((a) => ({ ...a, palabras: Math.round(a.palabras * factor) }));
    r = await redactarInforme(datos.contexto, pedidos, o.idioma, o.instrucciones, { formato: o.formato });
    notas = notasRevision(r, datos.eventos);
    archivo = await crearArchivoInforme(contenidoProyecto(datos, r, notas), o.formato, carpeta, nombre);
  } else {
    // Plantilla propia: copia, lectura de marcadores, redacción y sustitución.
    const esPresentacion = plantilla.id.startsWith('pres:');
    const id = (await d.copiar(plantilla.id.slice(plantilla.id.indexOf(':') + 1), carpeta, nombre)).id;
    archivo = { id, url: esPresentacion ? d.urlPresentacion(id) : d.urlDocumento(id) };
    const texto = esPresentacion ? await textoPresentacion(id) : await textoDocumento(id);
    const marcadores = [...new Set([...texto.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]))];
    const valores = valoresDatos(datos);
    const pedidos = marcadores.filter((m) => m.trim().toLowerCase().startsWith('ia:')).map((m) => apartadoDeMarcador(m, factor));
    r = await redactarInforme(datos.contexto, pedidos, o.idioma, o.instrucciones, { formato: o.formato });
    const desconocidos = marcadores.filter((m) => !m.trim().toLowerCase().startsWith('ia:') && !(m.trim() in valores));
    notas = notasRevision(r, datos.eventos, desconocidos.length ? [`Marcadores que la app no conoce y se han dejado tal cual: ${desconocidos.map((m) => `{{${m}}}`).join(', ')}`] : []);
    const porClave = new Map(r.apartados.map((a) => [a.clave, a.texto.replace(/\n\s*\n/g, '\n')]));
    const pares: [string, string][] = marcadores.flatMap((m): [string, string][] => {
      const limpio = m.trim();
      if (limpio.toLowerCase().startsWith('ia:')) return [[`{{${m}}}`, porClave.get(apartadoDeMarcador(limpio, factor).clave) ?? '']];
      return limpio in valores ? [[`{{${m}}}`, valores[limpio]]] : [];
    });
    if (esPresentacion) {
      // En una presentación no se añade texto al final: las notas quedan en la app.
      await reemplazarEnPresentacion(id, pares);
    } else {
      const fotos = datos.fotos.length ? ['', ETIQUETAS[o.idioma].fotos.toUpperCase(), ...datos.fotos.map((f) => `• ${f.nombre}: ${f.url}`)] : [];
      await reemplazar(id, pares, ['', '', ...fotos, '', TITULO_NOTAS, ...notas].join('\n'));
    }
  }

  const informe: Informe = {
    titulo: nombre,
    tipo: o.tipo,
    formato: o.formato,
    plantilla: { id: plantilla.id, nombre: plantilla.nombre },
    desde: o.tipo === 'financiacion' ? new Date().toISOString().slice(0, 10) : o.desde,
    hasta: o.tipo === 'financiacion' ? new Date().toISOString().slice(0, 10) : o.hasta,
    donante: datos.donante ? { id: datos.donante.id, nombre: datos.donante.nombre } : null,
    idioma: o.idioma,
    extension: o.extension,
    docId: archivo.id,
    url: archivo.url,
    estado: 'borrador',
    pendientes: contarPendientes(r),
    notas,
    resumen: r.resumen,
    hechoPorIA: r.hechoPorIA,
    creado: new Date().toISOString(),
    creadoPor: autor,
  };
  const id = await (await almacen()).crear(`proyectos/${codigo}/informes`, { ...informe });
  await anotarEvento(codigo, {
    tipo: 'sistema',
    autor,
    texto: `Borrador: ${clase.toLowerCase()} ${etiqueta}${informe.donante ? ` para ${informe.donante.nombre}` : ''} (${plantilla.nombre}). Revísalo y apruébalo antes de enviarlo.`,
    enlaces: [{ texto: o.formato === 'slides' ? 'Abrir en Google Slides' : 'Abrir en Google Docs', url: informe.url }],
  });
  return { ...informe, id };
}

export async function aprobarInforme(codigo: string, id: string, autor: Persona): Promise<void> {
  const informe = await aprobar(`proyectos/${codigo}/informes/${id}`, autor);
  await anotarEvento(codigo, { tipo: 'sistema', autor, texto: `Informe aprobado: ${informe.titulo}.`, enlaces: [{ texto: 'Abrir', url: informe.url }] });
}
