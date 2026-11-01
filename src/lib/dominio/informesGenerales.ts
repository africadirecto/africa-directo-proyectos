// Informes de conjunto: varios proyectos (cartera), una contraparte o un donante. Aquí se
// eligen los proyectos y se preparan los datos para la IA y para los marcadores; la generación,
// en segundo plano, está en lib/trabajos/informe.ts. El libro de Google Sheets (sin IA) se hace
// aquí mismo.

import { almacen } from '../almacen';
import { drive, conFecha } from '../drive';
import { ACTIVOS, ESTADOS } from '../estados';
import { nombrePais } from '../paises';
import { nombreSector } from '../formulario/textos';
import { aportacionesDeDonante } from './aportaciones';
import { leerContraparte } from './contrapartes';
import { leerDonante, TIPOS_DONANTE } from './donantes';
import { eventosEntre } from './eventos';
import { leerIndice } from './indice';
import { ES_HOJA } from '../drive/tipos';
import { rellenarLibro, type Celda, type Hoja } from '../drive/sheets';
import { eurDe as eurFila } from '../panel';
import { leerProyecto } from './proyectos';
import { sinContactos, type EventoContexto, type InformeConId } from './informesComun';
import { datosDelInforme, ETIQUETAS, formateadores, type ContextoInforme } from './informes';
import type { EstadoProyecto, FilaPanel, Idioma, Informe, Persona } from '../tipos';

export type TipoInformeGeneral = 'cartera' | 'contraparte' | 'donante';

export interface OpcionesConjunto {
  tipo: TipoInformeGeneral;
  /** La contraparte o el donante (vacío: todas las contrapartes). */
  sobre: string;
  estados: EstadoProyecto[];
  paises: string[];
  desde: string;
  hasta: string;
  idioma: Idioma;
}

/** Máximo de proyectos que se mandan con detalle a la IA (el resto entra en las cifras). */
const MAX_PROYECTOS = 30;

const CARPETAS: Record<TipoInformeGeneral, string> = { cartera: 'Cartera', contraparte: 'Contrapartes', donante: 'Donantes' };

export async function listarInformesGenerales(tipo: TipoInformeGeneral, sobre?: string): Promise<InformeConId[]> {
  const lista = await (await almacen()).consultar<InformeConId>('informes', { donde: [['tipo', '==', tipo]] });
  return lista.filter((i) => sobre === undefined || (i.sobre?.id ?? '') === sobre).sort((a, b) => b.creado.localeCompare(a.creado));
}

