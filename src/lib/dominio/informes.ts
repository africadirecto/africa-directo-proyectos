// Informes para donantes: borradores en Google Docs redactados con IA a partir de los
// datos del proyecto. Un voluntario los revisa y los aprueba antes de enviarlos.
//
// Plantillas:
// - Las dos de la app (seguimiento y final) se crean como Google Doc a partir de HTML.
// - Cualquier Google Doc de la unidad «Plantillas» (DRIVE_UNIDAD_PLANTILLAS_ID) con marcadores:
//     {{proyecto.titulo}}                         un dato (ver DATOS más abajo)
//     {{ia:avance}}                               un apartado redactado por la IA
//     {{ia:avance|150 palabras|Describe la obra}} con extensión e instrucción
//   Se copia en 05_Informes y se sustituyen los marcadores sin tocar el formato.

import { almacen } from '../almacen';
import { config } from '../config';
import { drive, conFecha } from '../drive';
import { reemplazar, textoDocumento } from '../drive/docs';
import { redactarInforme, type ApartadoPedido, type Redaccion } from '../ia';
import { ESTADOS } from '../estados';
import { nombrePais } from '../paises';
import { nombreSector } from '../formulario/textos';
import { aportacionesDeProyecto, totales } from './aportaciones';
import { anotarEvento, listarEventos } from './eventos';
import { leerProyecto } from './proyectos';
import type { ArchivoProyecto, ExtensionInforme, Idioma, Informe, Persona, Proyecto, TipoInforme } from '../tipos';

export type InformeConId = Informe & { id: string };

export interface PlantillaInforme {
  id: string;
  nombre: string;
  grupo: string;
}

export interface OpcionesInforme {
  plantilla: string;
  tipo: TipoInforme;
  desde: string;
  hasta: string;
  donanteId: string;
  idioma: Idioma;
  extension: ExtensionInforme;
  fotos: boolean;
  instrucciones: string;
}

