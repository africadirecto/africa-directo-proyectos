// Marcadores de las plantillas de informe y el texto que los sustituye. Sin E/S: lo usan los
// compositores de Docs, Slides y HTML (src/lib/drive/plantilla*.ts) y la sincronización.
//
//   {{proyecto.titulo}}      un dato (espacio.campo)
//   {{ia:avance}}            un texto redactado por la IA (instrucciones en Firestore)
//   {{foto:portada}}         una foto; también en el texto alternativo de una imagen existente
//   {{pie:portada}}          el pie de esa foto
//   {{fotos:galeria}}        varias fotos en una tabla de dos columnas (solo Docs)
//   {{tabla:presupuesto}}    una tabla de datos hecha por la app
//
// Compatibilidad: en {{ia:clave|150 palabras|instrucción}} lo que va tras «|» se conserva en
// `extra` para importarlo una vez como instrucción del campo.

export type TipoMarcador = 'dato' | 'ia' | 'foto' | 'pie' | 'fotos' | 'tabla';

export interface Marcador {
  tipo: TipoMarcador;
  /** En los datos, «espacio.campo»; en el resto, la clave normalizada (minúsculas, sin tildes). */
  clave: string;
  extra?: string;
}

/** Cualquier {{…}} sin llaves dentro. */
export const MARCADOR = /\{\{([^{}]+)\}\}/g;

/** Minúsculas, sin tildes y con «_» en lugar de espacios o guiones. */
export function normalizarClave(clave: string): string {
  return clave
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_#]/g, '');
}

/** Interpreta lo de dentro de {{…}}. Devuelve null si no es un marcador conocido. */
export function leerMarcador(interior: string): Marcador | null {
  const [cabeza, ...resto] = interior.split('|').map((s) => s.trim());
  const m = cabeza.match(/^(ia|foto|pie|fotos|tabla)\s*:\s*(.+)$/i);
  if (m) {
    const clave = normalizarClave(m[2]);
    if (!clave) return null;
    const extra = resto.filter((r) => !/^\d+\s*palabras?$/i.test(r)).join(' ').trim();
    return { tipo: m[1].toLowerCase() as TipoMarcador, clave, ...(extra ? { extra } : {}) };
  }
  const d = cabeza.replace(/\s+/g, '').match(/^([a-z]+)\.([a-z0-9_]+)$/i);
  return d ? { tipo: 'dato', clave: `${d[1]}.${d[2]}`.toLowerCase() } : null;
}

// ── Catálogo ────────────────────────────────────────────────────────────────

/** Para qué informes vale un dato o una tabla: de un proyecto, de conjunto, o los dos. */
export type Ambito = 'proyecto' | 'conjunto' | 'todos';

/** Datos que la app sabe poner. Las cifras van en euros, que es como se financia. */
export const DATOS: Record<string, { descripcion: string; ambito: Ambito }> = {
  'proyecto.codigo': { descripcion: 'Código (P-AAAA-NNN)', ambito: 'proyecto' },
  'proyecto.titulo': { descripcion: 'Título del proyecto', ambito: 'proyecto' },
  'proyecto.sector': { descripcion: 'Sector, en el idioma del informe', ambito: 'proyecto' },
  'proyecto.pais': { descripcion: 'País, en el idioma del informe', ambito: 'proyecto' },
  'proyecto.lugar': { descripcion: 'Lugar', ambito: 'proyecto' },
  'proyecto.contraparte': { descripcion: 'Contraparte local', ambito: 'proyecto' },
  'proyecto.beneficiarios': { descripcion: 'Beneficiarios, según la solicitud', ambito: 'proyecto' },
  'proyecto.estado': { descripcion: 'Estado del proyecto', ambito: 'proyecto' },
  'proyecto.presupuesto': { descripcion: 'Presupuesto en euros', ambito: 'proyecto' },
  'proyecto.presupuesto_local': { descripcion: 'Presupuesto en la moneda de la solicitud', ambito: 'proyecto' },
  'proyecto.moneda': { descripcion: 'Moneda de la solicitud', ambito: 'proyecto' },
  'proyecto.financiado': { descripcion: 'Financiación comprometida', ambito: 'proyecto' },
  'proyecto.recibido': { descripcion: 'Cobrado por Africa Directo', ambito: 'proyecto' },
  'proyecto.enviado': { descripcion: 'Enviado a la contraparte', ambito: 'proyecto' },
  'proyecto.falta': { descripcion: 'Lo que falta por financiar', ambito: 'proyecto' },
  'proyecto.inicio': { descripcion: 'Fecha de inicio de la obra', ambito: 'proyecto' },
  'proyecto.fin_previsto': { descripcion: 'Fecha prevista de fin', ambito: 'proyecto' },
  'conjunto.proyectos': { descripcion: 'Número de proyectos del informe', ambito: 'conjunto' },
  'conjunto.presupuesto': { descripcion: 'Presupuesto total de esos proyectos', ambito: 'conjunto' },
  'conjunto.comprometido': { descripcion: 'Financiación comprometida en total', ambito: 'conjunto' },
  'conjunto.paises': { descripcion: 'Países, separados por comas', ambito: 'conjunto' },
  'conjunto.contrapartes': { descripcion: 'Número de contrapartes', ambito: 'conjunto' },
  'sobre.nombre': { descripcion: 'La contraparte o el donante del informe de conjunto', ambito: 'conjunto' },
  'informe.fecha': { descripcion: 'Fecha del informe', ambito: 'todos' },
  'informe.desde': { descripcion: 'Inicio del periodo', ambito: 'todos' },
  'informe.hasta': { descripcion: 'Fin del periodo', ambito: 'todos' },
  'informe.periodo': { descripcion: 'Periodo («1 de marzo – 30 de junio de 2026»)', ambito: 'todos' },
  'donante.nombre': { descripcion: 'El donante elegido al generar el informe', ambito: 'todos' },
  'donante.importe': { descripcion: 'Lo que ha comprometido ese donante', ambito: 'todos' },
};

