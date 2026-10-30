// Informes de conjunto, en Google Docs o Slides, redactados con IA:
// - cartera: varios proyectos (desde la página de Proyectos), según estado y país;
// - contraparte: los proyectos de una contraparte (o de todas);
// - donante: lo que ha financiado un donante y cómo van esos proyectos.
// Se guardan en «AD - PROYECTOS / _Informes generales» y en informes/{id}. Como los de
// proyecto, son borradores que un voluntario revisa y aprueba antes de enviarlos.

import { almacen } from '../almacen';
import { drive, conFecha } from '../drive';
import { redactarInforme, type ApartadoPedido } from '../ia';
import { ACTIVOS, ESTADOS } from '../estados';
import { nombrePais } from '../paises';
import { nombreSector } from '../formulario/textos';
import { aportacionesDeDonante } from './aportaciones';
import { leerContraparte } from './contrapartes';
import { leerDonante, TIPOS_DONANTE } from './donantes';
import { listarEventos } from './eventos';
import { leerIndice } from './indice';
import { ES_HOJA } from '../drive/tipos';
import { rellenarLibro, type Celda, type Hoja } from '../drive/sheets';
import { eurDe as eurFila } from '../panel';
import { leerProyecto } from './proyectos';
import { aprobar, contarPendientes, crearArchivoInforme, FACTOR, LOCALE, notasRevision, sinContactos, type EventoContexto, type InformeConId } from './informesComun';
import type { EstadoProyecto, ExtensionInforme, FilaPanel, FormatoInforme, Idioma, Informe, Persona } from '../tipos';

export type TipoInformeGeneral = 'cartera' | 'contraparte' | 'donante';

export interface OpcionesInformeGeneral {
  tipo: TipoInformeGeneral;
  /** La contraparte o el donante (vacío: todas las contrapartes). */
  sobre: string;
  formato: FormatoInforme;
  estados: EstadoProyecto[];
  paises: string[];
  desde: string;
  hasta: string;
  idioma: Idioma;
  extension: ExtensionInforme;
  instrucciones: string;
}

/** Máximo de proyectos que se mandan con detalle a la IA (el resto entra en las cifras). */
const MAX_PROYECTOS = 30;

const APARTADOS: Record<TipoInformeGeneral, ApartadoPedido[]> = {
  cartera: [
    { clave: 'resumen', titulo: 'Resumen', palabras: 120, instruccion: 'Visión general de los proyectos del informe y lo más importante del periodo.' },
    { clave: 'panorama', titulo: 'Panorama', palabras: 150, instruccion: 'Cómo está el conjunto: estados, países, sectores, presupuesto y financiación, con las cifras del JSON.' },
    { clave: 'destacados', titulo: 'Avances destacados', palabras: 180, instruccion: 'Los avances más relevantes del periodo según la cronología de los proyectos.' },
    { clave: 'retos', titulo: 'Retos', palabras: 100, instruccion: 'Incidencias, retrasos y proyectos con financiación pendiente.' },
    { clave: 'proximos', titulo: 'Próximos pasos', palabras: 80, instruccion: 'Lo que viene en los próximos meses.' },
  ],
  contraparte: [
    { clave: 'resumen', titulo: 'Resumen', palabras: 100, instruccion: 'Quién es la contraparte (o las contrapartes) y su relación con Africa Directo.' },
    { clave: 'trayectoria', titulo: 'Proyectos', palabras: 150, instruccion: 'Proyectos realizados y en curso, con sus cifras y estado.' },
    { clave: 'destacados', titulo: 'Avances del periodo', palabras: 150, instruccion: 'Lo más relevante de la cronología del periodo.' },
    { clave: 'retos', titulo: 'Retos', palabras: 80, instruccion: 'Incidencias, retrasos o necesidades pendientes.' },
    { clave: 'proximos', titulo: 'Próximos pasos', palabras: 80, instruccion: 'Lo que viene en los próximos meses.' },
  ],
  donante: [
    { clave: 'resumen', titulo: 'Resumen', palabras: 100, instruccion: 'Qué ha hecho posible el donante con Africa Directo.' },
    { clave: 'impacto', titulo: 'Proyectos e impacto', palabras: 150, instruccion: 'Los proyectos que apoya, a quién benefician y en qué punto están.' },
    { clave: 'destacados', titulo: 'Novedades del periodo', palabras: 150, instruccion: 'Lo más relevante de la cronología del periodo en esos proyectos.' },
    { clave: 'economia', titulo: 'Aportaciones', palabras: 100, instruccion: 'Lo que ha aportado el donante (en euros), a qué proyectos y en qué estado está cada aportación.' },
    { clave: 'agradecimiento', titulo: 'Agradecimiento', palabras: 60, instruccion: 'Agradecimiento en nombre de las contrapartes y de Africa Directo. Recuerda que el 100 % llega.' },
  ],
};