const LOCALE: Record<Idioma, string> = { es: 'es-ES', fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT' };
const FACTOR: Record<ExtensionInforme, number> = { breve: 0.6, normal: 1, detallado: 1.6 };

// ── Plantillas de la app ────────────────────────────────────────────────────

const APARTADOS: Record<TipoInforme, ApartadoPedido[]> = {
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
};

const ETIQUETAS: Record<Idioma, Record<string, string>> = {
  es: { seguimiento: 'Informe de seguimiento', final: 'Informe final', datos: 'Datos del proyecto', codigo: 'Código', pais: 'País', lugar: 'Lugar', contraparte: 'Contraparte', sector: 'Sector', presupuesto: 'Presupuesto', financiado: 'Financiación comprometida', inicio: 'Inicio', fin: 'Fin previsto', periodo: 'Periodo', para: 'Para', fecha: 'Fecha', fotos: 'Fotos' },
  fr: { seguimiento: 'Rapport de suivi', final: 'Rapport final', datos: 'Données du projet', codigo: 'Code', pais: 'Pays', lugar: 'Lieu', contraparte: 'Partenaire local', sector: 'Secteur', presupuesto: 'Budget', financiado: 'Financement engagé', inicio: 'Début', fin: 'Fin prévue', periodo: 'Période', para: 'Pour', fecha: 'Date', fotos: 'Photos' },
  en: { seguimiento: 'Progress report', final: 'Final report', datos: 'Project details', codigo: 'Code', pais: 'Country', lugar: 'Location', contraparte: 'Local partner', sector: 'Sector', presupuesto: 'Budget', financiado: 'Committed funding', inicio: 'Start', fin: 'Planned end', periodo: 'Period', para: 'For', fecha: 'Date', fotos: 'Photos' },
  pt: { seguimiento: 'Relatório de acompanhamento', final: 'Relatório final', datos: 'Dados do projeto', codigo: 'Código', pais: 'País', lugar: 'Local', contraparte: 'Parceiro local', sector: 'Setor', presupuesto: 'Orçamento', financiado: 'Financiamento comprometido', inicio: 'Início', fin: 'Fim previsto', periodo: 'Período', para: 'Para', fecha: 'Data', fotos: 'Fotografias' },
};

export async function listarPlantillas(): Promise<PlantillaInforme[]> {
  const propias: PlantillaInforme[] = [
    { id: 'app:seguimiento', nombre: 'Informe de seguimiento', grupo: 'Plantillas de la app' },
    { id: 'app:final', nombre: 'Informe final', grupo: 'Plantillas de la app' },
  ];
  if (!config.drive.unidadPlantillas) return propias;
  try {
    const docs = await (await drive()).documentosDeUnidad(config.drive.unidadPlantillas);
    const deDrive = docs
      .map((d) => ({ id: `doc:${d.id}`, nombre: d.nombre, grupo: d.ruta ? `Plantillas · ${d.ruta}` : 'Plantillas' }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
    return [...propias, ...deDrive];
  } catch (e) {
    console.error('Drive: no se pudieron leer las plantillas', e);
    return propias;
  }
}

export async function listarInformes(codigo: string): Promise<InformeConId[]> {
  return (await almacen()).consultar<InformeConId>(`proyectos/${codigo}/informes`, { orden: ['creado', 'desc'] });
}

/** Fecha de inicio propuesta: el final del último informe o, si no hay, el inicio del proyecto. */
export function desdePropuesto(p: Proyecto, informes: Informe[]): string {
  return (informes[0]?.hasta ?? p.fechas.inicio ?? p.fechas.aprobado ?? p.fechas.creado).slice(0, 10);
}

// ── Contexto para la IA ─────────────────────────────────────────────────────

/** Quita correos y teléfonos de los textos que van a la IA. */
const sinContactos = (t: string) =>
  t.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[correo]').replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[teléfono]' : m));

interface Datos {
  p: Proyecto;
  o: OpcionesInforme;
  donante: { id: string; nombre: string; importe: number } | null;
  fotos: { nombre: string; url: string }[];
  anterior: Informe | undefined;
}

async function reunirDatos(p: Proyecto, o: OpcionesInforme): Promise<Datos & { contexto: object }> {
  const db = await almacen();
  const [aportaciones, eventos, registros, informes] = await Promise.all([
    aportacionesDeProyecto(p.codigo),
    listarEventos(p.codigo, 500),
    db.consultar<ArchivoProyecto & { id: string }>(`proyectos/${p.codigo}/archivos`),
    listarInformes(p.codigo),
  ]);
  const validas = aportaciones.filter((a) => a.estado === 'comprometida' || a.estado === 'recibida');
  const delDonante = validas.filter((a) => a.donanteId === o.donanteId);
  const donante = delDonante.length ? { id: o.donanteId, nombre: delDonante[0].donanteNombre, importe: delDonante.reduce((s, a) => s + a.importeProyecto, 0) } : null;
  const { comprometido, recibido } = totales(aportaciones);

  const hasta = `${o.hasta}T23:59:59.999Z`;
  const delPeriodo = eventos
    .filter((e) => e.fecha >= o.desde && e.fecha <= hasta && !['sistema', 'revision', 'solicitud'].includes(e.tipo))
    .reverse()
    .map((e, i) => ({ id: `E${i + 1}`, fecha: e.fecha.slice(0, 10), tipo: e.tipo, categoria: e.categoria ?? '', texto: sinContactos(e.texto).slice(0, 1500) }));

  const d = await drive();
  const fotos = o.fotos ? registros.filter((r) => r.esFoto && r.publicable).map((r) => ({ nombre: r.nombre, url: d.urlArchivo(r.id) })) : [];
  const anterior = informes[0];

  const contexto = {
    tipoInforme: o.tipo === 'final' ? 'informe final' : 'informe de seguimiento',
    periodo: { desde: o.desde, hasta: o.hasta },
    donante: donante ? { nombre: donante.nombre, aportacion: donante.importe, moneda: p.moneda } : null,
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
      presupuesto: p.presupuesto,
      moneda: p.moneda,
      comprometido,
      recibido,
      inicio: p.fechas.inicio?.slice(0, 10) ?? null,
      finPrevisto: p.fechas.finPrevisto?.slice(0, 10) ?? null,
    },
    aportaciones: validas.map((a) => ({ donante: a.donanteNombre, importe: a.importeProyecto, estado: a.estado })),
    eventos: delPeriodo,
    fotosPublicables: fotos.length,
    informeAnterior: anterior ? { fecha: anterior.creado.slice(0, 10), resumen: anterior.resumen } : null,
  };
  return { p, o, donante, fotos, anterior, contexto };
}

// ── Datos de las plantillas ─────────────────────────────────────────────────

