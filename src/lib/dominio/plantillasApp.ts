// Plantillas de la ONG: las crea la app una vez (Administración las pide desde Plantillas) en
// «AD · Plantillas / ONG», como Google Docs y Slides con marcadores. Desde ese momento son
// plantillas como cualquier otra: se editan en Google y sus instrucciones, en la app.
// En demo solo se crean las de Docs, como HTML en el Drive local.

import { modoDemo } from '../config';
import { drive } from '../drive';
import { ES_PRESENTACION } from '../drive/tipos';
import { rellenarPresentacion, type Diapositiva } from '../drive/slides';
import { carpetaPlantillas, listarPlantillas, marcarPorDefecto, registrarPlantilla } from './plantillas';
import type { FormatoPlantilla, InstruccionesPlantilla, Persona, TipoInforme } from '../tipos';

interface Campo {
  clave: string;
  titulo: string;
  instruccion: string;
}

interface Definicion {
  tipo: TipoInforme;
  nombre: string;
  titulo: string;
  subtitulo: string;
  general: string;
  /** Filas de «Datos del proyecto» (etiqueta → marcador). */
  datos: [string, string][];
  campos: Campo[];
  /** Antes de los apartados: una foto de portada. */
  portada?: Campo;
  /** Después de los apartados. */
  fotos?: Campo;
  tablas: { titulo: string; marcador: string; tras?: string }[];
}

const COMUN_PROYECTO: [string, string][] = [
  ['Código', '{{proyecto.codigo}}'],
  ['País', '{{proyecto.pais}}'],
  ['Lugar', '{{proyecto.lugar}}'],
  ['Contraparte', '{{proyecto.contraparte}}'],
  ['Sector', '{{proyecto.sector}}'],
];

