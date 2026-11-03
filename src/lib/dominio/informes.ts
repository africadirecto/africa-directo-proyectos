// Informes de un proyecto (seguimiento, final y financiación): los datos que ve la IA y los que
// van en los marcadores de la plantilla. La generación, en segundo plano, está en
// lib/trabajos/informe.ts.

import { almacen } from '../almacen';
import { ESTADOS } from '../estados';
import { nombrePais } from '../paises';
import { nombreSector } from '../formulario/textos';
import { totalPresupuesto } from '../formulario/respuestas';
import { aportacionesDeProyecto, presupuestoEnEuros, totales } from './aportaciones';
import { eventosEntre } from './eventos';
import { leerIndice } from './indice';
import { leerProyecto } from './proyectos';
import { listarVersiones } from './solicitudes';
import { LOCALE, sinContactos, type EventoContexto, type InformeConId } from './informesComun';
import type { Idioma, Informe, Proyecto } from '../tipos';

export type { InformeConId };

export async function listarInformes(codigo: string): Promise<InformeConId[]> {
  return (await almacen()).consultar<InformeConId>(`proyectos/${codigo}/informes`, { orden: ['creado', 'desc'] });
}

/** Fecha de inicio propuesta: el final del último informe o, si no hay, el inicio del proyecto. */
export function desdePropuesto(p: Proyecto, informes: Informe[]): string {
  return (informes.find((i) => (i.estado ?? 'listo') === 'listo')?.hasta ?? p.fechas.inicio ?? p.fechas.aprobado ?? p.fechas.creado).slice(0, 10);
}

/** Lo que necesita la generación de cualquier informe, de un proyecto o un resumen. */
export interface ContextoInforme {
  /** Tablas que no llevan fila de cabecera (p. ej. «datos», que es etiqueta → valor). */
  tablasSinCabecera: string[];
  /** Lo que ve la IA (sin datos de contacto). */
  contexto: object;
  /** Los eventos con su id (E1…), para mostrar de dónde sale cada campo. */
  eventos: EventoContexto[];
  /** Valor de cada {{espacio.campo}}; vacío si no consta. */
  datos: Record<string, string>;
  /** Cada {{tabla:…}}: filas, la primera es la cabecera. */
  tablas: Record<string, string[][]>;
  /** Carpeta de Drive donde va el informe y nombre del archivo (sin la fecha delante). */
  carpetaId: string;
  nombre: string;
}

// ── Formato ─────────────────────────────────────────────────────────────────