const CARPETAS: Record<TipoInformeGeneral, string> = { cartera: 'Cartera', contraparte: 'Contrapartes', donante: 'Donantes' };
const TITULOS: Record<TipoInformeGeneral, Record<Idioma, string>> = {
  cartera: { es: 'Informe de proyectos', fr: 'Rapport des projets', en: 'Projects report', pt: 'Relatório de projetos' },
  contraparte: { es: 'Informe de contraparte', fr: 'Rapport du partenaire local', en: 'Local partner report', pt: 'Relatório do parceiro local' },
  donante: { es: 'Informe para', fr: 'Rapport pour', en: 'Report for', pt: 'Relatório para' },
};
const T: Record<Idioma, Record<string, string>> = {
  es: { cifras: 'En cifras', proyectos: 'Proyectos', presupuesto: 'Presupuesto', comprometido: 'Comprometido', paises: 'Países', periodo: 'Periodo', fecha: 'Fecha', lista: 'Proyectos del informe', codigo: 'Código', titulo: 'Proyecto', pais: 'País', estado: 'Estado', financiado: 'Financiado', aportado: 'Aportado por el donante', contrapartes: 'Contrapartes' },
  fr: { cifras: 'En chiffres', proyectos: 'Projets', presupuesto: 'Budget', comprometido: 'Engagé', paises: 'Pays', periodo: 'Période', fecha: 'Date', lista: 'Projets du rapport', codigo: 'Code', titulo: 'Projet', pais: 'Pays', estado: 'État', financiado: 'Financé', aportado: 'Apport du donateur', contrapartes: 'Partenaires locaux' },
  en: { cifras: 'Key figures', proyectos: 'Projects', presupuesto: 'Budget', comprometido: 'Committed', paises: 'Countries', periodo: 'Period', fecha: 'Date', lista: 'Projects in this report', codigo: 'Code', titulo: 'Project', pais: 'Country', estado: 'Status', financiado: 'Funded', aportado: 'Donor contribution', contrapartes: 'Local partners' },
  pt: { cifras: 'Em números', proyectos: 'Projetos', presupuesto: 'Orçamento', comprometido: 'Comprometido', paises: 'Países', periodo: 'Período', fecha: 'Data', lista: 'Projetos do relatório', codigo: 'Código', titulo: 'Projeto', pais: 'País', estado: 'Estado', financiado: 'Financiado', aportado: 'Contribuição do doador', contrapartes: 'Parceiros locais' },
};

export async function listarInformesGenerales(tipo: TipoInformeGeneral, sobre?: string): Promise<InformeConId[]> {
  const lista = await (await almacen()).consultar<InformeConId>('informes', { donde: [['tipo', '==', tipo]] });
  return lista.filter((i) => sobre === undefined || (i.sobre?.id ?? '') === sobre).sort((a, b) => b.creado.localeCompare(a.creado));
}