export const DEFINICIONES: Definicion[] = [
  {
    tipo: 'seguimiento',
    nombre: 'Informe de seguimiento',
    titulo: 'Informe de seguimiento',
    subtitulo: '{{proyecto.titulo}} · {{informe.periodo}}',
    general:
      'Informe de seguimiento para un donante que ya apoya el proyecto. Cuenta lo ocurrido en el periodo del informe con un tono cercano y profesional, frases claras y sin tecnicismos. Si hay un donante elegido, agradécele su apoyo con naturalidad, sin exagerar.',
    datos: [...COMUN_PROYECTO, ['Presupuesto', '{{proyecto.presupuesto}}'], ['Financiación comprometida', '{{proyecto.financiado}}'], ['Periodo', '{{informe.periodo}}']],
    campos: [
      { clave: 'resumen', titulo: 'Resumen del periodo', instruccion: 'Qué se ha hecho en el periodo y en qué punto está el proyecto, en pocas frases.' },
      { clave: 'actividades', titulo: 'Actividades realizadas', instruccion: 'Avance de las obras o actividades del periodo, con las fechas y cifras que consten.' },
      { clave: 'incidencias', titulo: 'Incidencias', instruccion: 'Problemas o retrasos del periodo y cómo se han resuelto. Si no hubo, dilo en una frase.' },
      { clave: 'economia', titulo: 'Situación económica', instruccion: 'Presupuesto, financiación comprometida, cobrada y enviada a la contraparte, y gastos que consten. Breve.' },
      { clave: 'proximos', titulo: 'Próximos pasos', instruccion: 'Qué falta por hacer y cuándo está previsto. Breve.' },
    ],
    fotos: { clave: 'fotos', titulo: 'Fotos', instruccion: 'Fotos que muestren el avance del periodo; mejor la obra y las actividades que los retratos.' },
    tablas: [],
  },
  {
    tipo: 'final',
    nombre: 'Informe final',
    titulo: 'Informe final',
    subtitulo: '{{proyecto.titulo}} · {{informe.fecha}}',
    general:
      'Informe final para los donantes del proyecto: qué se ha conseguido, para quién y cómo se ha hecho. Es el cierre: mira todo el recorrido del proyecto, no solo el último periodo. Tono cercano y agradecido, con los datos que consten.',
    datos: [...COMUN_PROYECTO, ['Presupuesto', '{{proyecto.presupuesto}}'], ['Inicio', '{{proyecto.inicio}}'], ['Fin previsto', '{{proyecto.fin_previsto}}']],
    campos: [
      { clave: 'resumen', titulo: 'Resumen', instruccion: 'Qué se ha conseguido con el proyecto, en pocas frases.' },
      { clave: 'objetivos', titulo: 'Objetivos y resultados', instruccion: 'Objetivos de la solicitud y resultados alcanzados, con cifras si constan.' },
      { clave: 'beneficiarios', titulo: 'Beneficiarios', instruccion: 'Quiénes y cuántos se benefician, sin nombres de personas.' },
      { clave: 'ejecucion', titulo: 'Desarrollo del proyecto', instruccion: 'Cómo se ha ejecutado: fases, fechas, incidencias y cómo se resolvieron.' },
      { clave: 'economia', titulo: 'Balance económico', instruccion: 'Presupuesto, financiación recibida de cada donante y gastos que consten.' },
      { clave: 'sostenibilidad', titulo: 'Sostenibilidad', instruccion: 'Quién mantiene lo construido o la actividad, y cómo.' },
      { clave: 'agradecimiento', titulo: 'Agradecimiento', instruccion: 'Agradecimiento al donante en nombre de la contraparte y de Africa Directo. Breve.' },
    ],
    fotos: { clave: 'fotos', titulo: 'Fotos', instruccion: 'Fotos del resultado final; si las hay, alguna del antes y el después.' },
    tablas: [{ titulo: 'Aportaciones', marcador: '{{tabla:aportaciones}}', tras: 'economia' }],
  },
  {
    tipo: 'financiacion',
    nombre: 'Presentación para buscar financiación',
    titulo: '{{proyecto.titulo}}',
    subtitulo: 'Presentación del proyecto · Africa Directo',
    general:
      'Presentación del proyecto a un posible donante para pedirle que lo apoye. Tiene que convencer sin exagerar: una necesidad concreta, qué se hará, a quién beneficia y cuánto falta. Tono cálido y directo. En Africa Directo el 100 % de lo donado llega al proyecto: dilo donde encaje.',
    datos: [
      ...COMUN_PROYECTO,
      ['Beneficiarios', '{{proyecto.beneficiarios}}'],
      ['Presupuesto', '{{proyecto.presupuesto}}'],
      ['Ya comprometido', '{{proyecto.financiado}}'],
      ['Falta por financiar', '{{proyecto.falta}}'],
    ],
    portada: { clave: 'portada', titulo: '', instruccion: 'Una foto que muestre la necesidad o el lugar del proyecto.' },
    campos: [
      { clave: 'resumen', titulo: 'El proyecto en breve', instruccion: 'Qué se quiere hacer, dónde, para quién y cuánto cuesta, en pocas frases.' },
      { clave: 'necesidad', titulo: 'La necesidad', instruccion: 'El problema que hay hoy y por qué es urgente, con los datos de la solicitud.' },
      { clave: 'propuesta', titulo: 'Qué vamos a hacer', instruccion: 'Lo que se construirá o hará, el plazo y lo que aporta la comunidad local.' },
      { clave: 'beneficiarios', titulo: 'A quién beneficia', instruccion: 'Quiénes y cuántos se benefician, sin nombres de personas.' },
      { clave: 'contraparte', titulo: 'Quién lo ejecuta', instruccion: 'La contraparte local y su trayectoria con Africa Directo (otros proyectos), si consta.' },
      { clave: 'colaborar', titulo: 'Cómo colaborar', instruccion: 'Presupuesto en euros, lo ya comprometido y lo que falta; cómo puede ayudar el donante.' },
    ],
    tablas: [{ titulo: 'Presupuesto detallado', marcador: '{{tabla:presupuesto}}', tras: 'propuesta' }],
  },
  {
    tipo: 'cartera',
    nombre: 'Informe de varios proyectos',
    titulo: 'Informe de proyectos',
    subtitulo: '{{informe.periodo}}',
    general:
      'Informe de un conjunto de proyectos para la junta o los socios de Africa Directo: visión de conjunto con las cifras, lo más destacado del periodo y los retos. Tono informativo y claro.',
    datos: [],
    campos: [
      { clave: 'resumen', titulo: 'Resumen', instruccion: 'Visión general de los proyectos del informe y lo más importante del periodo.' },
      { clave: 'panorama', titulo: 'Panorama', instruccion: 'Cómo está el conjunto: estados, países, sectores, presupuesto y financiación, con las cifras que constan.' },
      { clave: 'destacados', titulo: 'Avances destacados', instruccion: 'Los avances más relevantes del periodo según la cronología de los proyectos.' },
      { clave: 'retos', titulo: 'Retos', instruccion: 'Incidencias, retrasos y proyectos con financiación pendiente.' },
      { clave: 'proximos', titulo: 'Próximos pasos', instruccion: 'Lo que viene en los próximos meses. Breve.' },
    ],
    tablas: [
      { titulo: 'En cifras', marcador: '{{tabla:cifras}}', tras: 'resumen' },
      { titulo: 'Proyectos del informe', marcador: '{{tabla:proyectos}}' },
    ],
  },
  {
    tipo: 'contraparte',
    nombre: 'Informe sobre una contraparte',
    titulo: 'Informe de contraparte: {{sobre.nombre}}',
    subtitulo: '{{informe.periodo}}',
    general: 'Informe sobre una contraparte local y sus proyectos con Africa Directo: trayectoria, situación de cada proyecto y lo más relevante del periodo. Tono informativo y cercano.',
    datos: [],
    campos: [
      { clave: 'resumen', titulo: 'Resumen', instruccion: 'Quién es la contraparte (o las contrapartes) y su relación con Africa Directo.' },
      { clave: 'proyectos', titulo: 'Proyectos', instruccion: 'Un apartado por proyecto, con su título como subtítulo (###): en qué punto está y lo más relevante, en pocas frases.' },
      { clave: 'destacados', titulo: 'Avances del periodo', instruccion: 'Lo más relevante de la cronología del periodo.' },
      { clave: 'retos', titulo: 'Retos', instruccion: 'Incidencias, retrasos o necesidades pendientes.' },
      { clave: 'proximos', titulo: 'Próximos pasos', instruccion: 'Lo que viene en los próximos meses. Breve.' },
    ],
    tablas: [{ titulo: 'Proyectos del informe', marcador: '{{tabla:proyectos}}' }],
  },
  {
    tipo: 'donante',
    nombre: 'Informe para un donante',
    titulo: 'Informe para {{sobre.nombre}}',
    subtitulo: '{{informe.periodo}}',
    general:
      'Informe para un donante sobre todo lo que financia con Africa Directo: qué ha hecho posible, en qué punto está cada proyecto y lo que ha aportado. Tono cercano y agradecido. En Africa Directo el 100 % de lo donado llega a los proyectos.',
    datos: [],
    campos: [
      { clave: 'resumen', titulo: 'Resumen', instruccion: 'Qué ha hecho posible el donante con Africa Directo.' },
      { clave: 'proyectos', titulo: 'Proyectos e impacto', instruccion: 'Un apartado por proyecto, con su título como subtítulo (###): a quién beneficia y en qué punto está.' },
      { clave: 'destacados', titulo: 'Novedades del periodo', instruccion: 'Lo más relevante de la cronología del periodo en esos proyectos.' },
      { clave: 'economia', titulo: 'Aportaciones', instruccion: 'Lo que ha aportado el donante (en euros), a qué proyectos, y cuánto ha pagado ya.' },
      { clave: 'agradecimiento', titulo: 'Agradecimiento', instruccion: 'Agradecimiento en nombre de las contrapartes y de Africa Directo. Breve.' },
    ],
    tablas: [{ titulo: 'Proyectos que apoya', marcador: '{{tabla:proyectos}}' }],
  },
];