/** Marcadores de datos que se pueden poner en una plantilla de Google Docs. */
function valoresDatos({ p, o, donante }: Datos): Record<string, string> {
  const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(LOCALE[o.idioma], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }) : '');
  const dinero = (n: number | null | undefined) =>
    n == null ? '' : new Intl.NumberFormat(LOCALE[o.idioma], { style: 'currency', currency: p.moneda, maximumFractionDigits: 0 }).format(n);
  return {
    'proyecto.codigo': p.codigo,
    'proyecto.titulo': p.titulo,
    'proyecto.sector': nombreSector(p.sector, o.idioma),
    'proyecto.pais': nombrePais(p.pais, o.idioma),
    'proyecto.lugar': p.lugar,
    'proyecto.contraparte': p.contraparte.nombre,
    'proyecto.beneficiarios': p.beneficiarios,
    'proyecto.presupuesto': dinero(p.presupuesto),
    'proyecto.financiado': dinero(p.comprometido),
    'proyecto.recibido': dinero(p.recibido),
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

/** Notas para quien revisa: lo pendiente y de dónde sale cada apartado. Van al final y se borran antes de enviar. */
function notas(r: Redaccion, eventos: { id: string; fecha: string; texto: string }[]): string[] {
  const porId = new Map(eventos.map((e) => [e.id, e]));
  const lineas = ['NOTAS PARA LA REVISIÓN (borra esta parte antes de enviar el informe)'];
  if (!r.hechoPorIA) lineas.push('Sin IA: los apartados están sin redactar.');
  if (r.pendientes.length) lineas.push('', 'Pendiente de completar o comprobar:', ...r.pendientes.map((x) => `• ${x}`));
  const fuentes = r.apartados.filter((a) => a.fuentes.length);
  if (fuentes.length) {
    lineas.push('', 'De dónde sale cada apartado:');
    for (const a of fuentes) {
      const detalle = a.fuentes.map((f) => {
        const e = porId.get(f);
        return e ? `${f} (${e.fecha}: ${e.texto.slice(0, 80)}${e.texto.length > 80 ? '…' : ''})` : f;
      });
      lineas.push(`• ${a.titulo}: ${detalle.join('; ')}`);
    }
  }
  return lineas;
}

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parrafos = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${escapar(x).replace(/\n/g, '<br>')}</p>`)
    .join('');

function htmlInforme(datos: Datos, r: Redaccion, eventos: { id: string; fecha: string; texto: string }[]): string {
  const { p, o, donante, fotos } = datos;
  const t = ETIQUETAS[o.idioma];
  const v = valoresDatos(datos);
  const fila = (k: string, valor: string) => (valor ? `<tr><td style="color:#5e5d57;padding:4px 16px 4px 0">${escapar(k)}</td><td style="padding:4px 0">${escapar(valor)}</td></tr>` : '');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5">
<p style="color:#b8360b;font-weight:bold;margin:0">Africa Directo · el 100 % llega</p>
<h1 style="font-size:20pt;margin:6pt 0 2pt">${escapar(t[o.tipo])}</h1>
<p style="font-size:14pt;margin:0 0 4pt">${escapar(p.titulo)}</p>
<p style="color:#5e5d57;margin:0 0 12pt">${escapar(`${t.periodo}: ${v['informe.periodo']}`)}${donante ? ` · ${escapar(`${t.para}: ${donante.nombre}`)}` : ''} · ${escapar(`${t.fecha}: ${v['informe.fecha']}`)}</p>
<h2 style="font-size:13pt">${escapar(t.datos)}</h2>
<table>${fila(t.codigo, p.codigo)}${fila(t.pais, v['proyecto.pais'])}${fila(t.lugar, p.lugar)}${fila(t.contraparte, p.contraparte.nombre)}${fila(t.sector, v['proyecto.sector'])}${fila(t.presupuesto, v['proyecto.presupuesto'])}${fila(t.financiado, v['proyecto.financiado'])}${fila(t.inicio, v['proyecto.inicio'])}${fila(t.fin, v['proyecto.fin_previsto'])}</table>
${r.apartados.map((a) => `<h2 style="font-size:13pt">${escapar(a.titulo)}</h2>${parrafos(a.texto)}`).join('\n')}
${fotos.length ? `<h2 style="font-size:13pt">${escapar(t.fotos)}</h2><ul>${fotos.map((f) => `<li><a href="${escapar(f.url)}">${escapar(f.nombre)}</a></li>`).join('')}</ul>` : ''}
<hr>
<div style="color:#5e5d57;font-size:9.5pt">${notas(r, eventos)
    .map((l, i) => (i === 0 ? `<p><b>${escapar(l)}</b></p>` : l ? `<p style="margin:0">${escapar(l)}</p>` : '<p></p>'))
    .join('')}</div>
</body></html>`;
}

// ── Generación ──────────────────────────────────────────────────────────────