/** Los proyectos del informe según su tipo y los filtros, y lo que se sabe del donante o la contraparte. */
async function seleccionar(o: Pick<OpcionesConjunto, 'tipo' | 'sobre' | 'estados' | 'paises'>) {
  const indice = await leerIndice();
  const estados = o.estados.length ? o.estados : ACTIVOS;
  let sobre: { id: string; nombre: string } | null = null;
  let filas: FilaPanel[];
  let contextoSobre: object | null = null;
  const aportado = new Map<string, number>();

  if (o.tipo === 'donante') {
    const donante = await leerDonante(o.sobre);
    if (!donante) throw new Error('Donante no encontrado.');
    sobre = { id: donante.id, nombre: donante.nombre };
    const aps = (await aportacionesDeDonante(donante.id)).filter((a) => a.importe > 0);
    for (const a of aps) aportado.set(a.proyecto, (aportado.get(a.proyecto) ?? 0) + a.importe);
    filas = indice.filter((f) => aportado.has(f.codigo));
    contextoSobre = { donante: donante.nombre, tipo: TIPOS_DONANTE[donante.tipo], aportaciones: aps.map((a) => ({ proyecto: a.proyectoTitulo || a.proyecto, comprometidoEur: a.importe, cobradoEur: a.recibido })) };
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
  return { filas, sobre, contextoSobre, aportado };
}

/** El libro de Google Sheets con los proyectos elegidos (sin IA). */
export async function generarHojaDeProyectos(o: Pick<OpcionesConjunto, 'estados' | 'paises'>, autor: Persona): Promise<InformeConId> {
  const { filas } = await seleccionar({ ...o, tipo: 'cartera', sobre: '' });
  return libroDeProyectos(filas, o, autor);
}

export async function contextoConjunto(o: OpcionesConjunto): Promise<ContextoInforme & { sobre: { id: string; nombre: string } | null }> {
  const { filas, sobre, contextoSobre, aportado } = await seleccionar(o);
  // Detalle de cada proyecto (ficha y cronología del periodo), hasta MAX_PROYECTOS.
  const orden = [...filas].sort((a, b) => b.codigo.localeCompare(a.codigo));
  const conDetalle = orden.slice(0, MAX_PROYECTOS);
  const eventos: EventoContexto[] = [];
  const detalle = await Promise.all(
    conDetalle.map(async (f) => {
      const [p, evs] = await Promise.all([leerProyecto(f.codigo), eventosEntre(f.codigo, o.desde, o.hasta, 30)]);
      const delPeriodo = evs
        .filter((e) => !['sistema', 'revision', 'solicitud'].includes(e.tipo))
        .slice(0, 8)
        .reverse()
        .map((e) => ({ fecha: e.fecha.slice(0, 10), tipo: e.tipo, categoria: e.categoria ?? '', texto: sinContactos(e.texto).slice(0, 400) }));
      return { f, p, eventos: delPeriodo };
    }),
  );
  let n = 0;
  const proyectos = detalle.map(({ f, p, eventos: evs }) => ({
    codigo: f.codigo,
    titulo: f.titulo,
    pais: nombrePais(f.pais),
    sector: nombreSector(f.sector),
    contraparte: f.contraparte,
    estado: ESTADOS[f.estado].nombre,
    anio: f.anio,
    presupuestoEur: eurFila(f),
    comprometidoEur: f.comprometido,
    aportadoPorElDonanteEur: o.tipo === 'donante' ? (aportado.get(f.codigo) ?? 0) : undefined,
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
    proyectos,
    proyectosSinDetalle: filas.length - conDetalle.length,
  };

  const t = ETIQUETAS[o.idioma];
  const { dinero } = formateadores(o.idioma);
  const paises = [...new Set(filas.map((f) => nombrePais(f.pais, o.idioma)))].join(', ');
  const aportadoTotal = [...aportado.values()].reduce((s, v) => s + v, 0);
  const datos: Record<string, string> = {
    'conjunto.proyectos': String(filas.length),
    'conjunto.presupuesto': dinero(presupuesto),
    'conjunto.comprometido': dinero(comprometido),
    'conjunto.paises': paises,
    'conjunto.contrapartes': String(new Set(filas.map((f) => f.contraparteId)).size),
    'sobre.nombre': sobre?.nombre ?? '',
    ...datosDelInforme({ idioma: o.idioma, desde: o.desde, hasta: o.hasta, donante: o.tipo === 'donante' && sobre ? { nombre: sobre.nombre, importe: aportadoTotal } : null }),
  };
  const tablas: Record<string, string[][]> = {
    cifras: [
      [t.proyectos, String(filas.length)],
      [t.presupuesto, dinero(presupuesto)],
      [t.comprometido, `${dinero(comprometido)}${presupuesto ? ` (${Math.round((comprometido / presupuesto) * 100)} %)` : ''}`],
      [t.paises, paises],
      ...(o.tipo === 'cartera' ? [[t.contrapartes, datos['conjunto.contrapartes']]] : []),
      ...(o.tipo === 'donante' ? [[t.aportado, dinero(aportadoTotal)]] : []),
    ],
    proyectos: [
      [t.proyecto, t.pais, t.estado, t.presupuesto, o.tipo === 'donante' ? t.aportado : t.financiado],
      ...orden.map((f) => [
        f.titulo ? `${f.titulo} (${f.codigo})` : f.codigo,
        nombrePais(f.pais, o.idioma),
        ESTADOS[f.estado].nombre,
        eurFila(f) ? dinero(eurFila(f)) : '—',
        o.tipo === 'donante' ? dinero(aportado.get(f.codigo) ?? 0) : eurFila(f) ? `${Math.round(((f.comprometido ?? 0) / eurFila(f)) * 100)} %` : '—',
      ]),
    ],
  };

  const d = await drive();
  const raiz = await d.carpetaHija('_Informes generales', d.raizProyectos);
  return {
    contexto,
    eventos,
    datos,
    tablas,
    tablasSinCabecera: ['cifras'],
    carpetaId: await d.carpetaHija(CARPETAS[o.tipo], raiz),
    nombre: `Informe ${CARPETAS[o.tipo].toLowerCase()}${sobre ? ` - ${sobre.nombre}` : ''}`,
    sobre,
  };
}

// ── Libro de análisis (Google Sheets) ──────────────────────────────────────

/**
 * Libro de Google Sheets con los proyectos y resúmenes por estado, país, sector, contraparte
 * y año. Los resúmenes son fórmulas sobre la hoja «Proyectos»: si se corrige un dato allí,
 * todo se recalcula. No usa IA. Las fórmulas van en español («;» y nombres en español,
 * salvo COUNTUNIQUE, que en español no se reconoce)
 * porque el libro se configura en español.
 */
async function libroDeProyectos(filas: FilaPanel[], o: Pick<OpcionesConjunto, 'estados' | 'paises'>, autor: Persona): Promise<InformeConId> {
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
    docId: id,
    url: d.urlHoja(id),
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