/** Tablas que la app sabe hacer, con cifras exactas (no las escribe la IA). */
export const TABLAS: Record<string, { descripcion: string; ambito: Ambito }> = {
  datos: { descripcion: 'Datos principales del proyecto', ambito: 'proyecto' },
  presupuesto: { descripcion: 'Presupuesto detallado de la solicitud', ambito: 'proyecto' },
  aportaciones: { descripcion: 'Aportaciones por donante: comprometido y cobrado', ambito: 'proyecto' },
  envios: { descripcion: 'Envíos a la contraparte, con fecha', ambito: 'proyecto' },
  proyectos: { descripcion: 'Proyectos del informe, con país, estado y financiación', ambito: 'conjunto' },
  cifras: { descripcion: 'Cifras del conjunto: proyectos, presupuesto, comprometido', ambito: 'conjunto' },
};

const DE_PROYECTO = ['seguimiento', 'final', 'financiacion'];
/** Si el dato o la tabla vale para ese tipo de informe. */
export const valeParaTipo = (ambito: Ambito, tipo: string) => ambito === 'todos' || (ambito === 'proyecto') === DE_PROYECTO.includes(tipo);

// ── Texto con formato ───────────────────────────────────────────────────────

export interface Trozo {
  texto: string;
  negrita?: boolean;
  /** Dato que falta: se muestra como «[texto]» resaltado para el revisor. */
  pendiente?: boolean;
}

export interface Parrafo {
  tipo: 'p' | 'li' | 'h';
  trozos: Trozo[];
}

/** Texto de un párrafo, sin formato. */
export const textoParrafo = (p: Parrafo) => p.trozos.map((t) => t.texto).join('');

/**
 * Convierte el Markdown restringido que escribe la IA en párrafos. Es tolerante con lo que
 * los modelos añaden por su cuenta: títulos de cualquier nivel, «*» o «•» como viñeta, listas
 * numeradas, dos espacios al final de línea, cursiva. Quita también las llaves dobles para que
 * un texto nunca cree marcadores nuevos.
 */
export function parsearTexto(md: string): Parrafo[] {
  const parrafos: Parrafo[] = [];
  for (const crudo of md.replace(/\r/g, '').split('\n')) {
    let linea = crudo.replace(/\{\{|\}\}/g, '').trimEnd();
    if (!linea.trim()) continue;
    let tipo: Parrafo['tipo'] = 'p';
    if (/^\s*#{1,6}\s+/.test(linea)) {
      tipo = 'h';
      linea = linea.replace(/^\s*#{1,6}\s+/, '').replace(/\s*#+\s*$/, '');
    } else if (/^\s*([-*•]|\d{1,2}[.)])\s+/.test(linea)) {
      tipo = 'li';
      linea = linea.replace(/^\s*([-*•]|\d{1,2}[.)])\s+/, '');
    }
    const trozos = trozosEnLinea(linea.trim());
    // Un título entero en negrita («**Título**») se queda como título sin más.
    if (tipo === 'h') trozos.forEach((t) => delete t.negrita);
    if (trozos.length) parrafos.push({ tipo, trozos });
  }
  return parrafos;
}