export async function generarInforme(codigo: string, o: OpcionesInforme, autor: Persona): Promise<InformeConId> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado');
  if (!p.drive) throw new Error('El proyecto no tiene carpeta en Drive.');
  if (!o.desde || !o.hasta || o.desde > o.hasta) throw new Error('Revisa las fechas del periodo.');

  const plantillas = await listarPlantillas();
  const plantilla = plantillas.find((x) => x.id === o.plantilla);
  if (!plantilla) throw new Error('Elige una plantilla.');

  const datos = await reunirDatos(p, o);
  const eventos = (datos.contexto as { eventos: { id: string; fecha: string; texto: string }[] }).eventos;
  const factor = FACTOR[o.extension];
  const d = await drive();
  const etiqueta = o.tipo === 'final' ? 'final' : 'de seguimiento';
  const nombre = conFecha(`Informe ${etiqueta} ${p.codigo}${datos.donante ? ` - ${datos.donante.nombre}` : ''}`);

  let docId: string;
  let r: Redaccion;
  if (plantilla.id.startsWith('app:')) {
    const pedidos = APARTADOS[o.tipo].map((a) => ({ ...a, palabras: Math.round(a.palabras * factor) }));
    r = await redactarInforme(datos.contexto, pedidos, o.idioma, o.instrucciones);
    docId = (await d.htmlADoc(htmlInforme(datos, r, eventos), p.drive.subcarpetas.informes, nombre)).id;
  } else {
    // Plantilla de Google Docs: copia, lectura de marcadores, redacción y sustitución.
    docId = (await d.copiar(plantilla.id.slice(4), p.drive.subcarpetas.informes, nombre)).id;
    const marcadores = [...new Set([...(await textoDocumento(docId)).matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]))];
    const valores = valoresDatos(datos);
    const pedidos = marcadores.filter((m) => m.trim().toLowerCase().startsWith('ia:')).map((m) => apartadoDeMarcador(m, factor));
    r = await redactarInforme(datos.contexto, pedidos, o.idioma, o.instrucciones);
    const desconocidos = marcadores.filter((m) => !m.trim().toLowerCase().startsWith('ia:') && !(m.trim() in valores));
    if (desconocidos.length) r.pendientes.push(`Marcadores que la app no conoce y se han dejado tal cual: ${desconocidos.map((m) => `{{${m}}}`).join(', ')}`);
    const porClave = new Map(r.apartados.map((a) => [a.clave, a.texto.replace(/\n\s*\n/g, '\n')]));
    const pares: [string, string][] = marcadores.flatMap((m): [string, string][] => {
      const limpio = m.trim();
      if (limpio.toLowerCase().startsWith('ia:')) return [[`{{${m}}}`, porClave.get(apartadoDeMarcador(limpio, factor).clave) ?? '']];
      return limpio in valores ? [[`{{${m}}}`, valores[limpio]]] : [];
    });
    const fotos = datos.fotos.length ? ['', ETIQUETAS[o.idioma].fotos.toUpperCase(), ...datos.fotos.map((f) => `• ${f.nombre}: ${f.url}`)] : [];
    await reemplazar(docId, pares, ['', '', ...fotos, '', ...notas(r, eventos)].join('\n'));
  }

  const pendientes = r.apartados.reduce((s, a) => s + (a.texto.match(/\[PENDIENTE/g)?.length ?? 0), 0);
  const informe: Informe = {
    titulo: nombre,
    tipo: o.tipo,
    plantilla: { id: plantilla.id, nombre: plantilla.nombre },
    desde: o.desde,
    hasta: o.hasta,
    donante: datos.donante ? { id: datos.donante.id, nombre: datos.donante.nombre } : null,
    idioma: o.idioma,
    extension: o.extension,
    docId,
    url: d.urlDocumento(docId),
    estado: 'borrador',
    pendientes,
    resumen: r.resumen,
    hechoPorIA: r.hechoPorIA,
    creado: new Date().toISOString(),
    creadoPor: autor,
  };
  const id = await (await almacen()).crear(`proyectos/${codigo}/informes`, { ...informe });
  await anotarEvento(codigo, {
    tipo: 'sistema',
    autor,
    texto: `Borrador de informe ${etiqueta}${informe.donante ? ` para ${informe.donante.nombre}` : ''} (${plantilla.nombre}). Revísalo y apruébalo antes de enviarlo.`,
    enlaces: [{ texto: 'Abrir en Google Docs', url: informe.url }],
  });
  return { ...informe, id };
}

export async function aprobarInforme(codigo: string, id: string, autor: Persona): Promise<void> {
  const db = await almacen();
  const ruta = `proyectos/${codigo}/informes/${id}`;
  const informe = await db.leer<Informe>(ruta);
  if (!informe) throw new Error('Informe no encontrado');
  await db.guardar(ruta, { estado: 'aprobado', aprobado: new Date().toISOString(), aprobadoPor: autor }, { fusionar: true });
  await anotarEvento(codigo, { tipo: 'sistema', autor, texto: `Informe aprobado: ${informe.titulo}.`, enlaces: [{ texto: 'Abrir', url: informe.url }] });
}