export async function generarInformeGeneral(o: OpcionesInformeGeneral, autor: Persona): Promise<InformeConId> {
  if (o.formato === 'sheets' && o.tipo !== 'cartera') throw new Error('La hoja de cálculo solo está disponible para el informe de proyectos.');
  if (o.formato !== 'sheets' && (!o.desde || !o.hasta || o.desde > o.hasta)) throw new Error('Revisa las fechas del periodo.');
  const indice = await leerIndice();
  const estados = o.estados.length ? o.estados : ACTIVOS;
  let sobre: { id: string; nombre: string } | null = null;
  let filas: FilaPanel[];
  let contextoSobre: object | null = null;
  let aportadoPorProyecto = new Map<string, number>();

  if (o.tipo === 'donante') {
    const donante = await leerDonante(o.sobre);
    if (!donante) throw new Error('Donante no encontrado.');
    sobre = { id: donante.id, nombre: donante.nombre };
    const aps = (await aportacionesDeDonante(donante.id)).filter((a) => a.estado !== 'descartada');
    aportadoPorProyecto = aps.reduce((m, a) => m.set(a.proyecto, (m.get(a.proyecto) ?? 0) + (a.estado === 'comprometida' || a.estado === 'recibida' ? a.importe : 0)), new Map<string, number>());
    filas = indice.filter((f) => aps.some((a) => a.proyecto === f.codigo));
    contextoSobre = { donante: donante.nombre, tipo: TIPOS_DONANTE[donante.tipo], aportaciones: aps.map((a) => ({ proyecto: a.proyectoTitulo || a.proyecto, importeEur: a.importe, estado: a.estado })) };
  } else if (o.tipo === 'contraparte' && o.sobre) {
    const c = await leerContraparte(o.sobre);
    if (!c) throw new Error('Contraparte no encontrada.');
    sobre = { id: c.id, nombre: c.nombre };
    filas = indice.filter((f) => f.contraparteId === c.id && estados.includes(f.estado));
    contextoSobre = { contraparte: c.nombre, tipo: c.tipo, pais: nombrePais(c.pais), proyectosTotales: indice.filter((f) => f.contraparteId === c.id).length };
  } else {
    filas = indice.filter((f) => estados.includes(f.estado) && (!o.paises.length || o.paises.includes(f.pais)));
  }
  if (!filas.length) throw new Error('No hay proyectos que cumplan las condiciones elegidas.');
  if (o.formato === 'sheets') return libroDeProyectos(filas, o, autor);

  // Detalle de cada proyecto (ficha y cronología del periodo), hasta MAX_PROYECTOS.
  const orden = [...filas].sort((a, b) => b.codigo.localeCompare(a.codigo));
  const conDetalle = orden.slice(0, MAX_PROYECTOS);
  const hasta = `${o.hasta}T23:59:59.999Z`;
  const eventos: EventoContexto[] = [];
  const detalle = await Promise.all(
    conDetalle.map(async (f) => {
      const [p, evs] = await Promise.all([leerProyecto(f.codigo), listarEventos(f.codigo, 40)]);
      const delPeriodo = evs
        .filter((e) => e.fecha >= o.desde && e.fecha <= hasta && !['sistema', 'revision', 'solicitud'].includes(e.tipo))
        .slice(0, 8)
        .reverse()
        .map((e) => ({ fecha: e.fecha.slice(0, 10), tipo: e.tipo, categoria: e.categoria ?? '', texto: sinContactos(e.texto).slice(0, 400) }));
      return { f, p, eventos: delPeriodo };
    }),
  );
  let n = 0;
  const proyectosContexto = detalle.map(({ f, p, eventos: evs }) => ({
    codigo: f.codigo,
    titulo: f.titulo,
    pais: nombrePais(f.pais),
    sector: nombreSector(f.sector),
    contraparte: f.contraparte,
    estado: ESTADOS[f.estado].nombre,
    anio: f.anio,
    presupuestoEur: eurFila(f),
    comprometidoEur: f.comprometido,
    aportadoPorElDonanteEur: o.tipo === 'donante' ? (aportadoPorProyecto.get(f.codigo) ?? 0) : undefined,
    descripcion: sinContactos(p?.resumen || p?.descripcion || '').slice(0, 600),
    beneficiarios: sinContactos(p?.beneficiarios || '').slice(0, 200),
    eventos: evs.map((e) => {
      const id = `E${++n}`;
      eventos.push({ id, fecha: e.fecha, texto: `${f.codigo}: ${e.texto}` });
      return { id, ...e };
    }),
  }));

  const presupuesto = filas.reduce((s, f) => s + eurFila(f), 0);
  const comprometido = filas.reduce((s, f) => s + (f.comprometido ?? 0), 0);
  const porEstado = Object.fromEntries([...new Set(filas.map((f) => f.estado))].map((e) => [ESTADOS[e].nombre, filas.filter((f) => f.estado === e).length]));
  const contexto = {
    tipoInforme: { cartera: 'informe de un conjunto de proyectos', contraparte: 'informe sobre una contraparte local', donante: 'informe para un donante sobre lo que financia' }[o.tipo],
    periodo: { desde: o.desde, hasta: o.hasta },
    sobre: contextoSobre,
    cifras: {
      proyectos: filas.length,
      presupuestoEur: presupuesto,
      comprometidoEur: comprometido,
      paises: [...new Set(filas.map((f) => nombrePais(f.pais)))],
      porEstado,
      contrapartes: new Set(filas.map((f) => f.contraparteId)).size,
    },
    proyectos: proyectosContexto,
    proyectosSinDetalle: filas.length - conDetalle.length,
  };

  const factor = FACTOR[o.extension];
  const pedidos = APARTADOS[o.tipo].map((a) => ({ ...a, palabras: Math.round(a.palabras * factor) }));
  // Un apartado por proyecto solo si son pocos; si no, basta con la tabla.
  const porProyecto = o.tipo !== 'cartera' && conDetalle.length <= 12 ? conDetalle.map((f) => f.codigo) : [];
  const r = await redactarInforme(contexto, pedidos, o.idioma, o.instrucciones, { formato: o.formato, porProyecto });
  const notas = notasRevision(r, eventos, filas.length > conDetalle.length ? [`El informe incluye ${filas.length} proyectos; la IA solo ha visto el detalle de los ${MAX_PROYECTOS} más recientes.`] : []);

  // Contenido y archivo.
  const t = T[o.idioma];
  const fecha = (iso: string) => new Date(iso).toLocaleDateString(LOCALE[o.idioma], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
  const euros = (v: number) => new Intl.NumberFormat(LOCALE[o.idioma], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions).format(v);
  const titulo = o.tipo === 'donante' ? `${TITULOS.donante[o.idioma]} ${sobre!.nombre}` : sobre ? `${TITULOS[o.tipo][o.idioma]}: ${sobre.nombre}` : TITULOS[o.tipo][o.idioma];
  const datos: [string, string][] = [
    [t.proyectos, String(filas.length)],
    [t.presupuesto, euros(presupuesto)],
    [t.comprometido, `${euros(comprometido)}${presupuesto ? ` (${Math.round((comprometido / presupuesto) * 100)} %)` : ''}`],
    [t.paises, [...new Set(filas.map((f) => nombrePais(f.pais, o.idioma)))].join(', ')],
    ...(o.tipo === 'cartera' ? ([[t.contrapartes, String(new Set(filas.map((f) => f.contraparteId)).size)]] as [string, string][]) : []),
    ...(o.tipo === 'donante' ? ([[t.aportado, euros([...aportadoPorProyecto.values()].reduce((s, v) => s + v, 0))]] as [string, string][]) : []),
  ];
  const cabecera = [t.titulo, t.pais, t.estado, t.presupuesto, o.tipo === 'donante' ? t.aportado : t.financiado];
  const tabla = [
    cabecera,
    ...orden.map((f) => [
      `${f.titulo || f.codigo} (${f.codigo})`,
      nombrePais(f.pais, o.idioma),
      ESTADOS[f.estado].nombre,
      eurFila(f) ? euros(eurFila(f)) : '—',
      o.tipo === 'donante' ? euros(aportadoPorProyecto.get(f.codigo) ?? 0) : eurFila(f) ? `${Math.round(((f.comprometido ?? 0) / eurFila(f)) * 100)} %` : '—',
    ]),
  ];
  const textos = new Map(r.proyectos.map((x) => [x.codigo, x.texto]));
  const contenido = {
    titulo,
    subtitulo: `${t.periodo}: ${fecha(o.desde)} – ${fecha(o.hasta)} · ${t.fecha}: ${fecha(new Date().toISOString())} · Africa Directo`,
    datos: { titulo: t.cifras, filas: datos },
    apartados: r.apartados.map((a) => ({ titulo: a.titulo, texto: a.texto })),
    tablas: [{ titulo: t.lista, filas: tabla }],
    porProyecto: conDetalle
      .filter((f) => textos.has(f.codigo))
      .map((f) => ({ titulo: f.titulo || f.codigo, detalle: `${f.codigo} · ${nombrePais(f.pais, o.idioma)} · ${ESTADOS[f.estado].nombre}`, texto: textos.get(f.codigo)! })),
    enlaces: null,
    notas,
  };

  const d = await drive();
  const raiz = await d.carpetaHija('_Informes generales', d.raizProyectos);
  const carpeta = await d.carpetaHija(CARPETAS[o.tipo], raiz);
  const clase = o.formato === 'slides' ? 'Presentación' : 'Informe';
  const nombre = conFecha(`${clase} ${CARPETAS[o.tipo].toLowerCase()}${sobre ? ` - ${sobre.nombre}` : ''}`);
  const archivo = await crearArchivoInforme(contenido, o.formato, carpeta, nombre);

  const informe: Informe = {
    titulo: nombre,
    tipo: o.tipo,
    formato: o.formato,
    sobre,
    plantilla: { id: `app:${o.formato}`, nombre: o.formato === 'slides' ? 'Presentación de la app' : 'Documento de la app' },
    desde: o.desde,
    hasta: o.hasta,
    donante: o.tipo === 'donante' ? sobre : null,
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
  const id = await (await almacen()).crear('informes', { ...informe });
  return { ...informe, id };
}

// ── Libro de análisis (Google Sheets) ──────────────────────────────────────

/**
 * Libro de Google Sheets con los proyectos y resúmenes por estado, país, sector, contraparte
 * y año. Los resúmenes son fórmulas sobre la hoja «Proyectos»: si se corrige un dato allí,
 * todo se recalcula. No usa IA. Las fórmulas van en español («;» y nombres en español,
 * salvo COUNTUNIQUE, que en español no se reconoce)
 * porque el libro se configura en español.
 */
async function libroDeProyectos(filas: FilaPanel[], o: OpcionesInformeGeneral, autor: Persona): Promise<InformeConId> {
  const orden = [...filas].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const n = orden.length + 1; // última fila con datos en «Proyectos»
  const fecha = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
  const proyectos: Celda[][] = [
    ['Código', 'Título', 'País', 'Lugar', 'Sector', 'Contraparte', 'Estado', 'Año', 'Presupuesto (€)', 'Comprometido (€)', '% financiado', 'Falta (€)', 'Presupuesto local', 'Moneda local', 'Inicio', 'Última noticia'],
    ...orden.map((f, i) => {
      const r = i + 2;
      return [
        f.codigo,
        f.titulo || `Solicitud de ${f.contraparte}`,
        nombrePais(f.pais),
        f.lugar,
        nombreSector(f.sector),
        f.contraparte,
        ESTADOS[f.estado].nombre,
        f.anio,
        eurFila(f) || null,
        f.comprometido ?? 0,
        `=SI(I${r}>0;J${r}/I${r};"")`,
        `=SI(I${r}>0;MAX(0;I${r}-J${r});"")`,
        f.presupuesto,
        f.moneda,
        fecha(f.inicio),
        fecha(f.ultimaNoticia),
      ];
    }),
  ];
  // Resumen por una columna de «Proyectos» (letra), con fórmulas que se recalculan solas.
  const resumen = (titulo: string, columna: string, valores: (string | number)[]): Hoja => {
    const rango = `Proyectos!$${columna}$2:$${columna}$${n}`;
    return {
      titulo,
      cabecera: true,
      formatos: { 1: 'entero', 2: 'euros', 3: 'euros', 4: 'porcentaje' },
      grafico: { titulo: `Presupuesto (€) ${titulo.toLowerCase()}`, columna: 2 },
      filas: [
        [titulo.replace('Por ', '').replace(/^./, (c) => c.toUpperCase()), 'Proyectos', 'Presupuesto (€)', 'Comprometido (€)', '% financiado'],
        ...valores.map((v, i) => {
          const r = i + 2;
          return [v, `=CONTAR.SI(${rango};A${r})`, `=SUMAR.SI(${rango};A${r};Proyectos!$I$2:$I$${n})`, `=SUMAR.SI(${rango};A${r};Proyectos!$J$2:$J$${n})`, `=SI(C${r}>0;D${r}/C${r};"")`];
        }),
      ],
    };
  };
  const distintos = (fn: (f: FilaPanel) => string | number) =>
    [...new Set(orden.map(fn))].filter((v) => v !== '').sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
  const hoy = new Date().toISOString().slice(0, 10);
  const hojas: Hoja[] = [
    {
      titulo: 'Resumen',
      formatosFila: { 5: 'entero', 6: 'euros', 7: 'euros', 8: 'porcentaje', 9: 'euros', 10: 'entero', 11: 'entero' },
      filas: [
        ['Africa Directo · Análisis de proyectos', ''],
        ['Generado', hoy],
        ['Estados incluidos', (o.estados.length ? o.estados : ACTIVOS).map((e) => ESTADOS[e].nombre).join(', ')],
        ['Países', o.paises.length ? o.paises.map((p) => nombrePais(p)).join(', ') : 'Todos'],
        ['', ''],
        ['Proyectos', `=CONTARA(Proyectos!A2:A${n})`],
        ['Presupuesto (€)', `=SUMA(Proyectos!I2:I${n})`],
        ['Comprometido (€)', `=SUMA(Proyectos!J2:J${n})`],
        ['% financiado', '=SI(B7>0;B8/B7;0)'],
        ['Falta por financiar (€)', `=SUMA(Proyectos!L2:L${n})`],
        ['Países distintos', `=COUNTUNIQUE(Proyectos!C2:C${n})`],
        ['Contrapartes distintas', `=COUNTUNIQUE(Proyectos!F2:F${n})`],
      ],
    },
    { titulo: 'Proyectos', filas: proyectos, cabecera: true, formatos: { 8: 'euros', 9: 'euros', 10: 'porcentaje', 11: 'euros', 12: 'entero' } },
    resumen('Por estado', 'G', distintos((f) => ESTADOS[f.estado].nombre)),
    resumen('Por país', 'C', distintos((f) => nombrePais(f.pais))),
    resumen('Por sector', 'E', distintos((f) => nombreSector(f.sector))),
    resumen('Por contraparte', 'F', distintos((f) => f.contraparte)),
    resumen('Por año', 'H', distintos((f) => f.anio)),
  ];

  const d = await drive();
  const raiz = await d.carpetaHija('_Informes generales', d.raizProyectos);
  const carpeta = await d.carpetaHija(CARPETAS.cartera, raiz);
  const nombre = conFecha('Análisis de proyectos');
  const { id } = await d.crearVacio(nombre, ES_HOJA, carpeta);
  await rellenarLibro(id, hojas);
  const informe: Informe = {
    titulo: nombre,
    tipo: 'cartera',
    formato: 'sheets',
    sobre: null,
    plantilla: { id: 'app:sheets', nombre: 'Hoja de cálculo de la app' },
    desde: hoy,
    hasta: hoy,
    donante: null,
    idioma: 'es',
    extension: 'normal',
    docId: id,
    url: d.urlHoja(id),
    estado: 'borrador',
    pendientes: 0,
    notas: [],
    resumen: `${orden.length} proyectos.`,
    hechoPorIA: false,
    creado: new Date().toISOString(),
    creadoPor: autor,
  };
  const idInforme = await (await almacen()).crear('informes', { ...informe });
  return { ...informe, id: idInforme };
}

export async function aprobarInformeGeneral(id: string, autor: Persona): Promise<void> {
  if (!/^[\w-]+$/.test(id)) throw new Error('Informe no válido');
  await aprobar(`informes/${id}`, autor);
}