function trozosEnLinea(linea: string): Trozo[] {
  const trozos: Trozo[] = [];
  for (const parte of linea.split(/(\*\*[^*]+\*\*|__[^_]+__|\[PENDIENTE:[^\]]*\])/i)) {
    if (!parte) continue;
    if (/^(\*\*|__)/.test(parte) && parte.length > 4) trozos.push({ texto: limpiar(parte.slice(2, -2)), negrita: true });
    else if (/^\[PENDIENTE:/i.test(parte)) trozos.push({ texto: `[${parte.slice(11, -1).trim()}]`, pendiente: true });
    else trozos.push({ texto: limpiar(parte) });
  }
  return fusionar(trozos);
}

/** Une trozos contiguos sin formato y quita los vacíos. */
function fusionar(trozos: Trozo[]): Trozo[] {
  return trozos.reduce<Trozo[]>((acc, t) => {
    if (!t.texto) return acc;
    const ultimo = acc[acc.length - 1];
    if (ultimo && !ultimo.negrita && !ultimo.pendiente && !t.negrita && !t.pendiente) ultimo.texto += t.texto;
    else acc.push({ ...t });
    return acc;
  }, []);
}

/** Cursiva y código de Markdown que no se usan: se deja solo el texto. */
const limpiar = (t: string) => t.replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=$|[\s.,;:!?)])/g, '$1$2').replace(/`([^`]*)`/g, '$1');

/** Para un marcador dentro de una frase: todo en un solo párrafo, sin títulos ni viñetas. */
export function enUnaLinea(parrafos: Parrafo[]): Parrafo {
  return { tipo: 'p', trozos: fusionar(parrafos.flatMap((p, i) => (i > 0 ? [{ texto: ' ' }, ...p.trozos] : p.trozos))) };
}

// ── Lo que se pone en cada marcador ─────────────────────────────────────────

export interface FotoRelleno {
  /** Dirección que Google puede descargar (en la app, /api/foto/<token>). */
  url: string;
  nombre: string;
  /** Medidas de la foto, para respetar su proporción. */
  ancho?: number;
  alto?: number;
  pie?: string;
}

/** Contenido para rellenar una plantilla. Lo prepara la generación del informe. */
export interface Relleno {
  /** «proyecto.titulo» → texto. Puede llevar [PENDIENTE: …] si el dato falta. */
  datos: Record<string, string>;
  /** «avance» → Markdown restringido (ver parsearTexto). */
  textos: Record<string, string>;
  /** «portada» → fotos (una para {{foto:…}}, varias para {{fotos:…}}). */
  fotos: Record<string, FotoRelleno[]>;
  /** «presupuesto» → filas; la primera es la cabecera. */
  tablas: Record<string, string[][]>;
  /** Tablas sin fila de cabecera (etiqueta → valor). */
  tablasSinCabecera?: string[];
  /** Texto fijo original → traducido, si el informe va en otro idioma que la plantilla. */
  traducciones?: Record<string, string>;
}

export interface ResultadoRelleno {
  /** Marcadores que la app no reconoce o para los que no hay contenido: se quedan resaltados. */
  desconocidos: string[];
  /** Fotos que Google no pudo descargar. */
  fotosFallidas: string[];
}

/**
 * Párrafos para un marcador de texto (dato, IA o pie), o null si no hay contenido para él.
 * Los datos y pies son texto llano (con [PENDIENTE: …] permitido), no Markdown.
 */
export function contenidoDe(m: Marcador, r: Relleno): Parrafo[] | null {
  if (m.tipo === 'ia') return r.textos[m.clave] === undefined ? null : parsearTexto(r.textos[m.clave]);
  if (m.tipo === 'dato') return r.datos[m.clave] === undefined ? null : [{ tipo: 'p', trozos: trozosEnLinea(r.datos[m.clave].replace(/\s*\n\s*/g, ' ')) }];
  if (m.tipo === 'pie') {
    const [clave, n] = m.clave.split('#');
    const foto = r.fotos[clave]?.[Number(n ?? 0)];
    return foto ? [{ tipo: 'p', trozos: [{ texto: foto.pie ?? '' }] }] : null;
  }
  return null;
}

/** Foto que corresponde a un marcador {{foto:clave}} o, en las galerías, {{foto:clave#n}}. */
export function fotoDe(clave: string, r: Relleno): FotoRelleno | null {
  const [c, n] = clave.split('#');
  return r.fotos[c]?.[Number(n ?? 0)] ?? null;
}

/** Texto plano que muestra un marcador que no se pudo rellenar: el revisor lo ve resaltado. */
export function huecoDe(m: Marcador | null, original: string): Parrafo {
  const texto = !m ? original : m.tipo === 'foto' || m.tipo === 'fotos' ? '[foto]' : `[${m.clave.replace(/^[a-z]+\./, '').replace(/_/g, ' ')}]`;
  return { tipo: 'p', trozos: [{ texto, pendiente: true }] };
}