export function formateadores(idioma: Idioma) {
  const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(LOCALE[idioma], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }) : '');
  const dinero = (n: number | null | undefined, moneda = 'EUR') =>
    n == null ? '' : new Intl.NumberFormat(LOCALE[idioma], { style: 'currency', currency: moneda, maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions).format(n);
  const numero = (n: number | null) => (n == null ? '' : new Intl.NumberFormat(LOCALE[idioma], { maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions).format(n));
  return { fecha, dinero, numero };
}

/** Etiquetas de las tablas que hace la app, en el idioma del informe. */
export const ETIQUETAS: Record<Idioma, Record<string, string>> = {
  es: { codigo: 'Código', pais: 'País', lugar: 'Lugar', contraparte: 'Contraparte', sector: 'Sector', presupuesto: 'Presupuesto', financiado: 'Financiación comprometida', falta: 'Falta por financiar', inicio: 'Inicio', fin: 'Fin previsto', concepto: 'Concepto', importe: 'Importe', total: 'Total', donante: 'Donante', comprometido: 'Comprometido', cobrado: 'Cobrado', fecha: 'Fecha', nota: 'Nota', proyecto: 'Proyecto', estado: 'Estado', proyectos: 'Proyectos', paises: 'Países', contrapartes: 'Contrapartes', aportado: 'Aportado por el donante' },
  fr: { codigo: 'Code', pais: 'Pays', lugar: 'Lieu', contraparte: 'Partenaire local', sector: 'Secteur', presupuesto: 'Budget', financiado: 'Financement engagé', falta: 'Reste à financer', inicio: 'Début', fin: 'Fin prévue', concepto: 'Poste', importe: 'Montant', total: 'Total', donante: 'Donateur', comprometido: 'Engagé', cobrado: 'Reçu', fecha: 'Date', nota: 'Note', proyecto: 'Projet', estado: 'État', proyectos: 'Projets', paises: 'Pays', contrapartes: 'Partenaires locaux', aportado: 'Apport du donateur' },
  en: { codigo: 'Code', pais: 'Country', lugar: 'Location', contraparte: 'Local partner', sector: 'Sector', presupuesto: 'Budget', financiado: 'Committed funding', falta: 'Still to fund', inicio: 'Start', fin: 'Planned end', concepto: 'Item', importe: 'Amount', total: 'Total', donante: 'Donor', comprometido: 'Committed', cobrado: 'Received', fecha: 'Date', nota: 'Note', proyecto: 'Project', estado: 'Status', proyectos: 'Projects', paises: 'Countries', contrapartes: 'Local partners', aportado: 'Donor contribution' },
  pt: { codigo: 'Código', pais: 'País', lugar: 'Local', contraparte: 'Parceiro local', sector: 'Setor', presupuesto: 'Orçamento', financiado: 'Financiamento comprometido', falta: 'Falta financiar', inicio: 'Início', fin: 'Fim previsto', concepto: 'Rubrica', importe: 'Montante', total: 'Total', donante: 'Doador', comprometido: 'Comprometido', cobrado: 'Recebido', fecha: 'Data', nota: 'Nota', proyecto: 'Projeto', estado: 'Estado', proyectos: 'Projetos', paises: 'Países', contrapartes: 'Parceiros locais', aportado: 'Contribuição do doador' },
};

/** Datos del informe que no dependen del proyecto: fecha, periodo y donante. */
export function datosDelInforme(o: { idioma: Idioma; desde: string; hasta: string; donante: { nombre: string; importe: number } | null }): Record<string, string> {
  const f = formateadores(o.idioma);
  return {
    'informe.fecha': f.fecha(new Date().toISOString()),
    'informe.desde': f.fecha(o.desde),
    'informe.hasta': f.fecha(o.hasta),
    'informe.periodo': o.desde && o.hasta ? `${f.fecha(o.desde)} – ${f.fecha(o.hasta)}` : '',
    'donante.nombre': o.donante?.nombre ?? '',
    'donante.importe': o.donante ? f.dinero(o.donante.importe) : '',
  };
}

// ── Contexto de un proyecto ─────────────────────────────────────────────────

export interface OpcionesProyecto {
  /** Nombre de la plantilla, para el del documento. */
  plantilla: string;
  desde: string;
  hasta: string;
  donanteId: string;
  idioma: Idioma;
}

export async function contextoProyecto(codigo: string, o: OpcionesProyecto): Promise<ContextoInforme & { donante: { id: string; nombre: string } | null }> {
  const p = await leerProyecto(codigo);
  if (!p) throw new Error('Proyecto no encontrado.');
  if (!p.drive) throw new Error('El proyecto no tiene carpeta en Drive.');
  const [aportaciones, eventos, informes, versiones, indice] = await Promise.all([
    aportacionesDeProyecto(codigo),
    eventosEntre(codigo, o.desde, o.hasta),
    listarInformes(codigo),
    listarVersiones(codigo),
    leerIndice(),
  ]);
  const validas = aportaciones.filter((a) => a.importe > 0);
  const delDonante = validas.filter((a) => a.donanteId === o.donanteId);
  const donante = delDonante.length ? { id: o.donanteId, nombre: delDonante[0].donanteNombre, importe: delDonante.reduce((s, a) => s + a.importe, 0) } : null;
  const { comprometido, recibido, enviado } = totales(aportaciones, p.envios ?? []);
  const objetivo = presupuestoEnEuros(p);

  const delPeriodo = eventos
    .filter((e) => !['sistema', 'revision', 'solicitud', 'informe'].includes(e.tipo))
    .reverse()
    .slice(-80)
    .map((e, i) => ({ id: `E${i + 1}`, fecha: e.fecha.slice(0, 10), tipo: e.tipo, categoria: e.categoria ?? '', texto: sinContactos(e.texto).slice(0, 1500) }));
  const anterior = informes.find((i) => (i.estado ?? 'listo') === 'listo');
  const v = versiones[0];
  const conceptos = v?.analisis?.traduccion?.conceptos ?? [];
  const lineas = (v?.respuestas.lineas ?? []).map((l, i) => ({ concepto: conceptos[i] || l.concepto, importe: l.importe })).filter((l) => l.concepto || l.importe);
  const otros = indice.filter((f) => f.contraparteId === p.contraparte.id && f.codigo !== p.codigo);

  const contexto = {
    periodo: { desde: o.desde, hasta: o.hasta },
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
      enviadoAContraparteEur: enviado,
      faltaEur: objetivo != null ? Math.max(0, objetivo - comprometido) : null,
      plazoMeses: v?.respuestas.plazoMeses ?? null,
      aportacionLocal: sinContactos(v?.analisis?.traduccion?.aportacionLocal || v?.respuestas.aportacionLocal || ''),
      inicio: p.fechas.inicio?.slice(0, 10) ?? null,
      finPrevisto: p.fechas.finPrevisto?.slice(0, 10) ?? null,
    },
    presupuestoDetallado: lineas.length ? { moneda: v?.respuestas.moneda, lineas } : null,
    otrosProyectosDeLaContraparte: otros.map((f) => ({ titulo: f.titulo, estado: ESTADOS[f.estado].nombre, anio: f.anio })),
    financiacion: {
      aportaciones: validas.map((a) => ({ donante: a.donanteNombre, comprometidoEur: a.importe, cobradoEur: a.recibido })),
      enviosAContraparte: (p.envios ?? []).map((e) => ({ fecha: e.fecha, importeEur: e.importe, nota: e.nota })),
    },
    eventos: delPeriodo,
    informeAnterior: anterior ? { fecha: anterior.creado.slice(0, 10), resumen: anterior.resumen } : null,
  };

  const t = ETIQUETAS[o.idioma];
  const f = formateadores(o.idioma);
  const datos: Record<string, string> = {
    'proyecto.codigo': p.codigo,
    'proyecto.titulo': p.titulo,
    'proyecto.sector': nombreSector(p.sector, o.idioma),
    'proyecto.pais': nombrePais(p.pais, o.idioma),
    'proyecto.lugar': p.lugar,
    'proyecto.contraparte': p.contraparte.nombre,
    'proyecto.beneficiarios': sinContactos(p.beneficiarios || ''),
    'proyecto.estado': ESTADOS[p.estado].nombre,
    // La financiación va en euros; el presupuesto local es el de la solicitud.
    'proyecto.presupuesto': f.dinero(objetivo),
    'proyecto.presupuesto_local': f.dinero(p.presupuesto, p.moneda),
    'proyecto.moneda': p.moneda,
    'proyecto.financiado': f.dinero(comprometido),
    'proyecto.recibido': f.dinero(recibido),
    'proyecto.enviado': f.dinero(enviado),
    'proyecto.falta': objetivo != null ? f.dinero(Math.max(0, objetivo - comprometido)) : '',
    'proyecto.inicio': f.fecha(p.fechas.inicio),
    'proyecto.fin_previsto': f.fecha(p.fechas.finPrevisto),
    ...datosDelInforme({ idioma: o.idioma, desde: o.desde, hasta: o.hasta, donante }),
  };
  const tablas: Record<string, string[][]> = {
    datos: [
      [t.codigo, datos['proyecto.codigo']],
      [t.pais, datos['proyecto.pais']],
      [t.lugar, datos['proyecto.lugar']],
      [t.contraparte, datos['proyecto.contraparte']],
      [t.sector, datos['proyecto.sector']],
      [t.presupuesto, datos['proyecto.presupuesto']],
      [t.financiado, datos['proyecto.financiado']],
    ].filter(([, x]) => x),
    ...(lineas.length
      ? { presupuesto: [[t.concepto, `${t.importe} (${v?.respuestas.moneda ?? p.moneda})`], ...lineas.map((l) => [l.concepto, f.numero(l.importe)]), [t.total, f.numero(totalPresupuesto(lineas))]] }
      : {}),
    ...(validas.length ? { aportaciones: [[t.donante, t.comprometido, t.cobrado], ...validas.map((a) => [a.donanteNombre, f.dinero(a.importe), f.dinero(a.recibido)])] } : {}),
    ...(p.envios?.length ? { envios: [[t.fecha, t.importe, t.nota], ...p.envios.map((e) => [f.fecha(e.fecha), f.dinero(e.importe), e.nota ?? ''])] } : {}),
  };
  return {
    contexto,
    eventos: delPeriodo.map((e) => ({ id: e.id, fecha: e.fecha, texto: e.texto })),
    datos,
    tablas,
    tablasSinCabecera: ['datos'],
    carpetaId: p.drive.subcarpetas.informes,
    nombre: `${o.plantilla} ${p.codigo}${donante ? ` - ${donante.nombre}` : ''}`.replace(/\s+/g, ' '),
    donante: donante ? { id: donante.id, nombre: donante.nombre } : null,
  };
}