const SLIDES_GENERAL = ' Es una presentación: cada campo va en una diapositiva, con pocas ideas muy breves (una por línea, como viñetas).';

function instrucciones(d: Definicion, formato: FormatoPlantilla): InstruccionesPlantilla {
  const campos = [...d.campos, ...(d.portada ? [d.portada] : []), ...(d.fotos ? [d.fotos] : [])];
  return { general: d.general + (formato === 'slides' ? SLIDES_GENERAL : ''), campos: Object.fromEntries(campos.map((c) => [c.clave, c.instruccion])) };
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const H2 = 'style="font-size:13pt;color:#1f1e1a;margin:14pt 0 4pt"';

/** El documento de la plantilla, en el estilo de los informes de la app. */
export function htmlDePlantilla(d: Definicion): string {
  const apartado = (c: Campo) => {
    const tablas = d.tablas.filter((t) => t.tras === c.clave).map((t) => `<h2 ${H2}>${esc(t.titulo)}</h2><p>${t.marcador}</p>`);
    return `<h2 ${H2}>${esc(c.titulo)}</h2><p>{{ia:${c.clave}}}</p>${tablas.join('')}`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5">
<p style="color:#b8360b;font-weight:bold;margin:0">Africa Directo · el 100 % llega</p>
<h1 style="font-size:20pt;margin:6pt 0 2pt">${esc(d.titulo)}</h1>
<p style="color:#5e5d57;margin:0 0 12pt">${esc(d.subtitulo)}</p>
${d.portada ? `<p>{{foto:${d.portada.clave}}}</p>` : ''}
${d.datos.length ? `<h2 ${H2}>Datos del proyecto</h2><table>${d.datos.map(([k, v]) => `<tr><td style="color:#5e5d57;padding:3pt 16pt 3pt 0">${esc(k)}</td><td style="padding:3pt 0">${v}</td></tr>`).join('')}</table>` : ''}
${d.tablas.filter((t) => t.tras && !d.campos.some((c) => c.clave === t.tras)).map((t) => `<h2 ${H2}>${esc(t.titulo)}</h2><p>${t.marcador}</p>`).join('')}
${d.campos.map(apartado).join('\n')}
${d.tablas.filter((t) => !t.tras).map((t) => `<h2 ${H2}>${esc(t.titulo)}</h2><p>${t.marcador}</p>`).join('')}
${d.fotos ? `<h2 ${H2}>${esc(d.fotos.titulo)}</h2><p>{{fotos:${d.fotos.clave}}}</p>` : ''}
</body></html>`;
}

/** La presentación: portada, datos, una diapositiva por campo, tablas como líneas y una foto. */
export function diapositivasDePlantilla(d: Definicion): Diapositiva[] {
  const lista: Diapositiva[] = [];
  if (d.portada) lista.push({ titulo: d.titulo, foto: `{{foto:${d.portada.clave}}}` });
  if (d.datos.length) lista.push({ titulo: 'Datos del proyecto', tabla: d.datos, cabecera: false });
  for (const c of d.campos) {
    lista.push({ titulo: c.titulo, puntos: [`{{ia:${c.clave}}}`] });
    for (const t of d.tablas.filter((x) => x.tras === c.clave)) lista.push({ titulo: t.titulo, puntos: [t.marcador] });
  }
  for (const t of d.tablas.filter((x) => !x.tras)) lista.push({ titulo: t.titulo, puntos: [t.marcador] });
  if (d.fotos) lista.push({ titulo: d.fotos.titulo, foto: `{{foto:${d.fotos.clave}}}` });
  return lista;
}

/**
 * Crea las plantillas de la ONG que falten (una por tipo y formato), activas y como las
 * propuestas por defecto si no hay otra. Devuelve cuántas ha creado.
 */
export async function crearPlantillasDeLaApp(autor: Persona): Promise<number> {
  const d = await drive();
  const existentes = await listarPlantillas();
  const carpeta = await carpetaPlantillas('ONG');
  const formatos: FormatoPlantilla[] = modoDemo ? ['docs'] : ['docs', 'slides'];
  let creadas = 0;
  for (const def of DEFINICIONES) {
    for (const formato of formatos) {
      if (existentes.some((p) => p.origen === 'app' && p.tipo === def.tipo && p.formato === formato)) continue;
      const nombre = formato === 'slides' ? `${def.nombre} (presentación)` : def.nombre;
      let archivoId: string;
      if (formato === 'docs') archivoId = (await d.htmlADoc(htmlDePlantilla(def), carpeta, nombre)).id;
      else {
        archivoId = (await d.crearVacio(nombre, ES_PRESENTACION, carpeta)).id;
        await rellenarPresentacion(archivoId, { titulo: def.titulo, subtitulo: def.subtitulo }, diapositivasDePlantilla(def));
      }
      const p = await registrarPlantilla(
        archivoId,
        { nombre, descripcion: 'Plantilla de Africa Directo.', tipo: def.tipo, idioma: 'es', donante: null, origen: 'app', estado: 'activa', instrucciones: instrucciones(def, formato) },
        autor,
      );
      if (!existentes.some((x) => x.porDefecto && x.tipo === def.tipo && x.formato === formato)) await marcarPorDefecto(p.id, autor);
      creadas += 1;
    }
  }
  return creadas;
}
